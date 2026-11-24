import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import pg from 'pg';
import { fineDbSchema } from '../src/config/database.js';
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
const schema = fineDbSchema();
const env = { FINE_BASE_URL: `http://127.0.0.1:${upstream.address().port}`, FINE_IDENTITY_MODE: 'trusted-cookie', FINEDB_SCHEMA: schema };
let app;
try {
  const users = (await db.query(`SELECT id::text, username, realname FROM ${schema}.fine_user
    WHERE enable::text IN ('true', 't') AND id IS NOT NULL AND username IS NOT NULL ORDER BY username LIMIT 2`)).rows;
  assert.equal(users.length, 2);
  const platform = platformClient(env, db);
  const request = (id, token = 'test-token') => ({ headers: { cookie: `fine_auth_token=${token}; fine_login_users=${encodeURIComponent(id)}` } });
  for (const user of users) {
    const context = await platform.context(request(user.id));
    assert.equal(context.user.userName, user.username);
    assert.equal(context.user.name, user.realname || user.username);
    assert.deepEqual(context.user.fineUserIds, [user.id]);
    assert.deepEqual([...context.ids], ['report-1']);
  }
  const subject = Buffer.from(JSON.stringify({ sub: users[0].username })).toString('base64url');
  const multiCookie = request([users[1].id, users[0].id].join(','), `test.${subject}.signature`);
  assert.equal((await platform.context(multiCookie, { needTree: false })).user.userName, users[0].username);
  const disabled = (await db.query(`SELECT id::text FROM ${schema}.fine_user WHERE enable::text IN ('false', 'f') LIMIT 1`)).rows[0];
  assert(disabled);
  await assert.rejects(platform.context(request(disabled.id)), { statusCode: 403 });
  await assert.rejects(platform.context(request('__no_such_id__')), { statusCode: 403 });
  await assert.rejects(platform.context(request(users[0].id, 'invalid-token')), { statusCode: 401 });
  await assert.rejects(platform.context({ headers: { cookie: 'fine_auth_token=test-token' } }), { statusCode: 401 });
  await assert.rejects(platform.context({ headers: { cookie: request(users[0].id).headers.cookie + '; fine_login_users=other' } }), { statusCode: 401 });
  Object.assign(process.env, env, { PUBLIC_ORIGIN: 'https://customer.example', FINE_ROOT_ID: 'report-1', PORTAL_DATA_MODEL: 'source' });
  delete process.env.FINE_SESSION_PATH; delete process.env.POC_PLATFORM_URL;
  app = await buildApp({ db: { query: (...args) => db.query(...args), end: async () => {} }, fineDb: db });
  const response = await app.inject({ url: '/portal/api/portal/v1/bootstrap', headers: request(users[0].id).headers });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.user.name, users[0].realname || users[0].username);
  assert(requests.every(path => path === '/v10/view/entry/tree' || path === '/v10/favorite/entry/list'));
  console.log('PASS: FineDB id-to-username mapping, account switching, disabled/missing users, invalid credentials and portal bootstrap.');
} finally { if (app) await app.close(); await new Promise(resolve => upstream.close(resolve)); await db.end(); }
