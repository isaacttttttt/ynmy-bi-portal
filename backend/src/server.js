import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import routes from './routes/index.js';
import { setupDatabase } from './config/database.js';

// 加载环境变量
dotenv.config();

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

// 注册CORS插件
await fastify.register(cors, {
  origin: true,
  credentials: true,
});

// 设置数据库连接
setupDatabase(fastify);

// 注册路由
await fastify.register(routes);

// 健康检查
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// 启动服务器
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`🚀 服务器启动成功！`);
    console.log(`📍 地址: http://${host}:${port}`);
    console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
