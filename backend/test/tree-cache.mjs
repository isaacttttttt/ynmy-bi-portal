import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { platformClient } from '../src/platform.js';

const calls = new Map(), logs = [], clients = [];
let status = 200, malformed = false, large = false, version = 1;
const server = createServer(async (req, res) => {
  const token = req.headers.authorization.slice(7);
  const key = token + req.url; calls.set(key, (calls.get(key) || 0) + 1);
  await delay(15);
  const data = req.url === '/tree'
    ? malformed ? [{ id: 'bad' }] : [{ id: token, pId: null, text: large ? 'x'.repeat(20000) : `Report ${version}`, path: 'report.cpt' }]
    : req.url === '/favorites' ? [{ id: token }] : 'success';
  res.writeHead(req.url === '/tree' ? status : 200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ data }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { FINE_BASE_URL: `http://127.0.0.1:${server.address().port}`, FINE_TREE_PATH: '/tree',
  FINE_FAVORITES_PATH: '/favorites', FINE_IDENTITY_MODE: 'trusted-cookie' };
let lookups = 0;
const db = { query: async () => { lookups++; return { rows: [{ id: 'id', userName: 'user', name: 'User' }] }; } };
const logger = { child() { return this; }, info(fields) { logs.push(fields); }, error(fields) { logs.push(fields); } };
const request = token => ({ headers: { cookie: `fine_login_users=id; fine_auth_token=${token}` }, log: logger });
const count = token => calls.get(token + '/tree') || 0;
function client(options = {}) { const value = platformClient({ ...env, ...options }, db); clients.push(value); return value; }
try {
  const cached = client({ FINE_TREE_CACHE_TTL_SECONDS: '1', FINE_TREE_CACHE_MAX_ENTRIES: '2' });
  const first = await Promise.all(Array.from({ length: 20 }, () => cached.context(request('a'))));
  assert.equal(count('a'), 1); assert.equal(lookups, 1, 'Identity cache coalesces concurrent lookups');
  assert(first.every(c => c.entries === first[0].entries && c.entryMap === first[0].entryMap));
  const noIdentityCache = client({ FINE_TREE_CACHE_TTL_SECONDS: '1', FINE_IDENTITY_CACHE_TTL_SECONDS: '0' });
  const beforeNoIdCache = lookups;
  await Promise.all(Array.from({ length: 5 }, () => noIdentityCache.context(request('no-id-cache'))));
  assert.equal(lookups - beforeNoIdCache, 5, 'Identity lookup remains per request when FINE_IDENTITY_CACHE_TTL_SECONDS=0');
  assert.equal((await cached.context(request('b'))).entries[0].id, 'b');
  await cached.context(request('a')); assert.equal(count('a'), 1);
  await cached.context(request('c'));
  await cached.context(request('a')); assert.equal(count('a'), 1, 'Most recently used session stays');
  await cached.context(request('b')); assert.equal(count('b'), 2, 'Least recently used session is evicted');
  await cached.favorites(first[0]); await cached.favorites(first[0]);
  assert.equal(calls.get('a/favorites'), 2, 'Favorites are not cached');
  await delay(1100); version++;
  assert.equal((await cached.context(request('a'))).entries[0].name, 'Report 2');
  assert.equal(count('a'), 2);
  await delay(1100); status = 401;
  const failed = await Promise.allSettled(Array.from({ length: 5 }, () => cached.context(request('a'))));
  assert(failed.every(r => r.status === 'rejected' && r.reason.code === 'SESSION_EXPIRED'));
  assert.equal(count('a'), 3, 'Expired permission is never served after refresh fails');
  status = 200; await cached.context(request('a')); assert.equal(count('a'), 4);
  malformed = true; await assert.rejects(cached.context(request('bad')), { code: 'PLATFORM_UNAVAILABLE' });
  malformed = false; await cached.context(request('bad')); assert.equal(count('bad'), 2);
  const disabled = client({ FINE_TREE_CACHE_TTL_SECONDS: '0' });
  await Promise.all(Array.from({ length: 10 }, () => disabled.context(request('disabled'))));
  assert.equal(count('disabled'), 1);
  await disabled.context(request('disabled')); assert.equal(count('disabled'), 2);
  const bounded = client({ FINE_TREE_CACHE_MAX_MB: '0.0009765625' });
  for (let i = 0; i < 20; i++) await bounded.context(request(`small-${i}`));
  await bounded.context(request('small-0')); assert.equal(count('small-0'), 2, 'Byte budget evicts old data');
  const retained = logs.filter(l => l.result === 'stored').at(-1);
  assert(retained.serializedBytes <= 1024); assert(retained.sessions < 20);
  large = true;
  await Promise.all(Array.from({ length: 5 }, () => bounded.context(request('large'))));
  assert.equal(count('large'), 1);
  await bounded.context(request('large')); assert.equal(count('large'), 2, 'Oversized trees bypass retention');
  assert(logs.some(l => l.result === 'shared')); assert(logs.some(l => l.result === 'hit'));
  assert(logs.some(l => l.result === 'oversized'));
  cached.close(); large = false;
  await cached.context(request('a')); assert.equal(count('a'), 5);
  const defaults = client();
  for (let i = 0; i < 105; i++) await defaults.context(request(`default-${i}`));
  await defaults.context(request('default-0'));
  assert.equal(count('default-0'), 1, 'Default cache is not capped at 100 sessions');
  assert.equal(logs.filter(l => l.result === 'stored').at(-1).sessions, 105);
  for (const options of [{ FINE_TREE_CACHE_TTL_SECONDS: '-1' }, { FINE_TREE_CACHE_MAX_ENTRIES: 'NaN' }, { FINE_TREE_CACHE_MAX_MB: '0' }]) {
    assert.throws(() => client(options), /Invalid tree cache limits/);
  }
  console.log('PASS: concurrent tree coalescing, session isolation, TTL refresh, failed refresh, invalid tree rejection, LRU/byte limits, oversize bypass, cache disabled, unchanged favorites and cleanup.');
} finally { for (const value of clients) value.close(); await new Promise(resolve => server.close(resolve)); }
