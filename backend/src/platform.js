import { createHash } from 'node:crypto';
import { serialize } from 'node:v8';
import { ApiError, cookieToken, publicUrl } from './http.js';

const upstreamError = () => new ApiError(502, 'PLATFORM_UNAVAILABLE', '帆软平台暂时不可用，请重试');
const validId = value => typeof value === 'string' && /^[\w.:-]{1,128}$/.test(value);
export function platformClient(env = process.env, db) {
  const base = new URL(env.FINE_BASE_URL);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('Invalid FINE_BASE_URL');
  const sessionPath = env.FINE_SESSION_PATH;
  const identityMode = env.FINE_IDENTITY_MODE || 'session';
  if (!['session', 'trusted-cookie'].includes(identityMode)) throw new Error('Invalid FINE_IDENTITY_MODE');
  if (identityMode === 'session' && !sessionPath) throw new Error('FINE_SESSION_PATH must identify the verified session endpoint');
  if (identityMode === 'trusted-cookie' && !db) throw new Error('Database required for trusted-cookie identity');
  const paths = {
    ...(identityMode === 'session' ? { session: sessionPath } : {}),
    tree: env.FINE_TREE_PATH || '/v10/view/entry/tree',
    favorites: env.FINE_FAVORITES_PATH || '/v10/favorite/entry/list',
    add: env.FINE_FAVORITE_ADD_PATH || '/v10/favorite/entry/{entryId}',
    remove: env.FINE_FAVORITE_REMOVE_PATH || '/v10/favorite/entry/{entryId}?fakeMethod=DELETE',
    roles: env.FINE_ROLES_PATH || '/v10/roles',
  };
  for (const [name, path] of Object.entries(paths)) {
    if (!path.startsWith('/') && !/^https?:\/\//.test(path) || path.startsWith('//') || !publicUrl(path)) throw new Error(`Invalid platform endpoint: ${name}`);
  }
  const rolesPrivilegeType = String(env.FINE_ROLES_PRIVILEGE_TYPE ?? '2');
  if (!/^\d{1,10}$/.test(rolesPrivilegeType)) throw new Error('Invalid FINE_ROLES_PRIVILEGE_TYPE');
  for (const name of ['add', 'remove']) if (!paths[name].includes('{entryId}')) throw new Error(`Platform ${name} path requires {entryId}`);
  const addMethod = env.FINE_FAVORITE_ADD_METHOD || 'POST', removeMethod = env.FINE_FAVORITE_REMOVE_METHOD || 'POST';
  if (![addMethod, removeMethod].every(method => ['POST', 'PUT', 'DELETE'].includes(method))) throw new Error('Invalid favorite HTTP method');
  const cookieName = env.FINE_COOKIE_NAME || 'fine_auth_token';
  const userCookieName = env.FINE_USER_COOKIE_NAME || 'fine_login_users';
  if (![cookieName, userCookieName].every(name => /^[\w-]+$/.test(name))) throw new Error('Invalid platform cookie name');
  const browserBase = (env.FINE_BROWSER_BASE_URL || '/webroot/decision').replace(/\/$/, '');
  const accessPath = env.FINE_ENTRY_ACCESS_PATH || '/v10/entry/access/{entryId}';
  const entryAccessUrl = /^https?:\/\//.test(accessPath) ? accessPath : browserBase + accessPath;
  if (!publicUrl(entryAccessUrl) || !entryAccessUrl.includes('{entryId}')) throw new Error('Invalid FINE_ENTRY_ACCESS_PATH');
  const iconTemplate = env.FINE_ICON_URL_TEMPLATE || '';
  if (iconTemplate && (!publicUrl(iconTemplate) || !iconTemplate.includes('{entryId}'))) throw new Error('Invalid FINE_ICON_URL_TEMPLATE');
  const ttlMs = Number(env.FINE_TREE_CACHE_TTL_SECONDS ?? 60) * 1000;
  const maxEntries = Number(env.FINE_TREE_CACHE_MAX_ENTRIES ?? 0);
  const maxBytes = Number(env.FINE_TREE_CACHE_MAX_MB ?? 512) * 1024 * 1024;
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 0 || ttlMs > 2147483647 ||
      !Number.isSafeInteger(maxEntries) || maxEntries < 0 || !Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error('Invalid tree cache limits');
  }
  const trees = new Map(), pendingTrees = new Map(), roleCaches = new Map();
  let cachedBytes = 0;
  async function call(token, path, method = 'GET', log, operation) {
    const started = Date.now();
    try {
      const response = await fetch(/^https?:\/\//.test(path) ? path : base.href.replace(/\/$/, '') + path, {
        method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(5000), redirect: 'error',
      });
      log?.info({ stage: 'platform', operation, method, status: response.status, durationMs: Date.now() - started }, 'platform response');
      if (response.status === 401) throw new ApiError(401, 'SESSION_EXPIRED', '登录已过期，请重新登录');
      if (response.status === 403) throw new ApiError(403, 'FORBIDDEN', '当前账号没有访问权限');
      if (!response.ok) throw upstreamError();
      const text = await response.text();
      if (text.length > 8 * 1024 * 1024) throw upstreamError();
      const body = JSON.parse(text);
      if (!body || body.errorCode || body.success === false || !Object.hasOwn(body, 'data')) throw upstreamError();
      return body.data;
    } catch (error) {
      log?.error({ stage: 'platform', operation, code: error instanceof ApiError ? error.code : 'PLATFORM_UNAVAILABLE' }, 'platform request failed');
      if (error instanceof ApiError) throw error; throw upstreamError();
    }
  }
  function removeTree(key) {
    const entry = trees.get(key);
    if (!entry) return;
    clearTimeout(entry.timer); cachedBytes -= entry.bytes; trees.delete(key);
  }
  async function loadTree(token, log) {
    const rows = await call(token, paths.tree, 'GET', log, 'tree');
    if (!Array.isArray(rows) || rows.length > 10000) throw upstreamError();
    const ids = new Set();
    const entries = rows.map(row => {
      if (!row || !validId(row.id) || ids.has(row.id) || (row.pId !== null && !validId(row.pId)) || typeof row.text !== 'string' || (row.path !== null && typeof row.path !== 'string')) throw upstreamError();
      ids.add(row.id);
      const path = row.path?.toLowerCase() || '';
      const type = String(row.entryType) === '5' ? 'url' : row.path === null ? 'folder' : /\.fvs(?:$|[?/#])/.test(path) ? 'fvs' : /\.frm(?:$|[?/#])/.test(path) ? 'frm' : /\.cpt(?:$|[?/#])/.test(path) ? 'cpt' : 'bi';
      if (type === 'bi' && !validId(row.templateId)) throw upstreamError();
      if (type === 'url' && !publicUrl(row.path)) throw upstreamError();
      return { id: row.id, parentId: row.pId, name: row.text, type, sort: Number(row.sortIndex) || 0,
        ...(type === 'bi' ? { templateId: row.templateId } : {}), ...(type === 'url' ? { url: row.path } : {}),
        ...(iconTemplate ? { iconUrl: iconTemplate.replaceAll('{entryId}', encodeURIComponent(row.id)) } : {}) };
    });
    return { entries, ids };
  }
  async function permissionTree(token, log) {
    const key = createHash('sha256').update(token).digest('hex');
    const cached = trees.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      trees.delete(key); trees.set(key, cached);
      log?.info({ stage: 'tree-cache', result: 'hit', sessions: trees.size, serializedBytes: cachedBytes }, 'tree cache');
      return cached.value;
    }
    removeTree(key);
    if (pendingTrees.has(key)) {
      log?.info({ stage: 'tree-cache', result: 'shared' }, 'tree cache');
      return pendingTrees.get(key);
    }
    log?.info({ stage: 'tree-cache', result: 'miss' }, 'tree cache');
    const pending = loadTree(token, log).then(value => {
      if (!ttlMs) return value;
      // Serialized size is a retention budget, not a limit on V8 heap or request working memory.
      const bytes = serialize(value).byteLength;
      if (bytes > maxBytes) {
        log?.info({ stage: 'tree-cache', result: 'oversized', serializedBytes: bytes }, 'tree cache');
        return value;
      }
      while ((maxEntries > 0 && trees.size >= maxEntries) || cachedBytes + bytes > maxBytes) removeTree(trees.keys().next().value);
      const timer = setTimeout(removeTree, ttlMs, key); timer.unref();
      trees.set(key, { value, bytes, expiresAt: Date.now() + ttlMs, timer }); cachedBytes += bytes;
      log?.info({ stage: 'tree-cache', result: 'stored', sessions: trees.size, serializedBytes: cachedBytes }, 'tree cache');
      return value;
    }).finally(() => pendingTrees.delete(key));
    pendingTrees.set(key, pending);
    return pending;
  }
  function removeRoleCache(key) {
    const entry = roleCaches.get(key);
    if (!entry) return;
    clearTimeout(entry.timer); roleCaches.delete(key);
  }
  function rememberRoles(token, items) {
    if (!ttlMs || !items.length) return;
    const key = createHash('sha256').update(token).digest('hex');
    const now = Date.now();
    let entry = roleCaches.get(key);
    if (!entry || entry.expiresAt <= now) {
      removeRoleCache(key);
      if (roleCaches.size >= 1000) removeRoleCache(roleCaches.keys().next().value);
      const timer = setTimeout(removeRoleCache, ttlMs, key); timer.unref();
      entry = { map: new Map(), expiresAt: now + ttlMs, timer };
      roleCaches.set(key, entry);
    }
    for (const role of items) entry.map.set(role.id, role);
  }
  function cachedRole(token, roleId) {
    const key = createHash('sha256').update(token).digest('hex');
    const entry = roleCaches.get(key);
    if (!entry || entry.expiresAt <= Date.now()) { removeRoleCache(key); return null; }
    return entry.map.get(roleId) || null;
  }
  async function fetchRoles(token, { page = 1, count = 15, keyword = '' } = {}, log) {
    const sep = paths.roles.includes('?') ? '&' : '?';
    const qs = `page=${page}&keyword=${encodeURIComponent(keyword)}&count=${count}&privilegeType=${rolesPrivilegeType}&_=${Date.now()}`;
    const data = await call(token, `${paths.roles}${sep}${qs}`, 'GET', log, 'roles');
    if (!data || !Array.isArray(data.items) || data.items.length > 500) throw upstreamError();
    const items = data.items.map(row => {
      if (!row || !validId(row.id) || typeof row.text !== 'string') throw upstreamError();
      return { id: row.id, name: row.text, description: typeof row.description === 'string' ? row.description : '' };
    });
    rememberRoles(token, items);
    return {
      page: Number.isInteger(data.page) && data.page > 0 ? data.page : page,
      pageSize: count,
      hasNext: Boolean(data.hasNext),
      items,
    };
  }
  return {
    close() { for (const key of trees.keys()) removeTree(key); for (const key of roleCaches.keys()) removeRoleCache(key); },
    browser: { entryAccessUrl, biServiceName: env.FINE_BI_SERVICE_NAME || 'dec.service.frame.tab_pane', biTabType: env.FINE_BI_TAB_TYPE || 'bi.subject.publink' },
    async context(request) {
      const log = request.log?.child({ requestId: request.id });
      log?.info({ stage: 'identity', mode: identityMode, tokenCookie: cookieName, userCookie: userCookieName }, 'resolving identity');
      const token = cookieToken(request, cookieName);
      const identity = identityMode === 'trusted-cookie' ? platformIdentity(token, cookieToken(request, userCookieName)) : null;
      log?.info({ stage: 'identity', mode: identityMode, candidateCount: identity?.ids.length }, 'identity parsed');
      let user = identityMode === 'session' ? await call(token, paths.session, 'GET', log, 'session') : null;
      const { entries, ids } = await permissionTree(token, log);
      if (identityMode === 'trusted-cookie') {
        // The trusted gateway must validate both cookies and their user binding before proxying here.
        const { rows: users } = await db.query(`SELECT DISTINCT username AS "userName", coalesce(nullif(realname,''),username) AS name
          FROM dim_bi_user WHERE id=ANY($1::text[]) AND enable='true'
            AND ($2::text IS NULL OR username=$2) LIMIT 2`, [identity.ids, identity.username]);
        log?.info({ stage: 'identity', matchedUsers: users.length, username: users.length === 1 ? users[0].userName : undefined }, 'identity lookup');
        if (users.length !== 1) throw new ApiError(403, 'USER_UNAVAILABLE', '平台用户未同步或已停用');
        user = users[0];
      }
      if (!user || typeof user.userName !== 'string' || !user.userName || user.userName.length > 128 || typeof user.name !== 'string') throw upstreamError();
      return { token, user, entries, ids, log };
    },
    async favorites(context) {
      const rows = await call(context.token, paths.favorites, 'GET', context.log, 'favorites');
      if (!Array.isArray(rows) || rows.some(r => !r || !validId(r.id))) throw upstreamError();
      return [...new Set(rows.map(r => r.id).filter(id => context.ids.has(id)))];
    },
    async favorite(context, id, value) {
      if (await call(context.token, (value ? paths.add : paths.remove).replaceAll('{entryId}', encodeURIComponent(id)), value ? addMethod : removeMethod, context.log, value ? 'favorite-add' : 'favorite-remove') !== 'success') throw upstreamError();
    },
    async roles(context, options) {
      return fetchRoles(context.token, options, context.log);
    },
    async verifyRoleAccess(context, roleId, roleNameHint = '') {
      if (!validId(roleId)) throw new ApiError(400, 'INVALID_REQUEST', '角色 ID 不合法');
      const hit = cachedRole(context.token, roleId);
      if (hit) return hit;
      if (roleNameHint) {
        const searched = await fetchRoles(context.token, { page: 1, count: 50, keyword: roleNameHint }, context.log);
        const found = searched.items.find(item => item.id === roleId);
        if (found) return found;
      }
      for (let page = 1; page <= 20; page++) {
        const listed = await fetchRoles(context.token, { page, count: 50, keyword: '' }, context.log);
        const found = listed.items.find(item => item.id === roleId);
        if (found) return found;
        if (!listed.hasNext) break;
      }
      throw new ApiError(403, 'FORBIDDEN', '当前账号没有该角色的配置权限');
    },
  };
}

function platformIdentity(token, cookie) {
  const ids = [...new Set(cookie.split(',').map(id => id.trim()))];
  if (ids.some(id => !id || id.length > 1024 || /[\x00-\x1f\x7f]/.test(id))) {
    throw new ApiError(401, 'INVALID_IDENTITY', '平台用户标识格式无效');
  }
  if (ids.length === 1) return { ids, username: null };
  // The gateway verifies the token. Its subject selects the current account from the remembered ID list.
  let username;
  try { username = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sub; }
  catch { throw new ApiError(401, 'INVALID_IDENTITY', '平台包含多个用户，但无法解析当前登录账号'); }
  if (typeof username !== 'string' || !username || username.length > 1024) {
    throw new ApiError(401, 'INVALID_IDENTITY', '平台包含多个用户，但缺少当前登录账号');
  }
  return { ids, username };
}
