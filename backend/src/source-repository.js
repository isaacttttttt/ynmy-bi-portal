import { ApiError, businessDate, publicUrl } from './http.js';

export async function dataAsOf(db) {
  const { rows } = await db.query('SELECT max(day_id) AS day FROM dim_bi_visit_log');
  if (!rows[0].day) throw new ApiError(503, 'DATA_NOT_READY', '访问日志尚未就绪');
  return rows[0].day;
}

export async function reportsFor(db, context) {
  if (!context.ids.size) return [];
  const asOf = await dataAsOf(db);
  const { rows } = await db.query(`SELECT r.*,
      v.total_views, v.visits30d, v.last_visited
    FROM dim_bi_report_info_dtl r
    LEFT JOIN (
      SELECT report_id, sum(visit_num::bigint) AS total_views,
        sum(visit_num::bigint) FILTER (WHERE user_code=$2 AND day_id >= ($3::date - 29)::text) AS visits30d,
        max(day_id) FILTER (WHERE user_code=$2) AS last_visited
      FROM dim_bi_visit_log WHERE report_id=ANY($1::text[]) AND day_id <= $3::text
      GROUP BY report_id
    ) v USING (report_id)
    WHERE r.report_id=ANY($1::text[]) ORDER BY r.report_name, r.report_id`, [[...context.ids], context.user.userName, asOf]);
  const entries = new Map(context.entries.map(entry => [entry.id, entry]));
  return rows.filter(row => entries.get(row.report_id)?.type !== 'folder').map(row => ({
    ...entries.get(row.report_id), metadataId: row.report_id, name: row.report_name,
    // report_lifecycle has no report_id yet; do not infer owners or metrics from names.
    description: '', module: '', department: '', owner: '', developer: '', developerDepartment: '',
    permission: 'granted', frequency: '', status: 'active', onlineOn: null, updateNote: '',
    source: '', metrics: [], useScene: '', calcLogic: '', updatedOn: '',
    views: Number(row.total_views || 0), visits30d: Number(row.visits30d || 0), lastVisitedOn: row.last_visited || null,
  }));
}

export async function noticesFor(db, context) {
  const { rows } = await db.query(`SELECT n.* FROM fr_index_noticement n
    WHERE nullif(trim(n.notice_start_day_id),'')::date <= $2::date
      AND (nullif(trim(n.notice_last_day_id),'') IS NULL OR n.notice_last_day_id::date >= $2::date)
      AND EXISTS (
        SELECT 1 FROM dim_bi_user u JOIN dim_dept_mapping m ON trim(u.oa_dept_code)=trim(m.dept_job_id)
        WHERE u.username=$1 AND u.enable='true'
          AND trim(m.dept_name) IN (SELECT trim(value) FROM unnest(string_to_array(n.notice_dept_name,',')) AS value)
      )
    ORDER BY CASE WHEN n.notice_is_top IN ('1','是') THEN 1 ELSE 0 END DESC,
      n.notice_register_day_id DESC, n.notice_uuid`, [context.user.userName, businessDate()]);
  return rows.map(row => ({
    id: row.notice_uuid, title: row.notice_title || '', category: row.notice_category || '',
    pinned: ['1','是'].includes(row.notice_is_top), publishedOn: row.notice_register_day_id || '',
    content: row.notice_content || '',
    ...(['1','是'].includes(row.notice_is_hyperlink) && publicUrl(row.notice_hyperlink) ? {url:publicUrl(row.notice_hyperlink)} : {}),
    ...(publicUrl(row.notice_file_url) ? {attachment:{name:row.file_name || '下载附件',url:publicUrl(row.notice_file_url)}} : {}),
  }));
}

export async function quickEntries(db) {
  const { rows } = await db.query('SELECT * FROM fr_quick_entry_app WHERE status=1 ORDER BY sort_no, app_id');
  return rows.map(row => ({id:row.app_id,name:row.app_name,description:row.app_desc || '',url:publicUrl(row.jump_url)}));
}
