import pg from 'pg';
// Business DATE and timestamp-without-zone fields keep their stored calendar values.
pg.types.setTypeParser(1082, value => value);
pg.types.setTypeParser(1114, value => value);
export function createPool(env = process.env) {
  for (const key of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) if (!env[key]) throw new Error(`Missing ${key}`);
  const pool = new pg.Pool({ host: env.DB_HOST, port: Number(env.DB_PORT || 5432), user: env.DB_USER,
    password: env.DB_PASSWORD, database: env.DB_NAME, max: 10, connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000, statement_timeout: 5000, query_timeout: 6000 });
  pool.on('error', error => console.error('PostgreSQL pool error:', error.code || 'CONNECTION_ERROR'));
  return pool;
}
