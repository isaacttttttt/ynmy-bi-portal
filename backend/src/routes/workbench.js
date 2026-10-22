export default async function workbenchRoutes(fastify, options) {
  // 获取工作台数据（最近打开、常用、收藏）
  fastify.get('/recent', async (request, reply) => {
    const { userId, page = 1, pageSize = 20 } = request.query;

    if (!userId) {
      return reply.code(400).send({
        success: false,
        message: '缺少用户ID参数',
      });
    }

    try {
      // 从访问日志表中获取最近打开的报表
      const [rows] = await fastify.db.query(
        `SELECT DISTINCT
          vl.report_id as id,
          vl.report_desc as name,
          vl.report_type as type,
          rm.icon_id as iconId,
          rm.business_module as module,
          MAX(vl.day_id) as lastOpenTime,
          COUNT(*) as visitCount
        FROM dim_bi_visit_log vl
        LEFT JOIN report_metadata rm ON vl.report_id = rm.report_id
        WHERE vl.user_code = ?
        GROUP BY vl.report_id, vl.report_desc, vl.report_type, rm.icon_id, rm.business_module
        ORDER BY MAX(vl.day_id) DESC, COUNT(*) DESC
        LIMIT ? OFFSET ?`,
        [userId, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize)]
      );

      return {
        success: true,
        data: rows,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: '获取最近打开列表失败',
        error: error.message,
      });
    }
  });

  // 获取常用报表
  fastify.get('/frequent', async (request, reply) => {
    const { userId, page = 1, pageSize = 20 } = request.query;

    if (!userId) {
      return reply.code(400).send({
        success: false,
        message: '缺少用户ID参数',
      });
    }

    try {
      // 按访问次数排序获取常用报表
      const [rows] = await fastify.db.query(
        `SELECT
          vl.report_id as id,
          vl.report_desc as name,
          vl.report_type as type,
          rm.icon_id as iconId,
          rm.business_module as module,
          COUNT(*) as visitCount,
          MAX(vl.day_id) as lastOpenTime
        FROM dim_bi_visit_log vl
        LEFT JOIN report_metadata rm ON vl.report_id = rm.report_id
        WHERE vl.user_code = ?
        GROUP BY vl.report_id, vl.report_desc, vl.report_type, rm.icon_id, rm.business_module
        HAVING COUNT(*) >= 3
        ORDER BY COUNT(*) DESC, MAX(vl.day_id) DESC
        LIMIT ? OFFSET ?`,
        [userId, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize)]
      );

      return {
        success: true,
        data: rows,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: '获取常用报表列表失败',
        error: error.message,
      });
    }
  });

  // 获取收藏报表
  // 注意：这需要对接帆软平台的收藏接口
  fastify.get('/favorite', async (request, reply) => {
    const { userId } = request.query;

    if (!userId) {
      return reply.code(400).send({
        success: false,
        message: '缺少用户ID参数',
      });
    }

    try {
      // 这里需要调用帆软平台的收藏接口
      // 暂时返回空数组，等待对接帆软API
      return {
        success: true,
        data: [],
        message: '需要对接帆软平台收藏接口',
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: '获取收藏列表失败',
        error: error.message,
      });
    }
  });
}
