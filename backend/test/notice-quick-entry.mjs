import assert from 'node:assert/strict';
import pg from 'pg';
import { noticesFor, quickEntries } from '../src/source-repository.js';

assert(process.env.SOURCE_TEST_DATABASE_URL, 'Provide an isolated source test database');
const db = new pg.Client({ connectionString: process.env.SOURCE_TEST_DATABASE_URL });
await db.connect();
try {
  await db.query('BEGIN');
  const existing = await quickEntries(db);
  assert.equal(existing.length, Number((await db.query('SELECT count(*) FROM fr_quick_entry_app WHERE status=1')).rows[0].count));
  await db.query(`INSERT INTO fr_quick_entry_app(app_id,app_name,sort_no,status,icon_url) VALUES
    ('test-q20','Test 20',20,1,'https://example.test/icon.png'),('test-q05','Test 5',5,1,NULL),
    ('test-qoff','Disabled',0,0,NULL)`);
  const links = (await quickEntries(db)).filter(e => e.id.startsWith('test-q'));
  assert.deepEqual(links.map(e => e.id), ['test-q05','test-q20']);
  assert.equal(links[1].iconUrl, 'https://example.test/icon.png');
  await db.query(`INSERT INTO dim_bi_user(id,username,oa_dept_code,enable) VALUES
    ('test-notice-id','test-notice-user','test-job','true')`);
  await db.query(`INSERT INTO dim_dept_mapping(dept_job_id,dept_name) VALUES
    ('test-job','测试部门A'),('test-job','测试部门A'),('test-job','测试部门B')`);
  await db.query(`INSERT INTO fr_index_noticement(notice_uuid,notice_title,notice_dept_name,notice_start_day_id,notice_last_day_id) VALUES
    ('test-notice-allowed','Allowed','测试部门A, 测试部门B','2020-01-01','2099-01-01'),
    ('test-notice-other','Other','测试部门AB','2020-01-01','2099-01-01'),
    ('test-notice-expired','Expired','测试部门A','2020-01-01','2020-01-02')`);
  const context = { user: { userName: 'test-notice-user' }, ids: new Set(), entries: [] };
  assert.deepEqual((await noticesFor(db, context)).map(n => n.id), ['test-notice-allowed']);
  await db.query("UPDATE dim_bi_user SET oa_dept_code='missing' WHERE username='test-notice-user'");
  assert.equal((await noticesFor(db, context)).length, 0);
  await db.query("UPDATE dim_bi_user SET oa_dept_code='test-job',enable='false' WHERE username='test-notice-user'");
  assert.equal((await noticesFor(db, context)).length, 0);
  assert.deepEqual((await quickEntries(db)).filter(e => e.id.startsWith('test-q')), links);
  console.log('PASS: quick entries use status/sort only; notice OA inner joins, comma-separated exact membership, duplicate removal, expiry and missing/disabled user.');
} finally { await db.query('ROLLBACK'); await db.end(); }
