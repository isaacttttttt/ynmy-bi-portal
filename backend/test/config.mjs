import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { platformClient } from '../src/platform.js';
import { buildApp } from '../src/app.js';
import { readdir } from 'node:fs/promises';

const calls = [];
const server = createServer((req, res) => {
  assert.equal(req.headers.authorization, 'Bearer verified-token');
  let rawBody = '';
  req.on('data', chunk => { rawBody += chunk; });
  req.on('end', () => {
    calls.push([req.method, req.url, req.headers['content-type'] || '', req.headers['x-requested-with'] || '', rawBody, req.headers.cookie || '']);
    const data = req.url === '/customer/session' ? { userName: 'actual-user', name: 'Test' }
      : req.url === '/customer/tree' ? [{ id: 'report-1', pId: null, text: 'Report', path: 'report.cpt', entryType: 1 }]
      : req.url === '/different/favorites' ? [{ id: 'report-1' }, { id: 'not-granted' }]
      : 'success';
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ data }));
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const env = { FINE_BASE_URL: base + '/customer', FINE_SESSION_PATH: '/session', FINE_TREE_PATH: '/tree',
  FINE_FAVORITES_PATH: base + '/different/favorites', FINE_FAVORITE_ADD_PATH: '/saved/{entryId}', FINE_FAVORITE_ADD_METHOD: 'PUT',
  FINE_FAVORITE_REMOVE_PATH: '/saved/{entryId}', FINE_FAVORITE_REMOVE_METHOD: 'DELETE', FINE_COOKIE_NAME: 'customer_token',
  FINE_BROWSER_BASE_URL: '/WebReport/ReportServer', FINE_ENTRY_ACCESS_PATH: '/open/{entryId}', FINE_ICON_URL_TEMPLATE: '/files/imgs/{entryId}.png' };
const db = {
  async query(sql) {
    assert.doesNotMatch(sql, /\bdim_bi_user\b/, 'Portal identity must not query the business user dimension');
    return { rows: sql.includes('max(day_id)') ? [{ day: '2026-11-05' }] : [] };
  },
  async end() {},
};
let app;
try {
  const platform = platformClient(env);
  const context = await platform.context({ headers: { cookie: 'customer_token=verified-token' } });
  assert.equal(context.user.userName, 'actual-user');
  assert.equal(context.entries[0].iconUrl, '/files/imgs/report-1.png');
  assert.deepEqual(await platform.favorites(context), ['report-1']);
  await platform.favorite(context, 'report-1', true); await platform.favorite(context, 'report-1', false);
  assert.deepEqual(calls.slice(0,5).map(([m, u]) => [m, u]), [['GET','/customer/session'],['GET','/customer/tree'],['GET','/different/favorites'],['PUT','/customer/saved/report-1'],['DELETE','/customer/saved/report-1']]);
  // Verify favorite mutations send JSON content-type, X-Requested-With, Cookie, and {} body (matching FineBI platform HAR)
  for (const [, , contentType, xrw, body, cookie] of calls.slice(3, 5)) {
    assert.equal(contentType, 'application/json');
    assert.equal(xrw, 'XMLHttpRequest');
    assert.equal(body, '{}');
    assert.equal(cookie, 'customer_token=verified-token');
  }
  // Verify legacy POST + ?fakeMethod=DELETE config auto-normalizes to DELETE without fakeMethod query param
  const legacyClient = platformClient({
    ...env,
    FINE_FAVORITE_REMOVE_PATH: '/saved/{entryId}?fakeMethod=DELETE',
    FINE_FAVORITE_REMOVE_METHOD: 'POST',
  });
  calls.length = 0;
  await legacyClient.favorite(context, 'report-1', false);
  assert.deepEqual(calls.map(([m, u]) => [m, u]), [['DELETE', '/customer/saved/report-1']]);
  assert.equal(calls[0][4], '{}');
  await assert.rejects(platform.context({ headers: { cookie: 'fine_auth_token=verified-token' } }), { statusCode: 401 });
  assert.throws(() => platformClient({ ...env, FINE_TREE_PATH: '//other.example/tree' }));
  process.env.PUBLIC_ORIGIN = 'https://customer.example'; process.env.FINE_ROOT_ID = 'report-1';
  process.env.POC_PLATFORM_URL = 'http://127.0.0.1:1';
  app = await buildApp({ platform, db });
  const response = await app.inject({ url: '/portal/api/portal/v1/bootstrap', headers: { cookie: 'customer_token=verified-token' } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data.user, { name: 'Test' });
  assert.deepEqual(response.json().data.platform, { entryAccessUrl: '/WebReport/ReportServer/open/{entryId}', biServiceName: 'dec.service.frame.tab_pane', biTabType: 'bi.subject.publink' });
  assert(!response.body.includes('verified-token')); assert(!response.body.includes(base));
  const redirect = await app.inject('/portal?q=hello');
  assert.equal(redirect.statusCode, 308);
  assert.equal(redirect.headers.location, '/portal/?q=hello');
  const chunk = (await readdir(new URL('../../out/_next/static/chunks/', import.meta.url))).find(file => file.endsWith('.js'));
  for (const [url, cache] of [
    ['/portal/', 'private, no-store'],
    ['/portal/report-dictionary/', 'private, no-store'],
    ['/portal/assets/company_title.png', 'public, max-age=3600'],
    ['/portal/assets/yunnan_baiyao.svg', 'public, max-age=3600'],
    [`/portal/_next/static/chunks/${chunk}`, 'public, max-age=31536000, immutable'],
  ]) {
    const resource = await app.inject(url);
    assert.equal(resource.statusCode, 200, url);
    assert.equal(resource.headers['cache-control'], cache, url);
  }
  for (const url of ['/', '/poc', '/poc/', '/poc/login', '/assets/company_title.png', '/api/portal/v1/bootstrap', '/portal/api/portal/v1/missing']) {
    assert.equal((await app.inject(url)).statusCode, 404, url);
  }
  assert.equal((await app.inject({ method: 'POST', url: '/poc/login', payload: {} })).statusCode, 404);
  await app.close();
  app = null;

  Object.assign(process.env, env, { FINE_IDENTITY_MODE: 'trusted-cookie', FINEDB_SCHEMA: 'fixture_finedb' });
  const fineDb = {
    async query(sql, params) {
      if (sql === 'SELECT 1' || sql.includes('fixture_finedb.fine_user_role_middle')) return { rows: [] };
      assert.match(sql, /FROM fixture_finedb\.fine_user\b/);
      assert.deepEqual(params, [['fine-user-id'], null]);
      return { rows: [{ id: 'fine-user-id', userName: 'new-fine-user', name: 'FineDB New User' }] };
    },
  };
  app = await buildApp({ db, fineDb });
  calls.length = 0;
  const realtimeUser = await app.inject({ url: '/portal/api/portal/v1/bootstrap', headers: {
    cookie: 'customer_token=verified-token; fine_login_users=fine-user-id',
  } });
  assert.equal(realtimeUser.statusCode, 200, realtimeUser.body);
  assert.deepEqual(realtimeUser.json().data.user, { name: 'FineDB New User' });
  assert.deepEqual(calls.map(([m, u]) => [m, u]), [['GET', '/customer/tree'], ['GET', '/different/favorites']]);
  console.log('PASS: custom endpoints, cookie, icon template, session and FineDB identities, base path and permission filtering.');
} finally { if (app) await app.close(); await new Promise(resolve => server.close(resolve)); }
