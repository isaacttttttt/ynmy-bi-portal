import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { buildApp } from '../src/app.js';

assert(process.env.SOURCE_TEST_DATABASE_URL, 'Provide an isolated test database');
const db = new pg.Client({ connectionString: process.env.SOURCE_TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });
const dir = await mkdtemp(join(tmpdir(), 'portal-data-'));
const logFile = join(dir, 'portal.log');
const origin = 'http://127.0.0.1:3194';
let app;
try {
  await db.connect();
  // Session-local tables shadow business tables; customer imports never replace public data.
  if (process.env.SOURCE_TEST_DICTIONARY_SQL) {
    const sql = await readFile(process.env.SOURCE_TEST_DICTIONARY_SQL, 'utf8');
    const ddl = sql.match(/CREATE TABLE "public"\."dim_bi_report_dictionary"[\s\S]*?\n\)\s*;/)[0];
    await db.query(ddl.replace('CREATE TABLE "public".', 'CREATE TEMP TABLE '));
    const start = sql.indexOf('INSERT INTO "public"."dim_bi_report_dictionary"');
    const end = sql.indexOf('\n--', start);
    await db.query(sql.slice(start, end < 0 ? undefined : end).replaceAll('INSERT INTO "public".', 'INSERT INTO pg_temp.'));
  } else {
    await db.query(`CREATE TEMP TABLE dim_bi_report_dictionary (
      id text, report_id text, report_name text, report_description text, business_domain text,
      business_group text, belonging_department text, suggested_owner_name text, developer_name text,
      update_cycle text, go_live_time text, usage_scenario text, core_metrics text, metrics_calc_logic text, data_source text)`);
  }
  await db.query(`CREATE TEMP TABLE dim_bi_report_info_dtl(report_id text, report_name text, report_type text, report_total_views bigint);
    CREATE TEMP TABLE dim_bi_visit_log(day_id text, report_id text, user_code text, visit_num text);
    CREATE TEMP TABLE fr_quick_entry_app(sort_no int, app_id text, status int)`);
  await db.query((await readFile(new URL('../sql/003-search-history.sql', import.meta.url), 'utf8'))
    .replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE'));
  await db.query(`INSERT INTO dim_bi_report_dictionary(id,report_id,report_name,business_group,belonging_department,go_live_time)
    SELECT 'qa-'||i, 'qa-'||i, 'QA报表'||i, 'QA事业群', 'QA部门', '' FROM generate_series(1,10) i;
    INSERT INTO dim_bi_report_info_dtl SELECT 'qa-'||i,'QA报表'||i,'cpt', 11-i FROM generate_series(1,10) i;
    INSERT INTO dim_bi_visit_log SELECT ('2026-11-01'::date+i)::text,'qa-'||i,'qa-user',(11-i)::text FROM generate_series(1,10) i`);
  await assert.rejects(db.query('SELECT go_live_time::date FROM dim_bi_report_dictionary'), { code: '22007' });
  const entries = Array.from({ length: 10 }, (_, i) => ({ id: `qa-${i+1}`, name: `QA报表${i+1}`, type: 'cpt', parentId: null, sort: i }));
  const context = { entries, ids: new Set(entries.map(e => e.id)), user: { userName: 'qa-user', name: 'QA' } };
  let favorites = entries.map(e => e.id);
  const platform = { context: async request => ({ ...context, log: request.log }), favorites: async () => favorites,
    favorite: async (_, id, value) => { favorites = favorites.filter(item => item !== id); if (value) favorites.push(id); } };
  Object.assign(process.env, { PUBLIC_ORIGIN: origin, FINE_ROOT_ID: 'root', PORTAL_LOG_FILE: logFile, PORTAL_CATALOG_CACHE_TTL_SECONDS: '0' });
  delete process.env.POC_PLATFORM_URL;
  app = await buildApp({ platform, db: { query: (...args) => db.query(...args), end: async () => {} } });
  const call = async (path, method = 'GET', payload) => {
    const response = await app.inject({ url: '/portal/api/portal/v1' + path, method, payload, headers: { origin } });
    assert.equal(response.statusCode, 200, response.body); return response.json().data;
  };
  const dictionary = await call('/reports?organization=' + encodeURIComponent('QA事业群'));
  assert.equal(dictionary.total, 10);
  assert(dictionary.items.every(r => r.businessGroup === 'QA事业群' && r.department === 'QA部门' && r.onlineOn === null));
  assert.equal((await call('/reports?organization=' + encodeURIComponent('QA部门'))).total, 0);
  await call('/search?category=all&q=QA');
  const snapshot = await call('/workbench/snapshot');
  assert.deepEqual(snapshot.recent.map(r => r.id), [10,9,8,7,6,5,4,3].map(i => `qa-${i}`));
  assert.deepEqual(snapshot.frequent.map(r => r.id), [1,2,3,4,5,6,7,8].map(i => `qa-${i}`));
  assert.equal(snapshot.favorites.length, 10);
  assert.equal((await call('/workbench?tab=frequent&pageSize=100')).total, 8);
  for (const query of [' ROI ', 'roi']) await call('/search-history', 'POST', { category: 'all', query });
  assert.equal((await call('/search-history?category=all')).items.length, 1);
  assert.equal((await db.query('SELECT query_text FROM portal_search_history')).rows[0].query_text, 'roi');
  context.user.userName = 'other-user';
  assert.equal((await call('/search-history?category=all')).items.length, 0);
  context.user.userName = 'qa-user';
  assert.equal((await call('/search-history/clear?category=all', 'POST')).items.length, 0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM portal_search_history')).rows[0].n, 0);
  await db.query("INSERT INTO dim_bi_visit_log VALUES ('2026-11-02','qa-2','qa-user','invalid')");
  try {
    const { report } = await call('/favorites/qa-1', 'POST', { favorite: false });
    assert.equal(report.id, 'qa-1');
    assert.equal(report.views, 10);
  } finally {
    await db.query("DELETE FROM dim_bi_visit_log WHERE report_id='qa-2' AND visit_num='invalid'");
  }
  assert(!favorites.includes('qa-1'));
  const forbidden = await app.inject({ url: '/portal/api/portal/v1/search-history', method: 'POST',
    headers: { origin: 'https://other.invalid' }, payload: { category: 'all', query: 'test' } });
  assert.equal(forbidden.statusCode, 403);
  if (process.env.PLAYWRIGHT_MODULE) {
    const { createRequire } = await import('node:module');
    const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE);
    await app.listen({ host: '127.0.0.1', port: 3194 });
    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    try {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      await page.addInitScript(() => localStorage.setItem('ynby.portal.guide.v1', 'done'));
      const methods = [];
      page.on('request', request => { if (request.url().includes('/api/portal/')) methods.push(request.method()); });
      await page.goto(origin + '/portal/');
      await page.locator('.workbench-card').first().waitFor();
      for (const width of [1280, 1920]) {
        await page.setViewportSize({ width, height: Math.round(width * 9 / 16) });
        for (const mode of ['当前布局', '宽度自适应', '双向自适应']) {
          await page.getByRole('button', { name: mode, exact: true }).click();
          for (const tab of ['最近打开', '我常用的']) {
            await page.getByRole('button', { name: tab, exact: true }).click();
            assert.equal(await page.locator('.workbench-card').count(), 8);
            const rows = await page.locator('.workbench-card').evaluateAll(cards => cards.map(card => Math.round(card.offsetTop)));
            assert.equal(new Set(rows).size, 2); assert.equal(rows.filter(top => top === rows[0]).length, 4);
            assert(await page.getByRole('region', { name: '工作台报表列表' }).evaluate(el => el.scrollHeight <= el.clientHeight + 1));
          }
        }
      }
      const search = page.getByRole('combobox', { name: '搜索报表' });
      await search.fill('QA报表');
      const saved = page.waitForResponse(r => r.url().endsWith('/search-history') && r.request().method() === 'POST');
      await page.getByRole('button', { name: '搜索', exact: true }).click();
      assert.equal((await saved).status(), 200);
      await page.locator('.dictionary-card').first().waitFor();
      await page.reload(); await page.locator('.dictionary-card').first().waitFor();
      await page.getByRole('combobox', { name: '搜索报表' }).click();
      await page.locator('.search-history-chips button').filter({ hasText: 'QA报表' }).waitFor();
      const cleared = page.waitForResponse(r => r.url().includes('/search-history/clear') && r.request().method() === 'POST');
      await page.getByRole('button', { name: '清空', exact: true }).click();
      assert.equal((await cleared).status(), 200);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM portal_search_history')).rows[0].n, 0);
      assert(methods.every(method => ['GET', 'POST'].includes(method)));
      console.log('PASS: browser two-by-four layout in three modes, POST search save, reload persistence and clear against PG.');
    } finally { await browser.close(); }
  }
  const schema = 'qa_visit_lock_' + randomUUID().replaceAll('-', '');
  const locker = new pg.Client({ connectionString: process.env.SOURCE_TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await locker.connect();
  try {
    await db.query(`INSERT INTO dim_bi_report_dictionary(id,report_name)
      SELECT 'qa-scale-'||i, '测试报表'||i FROM generate_series(1,920) i`);
    assert((await call('/reports')).total >= 930);
    await db.query(`CREATE SCHEMA ${schema};
      CREATE TABLE ${schema}.dim_bi_visit_log AS SELECT * FROM pg_temp.dim_bi_visit_log;
      DROP TABLE pg_temp.dim_bi_visit_log;
      SET search_path TO ${schema}, public;
      SET statement_timeout = 5000`);
    await locker.query(`BEGIN; LOCK TABLE ${schema}.dim_bi_visit_log IN ACCESS EXCLUSIVE MODE`);
    assert.equal((await call('/bootstrap')).dataAsOf, null);
    const duringLock = await call('/reports?q=QA&volume=low');
    assert.equal(duringLock.total, 10, 'Dictionary reads report_total_views without touching dim_bi_visit_log');
    assert.equal(duringLock.visitStatsUnavailable, undefined);
    assert(duringLock.items.every(r => r.views > 0 && r.permission === 'granted'));
    await locker.query('ROLLBACK');
    assert.equal((await call('/reports?q=QA&volume=high')).total, 0);
    const restored = await call('/reports?q=QA&volume=low');
    assert.equal(restored.visitStatsUnavailable, undefined);
    assert(restored.items.every(r => r.views > 0));
    assert.equal((await call('/bootstrap')).dataAsOf, '2026-11-11');
    assert.equal((await app.inject('/health')).statusCode, 200);
  } finally {
    await locker.end();
    await db.query(`CREATE TEMP TABLE dim_bi_visit_log AS SELECT * FROM ${schema}.dim_bi_visit_log`);
    await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  }
  await db.query('ALTER TABLE pg_temp.dim_bi_report_dictionary RENAME COLUMN business_group TO missing_group');
  const failed = await app.inject('/portal/api/portal/v1/reports?q=QA');
  assert.equal(failed.statusCode, 503);
  assert(!failed.body.includes('business_group'));
  await app.close(); app = null;
  const logs = (await readFile(logFile, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const error = logs.find(line => line.msg === 'request failed' && line.requestId === failed.json().requestId);
  assert.equal(error.route, '/portal/api/portal/v1/reports');
  assert.equal(error.code, '42703');
  assert.match(error.reason, /business_group/); assert(error.stack);
  assert(logs.some(line => line.stage === 'parameters' && line.body?.query === 'roi'));
  assert(logs.some(line => line.stage === 'visit-log-date' && line.code === '57014'));
  console.log('PASS: real PG empty dates, business_group facets, top eight, POST history persistence/clear/isolation, favorites and file error logs.');
} finally {
  if (app) await app.close();
  await db.end();
  await rm(dir, { recursive: true, force: true });
}
