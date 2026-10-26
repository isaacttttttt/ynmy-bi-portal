import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { request as httpsRequest } from 'node:https';

const base = process.env.POC_BASE_URL || 'https://portal-production-c6e5.up.railway.app';
const accessKey = process.env.POC_ACCESS_KEY || JSON.parse(await readFile(new URL('../../artifacts/qa/railway-secrets.json', import.meta.url), 'utf8')).accessKey;
let checks = 0;
async function call(path, { cookie, method = 'GET', body, origin = base, status = 200, raw = false } = {}) {
  const response = await fetch(base + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), Origin: origin, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000), redirect: 'manual' });
  assert.equal(response.status, status, `${method} ${path}: expected ${status}, received ${response.status}`); checks++;
  if (raw) return response;
  const json = await response.json();
  assert.equal(json.success, status === 200, path); checks++;
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  if (status !== 200) { assert.ok(json.error?.code); assert.ok(!JSON.stringify(json).match(/SELECT |password|stack|token=/i)); }
  return json.data;
}
async function login(user) {
  const response = await call('/poc/login', { method: 'POST', body: { user, accessKey }, raw: true });
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie && cookie.includes('HttpOnly') && cookie.includes('Secure') && cookie.includes('SameSite=Lax'));
  return cookie.split(';')[0];
}
const api = '/api/portal/v1';
const restartFile = new URL('../../artifacts/qa/restart-check.json', import.meta.url);
if (process.argv.includes('--prepare-restart')) {
  const cookie = await login('admin');
  const before = await call(api + '/bootstrap', { cookie });
  await writeFile(restartFile, JSON.stringify({ cookie, favorite: before.favoriteIds.includes('entry-1') }));
  await call(api + '/favorites/entry-1', { cookie, method: 'PUT', body: { favorite: true } });
  console.log('Prepared: session and favorite stored; restart the cloud services, then run --verify-restart.');
  process.exit(0);
}
if (process.argv.includes('--verify-restart')) {
  const saved = JSON.parse(await readFile(restartFile, 'utf8'));
  const after = await call(api + '/bootstrap', { cookie: saved.cookie });
  assert.ok(after.favoriteIds.includes('entry-1'), 'Favorite and authenticated session must survive service restarts');
  await call(api + '/favorites/entry-1', { cookie: saved.cookie, method: 'PUT', body: { favorite: saved.favorite } });
  await call('/poc/logout', { cookie: saved.cookie, method: 'POST', body: {} });
  await unlink(restartFile);
  console.log('PASS: session and favorite survived service restarts; original favorite state restored.');
  process.exit(0);
}
await call('/health', { raw: true });
const traversalStatus = await new Promise((resolve, reject) => {
  const request = httpsRequest(base, { path: '/poc/%2e%2e/health', timeout: 15000 }, response => { response.resume(); resolve(response.statusCode); });
  request.on('error', reject); request.on('timeout', () => request.destroy(new Error('Gateway boundary test timed out'))); request.end();
});
assert.ok([400,404].includes(traversalStatus), 'Normalized PoC paths cannot reach private non-PoC routes'); checks++;
await call(api + '/bootstrap', { status: 401 });
await call('/poc/login', { method: 'POST', body: { user: 'admin', accessKey: 'invalid' }, status: 403 });
const admin = await login('admin'), clinical = await login('clinical'), empty = await login('empty');
const control = body => call('/poc/control', { cookie: admin, method: 'POST', body: { accessKey, ...body } });
const favorite = (cookie, id, value, options = {}) => call(api + '/favorites/' + id, { cookie, method: 'PUT', body: { favorite: value }, ...options });
const initial = await call(api + '/bootstrap', { cookie: admin });
const touched = ['entry-1', 'unmapped'];
try {
  assert.equal(initial.user.name, '综合测试用户');
  assert.ok(initial.entries.some(e => e.id === 'unmapped'));
  assert.ok(!initial.entries.some(e => e.id === 'outside'));
  const all = await call(api + '/reports?pageSize=100', { cookie: admin });
  assert.equal(all.total, 18); assert.equal(all.items.length, 18);
  assert.ok(all.items.every(r => typeof r.id === 'string' && typeof r.metadataId === 'string' && Array.isArray(r.metrics)));
  assert.equal(all.items.find(r => r.id === 'entry-1').visits30d, 12, 'SUM across two visit types, excluding old and future rows');
  const frequent = await call(api + '/workbench?tab=frequent&pageSize=100', { cookie: admin });
  assert.equal(frequent.items[0].id, 'entry-2'); assert.equal(frequent.items[0].visits30d, 30);
  assert.ok(frequent.items.every(r => r.status === 'active'));
  const recent = await call(api + '/workbench?tab=recent', { cookie: admin });
  assert.equal(recent.items[0].lastVisitedOn, initial.dataAsOf);
  const restricted = await call(api + '/reports?pageSize=100', { cookie: clinical });
  assert.deepEqual(restricted.items.map(r => r.id).sort(), ['entry-1', 'entry-12', 'entry-15', 'entry-16', 'entry-5'].sort());
  assert.equal(restricted.items.find(r => r.id === 'entry-1').visits30d, 2);
  assert.ok(!restricted.facets.organization.some(f => f.value === '财务共享中心'));
  const clinicalBootstrap = await call(api + '/bootstrap', { cookie: clinical });
  assert.deepEqual(clinicalBootstrap.favoriteIds, ['entry-12']);
  assert.equal((await call(api + '/reports?q=' + encodeURIComponent('财务'), { cookie: clinical })).total, 0);
  for (const category of ['all','report','tag','metric']) {
    const result = await call(api + '/search?category=' + category, {cookie:clinical});
    assert.ok(result.total > 0);
    if(category==='all') assert.ok(result.items.every(item=>item.category==='report' ? restricted.items.some(r=>r.id===item.report.id) : restricted.items.some(r=>(item.category==='tag'?[r.module]:r.metrics).includes(item.value))));
    else if(category==='report') assert.ok(result.items.every(item=>restricted.items.some(r=>r.id===item.report.id) && item.report.status==='active'));
    else assert.ok(result.items.every(item=>restricted.items.some(r=>(category==='tag'?[r.module]:r.metrics).includes(item.value))));
    assert.equal((await call(api+'/search?category='+category,{cookie:empty})).total,0);
  }
  const metric = await call(api+'/reports?category=metric&q=ROI',{cookie:admin});
  assert.equal(metric.total,1); assert.ok(metric.items[0].metrics.includes('ROI'));
  for(const suffix of ['/search?category=bad','/search?userId=admin','/search?q=a&q=b','/search-history?userId=admin','/reports?category=bad']) await call(api+suffix,{cookie:clinical,status:400});
  const snapshots={};
  for(const category of ['all','report','tag','metric']) snapshots[category]=await call(api+'/search-history?category='+category,{cookie:empty});
  const otherHistory=await call(api+'/search-history?category=report',{cookie:clinical});
  const historyWrite=(category,query,options={})=>call(api+'/search-history',{cookie:empty,method:'PUT',body:{category,query},...options});
  const historyClear=(category,options={})=>call(api+'/search-history?category='+category,{cookie:empty,method:'DELETE',...options});
  try {
    for(const category of ['all','report','tag','metric']) await historyClear(category);
    await historyWrite('report','  ROI  ');
    const repeated=await historyWrite('report','roi');
    assert.equal(repeated.items.length,1);assert.equal(repeated.items[0].query,'roi');assert.ok(repeated.items[0].searchedAt.endsWith('Z'));
    await historyWrite('all','综合检索');
    assert.equal((await call(api+'/search-history?category=all',{cookie:empty})).items[0].query,'综合检索');
    await historyWrite('tag','供应链');await historyWrite('metric','ROI');
    for(let i=0;i<22;i++) await historyWrite('report','history-'+i);
    const saved=await call(api+'/search-history?category=report',{cookie:empty});
    assert.equal(saved.items.length,20);assert.equal(saved.items[0].query,'history-21');assert.ok(!saved.items.some(item=>item.query==='history-0'));
    const relogin=await login('empty');
    assert.deepEqual(await call(api+'/search-history?category=report',{cookie:relogin}),saved,'History persists across sessions');
    await call('/poc/logout',{cookie:relogin,method:'POST',body:{}});
    await historyWrite('report','   ',{status:400});await historyWrite('report','x'.repeat(201),{status:400});await historyWrite('other','x',{status:400});
    await historyWrite('report','x',{origin:'https://untrusted.invalid',status:403});
    await historyClear('report',{origin:'https://untrusted.invalid',status:403});
    await call(api+'/search-history',{cookie:empty,method:'PUT',body:{category:'report',query:'x',userId:'admin'},status:400});
    await call(api+'/search-history?category=report',{status:401});
    await historyClear('report');
    assert.equal((await call(api+'/search-history?category=report',{cookie:empty})).items.length,0);
    assert.equal((await call(api+'/search-history?category=tag',{cookie:empty})).items[0].query,'供应链');
    assert.equal((await call(api+'/search-history?category=metric',{cookie:empty})).items[0].query,'ROI');
    assert.deepEqual(await call(api+'/search-history?category=report',{cookie:clinical}),otherHistory,'Other user history is untouched');
  } finally {
    for(const category of ['all','report','tag','metric']) { await historyClear(category); for(const item of snapshots[category].items.toReversed()) await historyWrite(category,item.query); }
  }
  const filtered = await call(api + '/reports?organization=' + encodeURIComponent('临床一部') + '&organization=' + encodeURIComponent('财务共享中心') + '&status=active&pageSize=100', { cookie: admin });
  assert.ok(filtered.items.every(r => ['临床一部', '财务共享中心'].includes(r.department) && r.status === 'active'));
  assert.ok(filtered.total > 0);
  assert.deepEqual(Object.keys(all.facets), ['organization','status','permission','frequency','volume']);
  const permitted = await call(api+'/reports?permission=granted&pageSize=100',{cookie:admin});
  assert.equal(permitted.total,all.total);
  assert.ok(all.items.every(r=>r.permission==='granted' && Object.hasOwn(r,'onlineOn') && Object.hasOwn(r,'developerDepartment') && Object.hasOwn(r,'updateNote')));
  const second = await call(api + '/reports?page=2&pageSize=6', { cookie: admin });
  assert.deepEqual(second.items.map(r => r.id), all.items.slice(6, 12).map(r => r.id));
  for (const suffix of ['/reports?page=0', '/reports?pageSize=101', '/reports?status=invalid', '/reports?userId=admin', '/workbench?tab=bad', '/bootstrap?userId=admin']) await call(api + suffix, { cookie: clinical, status: 400 });
  const notices = await call(api + '/notices?pageSize=100', { cookie: admin });
  assert.ok(notices.items.some(n => n.id === 'outside-topic'), 'notices use the full permission tree');
  assert.ok(notices.items.some(n => n.id === 'finance-only'));
  assert.ok(!notices.items.some(n => ['exact-id', 'no-scope', 'expired'].includes(n.id)));
  const futureStarts = new Date(initial.dataAsOf+'T12:00:00Z'); futureStarts.setUTCDate(futureStarts.getUTCDate()+2);
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  assert.equal(notices.items.some(n=>n.id==='future'), today>=futureStarts.toISOString().slice(0,10), 'A future notice becomes visible on its actual start date');
  assert.ok(notices.items[0].pinned && notices.items[1].pinned);
  const restrictedNotices = await call(api + '/notices?pageSize=100', { cookie: clinical });
  assert.ok(!restrictedNotices.items.some(n => n.id === 'finance-only' || n.id === 'exact-id'));
  assert.equal((await call(api + '/reports', { cookie: empty })).total, 0);
  assert.equal((await call(api + '/notices', { cookie: empty })).total, 0);
  const emptyBootstrap = await call(api + '/bootstrap', { cookie: empty });
  assert.deepEqual(emptyBootstrap.entries, []); assert.deepEqual(emptyBootstrap.favoriteIds, []);
  await favorite(clinical, 'entry-2', true, { status: 404 });
  await favorite(admin, 'entry-15', true, { status: 409 });
  await favorite(admin, 'topics', true, { status: 404 });
  await favorite(admin, 'entry-1', true, { origin: 'https://untrusted.example', status: 403 });
  await call(api + '/favorites/entry-1', { cookie: admin, method: 'PUT', body: { favorite: 'true' }, status: 400 });
  await call(api + '/favorites/entry-1', { cookie: admin, method: 'PUT', body: { favorite: true, userId: 'admin' }, status: 400 });
  await favorite(admin, 'entry-1', true); await favorite(admin, 'entry-1', true);
  assert.equal((await call(api + '/bootstrap', { cookie: admin })).favoriteIds.filter(id => id === 'entry-1').length, 1);
  assert.ok(!(await call(api + '/bootstrap', { cookie: clinical })).favoriteIds.includes('entry-1'));
  const unmapped = await favorite(admin, 'unmapped', true); assert.equal(unmapped.report, null);
  assert.ok((await call(api + '/bootstrap', { cookie: admin })).favoriteIds.includes('unmapped'));
  await favorite(admin, 'entry-1', false); await favorite(admin, 'entry-1', false);
  await control({ action: 'fault', user: 'admin', fault: 'favorites-failed' });
  await favorite(admin, 'entry-1', true, { status: 502 });
  await control({ action: 'fault', user: 'admin', fault: 'none' });
  assert.ok(!(await call(api + '/bootstrap', { cookie: admin })).favoriteIds.includes('entry-1'));
  await control({ action: 'permission', user: 'clinical', entryId: 'entry-12', allowed: false });
  assert.ok(!(await call(api + '/reports?pageSize=100', { cookie: clinical })).items.some(r => r.id === 'entry-12'));
  assert.ok(!(await call(api + '/bootstrap', { cookie: clinical })).favoriteIds.includes('entry-12'));
  await favorite(clinical, 'entry-12', true, { status: 404 });
  await call('/poc/preview/entry-12', { cookie: clinical, status: 403 });
  await control({ action: 'permission', user: 'clinical', entryId: 'entry-12', allowed: true });
  for (const fault of ['tree-unavailable', 'malformed-tree']) {
    await control({ action: 'fault', user: 'clinical', fault });
    await call(api + '/reports', { cookie: clinical, status: 502 });
    await call(api + '/bootstrap', { cookie: clinical, status: 502 });
  }
  await control({ action: 'fault', user: 'clinical', fault: 'none' });
  const preview = await call('/poc/preview/entry-12', { cookie: clinical, raw: true }); assert.ok((await preview.text()).includes('终端数据面板'));
  await control({ action: 'expire', user: 'clinical' });
  await call(api + '/bootstrap', { cookie: clinical, status: 401 });
  await call(api + '/reports', { cookie: admin });
  console.log(`PASS: ${checks} HTTP/status/envelope checks; identity, permission isolation, filters, counts, dates, favorites, fault handling and session expiry.`);
} finally {
  await control({ action: 'fault', user: 'admin', fault: 'none' });
  await control({ action: 'fault', user: 'clinical', fault: 'none' });
  await control({ action: 'permission', user: 'clinical', entryId: 'entry-12', allowed: true });
  for (const id of touched) await favorite(admin, id, initial.favoriteIds.includes(id));
  await call('/poc/logout', { cookie: admin, method: 'POST', body: {} });
  await call('/poc/logout', { cookie: empty, method: 'POST', body: {} });
}
