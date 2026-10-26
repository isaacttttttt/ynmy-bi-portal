import pg from 'pg';
import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createPool } from '../src/config/database.js';
import { noticesFor } from '../src/repository.js';
import { businessDate } from '../src/http.js';

// Railway pre-deploy only. Runtime services use separate, restricted PostgreSQL roles.
for (const key of ['PGHOST','PGUSER','PGPASSWORD','PGDATABASE','PORTAL_DB_PASSWORD','PLATFORM_DB_PASSWORD']) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}
const db = new pg.Client({ connectionTimeoutMillis: 10000, statement_timeout: 30000 });
const business = ['portal_data_batch','icon_repository','report_metadata','dim_bi_visit_log','fr_index_noticement','fr_quick_entry_app'];
const platform = ['poc_users','poc_entries','poc_permissions','poc_favorites','poc_sessions','poc_faults'];
const tables = [...business, ...platform, 'portal_search_history'];
let source;
await db.connect();
try {
  await db.query("SET TIME ZONE 'UTC'");
  await db.query('BEGIN');
  await db.query("SELECT pg_advisory_xact_lock(790126)");
  for (const file of ['001-portal.sql','002-platform-poc.sql','003-search-history.sql']) {
    await db.query(await readFile(new URL(`../sql/${file}`, import.meta.url), 'utf8'));
  }
  await db.query('CREATE TABLE IF NOT EXISTS portal_migration_log (version TEXT PRIMARY KEY, migrated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, row_counts JSONB NOT NULL)');
  const done = await db.query("SELECT version FROM portal_migration_log WHERE version='mysql-to-pg-v1'");
  if (!done.rowCount) {
    source = await mysql.createConnection({ host: process.env.MYSQLHOST, port: Number(process.env.MYSQLPORT || 3306), user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD, database: process.env.MYSQLDATABASE, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true, connectTimeout: 10000 });
    await source.query('SET TRANSACTION READ ONLY');
    await source.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    const counts = {};
    for (const table of tables) {
      assert.equal((await db.query(`SELECT COUNT(*) FROM ${table}`)).rows[0].count, '0', `Refusing to overwrite nonempty PostgreSQL table: ${table}`);
      const [rows] = await source.query(`SELECT * FROM ${table}`);
      const columns = (await db.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position', ['public', table])).rows;
      for (const row of rows) {
        const fields = columns.filter(c => Object.hasOwn(row, c.column_name));
        const values = fields.map(c => {
          const value = row[c.column_name];
          if (c.data_type === 'jsonb') return typeof value === 'string' ? value : JSON.stringify(value);
          if (c.data_type === 'timestamp with time zone' && value) return value.replace(' ', 'T') + 'Z';
          return value;
        });
        await db.query(`INSERT INTO ${table} (${fields.map(c => '"'+c.column_name+'"').join(',')}) VALUES (${values.map((_, i) => '$'+(i+1)).join(',')})`, values);
      }
      counts[table] = rows.length;
      assert.equal(Number((await db.query(`SELECT COUNT(*) FROM ${table}`)).rows[0].count), rows.length);
    }
    assert.equal((await db.query('SELECT COUNT(*) FROM portal_data_batch WHERE batch_id=1')).rows[0].count, '1', 'Source data batch must be ready');
    await db.query("SELECT setval(pg_get_serial_sequence('fr_quick_entry_app','app_id'), COALESCE(MAX(app_id),1), COUNT(*)>0) FROM fr_quick_entry_app");
    await db.query("INSERT INTO portal_migration_log VALUES ('mysql-to-pg-v1',CURRENT_TIMESTAMP,$1)", [JSON.stringify(counts)]);
    await source.rollback();
    console.log('Migrated existing test data from MySQL to PostgreSQL; verified row counts:', JSON.stringify(counts));
  } else console.log('PostgreSQL migration already complete; existing data preserved.');
  for (const [role, password] of [['portal_reader',process.env.PORTAL_DB_PASSWORD],['portal_platform',process.env.PLATFORM_DB_PASSWORD]]) {
    const exists = await db.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role]);
    if (!exists.rowCount) await db.query(`CREATE ROLE ${role} LOGIN`);
    await db.query(`ALTER ROLE ${role} PASSWORD ${pg.escapeLiteral(password)}`);
    await db.query(`GRANT CONNECT ON DATABASE ${pg.escapeIdentifier(process.env.PGDATABASE)} TO ${role}`);
    await db.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await db.query(`ALTER ROLE ${role} SET timezone='UTC'`);
  }
  await db.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
  await db.query(`GRANT SELECT ON ${business.join(',')} TO portal_reader`);
  await db.query('GRANT SELECT, INSERT, UPDATE, DELETE ON portal_search_history TO portal_reader');
  await db.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${platform.join(',')} TO portal_platform`);
  await db.query('COMMIT');
  const reader = createPool({ DB_HOST:process.env.PGHOST, DB_PORT:process.env.PGPORT, DB_NAME:process.env.PGDATABASE, DB_USER:'portal_reader', DB_PASSWORD:process.env.PORTAL_DB_PASSWORD });
  try {
    await reader.query('SELECT report_id FROM report_metadata LIMIT 1');
    await assert.rejects(reader.query('SELECT * FROM poc_sessions LIMIT 1'), {code:'42501'});
    await assert.rejects(reader.query('UPDATE report_metadata SET sort_no=sort_no WHERE false'), {code:'42501'});
    const client = await reader.connect();
    try {
      await client.query('BEGIN');
      await client.query("INSERT INTO portal_search_history VALUES ('poc-index-check','all','index-check','index-check',CURRENT_TIMESTAMP)");
      const index = await client.query("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='idx_search_history_recent'");
      assert.match(index.rows[0].indexdef, /\(user_code, category, searched_at DESC, query_key\)/);
      const plan = await client.query("EXPLAIN SELECT query_text,searched_at FROM portal_search_history WHERE user_code='poc-index-check' AND category='all' ORDER BY searched_at DESC,query_key LIMIT 20");
      console.log('History query plan:', plan.rows.map(row=>row['QUERY PLAN']).join(' | '));
      await client.query("UPDATE portal_search_history SET query_text='updated' WHERE user_code='poc-index-check'");
      await client.query("DELETE FROM portal_search_history WHERE user_code='poc-index-check'");
    } finally { await client.query('ROLLBACK'); client.release(); }
  } finally { await reader.end(); }
  await db.query('BEGIN');
  await db.query('INSERT INTO fr_index_noticement (notice_uuid,notice_title,notice_start_day_id,notice_last_day_id,notice_register_day_id,notice_region_id) VALUES ($1,$2,$3,$3,$3,$4)', ['poc-date-boundary','结束日当天有效',businessDate(),'topics']);
  assert.ok((await noticesFor(db,{ids:new Set(['topics'])})).some(n=>n.id==='poc-date-boundary'));
  await db.query('ROLLBACK');
  console.log('Verified PostgreSQL business read-only access, session isolation, history CRUD/index and inclusive notice dates.');
} catch (error) {
  await db.query('ROLLBACK');
  console.error('PostgreSQL migration failed:', error.code || error.name);
  process.exitCode = 1;
} finally { if(source) await source.end(); await db.end(); }
