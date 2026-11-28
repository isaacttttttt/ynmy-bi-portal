import { fineDbSchema } from './config/database.js';
import { ApiError, businessDate, publicUrl } from './http.js';
import { inferReportTypeFromAuthorityObject } from './role-thematic-repository.js';

const FINEDB_FALLBACK_CODES = new Set(['42P01', '42703', '3F000', '42501']);
const DIRECTORY_ROOT_ID = 'decision-directory-root';

const METADATA_COLUMNS_BASE = `r.report_name AS catalog_name, r.report_type, r.report_total_views AS total_views,
  d.report_name AS dictionary_name, d.report_description,
  d.business_domain, d.business_group, d.belonging_department, d.suggested_owner_name, d.developer_name,
  d.update_cycle, nullif(trim(d.go_live_time),'')::date::text AS online_on, d.usage_scenario,
  d.core_metrics, d.metrics_calc_logic, d.data_source`;
const METADATA_COLUMNS_WITH_TAGS = `${METADATA_COLUMNS_BASE}, d.tags`;
const METADATA_COLUMNS_NO_TAGS = `${METADATA_COLUMNS_BASE}, NULL::text AS tags`;

function parseTags(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(v => String(v ?? '').trim()).filter(Boolean))];
  }
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.map(v => String(v ?? '').trim()).filter(Boolean))];
      }
    } catch {
      // Fall back to delimiter splitting if malformed JSON array string.
    }
  }
  return [...new Set(trimmed.split(/[、，,；;\n]+/).map(v => v.trim().replace(/[。；;]+$/, '')).filter(Boolean))];
}

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

function mapReportRow(row, context, entries, visit, options = {}) {
  const reportId = typeof row.report_id === 'string' ? row.report_id.trim() : '';
  const entry = reportId ? entries.get(reportId) : undefined;
  const granted = Boolean(reportId && context.ids.has(reportId));
  const status = options.status ?? 'active';
  const registered = options.registered ?? true;
  const rawType = options.resolvedType ?? row.report_type;
  const resolvedType = ['bi', 'fvs', 'frm', 'cpt', 'url'].includes(rawType?.toLowerCase()) ? rawType.toLowerCase() : 'cpt';
  return {
    id: reportId || `dictionary:${row.dictionary_id}`,
    parentId: null,
    sort: 0,
    type: resolvedType,
    ...entry,
    ...(entry?.type && entry.type !== 'folder' ? { type: entry.type } : { type: resolvedType }),
    metadataId: row.dictionary_id || reportId,
    name: row.dictionary_name?.trim() || entry?.name || options.liveName || row.catalog_name || '未命名报表',
    description: row.report_description || '',
    module: row.business_domain || '',
    tags: parseTags(row.tags),
    businessGroup: (row.business_group || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim(),
    department: row.belonging_department || '',
    owner: row.suggested_owner_name || '',
    developer: row.developer_name || '',
    developerDepartment: '',
    permission: granted ? 'granted' : 'denied',
    frequency: ({ '实时数据': '实时', '每日更新一次': '每日更新', '每月更新一次': '月更新', '其它': '其他' })[row.update_cycle] || row.update_cycle || '',
    status,
    registered,
    onlineOn: row.online_on || null,
    updateNote: '',
    source: row.data_source || '',
    metrics: (row.core_metrics || '').split(/[、，,；;\n]+/).map(value => value.trim().replace(/[。；;]+$/, '')).filter(Boolean),
    useScene: row.usage_scenario || '',
    calcLogic: row.metrics_calc_logic || '',
    updatedOn: '',
    views: parseTotalViews(row.total_views ?? options.fallbackViews),
    visits30d: Number(visit?.visits30d ?? row.visits30d ?? 0),
    lastVisitedOn: visit?.last_visited ?? row.last_visited ?? null,
  };
}

export function extractLiveDirectoryReports(rows) {
  const byId = new Map();
  const childrenByParent = new Map();
  for (const row of rows) {
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    if (!id || byId.has(id)) continue;
    const expandType = row.expand_type === null || row.expand_type === undefined ? null : Number(row.expand_type);
    if (expandType === 1 || expandType === 2) continue;
    const parentId = typeof row.parent_id === 'string' && row.parent_id.trim() ? row.parent_id.trim() : null;
    const displayName = typeof row.display_name === 'string' ? row.display_name.trim() : '';
    const objectPath = typeof row.object_path === 'string' ? row.object_path.trim() : '';
    const node = { id, parentId, displayName, expandType, objectPath };
    byId.set(id, node);
    if (parentId) {
      const list = childrenByParent.get(parentId) || [];
      list.push(node);
      childrenByParent.set(parentId, list);
    }
  }

  const hasDirectoryRoot = byId.has(DIRECTORY_ROOT_ID) || childrenByParent.has(DIRECTORY_ROOT_ID);
  const candidates = [];
  if (hasDirectoryRoot) {
    const visited = new Set([DIRECTORY_ROOT_ID]);
    const queue = [];
    for (const child of childrenByParent.get(DIRECTORY_ROOT_ID) || []) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      queue.push({ node: child, depth: 1 });
    }
    let head = 0;
    while (head < queue.length) {
      const { node, depth } = queue[head++];
      candidates.push(node);
      if (depth >= 32) continue;
      for (const child of childrenByParent.get(node.id) || []) {
        if (visited.has(child.id)) continue;
        visited.add(child.id);
        queue.push({ node: child, depth: depth + 1 });
      }
    }
  } else {
    for (const node of byId.values()) candidates.push(node);
  }

  const liveReports = new Map();
  for (const node of candidates) {
    if (node.id.includes('decision') || node.expandType === null || [1, 2, 3].includes(node.expandType)) continue;
    liveReports.set(node.id, {
      id: node.id,
      displayName: node.displayName,
      expandType: node.expandType,
      objectPath: node.objectPath,
      reportType: inferReportTypeFromAuthorityObject(node.expandType, node.objectPath),
    });
  }
  return liveReports;
}

