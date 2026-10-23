import 'dotenv/config';
import { buildApp } from './app.js';
const app = await buildApp();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => app.close().catch(() => { process.exitCode = 1; }));
try { await app.listen({ port: Number(process.env.PORT || 3001), host: process.env.HOST || '0.0.0.0' }); }
catch (error) { app.log.error({ code: error.code }, '服务启动失败'); await app.close(); process.exitCode = 1; }
