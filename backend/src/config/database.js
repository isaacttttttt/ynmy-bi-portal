import pg from 'pg';
import { readFileSync } from 'node:fs';
// Business DATE and timestamp-without-zone fields keep their stored calendar values.
pg.types.setTypeParser(1082, value => value);
pg.types.setTypeParser(1114, value => value);

function buildPgPool({ host, port, user, password, database, sslMode, sslCaFile, statementTimeout, label }) {
  if (!['disable', 'verify-full'].includes(sslMode)) throw new Error(`Invalid ${label}_SSL_MODE`);
  const queryTimeout = statementTimeout + 5000;
  if (!Number.isInteger(statementTimeout) || statementTimeout <= 0 || queryTimeout > 2147483647) {
    throw new Error(`${label}_STATEMENT_TIMEOUT_MS must be a positive integer within the supported timeout range`);
  }
  const pool = new pg.Pool({
    host,
    port: Number(port || 5432),
    user,
    password,
    database,
    ssl: sslMode === 'disable' ? false : { rejectUnauthorized: true, ...(sslCaFile ? { ca: readFileSync(sslCaFile, 'utf8') } : {}) },
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: statementTimeout,
    query_timeout: queryTimeout,
  });
  pool.on('error', error => console.error(`PostgreSQL (${label}) pool error:`, error.code || 'CONNECTION_ERROR'));
  return pool;
}

export function createPool(env = process.env) {
  for (const key of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) if (!env[key]) throw new Error(`Missing ${key}`);
  return buildPgPool({
    host: env.DB_HOST,
    port: env.DB_PORT || 5432,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    sslMode: env.DB_SSL_MODE || 'disable',
    sslCaFile: env.DB_SSL_CA_FILE,
    statementTimeout: Number(env.DB_STATEMENT_TIMEOUT_MS ?? 60000),
    label: 'DB',
  });
}

export function createFineDbPool(env = process.env) {
  if (!env.FINEDB_HOST) return null;
  for (const key of ['FINEDB_HOST', 'FINEDB_USER', 'FINEDB_PASSWORD', 'FINEDB_NAME']) {
    if (!env[key]) throw new Error(`Missing ${key}`);
  }
  return buildPgPool({
    host: env.FINEDB_HOST,
    port: env.FINEDB_PORT || 5432,
    user: env.FINEDB_USER,
    password: env.FINEDB_PASSWORD,
    database: env.FINEDB_NAME,
    sslMode: env.FINEDB_SSL_MODE || env.DB_SSL_MODE || 'disable',
    sslCaFile: env.FINEDB_SSL_CA_FILE || env.DB_SSL_CA_FILE,
    statementTimeout: Number(env.FINEDB_STATEMENT_TIMEOUT_MS ?? env.DB_STATEMENT_TIMEOUT_MS ?? 60000),
    label: 'FINEDB',
  });
}

export function fineDbSchema(env = process.env) {
  const fallback = env.FINEDB_HOST ? 'public' : 'finedb';
  const name = (env.FINEDB_SCHEMA || fallback).trim();
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error('Invalid FINEDB_SCHEMA');
  return name;
}
