// node --expose-gc test/tree-cache-memory.mjs path/to/tree-rows.json
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { platformClient } from '../src/platform.js';

assert(global.gc && process.argv[2], 'Use --expose-gc and provide a tree fixture file');
const rows = JSON.parse(await readFile(process.argv[2], 'utf8'));
const response = JSON.stringify({ data: rows });
let requests = 0, retained;
const server = createServer((req, res) => {
  requests++;
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(response);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { FINE_BASE_URL: `http://127.0.0.1:${server.address().port}`, FINE_IDENTITY_MODE: 'trusted-cookie' };
const db = { query: async () => ({ rows: [{ id: 'id', userName: 'user', name: 'User' }] }) };
const log = { child() { return this; }, info(fields) { if (fields.result === 'stored') retained = fields; }, error() {} };
const req = i => ({ headers: { cookie: `fine_login_users=id; fine_auth_token=benchmark-${i}` }, log });
const warmup = platformClient(env, db), measured = platformClient(env, db);
try {
  for (let i = 0; i < 5; i++) await warmup.context(req(i));
  warmup.close(); await delay(50); global.gc();
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < 100; i++) await measured.context(req(i));
  await delay(50); global.gc();
  const after = process.memoryUsage().heapUsed;
  const start = requests;
  await Promise.all(Array.from({ length: 20 }, () => measured.context(req(1000))));
  assert.equal(requests - start, 1);
  console.log(JSON.stringify({ fixtureNodes: rows.length, requestedSessions: 100,
    retainedSessions: retained.sessions, retainedSerializedBytes: retained.serializedBytes,
    measuredProcessHeapDeltaBytes: after - before, concurrentRequests: 20, upstreamCalls: requests - start,
    note: 'Fixture-based process heap delta, not a production RSS or exact cache allocation guarantee.' }, null, 2));
} finally { warmup.close(); measured.close(); await new Promise(resolve => server.close(resolve)); }
