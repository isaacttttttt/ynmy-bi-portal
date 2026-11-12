// Run against an isolated copy of the supplied customer PG dump. BI alone is replaced by an HTTP fixture.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { buildApp } from '../src/app.js';
import { platformClient } from '../src/platform.js';

const db = new pg.Client({ connectionString: process.env.SOURCE_TEST_DATABASE_URL });
await db.connect();
const dir = await mkdtemp(join(tmpdir(), 'portal-customer-'));
const logFile = join(dir, 'portal.log');
let app, upstream;
try {
  await db.query('BEGIN');
  const { rows: [user] } = await db.query(`SELECT u.id,u.username FROM dim_bi_user u
    WHERE u.enable='true' AND u.id<>u.username AND EXISTS
      (SELECT 1 FROM dim_bi_visit_log v JOIN dim_bi_report_info_dtl r USING(report_id)
       WHERE v.user_code=u.username) LIMIT 1`);
  assert(user, 'Need a user with username-based visit logs');
  const { rows: [other] } = await db.query("SELECT id,username FROM dim_bi_user WHERE enable='true' AND id<>$1 LIMIT 1", [user.id]);
  const { rows: entries } = await db.query(`SELECT DISTINCT v.report_id AS id FROM dim_bi_visit_log v
    JOIN dim_bi_report_info_dtl r USING(report_id) WHERE v.user_code=$1 LIMIT 3`, [user.username]);
  assert(entries.length > 0);
  upstream = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: req.url.endsWith('/tree')
      ? entries.map(e => ({ ...e, pId: null, text: 'Report', path: 'report.cpt' })) : [] }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const env = { FINE_BASE_URL: `http://127.0.0.1:${upstream.address().port}`, FINE_IDENTITY_MODE: 'trusted-cookie' };
  Object.assign(process.env, { PUBLIC_ORIGIN: 'https://portal-test.invalid', FINE_ROOT_ID: entries[0].id,
    PORTAL_DATA_MODEL: 'source', PORTAL_LOG_FILE: logFile });
  delete process.env.POC_PLATFORM_URL;
  const platform = platformClient(env, db);
  const token = sub => 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.test-signature';
  const cookie = (ids, subject = user.username) => `fine_login_users=${encodeURIComponent(ids.join(','))}; fine_auth_token=${token(subject)}`;
  const context = await platform.context({ headers: { cookie: cookie([other.id, user.id, '__missing__']) } });
  assert.equal(context.user.userName, user.username, 'Select token subject, not the first remembered ID');
  assert.equal((await platform.context({ headers: { cookie: cookie([user.id, other.id]) } })).user.userName, user.username);
  assert.equal((await platform.context({ headers: { cookie: cookie([user.id]) } })).user.userName, user.username);
  await assert.rejects(platform.context({ headers: { cookie: cookie([other.id, '__missing__']) } }), { code: 'USER_UNAVAILABLE' });
  await db.query(`INSERT INTO fr_quick_entry_app(app_id,app_name,jump_url,icon_url,status) VALUES
    ('portal-r4-test','Icon test','https://example.test','https://example.test/icon.png',1),
    ('portal-r4-unsafe','Bad icon','https://example.test','javascript:alert(1)',1)`);
  app = await buildApp({ platform, db: { query: (...args) => db.query(...args), end: async () => {} } });
  const headers = { cookie: cookie([other.id, user.id]), origin: process.env.PUBLIC_ORIGIN };
  const get = async path => {
    const res = await app.inject({ url: '/portal/api/portal/v1' + path, headers });
    assert.equal(res.statusCode, 200, res.body); return res.json().data;
  };
  const bootstrap = await get('/bootstrap');
  assert.equal(bootstrap.quickEntries.find(e => e.id === 'portal-r4-test').iconUrl, 'https://example.test/icon.png');
  assert.equal(bootstrap.quickEntries.find(e => e.id === 'portal-r4-unsafe').iconUrl, null);
  const reports = (await get('/reports?pageSize=100')).items;
  for (const report of reports) {
    const { rows: [expected] } = await db.query(`SELECT max(day_id) AS last, sum(visit_num::bigint) FILTER
      (WHERE day_id >= ($3::date - 29)::text) AS count FROM dim_bi_visit_log
      WHERE report_id=$1 AND user_code=$2 AND day_id <= ($3::date)::text`, [report.id, user.username, bootstrap.dataAsOf]);
    assert.equal(report.lastVisitedOn, expected.last);
    assert.equal(report.visits30d, Number(expected.count || 0));
  }
  const snapshot = await get('/workbench/snapshot');
  assert(snapshot.recent.length > 0);
  const secret = 'DO-NOT-LOG-CREDENTIAL';
  const invalid = await app.inject({ method: 'PUT', url: '/portal/api/portal/v1/search-history?token=' + secret,
    headers, payload: { category: 'all', query: 'test', password: secret, nested: { authorization: secret } } });
  assert.equal(invalid.statusCode, 400);
  const malformed = await app.inject({ url: '/portal/api/portal/v1/bootstrap', headers: {
    cookie: 'fine_login_users=a,b; fine_auth_token=not-a-jwt' } });
  assert.equal(malformed.json().error.code, 'INVALID_IDENTITY');
  await app.close(); app = null;
  const logs = await readFile(logFile, 'utf8');
  assert(!logs.includes(token(user.username))); assert(!logs.includes(secret));
  const lines = logs.trim().split('\n').map(line => JSON.parse(line));
  assert(lines.some(l => l.stage === 'identity' && l.candidateCount === 2));
  assert(lines.some(l => l.stage === 'platform' && l.operation === 'tree' && l.status === 200));
  assert(lines.some(l => l.stage === 'parameters' && l.body.password === '[REDACTED]'));
  assert(lines.some(l => l.requestId === malformed.json().requestId && l.code === 'INVALID_IDENTITY'));
  console.log('PASS: real PG user selection, reordered multi-user cookies, username visit joins, direct icons, request files and credential redaction.');
} finally {
  if (app) await app.close();
  if (upstream) await new Promise(resolve => upstream.close(resolve));
  await db.query('ROLLBACK'); await db.end();
  await rm(dir, { recursive: true, force: true });
}
