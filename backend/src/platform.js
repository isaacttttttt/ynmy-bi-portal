import { ApiError, cookieToken, publicUrl } from './http.js';

const upstreamError = () => new ApiError(502, 'PLATFORM_UNAVAILABLE', '帆软平台暂时不可用，请重试');
const validId = value => typeof value === 'string' && /^[\w.:-]{1,128}$/.test(value);
export function platformClient(env = process.env) {
  const base = new URL(env.FINE_BASE_URL);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('Invalid FINE_BASE_URL');
  const sessionPath = env.FINE_SESSION_PATH;
  if (!sessionPath?.startsWith('/') || sessionPath.startsWith('//') || sessionPath.includes('?')) throw new Error('FINE_SESSION_PATH must identify the verified session endpoint');
  async function call(token, path, method = 'GET') {
    try {
      const response = await fetch(base.href.replace(/\/$/, '') + path, {
        method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(5000), redirect: 'error',
      });
      if (response.status === 401) throw new ApiError(401, 'SESSION_EXPIRED', '登录已过期，请重新登录');
      if (response.status === 403) throw new ApiError(403, 'FORBIDDEN', '当前账号没有访问权限');
      if (!response.ok) throw upstreamError();
      const text = await response.text();
      if (text.length > 8 * 1024 * 1024) throw upstreamError();
      const body = JSON.parse(text);
      if (!body || body.errorCode || body.success === false || !Object.hasOwn(body, 'data')) throw upstreamError();
      return body.data;
    } catch (error) { if (error instanceof ApiError) throw error; throw upstreamError(); }
  }
  return {
    async context(request) {
      const token = cookieToken(request);
      // Identity is verified upstream; never decode a client JWT or trust userId.
      const user = await call(token, sessionPath);
      if (!user || typeof user.userName !== 'string' || !user.userName || user.userName.length > 128 || typeof user.name !== 'string') throw upstreamError();
      const rows = await call(token, '/v10/view/entry/tree');
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
          ...(type === 'bi' ? { templateId: row.templateId } : {}), ...(type === 'url' ? { url: row.path } : {}) };
      });
      return { token, user, entries, ids };
    },
    async favorites(context) {
      const rows = await call(context.token, '/v10/favorite/entry/list');
      if (!Array.isArray(rows) || rows.some(r => !r || !validId(r.id))) throw upstreamError();
      return [...new Set(rows.map(r => r.id).filter(id => context.ids.has(id)))];
    },
    async favorite(context, id, value) {
      if (await call(context.token, `/v10/favorite/entry/${encodeURIComponent(id)}${value ? '' : '?fakeMethod=DELETE'}`, 'POST') !== 'success') throw upstreamError();
    },
  };
}
