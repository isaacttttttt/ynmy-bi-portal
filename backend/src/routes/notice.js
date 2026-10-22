export default async function noticeRoutes(fastify, options) {
  // 获取制度公告列表
  fastify.get('/', async (request, reply) => {
    const { page = 1, pageSize = 10, isTop } = request.query;

    try {
      let query = `
        SELECT
          notice_uuid as id,
          notice_title as title,
          notice_category as category,
          notice_is_top as isTop,
          notice_last_day_id as expiryDate,
          notice_start_day_id as startDate,
          notice_content as content,
          notice_is_hyperlink as hasHyperlink,
          notice_hyperlink as hyperlink,
          notice_register_user_id as registeredBy,
          notice_register_day_id as registerDate,
          notice_region_id as regionIds,
          notice_region_desc as regionDesc
        FROM fr_index_noticement
        WHERE notice_start_day_id <= CURDATE()
        AND (notice_last_day_id >= CURDATE() OR notice_last_day_id IS NULL)
      `;

      const params = [];

      if (isTop !== undefined) {
        query += ' AND notice_is_top = ?';
        params.push(isTop);
      }

      query += ' ORDER BY notice_is_top DESC, notice_register_day_id DESC';
      query += ' LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

      const [rows] = await fastify.db.query(query, params);

      // 获取总数
      const [countResult] = await fastify.db.query(
        'SELECT COUNT(*) as total FROM fr_index_noticement WHERE notice_start_day_id <= CURDATE() AND (notice_last_day_id >= CURDATE() OR notice_last_day_id IS NULL)'
      );

      return {
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: countResult[0].total,
        },
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: '获取公告列表失败',
        error: error.message,
      });
    }
  });

  // 获取单个公告详情
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const [rows] = await fastify.db.query(
        `SELECT
          notice_uuid as id,
          notice_title as title,
          notice_category as category,
          notice_is_top as isTop,
          notice_last_day_id as expiryDate,
          notice_start_day_id as startDate,
          notice_content as content,
          notice_is_hyperlink as hasHyperlink,
          notice_hyperlink as hyperlink,
          notice_register_user_id as registeredBy,
          notice_register_day_id as registerDate,
          notice_region_id as regionIds,
          notice_region_desc as regionDesc
        FROM fr_index_noticement
        WHERE notice_uuid = ?`,
        [id]
      );

      if (rows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '公告不存在',
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
        message: '获取公告详情失败',
        error: error.message,
      });
    }
  });
}
