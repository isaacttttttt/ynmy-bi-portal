// Runs the real API and SQL against an isolated imported PG database. Only the unavailable platform is stubbed.
import assert from 'node:assert/strict';
import pg from 'pg';
import { buildApp } from '../src/app.js';

const client = new pg.Client({connectionString:process.env.SOURCE_TEST_DATABASE_URL,ssl:{rejectUnauthorized:false}});
await client.connect();
process.env.PUBLIC_ORIGIN='https://portal-test.invalid';
process.env.FINE_ROOT_ID='test-root';
process.env.PORTAL_DATA_MODEL='source';
delete process.env.POC_PLATFORM_URL;
const {rows:users}=await client.query(`SELECT DISTINCT u.username FROM dim_bi_user u JOIN dim_dept_mapping m ON u.oa_dept_code=m.dept_job_id
  WHERE u.enable='true' AND EXISTS (SELECT 1 FROM fr_index_noticement n WHERE m.dept_name=ANY(string_to_array(n.notice_dept_name,','))) ORDER BY u.username LIMIT 1`);
assert.equal(users.length,1,'Need an actual mapped user');
const {rows:catalog}=await client.query('SELECT report_id,report_name,report_type FROM dim_bi_report_info_dtl ORDER BY report_id');
assert(catalog.length>0);
const entries=catalog.map(row=>({id:row.report_id,name:row.report_name,type:row.report_type,parentId:'test-root',sort:0}));
let context={user:{userName:users[0].username,name:'测试用户'},ids:new Set(entries.map(e=>e.id)),entries};
const platform={context:async()=>context,favorites:async()=>[],favorite:async()=>{}};
const app=await buildApp({platform,db:{query:(...args)=>client.query(...args),end:async()=>{}}});
let checks=0;
async function call(path,method='GET',payload,status=200){
 const response=await app.inject({method,url:'/api/portal/v1'+path,headers:{origin:process.env.PUBLIC_ORIGIN},payload});
 assert.equal(response.statusCode,status,`${path}: ${response.body}`);checks++;
 return response.json().data;
}
try{
 await client.query('BEGIN');
 const bootstrap=await call('/bootstrap');assert.equal(bootstrap.dataAsOf,'2026-11-05');
 const enabledLinks=Number((await client.query('SELECT count(*) FROM fr_quick_entry_app WHERE status=1')).rows[0].count);
 assert.equal(bootstrap.quickEntries.length,enabledLinks);
 const reports=await call('/reports?pageSize=100');assert.equal(reports.total,entries.length);
 const seen=new Set(reports.items.map(r=>r.id));
 const full=[...reports.items];
 for(let page=2;page<=Math.ceil(reports.total/100);page++) for(const report of (await call('/reports?pageSize=100&page='+page)).items) {assert(!seen.has(report.id));seen.add(report.id);full.push(report);}
 assert.equal(seen.size,entries.length,'All source reports can be paged without loss or duplication');
 const dictionary=(await client.query("SELECT * FROM dim_bi_report_dictionary WHERE coalesce(suggested_owner_name,'')<>'' AND coalesce(report_name,'')<>'' LIMIT 1")).rows[0];
 assert(dictionary);
 const metadata=full.find(r=>r.id===dictionary.report_id);
 assert(metadata);assert.equal(metadata.name,dictionary.report_name);assert.equal(metadata.owner,dictionary.suggested_owner_name);
 assert.equal(metadata.description,dictionary.report_description || '');assert.equal(metadata.developer,dictionary.developer_name || '');
 assert.equal(metadata.useScene,dictionary.usage_scenario || '');assert.equal(metadata.calcLogic,dictionary.metrics_calc_logic || '');
 assert.equal(metadata.source,dictionary.data_source || '');assert.equal(metadata.updatedOn,'','No metadata update timestamp is supplied');
 const daily=await call('/reports?frequency='+encodeURIComponent('每日更新'));assert(daily.total>0);assert(daily.items.every(r=>r.frequency==='每日更新'));
 const metricReport=(await client.query("SELECT report_id FROM dim_bi_report_dictionary WHERE core_metrics IS NOT NULL AND core_metrics<>'' LIMIT 1")).rows[0];
 const metric=full.find(r=>r.id===metricReport.report_id).metrics[0];assert(metric);
 assert((await call('/search?category=metric&q='+encodeURIComponent(metric))).items.some(item=>item.value===metric));
 const {rows:dictionaryNames}=await client.query('SELECT report_id,report_name FROM dim_bi_report_dictionary');
 const names=new Map(dictionaryNames.map(row=>[row.report_id,row.report_name]));
 for(const report of full){
   assert.equal(report.name,names.get(report.id)?.trim() || entries.find(entry=>entry.id===report.id).name);
   if(!names.has(report.id)){assert.equal(report.owner,'');assert.deepEqual(report.metrics,[]);}
 }
 const target=reports.items[0];
 const found=await call('/search?category=all&q='+encodeURIComponent(target.name));assert(found.items.some(item=>item.report?.id===target.id));
 for(const category of ['report','tag','metric'])await call('/search?category='+category+'&q=');
 for(const tab of ['recent','frequent','favorites'])await call('/workbench?tab='+tab);
 const notices=await call('/notices?pageSize=100');assert.equal(notices.total,5);assert(notices.items.every(n=>n.attachment?.url.startsWith('https://')));
 const authorized=context;
 context={...authorized,entries:entries.map((e,i)=>i===0?{...e,type:'folder'}:e)};
 assert.equal((await call('/reports')).total,entries.length-1,'Platform folders are not dictionary reports');
 context={...authorized,ids:new Set(),entries:[]};
 assert.equal((await call('/reports')).total,0);assert.equal((await call('/search?category=all&q=')).total,0);
 assert.equal((await call('/notices')).total,5,'Notice permissions depend on OA department, not report tree');
 context={user:{userName:'__portal_no_such_user__',name:'未匹配用户'},ids:authorized.ids,entries};
 assert.equal((await call('/notices')).total,0);
 context=authorized;
 await client.query("UPDATE dim_bi_user SET enable='false' WHERE username=$1",[users[0].username]);
 assert.equal((await call('/notices')).total,0,'Disabled user cannot read notices');
 await client.query("UPDATE dim_bi_user SET enable='true',oa_dept_code='__unmapped__' WHERE username=$1",[users[0].username]);
 assert.equal((await call('/notices')).total,0,'Unknown department does not grant access');
 await client.query('ROLLBACK');await client.query('BEGIN');
 await client.query("UPDATE fr_index_noticement SET notice_dept_name='__other_department__'");
 assert.equal((await call('/notices')).total,0,'Other departments cannot read notices');
 await client.query('ROLLBACK');await client.query('BEGIN');
 await client.query("UPDATE fr_index_noticement SET notice_last_day_id='2000-01-01'");
 assert.equal((await call('/notices')).total,0,'Expired notices remain hidden');
 await client.query('ROLLBACK');await client.query('BEGIN');
 for(const category of ['all','report','tag','metric']){
   await call('/search-history','PUT',{category,query:'PORTAL-QA'});
   const history=await call('/search-history?category='+category);assert.equal(history.items[0].query,'PORTAL-QA');
   await call('/search-history?category='+category,'DELETE');assert.equal((await call('/search-history?category='+category)).items.length,0);
 }
 await call('/search?category=invalid','GET',undefined,400);
 console.log(JSON.stringify({passed:true,apiChecks:checks,catalogReports:entries.length,notices:5,platform:'stubbed; no real platform authentication or directory claims'}));
}finally{await client.query('ROLLBACK');await app.close();await client.end();}
