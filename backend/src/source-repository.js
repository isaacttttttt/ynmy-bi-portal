import { fineDbSchema } from './config/database.js';
import { ApiError, businessDate, publicUrl } from './http.js';

const METADATA_COLUMNS = `r.report_name AS catalog_name, r.report_type, r.report_total_views AS total_views,
  d.report_name AS dictionary_name, d.report_description,
  d.business_domain, d.business_group, d.belonging_department, d.suggested_owner_name, d.developer_name,
  d.update_cycle, nullif(trim(d.go_live_time),'')::date::text AS online_on, d.usage_scenario,
  d.core_metrics, d.metrics_calc_logic, d.data_source`;

function visitReadTimedOut(error) {
  return ['57014', '55P03'].includes(error.code) || error.message === 'Query read timeout';
}

function parseTotalViews(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

export async function dataAsOf(db, { cache, log } = {}) {
  const load = async () => {
    const { rows } = await db.query('SELECT max(day_id) AS day FROM dim_bi_visit_log');
    if (!rows[0]?.day) throw new ApiError(503, 'DATA_NOT_READY', '访问日志尚未就绪');
    return rows[0].day;
  };
  if (!cache) return load();
  return cache.getOrLoad('data-as-of', load, {
    onEvent: result => log?.info({ stage: 'catalog-cache', key: 'data-as-of', result }, 'catalog cache'),
  });
}

export async function bootstrapDate(db, log, { cache } = {}) {
  try {
    return await dataAsOf(db, { cache, log });
  } catch (error) {
    if (!visitReadTimedOut(error)) throw error;
    log.warn({ stage: 'visit-log-date', code: error.code, reason: error.message }, 'visit log date unavailable');
    return null;
  }
}

function mapReportRow(row, context, entries, visit) {
  const entry = entries.get(row.report_id);
  const granted = Boolean(row.report_id && context.ids.has(row.report_id));
  return {
    id: row.report_id || `dictionary:${row.dictionary_id}`,
    parentId: null,
    sort: 0,
    type: ['bi', 'fvs', 'frm', 'cpt', 'url'].includes(row.report_type?.toLowerCase()) ? row.report_type.toLowerCase() : 'cpt',
    ...entry,
    metadataId: row.dictionary_id || row.report_id,
    name: row.dictionary_name?.trim() || entry?.name || row.catalog_name || '未命名报表',
    description: row.report_description || '',
    module: row.business_domain || '',
    businessGroup: row.business_group?.trim() || '',
    department: row.belonging_department || '',
    owner: row.suggested_owner_name || '',
    developer: row.developer_name || '',
    developerDepartment: '',
    permission: granted ? 'granted' : 'denied',
    frequency: ({ '实时数据': '实时', '每日更新一次': '每日更新', '每月更新一次': '月更新', '其它': '其他' })[row.update_cycle] || row.update_cycle || '',
    status: 'active',
    onlineOn: row.online_on || null,
    updateNote: '',
    source: row.data_source || '',
    metrics: (row.core_metrics || '').split(/[、，,；;\n]+/).map(value => value.trim().replace(/[。；;]+$/, '')).filter(Boolean),
    useScene: row.usage_scenario || '',
    calcLogic: row.metrics_calc_logic || '',
    updatedOn: '',
    views: parseTotalViews(row.total_views),
    visits30d: Number(visit?.visits30d ?? row.visits30d ?? 0),
    lastVisitedOn: visit?.last_visited ?? row.last_visited ?? null,
  };
}

async function loadDictionaryRows(db, cache, log) {
  const load = async () => {
    const { rows } = await db.query(
      `/* portal: dictionary metadata */ SELECT d.report_id, d.id AS dictionary_id, ${METADATA_COLUMNS}
       FROM dim_bi_report_dictionary d LEFT JOIN dim_bi_report_info_dtl r USING (report_id)
       ORDER BY coalesce(nullif(d.report_name,''),r.report_name), d.id`,
    );
    return rows;
  };
  if (!cache) return load();
  return cache.getOrLoad('dictionary-rows', load, {
    onEvent: result => log?.info({ stage: 'catalog-cache', key: 'dictionary-rows', result }, 'catalog cache'),
  });
}

async function loadCatalogRows(db, cache, log) {
  const load = async () => {
    const { rows } = await db.query(
      `/* portal: catalog metadata */ SELECT r.report_id, ${METADATA_COLUMNS}
       FROM dim_bi_report_info_dtl r LEFT JOIN dim_bi_report_dictionary d USING (report_id)
       ORDER BY coalesce(nullif(d.report_name,''),r.report_name), r.report_id`,
    );
    return rows;
  };
  if (!cache) return load();
  return cache.getOrLoad('catalog-rows', load, {
    onEvent: result => log?.info({ stage: 'catalog-cache', key: 'catalog-rows', result }, 'catalog cache'),
  });
}

export async function reportsFor(db, context, dictionary = false, { includeUserVisits = !dictionary, cache } = {}) {
  if (!dictionary && !context.ids.size) return [];
  const entries = context.entryMap ?? new Map(context.entries.map(entry => [entry.id, entry]));

  if (dictionary) {
    const rows = await loadDictionaryRows(db, cache, context.log);
    return rows
      .filter(row => entries.get(row.report_id)?.type !== 'folder')
      .map(row => mapReportRow(row, context, entries));
  }

  const catalogRows = (await loadCatalogRows(db, cache, context.log))
    .filter(row => context.ids.has(row.report_id) && entries.get(row.report_id)?.type !== 'folder');
  if (!includeUserVisits || !catalogRows.length) {
    return catalogRows.map(row => mapReportRow(row, context, entries));
  }

  const asOf = await dataAsOf(db, { cache, log: context.log });
  const ids = catalogRows.map(row => row.report_id);
  const { rows: visitRows } = await db.query(
    `/* portal: user visits */ SELECT report_id,
       sum(visit_num::bigint) FILTER (WHERE day_id >= ($3::date - 29)::text) AS visits30d,
       max(day_id) AS last_visited
     FROM dim_bi_visit_log
     WHERE user_code=$2 AND report_id=ANY($1::text[]) AND day_id <= $3::text
     GROUP BY report_id`,
    [ids, context.user.userName, asOf],
  );
  const visits = new Map(visitRows.map(row => [row.report_id, row]));
  return catalogRows.map(row => mapReportRow(row, context, entries, visits.get(row.report_id)));
}

export async function userDeptJobIds(fineDb, context, { env = process.env } = {}) {
  const schema = fineDbSchema(env);
  const { rows } = await fineDb.query(
    `/* portal: finedb user departments */
     SELECT DISTINCT dep_id
     FROM (
       SELECT trim(dr.departmentid::text) AS dep_id
       FROM ${schema}.fine_user_role_middle urm
       JOIN ${schema}.fine_user fu ON fu.id = urm.userid
       JOIN ${schema}.fine_dep_role dr ON dr.id = urm.roleid
       WHERE fu.username = $1
         AND fu.enable::text IN ('true', 't')
         AND ($2::text[] IS NULL OR fu.id::text = ANY($2::text[]))
         AND urm.roletype = 1
         AND dr.departmentid IS NOT NULL
         AND trim(dr.departmentid::text) <> ''
       UNION
       SELECT trim(urm.roleid::text) AS dep_id
       FROM ${schema}.fine_user_role_middle urm
       JOIN ${schema}.fine_user fu ON fu.id = urm.userid
       WHERE fu.username = $1
         AND fu.enable::text IN ('true', 't')
         AND ($2::text[] IS NULL OR fu.id::text = ANY($2::text[]))
         AND urm.roletype = 1
         AND urm.roleid IS NOT NULL
         AND trim(urm.roleid::text) <> ''
     ) t`,
    [context.user.userName, context.user.fineUserIds ?? null],
  );
  return rows.map(row => row.dep_id).filter(Boolean);
}

export async function noticesFor(db, context, { fineDb = null, env = process.env } = {}) {
  let deptJobIds = null;
  if (Array.isArray(context.user?.oaDeptCodes)) {
    deptJobIds = context.user.oaDeptCodes;
  } else if (fineDb) {
    try {
      deptJobIds = await userDeptJobIds(fineDb, context, { env });
    } catch (error) {
      if (!['42P01', '42703', '3F000', '42501'].includes(error.code)) throw error;
      context.log?.warn({ stage: 'notice-departments', code: error.code, reason: error.message }, 'finedb user departments unavailable, falling back to dim_bi_user');
    }
  }

  let rows;
  if (Array.isArray(deptJobIds)) {
    if (!deptJobIds.length) return [];
    ({ rows } = await db.query(
      `SELECT n.* FROM (SELECT DISTINCT n.* FROM fr_index_noticement n
        INNER JOIN (
          SELECT DISTINCT trim(m.dept_name) AS dept_name
          FROM dim_dept_mapping m
          WHERE trim(m.dept_job_id) = ANY($1::text[])
        ) departments ON departments.dept_name IN
          (SELECT trim(value) FROM unnest(string_to_array(n.notice_dept_name,',')) AS value)
        WHERE nullif(trim(n.notice_start_day_id),'')::date <= $2::date
          AND (nullif(trim(n.notice_last_day_id),'') IS NULL OR n.notice_last_day_id::date >= $2::date)
        ) n
        ORDER BY CASE WHEN n.notice_is_top IN ('1','是') THEN 1 ELSE 0 END DESC,
          n.notice_register_day_id DESC, n.notice_uuid`,
      [deptJobIds, businessDate()],
    ));
  } else {
    ({ rows } = await db.query(
      `SELECT n.* FROM (SELECT DISTINCT n.* FROM fr_index_noticement n
        INNER JOIN (
          SELECT DISTINCT trim(m.dept_name) AS dept_name
          FROM dim_bi_user u INNER JOIN dim_dept_mapping m ON trim(u.oa_dept_code)=trim(m.dept_job_id)
          WHERE u.username=$1 AND u.enable='true'
            AND ($3::text[] IS NULL OR u.id::text=ANY($3::text[]))
        ) departments ON departments.dept_name IN
          (SELECT trim(value) FROM unnest(string_to_array(n.notice_dept_name,',')) AS value)
        WHERE nullif(trim(n.notice_start_day_id),'')::date <= $2::date
          AND (nullif(trim(n.notice_last_day_id),'') IS NULL OR n.notice_last_day_id::date >= $2::date)
        ) n
        ORDER BY CASE WHEN n.notice_is_top IN ('1','是') THEN 1 ELSE 0 END DESC,
          n.notice_register_day_id DESC, n.notice_uuid`,
      [context.user.userName, businessDate(), context.user.fineUserIds ?? null],
    ));
  }
  return rows.map(row => ({
    id: row.notice_uuid, title: row.notice_title || '', category: row.notice_category || '',
    pinned: ['1', '是'].includes(row.notice_is_top), publishedOn: row.notice_register_day_id || '',
    content: row.notice_content || '',
    ...(['1', '是'].includes(row.notice_is_hyperlink) && publicUrl(row.notice_hyperlink) ? { url: publicUrl(row.notice_hyperlink) } : {}),
    ...(publicUrl(row.notice_file_url) ? { attachment: { name: row.file_name || '下载附件', url: publicUrl(row.notice_file_url) } } : {}),
  }));
}

export async function quickEntries(db, { cache, log } = {}) {
  const load = async () => {
    const { rows } = await db.query('SELECT * FROM fr_quick_entry_app WHERE status=1 ORDER BY sort_no, app_id');
    return rows.map(row => ({ id: row.app_id, name: row.app_name, description: row.app_desc || '', url: publicUrl(row.jump_url), iconUrl: publicUrl(row.icon_url) }));
  };
  if (!cache) return load();
  return cache.getOrLoad('quick-entries', load, {
    onEvent: result => log?.info({ stage: 'catalog-cache', key: 'quick-entries', result }, 'catalog cache'),
  });
}
