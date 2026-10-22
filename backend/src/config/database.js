import mysql from 'mysql2/promise';

let pool = null;

export function setupDatabase(fastify) {
  // 创建数据库连接池
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ynmy_bi_portal',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  // 将数据库连接池添加到 Fastify 实例
  fastify.decorate('db', pool);

  // 测试数据库连接
  pool.getConnection()
    .then((connection) => {
      fastify.log.info('✅ 数据库连接成功');
      connection.release();
    })
    .catch((err) => {
      fastify.log.error('❌ 数据库连接失败:', err);
    });

  // 应用关闭时关闭连接池
  fastify.addHook('onClose', async (instance) => {
    await pool.end();
    instance.log.info('数据库连接池已关闭');
  });
}

export function getPool() {
  return pool;
}