export async function loadLiveFineDbReports(fineDb, { env = process.env } = {}) {
  const schema = fineDbSchema(env);
  const { rows } = await fineDb.query(
    `/* portal: finedb live directory reports */
     SELECT fao.id,
            fao.parentid AS parent_id,
            fao.displayname AS display_name,
            fao.expandtype AS expand_type,
            fao.path AS object_path
     FROM ${schema}.fine_authority_object fao
     WHERE fao.id IS NOT NULL
       AND trim(fao.id) <> ''
       AND coalesce(fao.expandtype, 0) NOT IN (1, 2)`,
  );
  return extractLiveDirectoryReports(rows);
}

export function createLiveDirectoryStore({
  fineDb,
  ttlMs = 300000,
  refreshIntervalMs = ttlMs > 0 ? Math.max(1000, Math.floor(ttlMs * 0.8)) : 0,
  env = process.env,
  log,
} = {}) {
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 0 || ttlMs > 2147483647) {
    throw new Error('Invalid FINEDB_DIRECTORY_CACHE_TTL_SECONDS');
  }
  if (!Number.isSafeInteger(refreshIntervalMs) || refreshIntervalMs < 0 || refreshIntervalMs > 2147483647) {
    throw new Error('Invalid FINEDB_DIRECTORY_REFRESH_INTERVAL_SECONDS');
  }
  let snapshot = null; // { value: Map, expiresAt: number } | null
  let inFlight = null;
  let timer = null;
  let closed = false;

  async function fetchAndStore(trigger, callLog = log) {
    if (inFlight) {
      callLog?.info({ stage: 'finedb-directory-cache', trigger, result: 'shared' }, 'finedb directory cache');
      return inFlight;
    }
    const promise = (async () => {
      const startedAt = Date.now();
      const liveReports = await loadLiveFineDbReports(fineDb, { env });
      const now = Date.now();
      if (!closed && ttlMs > 0) {
        snapshot = { value: liveReports, expiresAt: now + ttlMs };
      }
      callLog?.info({
        stage: 'finedb-directory-cache',
        trigger,
        result: 'refreshed',
        count: liveReports.size,
        durationMs: now - startedAt,
        ttlMs,
      }, 'finedb directory cache');
      return liveReports;
    })().finally(() => {
      inFlight = null;
    });
    inFlight = promise;
    return promise;
  }

  async function get({ log: callLog = log } = {}) {
    if (!fineDb) return null;
    const now = Date.now();
    if (ttlMs > 0 && snapshot && snapshot.expiresAt > now) {
      callLog?.info({ stage: 'finedb-directory-cache', result: 'hit', count: snapshot.value.size }, 'finedb directory cache');
      return snapshot.value;
    }
    try {
      return await fetchAndStore('demand', callLog);
    } catch (error) {
      if (snapshot && !FINEDB_FALLBACK_CODES.has(error.code)) {
        callLog?.warn(
          { stage: 'finedb-directory-cache', result: 'stale-fallback', code: error.code, reason: error.message },
          'finedb directory refresh failed, serving stale snapshot',
        );
        return snapshot.value;
      }
      throw error;
    }
  }

  function start() {
    if (closed || !fineDb || ttlMs <= 0 || refreshIntervalMs <= 0 || timer) return;
    timer = setInterval(() => {
      if (closed) return;
      void fetchAndStore('timer', log).catch(error => {
        log?.warn(
          { stage: 'finedb-directory-cache', trigger: 'timer', result: 'error', code: error.code, reason: error.message },
          'finedb directory background refresh failed',
        );
      });
    }, refreshIntervalMs);
    timer.unref();
  }

  function invalidate() {
    snapshot = null;
  }

  function stop() {
    closed = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    snapshot = null;
    inFlight = null;
  }

  return {
    get,
    refresh: () => fetchAndStore('manual', log),
    start,
    invalidate,
    stop,
    get hasSnapshot() {
      return snapshot !== null;
    },
  };
}

