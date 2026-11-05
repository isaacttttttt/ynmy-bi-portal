import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import pg from 'pg';
import { platformClient } from '../src/platform.js';
import { buildApp } from '../src/app.js';

const db = new pg.Client({ connectionString: process.env.SOURCE_TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const requests = [];
const upstream = createServer((req, res) => {
  requests.push(req.url);
  if (req.headers.authorization !== 'Bearer test-token') { res.writeHead(401); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ data: [{ id: 'report-1', pId: null, text: 'Report', path: 'report.cpt' }] }));
});
await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
const env = { FINE_BASE_URL: `http://127.0.0.1:${upstream.address().port}`, FINE_IDENTITY_MODE: 'trusted-cookie' };
let app;
try {
  const users = (await db.query("SELECT id,username,realname FROM dim_bi_user WHERE enable='true' AND id IS NOT NULL AND username IS NOT NULL LIMIT 2")).rows;
  assert.equal(users.length, 2);
  const platform = platformClient(env, db);
  const request = (id, token = 'test-token') => ({ headers: { cookie: `fine_auth_token=${token}; fine_login_users=${encodeURIComponent(id)}` } });
  for (const user of users) {
    const context = await platform.context(request(user.id));
    assert.equal(context.user.userName, user.username);
    assert.equal(context.user.name, user.realname || user.username);
    assert.deepEqual([...context.ids], ['report-1']);
  }
  const disabled = (await db.query("SELECT id FROM dim_bi_user WHERE enable='false' LIMIT 1")).rows[0];
  assert(disabled);
  await assert.rejects(platform.context(request(disabled.id)), { statusCode: 403 });
  await assert.rejects(platform.context(request('__no_such_id__')), { statusCode: 403 });
  await assert.rejects(platform.context(request(users[0].id, 'invalid-token')), { statusCode: 401 });
  await assert.rejects(platform.context({ headers: { cookie: 'fine_auth_token=test-token' } }), { statusCode: 401 });
  await assert.rejects(platform.context({ headers: { cookie: request(users[0].id).headers.cookie + '; fine_login_users=other' } }), { statusCode: 401 });
  Object.assign(process.env, env, { PUBLIC_ORIGIN: 'https://customer.example', FINE_ROOT_ID: 'report-1', PORTAL_DATA_MODEL: 'source' });
  delete process.env.FINE_SESSION_PATH; delete process.env.POC_PLATFORM_URL;
  app = await buildApp({ db: { query: (...args) => db.query(...args), end: async () => {} } });
  const response = await app.inject({ url: '/api/portal/v1/bootstrap', headers: request(users[0].id).headers });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.user.name, users[0].realname || users[0].username);
  assert(requests.every(path => path === '/v10/view/entry/tree' || path === '/v10/favorite/entry/list'));
  console.log('PASS: real PG id-to-username mapping, account switching, disabled/missing users, missing/duplicate cookies, invalid token, bootstrap without session endpoint.');
} finally { if (app) await app.close(); await new Promise(resolve => upstream.close(resolve)); await db.end(); }
