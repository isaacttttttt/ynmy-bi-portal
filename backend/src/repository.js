import { ApiError, businessDate, publicUrl } from './http.js';

export async function dataAsOf(db) {
  const { rows } = await db.query('SELECT data_as_of FROM portal_data_batch WHERE batch_id = 1');
  if (!rows.length) throw new ApiError(503, 'DATA_NOT_READY', '底表数据尚未就绪');
  return rows[0].data_as_of;
}
export async function reportsFor(db, context) {
  if (!context.ids.size) return [];
  const asOf = await dataAsOf(db);
  // ponytail: permission-scoped catalog in memory; move facets/search into SQL if large catalogs make this slow.
  const { rows } = await db.query( `SELECT m.*, i.icon_url, v.visits30d, v.last_visited
    FROM report_metadata m LEFT JOIN icon_repository i ON i.icon_id = m.icon_id
    LEFT JOIN (SELECT report_id, MAX(day_id) AS last_visited,
      SUM(CASE WHEN day_id >= ($1::date - 29) THEN visit_num ELSE 0 END) AS visits30d
      FROM dim_bi_visit_log WHERE user_code = $2 AND day_id <= $1::date GROUP BY report_id) v ON v.report_id = m.fine_entry_id
    WHERE m.is_deleted = 0 AND m.fine_entry_id = ANY($3::text[]) ORDER BY m.sort_no, m.report_id`, [asOf, context.user.userName, [...context.ids]]);
  const entries = new Map(context.entries.map(e => [e.id, e]));
  return rows.filter(r => entries.get(r.fine_entry_id)?.type !== 'folder').map(r => ({
    ...entries.get(r.fine_entry_id), metadataId: String(r.report_id), description: r.report_desc || '',
    module: r.business_module, department: r.report_owner_dept || '', owner: r.report_owner_name,
    developer: r.dev_owner_name || '', developerDepartment: r.dev_owner_dept || '', permission: 'granted', onlineOn: r.online_date || null, updateNote: r.last_update_note || '', frequency: r.update_frequency, status: r.report_status === 1 ? 'active' : 'archived',
    source: r.source_system || '', metrics: r.core_metrics || [], views: Number(r.total_views),
    visits30d: Number(r.visits30d || 0), lastVisitedOn: r.last_visited || null, useScene: r.use_scene || '',
    calcLogic: r.calc_logic || '', updatedOn: r.last_updated_at?.slice(0, 10) || '',
    ...(publicUrl(r.icon_url) ? { iconUrl: r.icon_url } : {}),
  }));
}
export async function noticesFor(db, context) {
  const today = businessDate();
  const { rows } = await db.query( `SELECT * FROM fr_index_noticement WHERE notice_start_day_id <= $1::date
    AND (notice_last_day_id IS NULL OR notice_last_day_id >= $1::date)
    ORDER BY notice_is_top DESC, notice_register_day_id DESC, notice_uuid`, [today]);
  return rows.filter(r => (r.notice_region_id || '').split(',').some(id => context.ids.has(id.trim()))).map(r => ({
    id: r.notice_uuid, title: r.notice_title, category: r.notice_category || '', pinned: r.notice_is_top === 1,
    publishedOn: r.notice_register_day_id, content: r.notice_content || '',
    ...(r.notice_is_hyperlink && publicUrl(r.notice_hyperlink) ? { url: r.notice_hyperlink } : {}),
  }));
}
export async function quickEntries(db) {
  const { rows } = await db.query('SELECT * FROM fr_quick_entry_app WHERE status = 1 AND is_deleted = 0 ORDER BY sort_no, app_id');
  return rows.map(r => ({ id: r.app_key, name: r.app_name, description: r.app_desc || '', url: publicUrl(r.jump_url) }));
}
export async function searchHistory(db, user, category) {
  const { rows: items } = await db.query('SELECT query_text AS query, searched_at AS "searchedAt" FROM portal_search_history WHERE user_code = $1 AND category = $2 ORDER BY searched_at DESC, query_key LIMIT 20', [user, category]);
  return { items: items.map(item => ({ ...item, searchedAt: item.searchedAt.toISOString() })) };
}
export async function saveSearch(db, user, category, query) {
  const key = query.toLocaleLowerCase();
  await db.query(`INSERT INTO portal_search_history (user_code, category, query_key, query_text, searched_at)
    VALUES ($1, $2, $3, $4, clock_timestamp()) ON CONFLICT (user_code, category, query_key)
    DO UPDATE SET query_text = EXCLUDED.query_text, searched_at = EXCLUDED.searched_at`, [user, category, key, query]);
  await db.query(`DELETE FROM portal_search_history WHERE user_code = $1 AND category = $2 AND query_key IN
    (SELECT query_key FROM portal_search_history WHERE user_code = $1 AND category = $2 ORDER BY searched_at DESC, query_key OFFSET 20)`, [user, category]);
  return searchHistory(db, user, category);
}
