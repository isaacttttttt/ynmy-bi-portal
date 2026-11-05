import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPool } from '../src/config/database.js';

// One-time provisioning for the imported test snapshot, never production or the demo seed.
assert.equal(process.env.DB_NAME, 'portal_realdata_20261105');
const db = createPool();
const client = await db.connect();
try {
  await client.query('BEGIN');
  await client.query(await readFile(new URL('../sql/002-platform-poc.sql', import.meta.url), 'utf8'));
  assert.equal((await client.query('SELECT count(*) FROM poc_users')).rows[0].count, '0', 'Test accounts already provisioned');
  await client.query('ALTER TABLE poc_users ADD COLUMN source_user_code TEXT');
  const { rows: users } = await client.query(`SELECT u.username, count(v.report_id) AS visits
    FROM dim_bi_user u JOIN dim_bi_visit_log v ON v.user_code=u.username
    WHERE u.enable='true' AND EXISTS (
      SELECT 1 FROM dim_dept_mapping m JOIN fr_index_noticement n
        ON m.dept_name=ANY(string_to_array(n.notice_dept_name,','))
      WHERE m.dept_job_id=u.oa_dept_code)
    GROUP BY u.username ORDER BY visits DESC, u.username LIMIT 2`);
  assert.equal(users.length, 2);
  await client.query(`INSERT INTO poc_users VALUES
    ('admin','综合测试用户',$1),('clinical','部分目录测试用户',$2),('empty','无目录权限用户','__portal_empty_test__')`, users.map(u=>u.username));
  const { rows: reports } = await client.query('SELECT * FROM dim_bi_report_info_dtl ORDER BY report_id');
  const ids = new Set(reports.map(r=>r.report_id));
  const entries = [{id:'topics',pId:null,text:'真实底表测试目录',path:null,entryType:3}];
  for (const r of reports) {
    const ancestors = r.report_displayname_path_ids.split(',').filter(id=>id!==r.report_id);
    const parent = ancestors.at(-1);
    const folder = r.report_type==='bi' && r.report_expandtype==='3';
    const url = r.report_type==='url' || r.report_expandtype==='5';
    entries.push({id:r.report_id,pId:ids.has(parent)?parent:'topics',text:r.report_name || r.report_id,
      path:folder?null:url?`${process.env.PUBLIC_ORIGIN}/poc/preview/${r.report_id}`:`${r.report_id}.${r.report_type}`,
      entryType:url?5:folder?3:1,templateId:r.report_id});
  }
  await client.query(`INSERT INTO poc_entries (entry_id,payload)
    SELECT value->>'id',value FROM jsonb_array_elements($1::jsonb)`, [JSON.stringify(entries)]);
  await client.query("INSERT INTO poc_permissions SELECT 'admin',entry_id FROM poc_entries");
  await client.query(`INSERT INTO poc_permissions SELECT 'clinical',entry_id FROM poc_entries
    WHERE payload->>'path' IS NULL OR entry_id IN (SELECT report_id FROM dim_bi_report_dictionary)`);
  await client.query(`INSERT INTO poc_favorites SELECT 'admin',report_id FROM dim_bi_report_dictionary ORDER BY report_id LIMIT 3`);
  await client.query('GRANT USAGE ON SCHEMA public TO portal_reader, portal_platform');
  await client.query('GRANT CONNECT ON DATABASE portal_realdata_20261105 TO portal_reader, portal_platform');
  await client.query(`GRANT SELECT ON dim_bi_report_info_dtl,dim_bi_report_dictionary,dim_bi_visit_log,
    dim_bi_user,dim_dept_mapping,fr_index_noticement,fr_quick_entry_app TO portal_reader`);
  await client.query('GRANT SELECT,INSERT,UPDATE,DELETE ON portal_search_history TO portal_reader');
  await client.query('GRANT SELECT,INSERT,UPDATE,DELETE ON poc_users,poc_entries,poc_permissions,poc_favorites,poc_sessions,poc_faults TO portal_platform');
  await client.query('COMMIT');
  console.log(JSON.stringify({provisioned:true,entries:entries.length,accounts:3,permissions:'simulated'}));
} catch(error) {
  await client.query('ROLLBACK');
  throw error;
} finally { client.release(); await db.end(); }
