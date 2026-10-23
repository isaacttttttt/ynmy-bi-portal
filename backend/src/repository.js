import { ApiError, businessDate, publicUrl } from './http.js';

export async function dataAsOf(db) {
  const [rows] = await db.query('SELECT data_as_of FROM portal_data_batch WHERE batch_id = 1');
  if (!rows.length) throw new ApiError(503, 'DATA_NOT_READY', '底表数据尚未就绪');
  return rows[0].data_as_of;
}
export async function reportsFor(db, context) {
  if (!context.ids.size) return [];
  const asOf = await dataAsOf(db);
  // ponytail: permission-scoped catalog in memory; move facets/search into SQL if large catalogs make this slow.
  const [rows] = await db.query({ sql: `SELECT m.*, i.icon_url, v.visits30d, v.last_visited
    FROM report_metadata m LEFT JOIN icon_repository i ON i.icon_id = m.icon_id
    LEFT JOIN (SELECT report_id, MAX(day_id) AS last_visited,
      SUM(CASE WHEN day_id >= DATE_SUB(?, INTERVAL 29 DAY) THEN visit_num ELSE 0 END) AS visits30d
      FROM dim_bi_visit_log WHERE user_code = ? AND day_id <= ? GROUP BY report_id) v ON v.report_id = m.fine_entry_id
    WHERE m.is_deleted = 0 AND m.fine_entry_id IN (?) ORDER BY m.sort_no, m.report_id`, timeout: 5000 }, [asOf, context.user.userName, asOf, [...context.ids]]);
  const entries = new Map(context.entries.map(e => [e.id, e]));
  return rows.filter(r => entries.get(r.fine_entry_id)?.type !== 'folder').map(r => ({
    ...entries.get(r.fine_entry_id), metadataId: String(r.report_id), description: r.report_desc || '',
    module: r.business_module, department: r.report_owner_dept || '', owner: r.report_owner_name,
    developer: r.dev_owner_name || '', frequency: r.update_frequency, status: r.report_status === 1 ? 'active' : 'archived',
    source: r.source_system || '', metrics: r.core_metrics || [], views: Number(r.total_views),
    visits30d: Number(r.visits30d || 0), lastVisitedOn: r.last_visited || null, useScene: r.use_scene || '',
    calcLogic: r.calc_logic || '', updatedOn: r.last_updated_at?.slice(0, 10) || '',
    ...(publicUrl(r.icon_url) ? { iconUrl: r.icon_url } : {}),
  }));
}
export async function noticesFor(db, context) {
  const today = businessDate();
  const [rows] = await db.query({ sql: `SELECT * FROM fr_index_noticement WHERE notice_start_day_id <= ?
    AND (notice_last_day_id IS NULL OR notice_last_day_id >= ?)
    ORDER BY notice_is_top DESC, notice_register_day_id DESC, notice_uuid`, timeout: 5000 }, [today, today]);
  return rows.filter(r => (r.notice_region_id || '').split(',').some(id => context.ids.has(id.trim()))).map(r => ({
    id: r.notice_uuid, title: r.notice_title, category: r.notice_category || '', pinned: r.notice_is_top === 1,
    publishedOn: r.notice_register_day_id, content: r.notice_content || '',
    ...(r.notice_is_hyperlink && publicUrl(r.notice_hyperlink) ? { url: r.notice_hyperlink } : {}),
  }));
}
export async function quickEntries(db) {
  const [rows] = await db.query('SELECT * FROM fr_quick_entry_app WHERE status = 1 AND is_deleted = 0 ORDER BY sort_no, app_id');
  return rows.map(r => ({ id: r.app_key, name: r.app_name, description: r.app_desc || '', url: publicUrl(r.jump_url) }));
}
