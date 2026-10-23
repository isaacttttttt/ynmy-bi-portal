import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { bootstrap, reports, notices } from '../../src/lib/portal-fixtures.ts';
import { businessDate } from '../src/http.js';
import assert from 'node:assert/strict';
import { noticesFor } from '../src/repository.js';

// Run as a Railway pre-deploy command with the MySQL administrator, not the BFF account.
const db = await mysql.createConnection({ host: process.env.MYSQLHOST, port: Number(process.env.MYSQLPORT || 3306), user: process.env.MYSQLUSER, password: process.env.MYSQLPASSWORD, database: process.env.MYSQLDATABASE, multipleStatements: true });
const database = process.env.MYSQLDATABASE;
if (!/^[a-zA-Z0-9_]+$/.test(database) || !process.env.PORTAL_DB_PASSWORD || !process.env.PLATFORM_DB_PASSWORD) throw new Error('Missing seed configuration');
try {
  for (const file of ['001-portal.sql', '002-platform-poc.sql']) await db.query(await readFile(new URL(`../sql/${file}`, import.meta.url), 'utf8'));
  for (const [user, password] of [['portal_reader', process.env.PORTAL_DB_PASSWORD], ['portal_platform', process.env.PLATFORM_DB_PASSWORD]]) {
    await db.query(`CREATE USER IF NOT EXISTS '${user}'@'%' IDENTIFIED BY ?`, [password]);
    await db.query(`ALTER USER '${user}'@'%' IDENTIFIED BY ?`, [password]);
  }
  for (const table of ['portal_data_batch', 'icon_repository', 'report_metadata', 'dim_bi_visit_log', 'fr_index_noticement', 'fr_quick_entry_app']) await db.query(`GRANT SELECT ON \`${database}\`.\`${table}\` TO 'portal_reader'@'%'`);
  for (const table of ['poc_users', 'poc_entries', 'poc_permissions', 'poc_favorites', 'poc_sessions', 'poc_faults']) await db.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON \`${database}\`.\`${table}\` TO 'portal_platform'@'%'`);
  const [existing] = await db.query('SELECT batch_id FROM portal_data_batch WHERE batch_id = 1');
  if (existing.length) { console.log('Schema ready; existing test data preserved.'); }
  else {
    const shift = (day, n) => { const date = new Date(day+'T12:00:00Z'); date.setUTCDate(date.getUTCDate()+n); return date.toISOString().slice(0,10); };
    const today = businessDate(), asOf = shift(today,-1);
    await db.beginTransaction();
    for (const user of [['admin','综合测试用户'],['clinical','临床受限用户'],['empty','无目录权限用户']]) await db.query('INSERT INTO poc_users VALUES (?,?)',user);
    const clinicalIds = new Set(['topics','clinical',...bootstrap.entries.filter(e=>e.parentId==='clinical').map(e=>e.id)]);
    const entries = [...bootstrap.entries, {id:'outside',parentId:null,name:'其他授权目录',type:'folder',sort:200}, {id:'unmapped',parentId:'health',name:'尚未维护元数据的报表',type:'cpt',sort:300}];
    for (const e of entries) {
      const row = { id:e.id,pId:e.parentId,text:e.name,sortIndex:e.sort,entryType:e.type==='url'?5:1,path:e.type==='folder'?null:e.type==='bi'?`bi/${e.id}`:`reports/${e.id}.${e.type}`,templateId:e.templateId || null };
      await db.query('INSERT INTO poc_entries (entry_id,payload) VALUES (?,?)',[e.id,JSON.stringify(row)]);
      await db.query('INSERT INTO poc_permissions VALUES (?,?)',['admin',e.id]);
      if (clinicalIds.has(e.id)) await db.query('INSERT INTO poc_permissions VALUES (?,?)',['clinical',e.id]);
    }
    const order=['entry-12','entry-16','entry-17','entry-18','entry-13','entry-14'];
    for (const [i,r] of reports.entries()) {
      await db.query(`INSERT INTO report_metadata (report_id,fine_entry_id,report_name,fine_report_path,report_desc,use_scene,business_module,report_owner_name,report_owner_dept,dev_owner_name,source_system,core_metrics,calc_logic,update_frequency,report_status,last_updated_at,total_views,sort_no)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[r.metadataId,r.id,r.name,`/示例/${r.id}`,r.description,r.useScene,r.module,r.owner,r.department,r.developer,r.source,JSON.stringify(r.metrics),r.calcLogic,r.frequency,r.status==='active'?1:0,asOf+' 12:00:00',r.views,order.includes(r.id)?order.indexOf(r.id):100+i]);
      if (r.visits30d) {
        const day=shift(asOf,-i%20), amount=Math.floor(r.visits30d/2);
        await db.query('INSERT INTO dim_bi_visit_log (day_id,report_id,user_code,visit_type,visit_num) VALUES (?,?,?,?,?),(?,?,?,?,?)',[day,r.id,'admin','view',amount,day,r.id,'admin','export',r.visits30d-amount]);
        if (clinicalIds.has(r.id)) await db.query('INSERT INTO dim_bi_visit_log (day_id,report_id,user_code,visit_num) VALUES (?,?,?,?)',[day,r.id,'clinical',2]);
      }
    }
    // Large old count must not enter the current 30-day window; future rows are excluded too.
    await db.query('INSERT INTO dim_bi_visit_log (day_id,report_id,user_code,visit_num) VALUES (?,?,?,?),(?,?,?,?)',[shift(asOf,-30),'entry-1','admin',9000,shift(asOf,1),'entry-1','admin',8000]);
    for (const id of bootstrap.favoriteIds) await db.query('INSERT INTO poc_favorites VALUES (?,?)',['admin',id]);
    await db.query('INSERT INTO poc_favorites VALUES (?,?)',['clinical','entry-12']);
    const extra=[['finance-only','财务权限专属公告','finance',-1,10],['exact-id','精确ID匹配测试','entry-120',-1,10],['no-scope','空范围不公开','',-1,10],['expired','已过期公告','topics',-10,-1],['future','未生效公告','topics',1,10],['outside-topic','专题外目录公告','outside',-1,10]];
    for (const [i,n] of notices.entries()) await db.query('INSERT INTO fr_index_noticement (notice_uuid,notice_title,notice_category,notice_is_top,notice_start_day_id,notice_last_day_id,notice_content,notice_register_day_id,notice_region_id) VALUES (?,?,?,?,?,?,?,?,?)',[n.id,n.title,n.category,n.pinned?1:0,shift(today,-30),shift(today,30),n.content,shift(today,-i-1),'topics']);
    for (const [id,title,scope,start,end] of extra) await db.query('INSERT INTO fr_index_noticement (notice_uuid,notice_title,notice_category,notice_start_day_id,notice_last_day_id,notice_content,notice_register_day_id,notice_region_id) VALUES (?,?,?,?,?,?,?,?)',[id,title,'PoC验证',shift(today,start),shift(today,end),'仅用于权限及日期边界验证',shift(today,-1),scope]);
    for (const [i,q] of bootstrap.quickEntries.entries()) await db.query('INSERT INTO fr_quick_entry_app (app_key,app_name,app_desc,jump_url,sort_no) VALUES (?,?,?,?,?)',[q.id,q.name,q.description,q.url,i]);
    await db.query('INSERT INTO portal_data_batch (batch_id,data_as_of) VALUES (1,?)',[asOf]);
    await db.commit(); console.log('Seeded synthetic portal data, three users and permission boundary cases.');
  }
  const reader = await mysql.createConnection({ host: process.env.MYSQLHOST, port: Number(process.env.MYSQLPORT || 3306), user: 'portal_reader', password: process.env.PORTAL_DB_PASSWORD, database, dateStrings: true });
  try {
    await reader.query('SELECT report_id FROM report_metadata LIMIT 1');
    await assert.rejects(reader.query('SELECT * FROM poc_sessions LIMIT 1'), { code: 'ER_TABLEACCESS_DENIED_ERROR' });
    await assert.rejects(reader.query('UPDATE report_metadata SET sort_no=sort_no WHERE 1=0'), { code: 'ER_TABLEACCESS_DENIED_ERROR' });
  } finally { await reader.end(); }
  // A rolled-back row checks the inclusive DATE boundary against real MySQL on every deploy.
  await db.beginTransaction();
  await db.query('INSERT INTO fr_index_noticement (notice_uuid,notice_title,notice_start_day_id,notice_last_day_id,notice_register_day_id,notice_region_id) VALUES (?,?,?,?,?,?)',['poc-date-boundary','结束日当天有效',businessDate(),businessDate(),businessDate(),'topics']);
  assert.ok((await noticesFor(db,{ids:new Set(['topics'])})).some(n=>n.id==='poc-date-boundary'));
  await db.rollback();
  console.log('Verified: read-only BFF privileges, session-table isolation and inclusive notice end date.');
} catch(error) { await db.rollback(); console.error('Seed failed:', error.code || 'SEED_ERROR'); process.exitCode=1; } finally { await db.end(); }