async function loadReportInfoLookup(db, cache, log) {
  const load = async () => {
    try {
      const { rows } = await db.query(
        `/* portal: report info views lookup */
         SELECT report_id, report_name, report_type, report_total_views AS total_views
         FROM dim_bi_report_info_dtl
         WHERE report_id IS NOT NULL AND trim(report_id) <> ''`,
      );
      return new Map(rows.map(row => [row.report_id.trim(), row]));
    } catch (error) {
      if (!['42P01', '42703'].includes(error.code)) throw error;
      log?.warn({ stage: 'report-info-lookup', code: error.code, reason: error.message }, 'dim_bi_report_info_dtl unavailable for live dictionary views');
      return new Map();
    }
  };
  if (!cache) return load();
  return cache.getOrLoad('report-info-lookup', load, {
    onEvent: result => log?.info({ stage: 'catalog-cache', key: 'report-info-lookup', result }, 'catalog cache'),
  });
}

async function queryMetadataRows(db, sqlBuilder, log, label) {
  try {
    const { rows } = await db.query(sqlBuilder(METADATA_COLUMNS_WITH_TAGS));
    return rows;
  } catch (error) {
    if (error.code !== '42703') throw error;
    log?.warn({ stage: label, code: error.code, reason: error.message }, 'dim_bi_report_dictionary.tags unavailable, falling back without tags');
    const { rows } = await db.query(sqlBuilder(METADATA_COLUMNS_NO_TAGS));
    return rows;
  }
}

async function loadDictionaryRows(db, cache, log) {
  const load = () => queryMetadataRows(
    db,
    columns => `/* portal: dictionary metadata */ SELECT d.report_id, d.id AS dictionary_id, ${columns}
       FROM dim_bi_report_dictionary d LEFT JOIN dim_bi_report_info_dtl r USING (report_id)
       ORDER BY coalesce(nullif(d.report_name,''),r.report_name), d.id`,
    log,
    'dictionary-metadata',
  );
  if (!cache) return load();
  return cache.getOrLoad('dictionary-rows', load, {
    onEvent: result => log?.info({ stage: 'catalog-cache', key: 'dictionary-rows', result }, 'catalog cache'),
  });
}

async function loadCatalogRows(db, cache, log) {
  const load = () => queryMetadataRows(
    db,
    columns => `/* portal: catalog metadata */ SELECT r.report_id, ${columns}
       FROM dim_bi_report_info_dtl r LEFT JOIN dim_bi_report_dictionary d USING (report_id)
       ORDER BY coalesce(nullif(d.report_name,''),r.report_name), r.report_id`,
    log,
    'catalog-metadata',
  );
  if (!cache) return load();
  return cache.getOrLoad('catalog-rows', load, {
    onEvent: result => log?.info({ stage: 'catalog-cache', key: 'catalog-rows', result }, 'catalog cache'),
  });
}

function dictionarySortRank(report) {
  if (report.status === 'archived') return 2;
  return report.registered === false ? 1 : 0;
}

export function parseBusinessGroups(value) {
  if (typeof value !== 'string') return [];
  return [...new Set(value.split(/[,，]+/).map(item => item.trim()).filter(Boolean))];
}

export function canViewDictionaryReport(report, allowedDeptNames) {
  if (report.permission === 'granted') return true;
  if (!allowedDeptNames || !allowedDeptNames.size) return false;
  if (report.registered === false) return false;
  return parseBusinessGroups(report.businessGroup).some(group => allowedDeptNames.has(group));
}

