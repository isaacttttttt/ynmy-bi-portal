export default async function quickEntryRoutes(fastify, options) {
  // 获取快捷入口列表
  fastify.get('/', async (request, reply) => {
    try {
      const [rows] = await fastify.db.query(
        `SELECT
          app_id as id,
          app_name as name,
          app_desc as description,
          jump_url as url,
          icon_url as iconUrl,
          sort_no as sortNo,
          status,
          created_at as createdAt,
          updated_at as updatedAt
        FROM fr_quick_entry_app
        WHERE status = 1
        ORDER BY sort_no ASC, app_id ASC`
      );

      return {
        success: true,
        data: rows,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: '获取快捷入口列表失败',
        error: error.message,
      });
    }
  });

  // 获取单个快捷入口
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const [rows] = await fastify.db.query(
        `SELECT
          app_id as id,
          app_name as name,
          app_desc as description,
          jump_url as url,
          icon_url as iconUrl,
          sort_no as sortNo,
          status,
          created_at as createdAt,
          updated_at as updatedAt
        FROM fr_quick_entry_app
        WHERE app_id = ? AND status = 1`,
        [id]
      );

      if (rows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '快捷入口不存在',
        });
      }

      return {
        success: true,
        data: rows[0],
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: '获取快捷入口失败',
        error: error.message,
      });
    }
  });
}
