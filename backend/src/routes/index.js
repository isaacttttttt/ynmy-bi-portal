import noticeRoutes from './notice.js';
import quickEntryRoutes from './quickEntry.js';
import reportRoutes from './report.js';
import workbenchRoutes from './workbench.js';

export default async function routes(fastify, options) {
  // API 根路径
  fastify.get('/api', async (request, reply) => {
    return {
      message: '云南白药BI门户 API',
      version: '1.0.0',
      endpoints: [
        '/api/notices',
        '/api/quick-entries',
        '/api/reports',
        '/api/workbench',
      ],
    };
  });

  // 注册各模块路由
  fastify.register(noticeRoutes, { prefix: '/api/notices' });
  fastify.register(quickEntryRoutes, { prefix: '/api/quick-entries' });
  fastify.register(reportRoutes, { prefix: '/api/reports' });
  fastify.register(workbenchRoutes, { prefix: '/api/workbench' });
}
