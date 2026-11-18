import assert from 'node:assert/strict';
import pg from 'pg';
import { buildApp } from '../src/app.js';

assert(process.env.SOURCE_TEST_DATABASE_URL, 'Provide an isolated source test database');
const db = new pg.Client({ connectionString: process.env.SOURCE_TEST_DATABASE_URL });
await db.connect();
let app;
try {
  await db.query('BEGIN');
  await db.query(`INSERT INTO dim_bi_report_dictionary(id,report_id,report_name) VALUES
    ('test-d1','test-allowed','权限测试授权'),('test-d2','test-denied','权限测试无权限'),
    ('test-d3','test-missing','权限测试缺明细'),('test-d4',NULL,'权限测试缺ID')`);
  await db.query(`INSERT INTO dim_bi_report_info_dtl(report_id,report_name,report_type) VALUES
    ('test-allowed','目录名称','cpt'),('test-denied','未授权','bi'),('test-detail-only','权限测试仅明细','cpt')`);
  await db.query(`INSERT INTO dim_bi_visit_log(day_id,report_id,user_code,visit_num) VALUES
    ('2026-11-12','test-allowed','user', '1'),('2026-11-12','test-denied','user','2'),
    ('2026-11-12','test-detail-only','user','3')`);
  const entries = ['test-allowed','test-detail-only'].map(id => ({ id, name: id, type: 'cpt', parentId: null, sort: 0 }));
  let context = { entries, ids: new Set(entries.map(e => e.id)), user: { userName: 'user', name: 'User' } };
  const platform = { context: async () => context, favorites: async () => [], favorite: async () => { throw new Error('Unauthorized write'); } };
  Object.assign(process.env, { PUBLIC_ORIGIN: 'https://test.invalid', FINE_ROOT_ID: 'root', PORTAL_DATA_MODEL: 'source' });
  delete process.env.POC_PLATFORM_URL;
  app = await buildApp({ platform, db: { query: (...args) => db.query(...args), end: async () => {} } });
  const get = async path => { const r = await app.inject('/portal/api/portal/v1' + path); assert.equal(r.statusCode, 200, r.body); return r.json().data; };
  const data = await get('/reports?q=' + encodeURIComponent('权限测试'));
  assert.equal(data.total, 4);
  assert.equal(data.items.find(r => r.id === 'test-allowed').permission, 'granted');
  assert.equal(data.items.find(r => r.id === 'test-missing').permission, 'denied');
  assert(data.items.some(r => r.metadataId === 'test-d4'));
  assert(!data.items.some(r => r.id === 'test-detail-only'));
  const denied = await get('/reports?permission=denied&q=' + encodeURIComponent('权限测试'));
  assert.equal(denied.total, 3); assert(denied.items.every(r => r.permission === 'denied'));
  const snapshot = await get('/workbench/snapshot');
  assert.deepEqual(new Set(snapshot.recent.map(r => r.id)), new Set(['test-allowed','test-detail-only']));
  const write = await app.inject({ method: 'POST', url: '/portal/api/portal/v1/favorites/test-denied',
    headers: { origin: 'https://test.invalid' }, payload: { favorite: true } });
  assert.equal(write.statusCode, 404);
  context = { ...context, ids: new Set(), entries: [] };
  const none = await get('/reports?q=' + encodeURIComponent('权限测试'));
  assert.equal(none.total, 4); assert(none.items.every(r => r.permission === 'denied'));
  assert.equal((await get('/workbench/snapshot')).recent.length, 0);
  console.log('PASS: dictionary-led LEFT JOIN, missing metadata/ID, permission filters, no-permission catalog, authorized workbench, rejected favorites.');
} finally { if (app) await app.close(); await db.query('ROLLBACK'); await db.end(); }
