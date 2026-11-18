import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

assert(process.env.SOURCE_TEST_DATABASE_URL, 'Provide an isolated test database');
const db = new pg.Client({ connectionString: process.env.SOURCE_TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });
const schema = 'qa_indexes_' + randomUUID().replaceAll('-', '');
const tables = ['dim_bi_user', 'dim_bi_report_info_dtl', 'dim_bi_report_dictionary',
  'dim_bi_visit_log', 'dim_dept_mapping', 'fr_quick_entry_app', 'portal_search_history'];
await db.connect();
try {
  await db.query(`CREATE SCHEMA ${schema}`);
  await db.query(`SET search_path TO ${schema}, public`);
  for (const table of tables) {
    await db.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table})`);
    await db.query(`INSERT INTO ${schema}.${table} SELECT * FROM public.${table} LIMIT ${table === 'dim_bi_visit_log' ? 100000 : 5000}`);
  }
  const old = await readFile(new URL('../sql/004-source-indexes.sql', import.meta.url), 'utf8');
  await db.query(old);
  const sql = (await readFile(new URL('../sql/006-customer-query-indexes.sql', import.meta.url), 'utf8'))
    .replaceAll('public.', schema + '.').replace("n.nspname = 'public'", `n.nspname = '${schema}'`);
  const statements = sql.replace(/^--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean);
  for (let run = 0; run < 2; run++) for (const statement of statements) await db.query(statement);
  const { rows } = await db.query(statements.at(-1));
  for (const name of ['idx_portal_user_id','idx_portal_user_username','idx_portal_report_id',
    'idx_portal_dictionary_report_id','idx_portal_visit_report_day','idx_portal_visit_day',
    'idx_portal_dept_job_trim','idx_portal_quick_entry_enabled_sort','idx_search_history_recent']) {
    assert(rows.some(r => r.index_name === name && r.indisvalid && r.indisready), name);
  }
  const report = (await db.query('SELECT report_id FROM dim_bi_visit_log LIMIT 1')).rows[0]?.report_id;
  for (const [label, sql, values] of [
    ['latest log day', 'SELECT max(day_id) FROM dim_bi_visit_log', []],
    ['report visits', 'SELECT report_id, sum(visit_num::bigint) FROM dim_bi_visit_log WHERE report_id=ANY($1::text[]) AND day_id <= $2 GROUP BY report_id', [[report], '9999-12-31']],
    ['department mapping', "SELECT dept_name FROM dim_dept_mapping WHERE trim(dept_job_id)=$1", ['qa-no-match']],
    ['search history', 'SELECT query_text FROM portal_search_history WHERE user_code=$1 AND category=$2 ORDER BY searched_at DESC, query_key LIMIT 20', ['qa-user', 'all']],
  ]) {
    const result = await db.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + sql, values);
    console.log(label, JSON.stringify(result.rows[0]['QUERY PLAN'][0]));
  }
  console.log('PASS: concurrent indexes, existing 004 indexes, repeat execution and query plans on isolated copies.');
} finally {
  await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await db.end();
}
