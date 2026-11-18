import { ApiError, businessDate, publicUrl } from './http.js';

export async function dataAsOf(db) {
  const { rows } = await db.query('SELECT max(day_id) AS day FROM dim_bi_visit_log');
  if (!rows[0].day) throw new ApiError(503, 'DATA_NOT_READY', '访问日志尚未就绪');
  return rows[0].day;
}

function visitReadTimedOut(error) {
  return ['57014', '55P03'].includes(error.code) || error.message === 'Query read timeout';
}

export async function bootstrapDate(db, log) {
  try {
    return await dataAsOf(db);
  } catch (error) {
    if (!visitReadTimedOut(error)) throw error;
    log.warn({ stage: 'visit-log-date', code: error.code, reason: error.message }, 'visit log date unavailable');
    return null;
  }
}

export async function reportsFor(db, context, dictionary = false) {
  if (!dictionary && !context.ids.size) return [];
  const metadata = `r.report_name AS catalog_name, r.report_type, d.report_name AS dictionary_name, d.report_description,
      d.business_domain, d.business_group, d.belonging_department, d.suggested_owner_name, d.developer_name,
      d.update_cycle, nullif(trim(d.go_live_time),'')::date::text AS online_on, d.usage_scenario,
      d.core_metrics, d.metrics_calc_logic, d.data_source`;
  const ids = [...context.ids];
  let rows;
  if (dictionary) {
    const [catalog, visits] = await Promise.all([
      db.query(`/* portal: dictionary metadata */ SELECT d.report_id, d.id AS dictionary_id,
        d.report_id=ANY($1::text[]) AS granted, ${metadata}
        FROM dim_bi_report_dictionary d LEFT JOIN dim_bi_report_info_dtl r USING (report_id)
        ORDER BY coalesce(nullif(d.report_name,''),r.report_name), d.id`, [ids]),
      dictionaryVisits(db, context),
    ]);
    rows = catalog.rows.map(row => ({ ...row, ...visits?.get(row.report_id),
      total_views: visits === null ? null : visits.get(row.report_id)?.total_views ?? 0 }));
  } else {
    const asOf = await dataAsOf(db);
    ({ rows } = await db.query(`SELECT r.report_id, r.report_id=ANY($1::text[]) AS granted, ${metadata},
      coalesce(v.total_views, 0) AS total_views, v.visits30d, v.last_visited
    FROM dim_bi_report_info_dtl r LEFT JOIN dim_bi_report_dictionary d USING (report_id)
    LEFT JOIN (
      SELECT report_id, sum(visit_num::bigint) AS total_views,
        sum(visit_num::bigint) FILTER (WHERE user_code=$2 AND day_id >= ($3::date - 29)::text) AS visits30d,
        max(day_id) FILTER (WHERE user_code=$2) AS last_visited
      FROM dim_bi_visit_log WHERE report_id=ANY($1::text[]) AND day_id <= $3::text
      GROUP BY report_id
    ) v USING (report_id)
    WHERE r.report_id=ANY($1::text[]) ORDER BY coalesce(nullif(d.report_name,''),r.report_name), r.report_id`, [ids, context.user.userName, asOf]));
  }
  const entries = new Map(context.entries.map(entry => [entry.id, entry]));
  return rows.filter(row => entries.get(row.report_id)?.type !== 'folder').map(row => ({
    id: row.report_id || `dictionary:${row.dictionary_id}`, parentId: null, sort: 0,
    type: ['bi','fvs','frm','cpt','url'].includes(row.report_type?.toLowerCase()) ? row.report_type.toLowerCase() : 'cpt',
    ...entries.get(row.report_id), metadataId: row.dictionary_id || row.report_id, name: row.dictionary_name?.trim() || entries.get(row.report_id)?.name || row.catalog_name || '未命名报表',
    description: row.report_description || '', module: row.business_domain || '', businessGroup: row.business_group?.trim() || '', department: row.belonging_department || '',
    owner: row.suggested_owner_name || '', developer: row.developer_name || '', developerDepartment: '',
    permission: row.granted ? 'granted' : 'denied', frequency: ({'实时数据':'实时','每日更新一次':'每日更新','每月更新一次':'月更新','其它':'其他'})[row.update_cycle] || row.update_cycle || '',
    status: 'active', onlineOn: row.online_on || null, updateNote: '',
    source: row.data_source || '', metrics: (row.core_metrics || '').split(/[、，,；;\n]+/).map(value=>value.trim().replace(/[。；;]+$/,'')).filter(Boolean),
    useScene: row.usage_scenario || '', calcLogic: row.metrics_calc_logic || '', updatedOn: '',
    views: row.total_views === null ? null : Number(row.total_views), visits30d: Number(row.visits30d || 0), lastVisitedOn: row.last_visited || null,
  }));
}

async function dictionaryVisits(db, context) {
  try {
    const { rows } = await db.query(`/* portal: dictionary visits */ WITH cutoff AS (
        SELECT max(day_id) AS day FROM dim_bi_visit_log
      ) SELECT v.report_id, sum(v.visit_num::bigint) AS total_views,
        sum(v.visit_num::bigint) FILTER (WHERE v.user_code=$1 AND v.day_id >= (cutoff.day::date - 29)::text) AS visits30d,
        max(v.day_id) FILTER (WHERE v.user_code=$1) AS last_visited
      FROM dim_bi_visit_log v CROSS JOIN cutoff
      WHERE v.day_id <= cutoff.day AND v.report_id IN (SELECT report_id FROM dim_bi_report_dictionary)
      GROUP BY v.report_id`, [context.user.userName]);
    return new Map(rows.map(row => [row.report_id, row]));
  } catch (error) {
    if (!visitReadTimedOut(error)) throw error;
    context.log?.warn({ stage: 'dictionary-visits', code: error.code, reason: error.message }, 'dictionary visit stats unavailable');
    return null;
  }
}

export async function noticesFor(db, context) {
  const { rows } = await db.query(`SELECT n.* FROM (SELECT DISTINCT n.* FROM fr_index_noticement n
    INNER JOIN (
      SELECT DISTINCT trim(m.dept_name) AS dept_name
      FROM dim_bi_user u INNER JOIN dim_dept_mapping m ON trim(u.oa_dept_code)=trim(m.dept_job_id)
      WHERE u.username=$1 AND u.enable='true'
    ) departments ON departments.dept_name IN
      (SELECT trim(value) FROM unnest(string_to_array(n.notice_dept_name,',')) AS value)
    WHERE nullif(trim(n.notice_start_day_id),'')::date <= $2::date
      AND (nullif(trim(n.notice_last_day_id),'') IS NULL OR n.notice_last_day_id::date >= $2::date)
    ) n
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
  return rows.map(row => ({id:row.app_id,name:row.app_name,description:row.app_desc || '',url:publicUrl(row.jump_url),iconUrl:publicUrl(row.icon_url)}));
}
