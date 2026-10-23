import Fastify from 'fastify';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createPool } from '../src/config/database.js';
import { ApiError, cookieToken, requireOrigin, invalid } from '../src/http.js';

if (!process.env.POC_ACCESS_KEY || process.env.POC_ACCESS_KEY.length < 24) throw new Error('POC_ACCESS_KEY required');
const origin = new URL(process.env.PUBLIC_ORIGIN).origin;
const app = Fastify({ logger: false, bodyLimit: 16384 });
const db = createPool();
const hash = value => createHash('sha256').update(value).digest('hex');
function accessKey(request) {
  const supplied=request.body?.accessKey;
  if(typeof supplied!=='string' || !timingSafeEqual(Buffer.from(hash(supplied)),Buffer.from(hash(process.env.POC_ACCESS_KEY)))) throw new ApiError(403,'INVALID_ACCESS_KEY','测试访问码不正确');
}
async function session(request) {
  const authorization=request.headers.authorization;
  const token=authorization?.startsWith('Bearer ') ? authorization.slice(7) : cookieToken(request);
  const [rows]=await db.query('SELECT s.*,u.display_name FROM poc_sessions s JOIN poc_users u USING(user_code) WHERE token_hash=? AND expires_at>UTC_TIMESTAMP()',[hash(token)]);
  if(!rows.length) throw new ApiError(401,'SESSION_EXPIRED','会话已失效');
  return rows[0];
}
async function granted(user,id) {
  const [rows]=await db.query('SELECT e.payload FROM poc_permissions p JOIN poc_entries e USING(entry_id) WHERE user_code=? AND entry_id=? AND active=1',[user,id]);
  if(!rows.length) throw new ApiError(403,'FORBIDDEN','无目录权限');
  return rows[0].payload;
}
app.addHook('onClose',()=>db.end());
app.addHook('onSend',async(request,reply)=>{reply.header('Cache-Control','private, no-store');reply.header('X-Content-Type-Options','nosniff');});
app.setErrorHandler((error,request,reply)=>reply.code(error.statusCode||500).send({success:false,error:{code:error.code||'PLATFORM_ERROR',message:error instanceof ApiError?error.message:'模拟平台服务失败'}}));
app.get('/health',async()=>{await db.query('SELECT 1');return{status:'ok'};});
app.get('/poc/',async(request,reply)=>reply.type('text/html').send(await readFile(new URL('./index.html',import.meta.url),'utf8')));
app.post('/poc/login',async(request,reply)=>{
  requireOrigin(request,origin);accessKey(request);
  if(typeof request.body?.user!=='string')throw invalid();
  const [users]=await db.query('SELECT user_code FROM poc_users WHERE user_code=?',[request.body.user]);
  if(!users.length)throw invalid();
  const token=randomBytes(32).toString('hex');
  await db.query('DELETE FROM poc_sessions WHERE expires_at<=UTC_TIMESTAMP()');
  await db.query('INSERT INTO poc_sessions VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 HOUR))',[hash(token),users[0].user_code]);
  reply.header('Set-Cookie',`fine_auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`);
  return{success:true};
});
app.post('/poc/logout',async(request,reply)=>{
  requireOrigin(request,origin);
  try{const user=await session(request);await db.query('DELETE FROM poc_sessions WHERE token_hash=?',[user.token_hash]);}catch(error){if(error.statusCode!==401)throw error;}
  reply.header('Set-Cookie','fine_auth_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');return{success:true};
});
app.get('/poc/preview/:id',async(request,reply)=>{
  const user=await session(request);const entry=await granted(user.user_code,request.params.id);
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return reply.type('text/html').send(`<meta charset="utf-8"><title>平台预览链路验证</title><main style="font:18px system-ui;padding:40px"><h1>${escape(entry.text)}</h1><p>已验证当前会话和该入口权限。</p><p>这是 Railway 上的帆软模拟预览，不包含真实业务报表。</p><p>入口 ID：${escape(entry.id)}</p></main>`);
});
// Test controls are protected by both the shared test access code and an admin test session.
app.post('/poc/control',async request=>{
  requireOrigin(request,origin);accessKey(request);const actor=await session(request);
  if(actor.user_code!=='admin')throw new ApiError(403,'FORBIDDEN','仅测试管理员可修改测试场景');
  const {action,user,entryId,allowed,fault}=request.body;
  if(!['admin','clinical','empty'].includes(user))throw invalid();
  if(action==='expire') await db.query('DELETE FROM poc_sessions WHERE user_code=?',[user]);
  else if(action==='permission') {
    if(typeof allowed!=='boolean'||typeof entryId!=='string')throw invalid();
    const [entries]=await db.query('SELECT entry_id FROM poc_entries WHERE entry_id=?',[entryId]);if(!entries.length)throw invalid();
    if(allowed)await db.query('INSERT IGNORE INTO poc_permissions VALUES (?,?)',[user,entryId]);
    else await db.query('DELETE FROM poc_permissions WHERE user_code=? AND entry_id=?',[user,entryId]);
  } else if(action==='fault' && ['none','tree-unavailable','malformed-tree','favorites-failed'].includes(fault)) {
    if(fault==='none')await db.query('DELETE FROM poc_faults WHERE user_code=?',[user]);
    else await db.query('INSERT INTO poc_faults VALUES (?,?) ON DUPLICATE KEY UPDATE fault=VALUES(fault)',[user,fault]);
  } else throw invalid();
  return{success:true};
});
app.get('/webroot/decision/poc/session',async request=>{
  const user=await session(request);return{data:{userName:user.user_code,name:user.display_name}};
});
app.get('/webroot/decision/v10/view/entry/tree',async request=>{
  const user=await session(request);const [faults]=await db.query('SELECT fault FROM poc_faults WHERE user_code=?',[user.user_code]);
  if(faults[0]?.fault==='tree-unavailable')throw new ApiError(503,'TEST_FAULT','模拟目录不可用');
  if(faults[0]?.fault==='malformed-tree')return{data:[{id:'invalid'}]};
  const [rows]=await db.query('SELECT e.payload FROM poc_entries e JOIN poc_permissions p USING(entry_id) WHERE p.user_code=? AND e.active=1 ORDER BY entry_id',[user.user_code]);
  return{data:rows.map(r=>r.payload)};
});
app.get('/webroot/decision/v10/favorite/entry/list',async request=>{
  const user=await session(request);const [rows]=await db.query('SELECT entry_id AS id FROM poc_favorites WHERE user_code=? ORDER BY entry_id',[user.user_code]);return{data:rows};
});
app.post('/webroot/decision/v10/favorite/entry/:id',async request=>{
  const user=await session(request);const entry=await granted(user.user_code,request.params.id);
  if(entry.path===null)throw invalid();
  const [faults]=await db.query('SELECT fault FROM poc_faults WHERE user_code=?',[user.user_code]);
  if(faults[0]?.fault==='favorites-failed')return{data:'failed'};
  if(request.query.fakeMethod==='DELETE')await db.query('DELETE FROM poc_favorites WHERE user_code=? AND entry_id=?',[user.user_code,entry.id]);
  else await db.query('INSERT IGNORE INTO poc_favorites VALUES (?,?)',[user.user_code,entry.id]);
  return{data:'success'};
});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close());
await db.query('SELECT 1');await app.listen({host:'::',port:Number(process.env.PORT||3002)});
