import mysql from 'mysql2/promise';
export function createPool(env = process.env) {
  for (const key of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) if (!env[key]) throw new Error(`Missing ${key}`);
  return mysql.createPool({
    host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USER,
    password: env.DB_PASSWORD, database: env.DB_NAME, charset: 'utf8mb4',
    dateStrings: true, supportBigNumbers: true, bigNumberStrings: true,
    waitForConnections: true, connectionLimit: 10, queueLimit: 100, connectTimeout: 5000,
  });
}
