import { ApiError, businessDate, publicUrl } from './http.js';

export async function dataAsOf(db) {
  const { rows } = await db.query('SELECT max(day_id) AS day FROM dim_bi_visit_log');
  if (!rows[0].day) throw new ApiError(503, 'DATA_NOT_READY', '访问日志尚未就绪');
  return rows[0].day;
}

export async function reportsFor(db, context) {
  if (!context.ids.size) return [];
  const asOf = await dataAsOf(db);
  const { rows } = await db.query(`SELECT r.*, d.report_name AS dictionary_name, d.report_description,
      d.business_domain, d.belonging_department, d.suggested_owner_name, d.developer_name,
      d.update_cycle, d.go_live_time::date::text AS online_on, d.usage_scenario,
      d.core_metrics, d.metrics_calc_logic, d.data_source,
      v.total_views, v.visits30d, v.last_visited
    FROM dim_bi_report_info_dtl r
    LEFT JOIN dim_bi_report_dictionary d USING (report_id)
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
    ...entries.get(row.report_id), metadataId: row.report_id, name: row.dictionary_name?.trim() || entries.get(row.report_id).name,
    description: row.report_description || '', module: row.business_domain || '', department: row.belonging_department || '',
    owner: row.suggested_owner_name || '', developer: row.developer_name || '', developerDepartment: '',
    permission: 'granted', frequency: ({'实时数据':'实时','每日更新一次':'每日更新','每月更新一次':'月更新','其它':'其他'})[row.update_cycle] || row.update_cycle || '',
    status: 'active', onlineOn: row.online_on || null, updateNote: '',
    source: row.data_source || '', metrics: (row.core_metrics || '').split(/[、，,；;\n]+/).map(value=>value.trim().replace(/[。；;]+$/,'')).filter(Boolean),
    useScene: row.usage_scenario || '', calcLogic: row.metrics_calc_logic || '', updatedOn: '',
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
