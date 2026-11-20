import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { finished } from 'node:stream/promises';
import { logStream, logParameters } from './request-log.js';
import staticFiles from '@fastify/static';
import { fileURLToPath } from 'node:url';
import portalConfig from '../../src/config/portal.json' with { type: 'json' };
import { createPool } from './config/database.js';
import { platformClient } from './platform.js';
import { ApiError, invalid, pageQuery, requireOrigin, roleListQuery, searchQuery } from './http.js';
import * as sourceRepository from './source-repository.js';
import { searchHistory, saveSearch } from './repository.js';
import { roleSummaryCounts, roleThematicDetail, saveRoleThematicTree, thematicRolesFor } from './role-thematic-repository.js';
import { queryReports, paginate, descendants, searchCatalog, searchCategories } from '../../src/lib/portal-model.ts';

const { basePath } = portalConfig;

export async function buildApp({ platform, db = createPool() } = {}) {
  platform ||= platformClient(process.env, db);
  const origin = new URL(process.env.PUBLIC_ORIGIN).origin;
  const rootId = process.env.FINE_ROOT_ID || '';
  const { reportsFor, noticesFor, quickEntries, bootstrapDate } = sourceRepository;
  const stream = logStream(process.env.PORTAL_LOG_FILE);
  const app = Fastify({ logger: { level: 'info', stream, redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers.set-cookie'] },
    disableRequestLogging: true, genReqId: () => randomUUID(), requestIdHeader: false,
    bodyLimit: 524288, requestTimeout: 15000, ajv: { customOptions: { coerceTypes: false, removeAdditional: false } } });
  app.addHook('onClose', () => db.end());
  app.addHook('onClose', async () => { platform.close?.(); });
  if (stream) app.addHook('onClose', async () => { stream.end(); await finished(stream); });
  app.addHook('onRequest', async request => {
    request.log.info({ requestId: request.id, stage: 'received', method: request.method,
      path: request.url.split('?')[0], query: logParameters(request.query),
      cookieNames: (request.headers.cookie || '').split(';').map(item => item.trim().split('=')[0]).filter(Boolean) }, 'request received');
  });
  app.addHook('preValidation', async request => {
    if (request.body !== undefined || Object.keys(request.params || {}).length) request.log.info({ requestId: request.id,
      stage: 'parameters', params: logParameters(request.params), body: logParameters(request.body) }, 'request parameters');
  });
  app.addHook('onSend', async (request, reply) => {
    const path = request.url.split('?')[0];
    const cache = reply.statusCode === 200 && request.routeOptions.url === `${basePath}/*`
      ? path.startsWith(`${basePath}/_next/static/`) ? 'public, max-age=31536000, immutable'
        : path.startsWith(`${basePath}/assets/`) ? 'public, max-age=3600' : 'private, no-store'
      : 'private, no-store';
    reply.header('Cache-Control', cache); reply.header('X-Content-Type-Options', 'nosniff'); reply.header('X-Request-Id', request.id);
  });
  app.addHook('onResponse', async (request, reply) => { app.log.info({ requestId: request.id, route: request.routeOptions.url, method: request.method, status: reply.statusCode, durationMs: reply.elapsedTime }, 'request'); });
  app.setErrorHandler((error, request, reply) => {
    const status = error instanceof ApiError ? error.statusCode : error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : /^[0-9A-Z]{5}$/.test(error.code || '') || ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(error.code) || error.message === 'Query read timeout' ? 503 : 500;
    request.log.error({ requestId: request.id, route: request.routeOptions.url, method: request.method,
      code: error.code, status, reason: error.message, stack: error.stack,
      schema: error.schema, table: error.table, column: error.column, constraint: error.constraint }, 'request failed');
    reply.code(status).send({ success: false, error: { code: error instanceof ApiError ? error.code : status === 400 ? 'INVALID_REQUEST' : status === 503 ? 'DATA_UNAVAILABLE' : 'SERVICE_ERROR', message: error instanceof ApiError ? error.message : status === 400 ? '请求参数不合法' : '服务暂时不可用，请重试' }, requestId: request.id });
  });
  app.setNotFoundHandler((request, reply) => reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: '接口不存在' }, requestId: request.id }));
  app.get('/health', async () => { await db.query('SELECT 1'); return { status: 'ok' }; });
  await app.register(async api => {
    api.decorateRequest('portal', null);
    api.addHook('preHandler', async request => {
      if (request.method === 'POST') requireOrigin(request, origin);
      request.portal = await platform.context(request);
    });
    api.get('/bootstrap', async request => {
      if (Object.keys(request.query).length) throw invalid();
      const context = request.portal;
      const [favoriteIds, links, asOf, thematicRoles] = await Promise.all([
        platform.favorites(context), quickEntries(db), bootstrapDate(db, request.log), thematicRolesFor(db, context),
      ]);
      const tree = rootId && context.ids.has(rootId) ? context.entries.filter(e => e.id === rootId).concat(descendants(context.entries, rootId)) : [];
      return { success: true, data: { user: { name: context.user.name }, rootId, entries: tree, thematicRoles, favoriteIds, quickEntries: links, dataAsOf: asOf, platform: platform.browser } };
    });
    api.get('/reports', async request => {
      const query = pageQuery(request.query, { reports: true });
      return { success: true, data: queryReports(await reportsFor(db, request.portal, true), query) };
    });
    api.get('/workbench', async request => {
      const query = pageQuery(request.query, { workbench: true, defaultSize: 8 });
      const [reports, favorites] = await Promise.all([reportsFor(db, request.portal), query.tab === 'favorites' ? platform.favorites(request.portal) : []]);
      const items = workbenchLists(reports, favorites, query.tab)[query.tab];
      return { success: true, data: paginate(items, query.page, query.pageSize) };
    });
    api.get('/workbench/snapshot', async request => {
      if (Object.keys(request.query).length) throw invalid();
      const [reports, favorites] = await Promise.all([reportsFor(db, request.portal), platform.favorites(request.portal)]);
      return { success: true, data: workbenchLists(reports, favorites) };
    });
    api.get('/search', async request => {
      const { category, q } = searchQuery(request.query, true);
      return { success: true, data: searchCatalog(await reportsFor(db, request.portal), category, q) };
    });
    api.get('/search-history', async request => {
      const { category } = searchQuery(request.query);
      return { success: true, data: await searchHistory(db, request.portal.user.userName, category) };
    });
    api.post('/search-history', { schema: { body: { type: 'object', required: ['category', 'query'], additionalProperties: false, properties: { category: { type: 'string', enum: [...searchCategories] }, query: { type: 'string', minLength: 1, maxLength: 200 } } } } }, async request => {
      if (Object.keys(request.query).length) throw invalid();
      const query = request.body.query.trim().replace(/\s+/g, ' ');
      if (!query) throw invalid();
      return { success: true, data: await saveSearch(db, request.portal.user.userName, request.body.category, query) };
    });
    api.post('/search-history/clear', async request => {
      const { category } = searchQuery(request.query);
      await db.query('DELETE FROM portal_search_history WHERE user_code = $1 AND category = $2', [request.portal.user.userName, category]);
      return { success: true, data: { items: [] } };
    });
    api.get('/notices', async request => {
      const query = pageQuery(request.query, { defaultSize: 5 });
      return { success: true, data: paginate(await noticesFor(db, request.portal), query.page, query.pageSize) };
    });
    api.post('/favorites/:entryId', { schema: { body: { type: 'object', required: ['favorite'], additionalProperties: false, properties: { favorite: { type: 'boolean' } } } } }, async request => {
      if (Object.keys(request.query).length) throw invalid();
      const context = request.portal, id = request.params.entryId;
      const entry = context.entries.find(e => e.id === id && e.type !== 'folder');
      if (!entry) throw new ApiError(404, 'NOT_FOUND', '报表不存在或无权访问');
      const [report = null] = await reportsFor(db, { ...context, ids: new Set(context.ids.has(id) ? [id] : []) });
      if (request.body.favorite && report?.status === 'archived') throw new ApiError(409, 'REPORT_ARCHIVED', '已归档报表不能新增收藏');
      const favorites = await platform.favorites(context);
      if (favorites.includes(id) !== request.body.favorite) await platform.favorite(context, id, request.body.favorite);
      return { success: true, data: { id, favorite: request.body.favorite, report } };
    });
    api.get('/role-thematic/roles', async request => {
      const { page, pageSize, q } = roleListQuery(request.query);
      if (typeof platform.roles !== 'function') throw new ApiError(501, 'NOT_SUPPORTED', '当前平台客户端未启用角色查询');
      const result = await platform.roles(request.portal, { page, count: pageSize, keyword: q });
      const counts = await roleSummaryCounts(db, result.items.map(item => item.id));
      return {
        success: true,
        data: {
          ...result,
          items: result.items.map(item => ({
            ...item,
            configured: counts.has(item.id),
            enabledReportCount: counts.get(item.id)?.enabledReportCount ?? 0,
            totalReportCount: counts.get(item.id)?.totalReportCount ?? 0,
          })),
        },
      };
    });
    api.get('/role-thematic/roles/:roleId', async request => {
      if (Object.keys(request.query).some(key => key !== 'roleName')) throw invalid();
      const roleNameHint = request.query.roleName ?? '';
      if (typeof roleNameHint !== 'string' || roleNameHint.length > 256) throw invalid();
      if (typeof platform.verifyRoleAccess !== 'function') throw new ApiError(501, 'NOT_SUPPORTED', '当前平台客户端未启用角色校验');
      const verifiedRole = await platform.verifyRoleAccess(request.portal, request.params.roleId, roleNameHint.trim());
      return { success: true, data: await roleThematicDetail(db, verifiedRole) };
    });
    api.post('/role-thematic/roles/:roleId/tree', {
      schema: {
        body: {
          type: 'object',
          required: ['nodes'],
          additionalProperties: false,
          properties: {
            roleName: { type: 'string', maxLength: 256 },
            nodes: {
              type: 'array',
              maxItems: 2000,
              items: {
                type: 'object',
                required: ['id', 'parentId', 'nodeType', 'reportId', 'name', 'sort', 'enabled'],
                additionalProperties: false,
                properties: {
                  id: { type: 'string', minLength: 1, maxLength: 128 },
                  parentId: { type: ['string', 'null'], maxLength: 128 },
                  nodeType: { type: 'string', enum: ['folder', 'report'] },
                  reportId: { type: ['string', 'null'], maxLength: 128 },
                  name: { type: 'string', minLength: 1, maxLength: 256 },
                  sort: { type: 'integer', minimum: 0, maximum: 100000 },
                  enabled: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    }, async request => {
      if (Object.keys(request.query).length) throw invalid();
      if (typeof platform.verifyRoleAccess !== 'function') throw new ApiError(501, 'NOT_SUPPORTED', '当前平台客户端未启用角色校验');
      const verifiedRole = await platform.verifyRoleAccess(request.portal, request.params.roleId, (request.body.roleName || '').trim());
      return {
        success: true,
        data: await saveRoleThematicTree(db, {
          role: verifiedRole,
          userName: request.portal.user.userName,
          nodes: request.body.nodes,
        }),
      };
    });
  }, { prefix: `${basePath}/api/portal/v1` });
  app.get(basePath, (request, reply) => reply.redirect(`${basePath}/${request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : ''}`, 308));
  app.get(`${basePath}/role-thematic-config`, (request, reply) => reply.redirect(`${basePath}/role-thematic-config/${request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : ''}`, 308));
  await app.register(staticFiles, { root: fileURLToPath(new URL('../../out/', import.meta.url)), prefix: `${basePath}/`, index: ['index.html'] });
  try { await db.query('SELECT 1'); } catch (error) { await app.close(); throw error; }
  return app;
}

function workbenchLists(reports, favoriteIds, tab) {
  const recent = [], frequent = [], favorites = [];
  const saved = new Set(favoriteIds);
  for (const report of reports) {
    if (report.status !== 'active') continue;
    if ((!tab || tab === 'recent') && report.lastVisitedOn) recent.push(report);
    if ((!tab || tab === 'frequent') && report.visits30d > 0) frequent.push(report);
    if (saved.has(report.id)) favorites.push(report);
  }
  recent.sort((a, b) => b.lastVisitedOn.localeCompare(a.lastVisitedOn) || a.id.localeCompare(b.id));
  frequent.sort((a, b) => b.visits30d - a.visits30d || a.id.localeCompare(b.id));
  return { recent: recent.slice(0, 8), frequent: frequent.slice(0, 8), favorites };
}
