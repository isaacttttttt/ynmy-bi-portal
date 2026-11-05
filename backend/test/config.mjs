import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { platformClient } from '../src/platform.js';
import { buildApp } from '../src/app.js';

const calls = [];
const server = createServer((req, res) => {
  assert.equal(req.headers.authorization, 'Bearer verified-token');
  calls.push([req.method, req.url]);
  const data = req.url === '/customer/session' ? { userName: 'actual-user', name: 'Test' }
    : req.url === '/customer/tree' ? [{ id: 'report-1', pId: null, text: 'Report', path: 'report.cpt', entryType: 1 }]
    : req.url === '/different/favorites' ? [{ id: 'report-1' }, { id: 'not-granted' }]
    : 'success';
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ data }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const env = { FINE_BASE_URL: base + '/customer', FINE_SESSION_PATH: '/session', FINE_TREE_PATH: '/tree',
  FINE_FAVORITES_PATH: base + '/different/favorites', FINE_FAVORITE_ADD_PATH: '/saved/{entryId}', FINE_FAVORITE_ADD_METHOD: 'PUT',
  FINE_FAVORITE_REMOVE_PATH: '/saved/{entryId}', FINE_FAVORITE_REMOVE_METHOD: 'DELETE', FINE_COOKIE_NAME: 'customer_token',
  FINE_BROWSER_BASE_URL: '/WebReport/ReportServer', FINE_ENTRY_ACCESS_PATH: '/open/{entryId}', FINE_ICON_URL_TEMPLATE: '/files/imgs/{entryId}.png' };
let app;
try {
  const platform = platformClient(env);
  const context = await platform.context({ headers: { cookie: 'customer_token=verified-token' } });
  assert.equal(context.user.userName, 'actual-user');
  assert.equal(context.entries[0].iconUrl, '/files/imgs/report-1.png');
  assert.deepEqual(await platform.favorites(context), ['report-1']);
  await platform.favorite(context, 'report-1', true); await platform.favorite(context, 'report-1', false);
  assert.deepEqual(calls.slice(0,5), [['GET','/customer/session'],['GET','/customer/tree'],['GET','/different/favorites'],['PUT','/customer/saved/report-1'],['DELETE','/customer/saved/report-1']]);
  await assert.rejects(platform.context({ headers: { cookie: 'fine_auth_token=verified-token' } }), { statusCode: 401 });
  assert.throws(() => platformClient({ ...env, FINE_TREE_PATH: '//other.example/tree' }));
  process.env.PUBLIC_ORIGIN = 'https://customer.example'; process.env.FINE_ROOT_ID = 'report-1'; process.env.PORTAL_DATA_MODEL = 'source';
  delete process.env.POC_PLATFORM_URL;
  app = await buildApp({ platform, db: { query: async sql => ({ rows: sql.includes('max(day_id)') ? [{ day: '2026-11-05' }] : [] }), end: async () => {} } });
  const response = await app.inject({ url: '/api/portal/v1/bootstrap', headers: { cookie: 'customer_token=verified-token' } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data.platform, { entryAccessUrl: '/WebReport/ReportServer/open/{entryId}', biServiceName: 'dec.service.frame.tab_pane', biTabType: 'bi.subject.publink' });
  assert(!response.body.includes('verified-token')); assert(!response.body.includes(base));
  console.log('PASS: custom endpoints, methods, cookie, icon template, public runtime config and permission filtering.');
} finally { if (app) await app.close(); await new Promise(resolve => server.close(resolve)); }
