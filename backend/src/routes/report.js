export default async function reportRoutes(fastify, options) {
  // 获取报表字典列表
  fastify.get('/dictionary', async (request, reply) => {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      module,
      status,
      updateFrequency,
    } = request.query;

    try {
      let query = `
        SELECT
          report_id as id,
          report_name as name,
          icon_id as iconId,
          fine_report_path as path,
          report_desc as description,
          use_scene as useScene,
          business_module as module,
          report_owner_name as ownerName,
          report_owner_dept as ownerDept,
          dev_owner_name as devOwnerName,
          dev_owner_dept as devOwnerDept,
          source_system as sourceSystem,
          core_metrics as coreMetrics,
          calc_logic as calcLogic,
          update_frequency as updateFrequency,
          report_status as status,
          online_date as onlineDate,
          last_updated_at as lastUpdatedAt,
          last_update_note as lastUpdateNote,
          total_views as totalViews,
          permission_code as permissionCode,
          sort_no as sortNo
        FROM report_metadata
        WHERE is_deleted = 0
      `;

      const params = [];

      if (keyword) {
        query += ' AND (report_name LIKE ? OR report_desc LIKE ? OR report_owner_name LIKE ?)';
        const searchTerm = `%${keyword}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      if (module) {
        query += ' AND business_module = ?';
        params.push(module);
      }

      if (status !== undefined) {
        query += ' AND report_status = ?';
        params.push(status);
      }

      if (updateFrequency) {
        query += ' AND update_frequency = ?';
        params.push(updateFrequency);
      }

      query += ' ORDER BY sort_no ASC, total_views DESC, report_id DESC';
      query += ' LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

      const [rows] = await fastify.db.query(query, params);

      // 获取总数
      let countQuery = 'SELECT COUNT(*) as total FROM report_metadata WHERE is_deleted = 0';
      const countParams = [];

      if (keyword) {
        countQuery += ' AND (report_name LIKE ? OR report_desc LIKE ? OR report_owner_name LIKE ?)';
        const searchTerm = `%${keyword}%`;
        countParams.push(searchTerm, searchTerm, searchTerm);
      }

      if (module) {
        countQuery += ' AND business_module = ?';
        countParams.push(module);
      }

      if (status !== undefined) {
        countQuery += ' AND report_status = ?';
        countParams.push(status);
      }

      if (updateFrequency) {
        countQuery += ' AND update_frequency = ?';
        countParams.push(updateFrequency);
      }

      const [countResult] = await fastify.db.query(countQuery, countParams);

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
        message: '获取报表字典失败',
        error: error.message,
      });
    }
  });

  // 获取报表详情
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const [rows] = await fastify.db.query(
        `SELECT
          report_id as id,
          report_name as name,
          icon_id as iconId,
          fine_report_path as path,
          report_desc as description,
          use_scene as useScene,
          business_module as module,
          report_owner_name as ownerName,
          report_owner_dept as ownerDept,
          dev_owner_name as devOwnerName,
          dev_owner_dept as devOwnerDept,
          source_system as sourceSystem,
          core_metrics as coreMetrics,
          calc_logic as calcLogic,
          update_frequency as updateFrequency,
          report_status as status,
          online_date as onlineDate,
          last_updated_at as lastUpdatedAt,
          last_update_note as lastUpdateNote,
          total_views as totalViews,
          permission_code as permissionCode,
          sort_no as sortNo
        FROM report_metadata
        WHERE report_id = ? AND is_deleted = 0`,
        [id]
      );

      if (rows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '报表不存在',
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
        message: '获取报表详情失败',
        error: error.message,
      });
    }
  });

  // 增加报表访问次数
  fastify.post('/:id/view', async (request, reply) => {
    const { id } = request.params;

    try {
      await fastify.db.query(
        'UPDATE report_metadata SET total_views = total_views + 1 WHERE report_id = ?',
        [id]
      );

      return {
        success: true,
        message: '访问次数已更新',
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: '更新访问次数失败',
        error: error.message,
      });
    }
  });
}