export async function userDeptNamesFor(db, context, { fineDb = null, env = process.env, cache = null } = {}) {
  if (!context?.user) return null;
  const userName = context.user.userName || '';
  const fineUserIds = Array.isArray(context.user.fineUserIds) ? [...context.user.fineUserIds].sort() : null;
  const oaDeptCodes = Array.isArray(context.user.oaDeptCodes) ? [...context.user.oaDeptCodes].sort() : null;
  if (!userName && !oaDeptCodes) return null;

  const load = async () => {
    let rows;
    if (oaDeptCodes) {
      if (!oaDeptCodes.length) return new Set();
      ({ rows } = await db.query(
        `/* portal: user mapped departments */
         SELECT DISTINCT trim(m.dept_name) AS dept_name
         FROM dim_dept_mapping m
         WHERE trim(m.dept_job_id) = ANY($1::text[])
           AND m.dept_name IS NOT NULL AND trim(m.dept_name) <> ''`,
        [oaDeptCodes],
      ));
    } else {
      let fineDeptIds = [];
      if (fineDb) {
        try {
          fineDeptIds = await userDeptJobIds(fineDb, context, { env });
        } catch (error) {
          if (!FINEDB_FALLBACK_CODES.has(error.code)) throw error;
          context.log?.warn({ stage: 'dictionary-departments', code: error.code, reason: error.message }, 'finedb user departments unavailable, falling back to dim_bi_user');
        }
      }
      if (fineDeptIds.length) {
        ({ rows } = await db.query(
          `/* portal: user mapped departments */
           SELECT DISTINCT dept_name FROM (
             SELECT trim(m.dept_name) AS dept_name
             FROM dim_dept_mapping m
             WHERE trim(m.dept_job_id) = ANY($3::text[])
             UNION
             SELECT trim(m.dept_name) AS dept_name
             FROM dim_bi_user u INNER JOIN dim_dept_mapping m ON trim(u.oa_dept_code) = trim(m.dept_job_id)
             WHERE u.username = $1 AND u.enable = 'true'
               AND ($2::text[] IS NULL OR u.id::text = ANY($2::text[]))
           ) departments
           WHERE dept_name IS NOT NULL AND dept_name <> ''`,
          [userName, fineUserIds, fineDeptIds],
        ));
      } else {
        ({ rows } = await db.query(
          `/* portal: user mapped departments */
           SELECT DISTINCT trim(m.dept_name) AS dept_name
           FROM dim_bi_user u INNER JOIN dim_dept_mapping m ON trim(u.oa_dept_code) = trim(m.dept_job_id)
           WHERE u.username = $1 AND u.enable = 'true'
             AND ($2::text[] IS NULL OR u.id::text = ANY($2::text[]))
             AND m.dept_name IS NOT NULL AND trim(m.dept_name) <> ''`,
          [userName, fineUserIds],
        ));
      }
    }
    return new Set(rows.map(row => (typeof row.dept_name === 'string' ? row.dept_name.trim() : '')).filter(Boolean));
  };

  if (!cache) return load();
  const key = `${userName}|${fineUserIds ? fineUserIds.join(',') : ''}|${oaDeptCodes ? oaDeptCodes.join(',') : ''}`;
  return cache.getOrLoad(key, load, {
    onEvent: (result, size) => context.log?.info({ stage: 'user-depts-cache', result, entries: size }, 'user depts cache'),
  });
}

