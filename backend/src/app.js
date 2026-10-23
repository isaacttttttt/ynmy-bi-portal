import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import staticFiles from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { createPool } from './config/database.js';
import { platformClient } from './platform.js';
import { ApiError, invalid, pageQuery, requireOrigin } from './http.js';
import { dataAsOf, reportsFor, noticesFor, quickEntries } from './repository.js';
import { queryReports, paginate, descendants } from '../../src/lib/portal-model.ts';

export async function buildApp() {
  const origin = new URL(process.env.PUBLIC_ORIGIN).origin;
  const rootId = process.env.FINE_ROOT_ID;
  if (!rootId) throw new Error('Missing FINE_ROOT_ID');
  const platform = platformClient(), db = createPool();
  const app = Fastify({ logger: { level: 'info', redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers.set-cookie'] },
    disableRequestLogging: true, genReqId: () => randomUUID(), requestIdHeader: false,
    bodyLimit: 16384, requestTimeout: 15000, ajv: { customOptions: { coerceTypes: false, removeAdditional: false } } });
  app.addHook('onClose', () => db.end());
  app.addHook('onSend', async (request, reply) => { reply.header('Cache-Control', 'private, no-store'); reply.header('X-Content-Type-Options', 'nosniff'); reply.header('X-Request-Id', request.id); });
  app.addHook('onResponse', async (request, reply) => { app.log.info({ requestId: request.id, route: request.routeOptions.url, method: request.method, status: reply.statusCode }, 'request'); });
  app.setErrorHandler((error, request, reply) => {
    const status = error instanceof ApiError ? error.statusCode : error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : error.code?.startsWith('ER_') || ['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'PROTOCOL_SEQUENCE_TIMEOUT'].includes(error.code) ? 503 : 500;
    app.log.error({ requestId: request.id, code: error.code, status }, 'request failed');
    reply.code(status).send({ success: false, error: { code: error instanceof ApiError ? error.code : status === 400 ? 'INVALID_REQUEST' : status === 503 ? 'DATA_UNAVAILABLE' : 'SERVICE_ERROR', message: error instanceof ApiError ? error.message : status === 400 ? '请求参数不合法' : '服务暂时不可用，请重试' }, requestId: request.id });
  });
  app.setNotFoundHandler((request, reply) => reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: '接口不存在' }, requestId: request.id }));
  app.get('/health', async () => { await db.query({ sql: 'SELECT 1', timeout: 3000 }); return { status: 'ok' }; });
  await app.register(async api => {
    api.decorateRequest('portal', null);
    api.addHook('preHandler', async request => {
      if (request.method === 'PUT') requireOrigin(request, origin);
      request.portal = await platform.context(request);
    });
    api.get('/bootstrap', async request => {
      if (Object.keys(request.query).length) throw invalid();
      const context = request.portal;
      const [favoriteIds, links, asOf] = await Promise.all([platform.favorites(context), quickEntries(db), dataAsOf(db)]);
      const tree = context.ids.has(rootId) ? context.entries.filter(e => e.id === rootId).concat(descendants(context.entries, rootId)) : [];
      return { success: true, data: { user: { name: context.user.name }, rootId, entries: tree, favoriteIds, quickEntries: links, dataAsOf: asOf } };
    });
    api.get('/reports', async request => {
      const query = pageQuery(request.query, { reports: true });
      return { success: true, data: queryReports(await reportsFor(db, request.portal), query) };
    });
    api.get('/workbench', async request => {
      const query = pageQuery(request.query, { workbench: true, defaultSize: 8 });
      const [reports, favorites] = await Promise.all([reportsFor(db, request.portal), query.tab === 'favorites' ? platform.favorites(request.portal) : []]);
      const items = reports.filter(r => r.status === 'active' && (query.tab === 'favorites' ? favorites.includes(r.id) : query.tab === 'recent' ? r.lastVisitedOn : r.visits30d > 0));
      if (query.tab === 'recent') items.sort((a, b) => b.lastVisitedOn.localeCompare(a.lastVisitedOn) || a.id.localeCompare(b.id));
      if (query.tab === 'frequent') items.sort((a, b) => b.visits30d - a.visits30d || a.id.localeCompare(b.id));
      return { success: true, data: paginate(items, query.page, query.pageSize) };
    });
    api.get('/notices', async request => {
      const query = pageQuery(request.query, { defaultSize: 5 });
      return { success: true, data: paginate(await noticesFor(db, request.portal), query.page, query.pageSize) };
    });
    api.put('/favorites/:entryId', { schema: { body: { type: 'object', required: ['favorite'], additionalProperties: false, properties: { favorite: { type: 'boolean' } } } } }, async request => {
      if (Object.keys(request.query).length) throw invalid();
      const context = request.portal, id = request.params.entryId;
      const entry = context.entries.find(e => e.id === id && e.type !== 'folder');
      if (!entry) throw new ApiError(404, 'NOT_FOUND', '报表不存在或无权访问');
      const report = (await reportsFor(db, context)).find(r => r.id === id) || null;
      if (request.body.favorite && report?.status === 'archived') throw new ApiError(409, 'REPORT_ARCHIVED', '已归档报表不能新增收藏');
      const favorites = await platform.favorites(context);
      if (favorites.includes(id) !== request.body.favorite) await platform.favorite(context, id, request.body.favorite);
      return { success: true, data: { id, favorite: request.body.favorite, report } };
    });
  }, { prefix: '/api/portal/v1' });
  // Only the cloud test environment enables this gateway to the private platform simulator.
  if (process.env.POC_PLATFORM_URL) {
    const simulator = new URL(process.env.POC_PLATFORM_URL);
    app.route({ method: ['GET', 'POST'], url: '/poc/*', handler: async (request, reply) => {
      const path = new URL(request.raw.url, origin);
      const headers = {};
      for (const key of ['cookie', 'origin', 'sec-fetch-site']) if (request.headers[key]) headers[key] = request.headers[key];
      if (request.method === 'POST') headers['content-type'] = 'application/json';
      let response;
      try {
        response = await fetch(new URL(path.pathname + path.search, simulator), {
          method: request.method, headers, redirect: 'error', signal: AbortSignal.timeout(5000),
          ...(request.method === 'POST' ? { body: JSON.stringify(request.body ?? {}) } : {}),
        });
      } catch { throw new ApiError(502, 'PLATFORM_UNAVAILABLE', '测试平台暂时不可用'); }
      for (const key of ['content-type', 'set-cookie']) if (response.headers.has(key)) reply.header(key, response.headers.get(key));
      return reply.code(response.status).send(await response.text());
    } });
    app.get('/poc', (request, reply) => reply.redirect('/poc/'));
  }
  await app.register(staticFiles, { root: fileURLToPath(new URL('../../out/', import.meta.url)), index: ['index.html'] });
  try { await db.query('SELECT 1'); } catch (error) { await app.close(); throw error; }
  return app;
}
