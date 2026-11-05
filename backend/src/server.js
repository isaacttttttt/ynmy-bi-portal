import { config } from 'dotenv';
import { buildApp } from './app.js';
const loaded = config({ path: process.env.PORTAL_CONFIG_FILE || '.env' });
if (process.env.PORTAL_CONFIG_FILE && loaded.error) throw new Error('Cannot read PORTAL_CONFIG_FILE');
const app = await buildApp();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => app.close().catch(() => { process.exitCode = 1; }));
try { await app.listen({ port: Number(process.env.PORT || 3001), host: process.env.HOST || '0.0.0.0' }); }
catch (error) { app.log.error({ code: error.code }, '服务启动失败'); await app.close(); process.exitCode = 1; }