export async function reportsFor(db, context, dictionary = false, { includeUserVisits = !dictionary, cache, fineDb = null, directoryStore = null, userDeptsCache = null, env = process.env } = {}) {
  if (!dictionary && !context.ids.size) return [];
  const entries = context.entryMap ?? new Map(context.entries.map(entry => [entry.id, entry]));

  if (dictionary) {
    const [liveReports, allowedDeptNames] = await Promise.all([
      (async () => {
        if (!directoryStore && !fineDb) return null;
        try {
          return directoryStore
            ? await directoryStore.get({ log: context.log })
            : await loadLiveFineDbReports(fineDb, { env });
        } catch (error) {
          if (!FINEDB_FALLBACK_CODES.has(error.code)) throw error;
          context.log?.warn({ stage: 'dictionary-finedb', code: error.code, reason: error.message }, 'finedb fine_authority_object unavailable, falling back to dim_bi_report_dictionary');
          return null;
        }
      })(),
      userDeptNamesFor(db, context, { fineDb, env, cache: userDeptsCache }),
    ]);

    const applyOrgVisibility = list => (allowedDeptNames ? list.filter(report => canViewDictionaryReport(report, allowedDeptNames)) : list);

    if (liveReports) {
      const [dictRows, infoByReportId] = await Promise.all([
        loadDictionaryRows(db, cache, context.log),
        loadReportInfoLookup(db, cache, context.log),
      ]);
      const matchedLiveIds = new Set();
      const merged = [];

      for (const row of dictRows) {
        const reportId = typeof row.report_id === 'string' ? row.report_id.trim() : '';
        if (!reportId) continue;
        if (entries.get(reportId)?.type === 'folder') continue;
        const live = liveReports.get(reportId);
        const info = infoByReportId.get(reportId);
        if (live) {
          matchedLiveIds.add(reportId);
          merged.push(mapReportRow(row, context, entries, undefined, {
            status: 'active',
            registered: true,
            liveName: live.displayName,
            resolvedType: inferReportTypeFromAuthorityObject(live.expandType, live.objectPath, row.report_type ?? info?.report_type),
            fallbackViews: info?.total_views,
          }));
        } else {
          merged.push(mapReportRow(row, context, entries, undefined, {
            status: 'archived',
            registered: true,
            fallbackViews: info?.total_views,
          }));
        }
      }

      for (const live of liveReports.values()) {
        if (matchedLiveIds.has(live.id)) continue;
        if (entries.get(live.id)?.type === 'folder') continue;
        const info = infoByReportId.get(live.id);
        merged.push(mapReportRow(
          {
            report_id: live.id,
            dictionary_id: null,
            catalog_name: info?.report_name ?? live.displayName,
            report_type: info?.report_type ?? live.reportType,
            total_views: info?.total_views ?? 0,
            dictionary_name: null,
          },
          context,
          entries,
          undefined,
          {
            status: 'active',
            registered: false,
            liveName: live.displayName,
            resolvedType: inferReportTypeFromAuthorityObject(live.expandType, live.objectPath, info?.report_type),
            fallbackViews: info?.total_views,
          },
        ));
      }

      return applyOrgVisibility(merged).sort((a, b) =>
        dictionarySortRank(a) - dictionarySortRank(b)
        || a.name.localeCompare(b.name, 'zh-CN')
        || a.id.localeCompare(b.id),
      );
    }

    const rows = await loadDictionaryRows(db, cache, context.log);
    return applyOrgVisibility(
      rows
        .filter(row => entries.get(row.report_id)?.type !== 'folder')
        .map(row => mapReportRow(row, context, entries)),
    );
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
     SELECT DISTINCT trim(dr.departmentid::text) AS dep_id
     FROM ${schema}.fine_user_role_middle urm
     JOIN ${schema}.fine_user fu ON fu.id = urm.userid
     JOIN ${schema}.fine_dep_role dr ON dr.id = urm.roleid
     WHERE fu.username = $1
       AND fu.enable::text IN ('true', 't')
       AND ($2::text[] IS NULL OR fu.id::text = ANY($2::text[]))
       AND urm.roletype = 1
       AND dr.departmentid IS NOT NULL
       AND trim(dr.departmentid::text) <> ''`,
    [context.user.userName, context.user.fineUserIds ?? null],
  );
  return rows.map(row => row.dep_id).filter(Boolean);
}

export async function noticesFor(db, context, { fineDb = null, env = process.env } = {}) {
  let rows;
  if (Array.isArray(context.user?.oaDeptCodes)) {
    if (!context.user.oaDeptCodes.length) return [];
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
      [context.user.oaDeptCodes, businessDate()],
    ));
  } else {
    let fineDeptIds = [];
    if (fineDb) {
      try {
        fineDeptIds = await userDeptJobIds(fineDb, context, { env });
      } catch (error) {
        if (!['42P01', '42703', '3F000', '42501'].includes(error.code)) throw error;
        context.log?.warn({ stage: 'notice-departments', code: error.code, reason: error.message }, 'finedb user departments unavailable, falling back to dim_bi_user');
      }
    }
    if (fineDeptIds.length) {
      ({ rows } = await db.query(
        `SELECT n.* FROM (SELECT DISTINCT n.* FROM fr_index_noticement n
          INNER JOIN (
            SELECT trim(m.dept_name) AS dept_name
            FROM dim_dept_mapping m
            WHERE trim(m.dept_job_id) = ANY($4::text[])
            UNION
            SELECT trim(m.dept_name) AS dept_name
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
        [context.user.userName, businessDate(), context.user.fineUserIds ?? null, fineDeptIds],
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
