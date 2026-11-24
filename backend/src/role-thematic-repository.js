import { ApiError } from './http.js';
import { fineDbSchema } from './config/database.js';
import { validateRoleThematicNodes } from '../../src/lib/portal-model.ts';

const VALID_TYPES = new Set(['bi', 'fvs', 'frm', 'cpt', 'url']);

function normalizeReportType(value) {
  const lowered = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return VALID_TYPES.has(lowered) ? lowered : 'cpt';
}

export function inferReportTypeFromAuthorityObject(expandType, pathValue, fallbackType = null) {
  const typeNum = Number(expandType);
  const path = typeof pathValue === 'string' ? pathValue.trim().toLowerCase() : '';
  if (typeNum === 201) return 'bi';
  if (typeNum === 5 || /^https?:\/\//.test(path)) return 'url';
  if (/\.fvs(?:$|[?/#])/.test(path)) return 'fvs';
  if (/\.frm(?:$|[?/#])/.test(path)) return 'frm';
  if (/\.cpt(?:$|[?/#])/.test(path)) return 'cpt';
  if (typeof fallbackType === 'string' && VALID_TYPES.has(fallbackType.trim().toLowerCase())) {
    return fallbackType.trim().toLowerCase();
  }
  if (typeNum === 102) return 'cpt';
  return 'bi';
}

async function withTransaction(db, fn) {
  if (typeof db.connect === 'function') {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  return fn(db);
}

export function parseUserRoleIds(rawValues) {
  const result = new Set();
  for (const raw of rawValues) {
    if (raw === null || raw === undefined) continue;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === 'string' && item.trim()) result.add(item.trim());
      }
      continue;
    }
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === 'string' && item.trim()) result.add(item.trim());
          }
          continue;
        }
      } catch {
        // Fall through to delimiter parsing if malformed JSON array string.
      }
    }
    for (const part of trimmed.replace(/^\[|\]$/g, '').split(',')) {
      const cleaned = part.trim().replace(/^["']|["']$/g, '').trim();
      if (cleaned) result.add(cleaned);
    }
  }
  return [...result].sort();
}

export async function userRoleIds(db, userName, { cache, log, env = process.env } = {}) {
  const schema = fineDbSchema(env);
  const loader = async () => {
    const { rows } = await db.query(
      `/* portal: finedb user roles */
       SELECT DISTINCT urm.roleid AS role_id
       FROM ${schema}.fine_user_role_middle urm
       JOIN ${schema}.fine_user fu ON fu.id = urm.userid
       WHERE fu.username = $1
         AND urm.roletype = 2
         AND urm.roleid IS NOT NULL
         AND trim(urm.roleid) <> ''
       ORDER BY urm.roleid`,
      [userName],
    );
    return parseUserRoleIds(rows.map(row => row.role_id));
  };
  if (!cache) return loader();
  return cache.getOrLoad(`${schema}:${userName}`, loader, {
    onEvent: (result, size) => log?.info({ stage: 'user-roles-cache', result, entries: size }, 'user roles cache'),
  });
}

function compileRoleTree(config, rawNodes) {
  const childrenByParent = new Map();
  for (const row of rawNodes) {
    if (!row.node_id) continue;
    const key = row.parent_node_id ?? '';
    const list = childrenByParent.get(key) || [];
    list.push(row);
    childrenByParent.set(key, list);
  }
  const orderedNodes = [];
  const visited = new Set();
  const stack = [...(childrenByParent.get('') || [])].reverse();
  while (stack.length) {
    const row = stack.pop();
    if (visited.has(row.node_id)) continue;
    visited.add(row.node_id);
    if (row.node_type === 'folder') {
      orderedNodes.push({
        nodeType: 'folder',
        id: row.node_id,
        parentId: row.parent_node_id,
        name: row.node_name,
        sort: Number(row.sort_no) || 0,
      });
      const children = childrenByParent.get(row.node_id) || [];
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
    } else if (row.node_type === 'report' && row.report_id) {
      orderedNodes.push({
        nodeType: 'report',
        reportId: row.report_id,
        parentId: row.parent_node_id,
        name: row.node_name?.trim() || '',
        catalogName: row.catalog_name || '',
        reportType: normalizeReportType(row.report_type),
        sort: Number(row.sort_no) || 0,
      });
    }
  }
  return { configured: true, id: config.role_id, name: config.role_name, nodes: orderedNodes };
}

async function fetchFineCustomRoleNames(fineDb, roleIds, log, env = process.env) {
  const schema = fineDbSchema(env);
  try {
    const { rows } = await fineDb.query(
      `/* portal: finedb custom role names */
       SELECT id AS role_id, name AS role_name
       FROM ${schema}.fine_custom_role
       WHERE id = ANY($1::text[])`,
      [roleIds],
    );
    const map = new Map();
    for (const row of rows) {
      if (row.role_id && typeof row.role_name === 'string' && row.role_name.trim()) {
        map.set(row.role_id, row.role_name.trim());
      }
    }
    return map;
  } catch (error) {
    if (!['42P01', '42703', '3F000', '42501'].includes(error.code)) throw error;
    log?.warn({ stage: 'thematic-cache', code: error.code, reason: error.message }, 'finedb.fine_custom_role unavailable, falling back to stored role_name');
    return new Map();
  }
}

async function fetchCompiledRoles(db, fineDb, roleIds, log, env = process.env) {
  const [{ rows }, liveRoleNames] = await Promise.all([
    db.query(
      `/* portal: role thematic tree */
       SELECT c.role_id, c.role_name,
              n.node_id, n.parent_node_id, n.node_type, n.report_id,
              n.node_name, n.sort_no, r.report_name AS catalog_name, r.report_type
       FROM portal_role_thematic_config c
       LEFT JOIN portal_role_thematic_node n
         ON n.role_id = c.role_id AND n.is_enabled = TRUE
       LEFT JOIN dim_bi_report_info_dtl r USING (report_id)
       WHERE c.role_id = ANY($1::text[])
       ORDER BY c.role_name, c.role_id, n.parent_node_id NULLS FIRST, n.sort_no, n.node_id`,
      [roleIds],
    ),
    fetchFineCustomRoleNames(fineDb, roleIds, log, env),
  ]);
  const grouped = new Map();
  for (const row of rows) {
    let entry = grouped.get(row.role_id);
    if (!entry) {
      entry = {
        config: { role_id: row.role_id, role_name: liveRoleNames.get(row.role_id) || row.role_name },
        rows: [],
      };
      grouped.set(row.role_id, entry);
    }
    if (row.node_id) entry.rows.push(row);
  }
  const compiled = new Map();
  for (const id of roleIds) {
    const found = grouped.get(id);
    compiled.set(id, found ? compileRoleTree(found.config, found.rows) : { configured: false, id });
  }
  log?.info({ stage: 'thematic-cache', result: 'loaded', requested: roleIds.length, configured: grouped.size }, 'role thematic loaded');
  return compiled;
}

export async function thematicRolesFor(db, context, { fineDb = db, cache, userRolesCache, env = process.env } = {}) {
  let roleIds;
  if (Array.isArray(context.user?.roleIds)) {
    roleIds = context.user.roleIds;
  } else {
    try {
      roleIds = await userRoleIds(fineDb, context.user.userName, { cache: userRolesCache, log: context.log, env });
    } catch (error) {
      if (error.code === '42P01' || error.code === '42703' || error.code === '3F000') {
        context.log?.warn({ stage: 'role-thematic', code: error.code, reason: error.message }, 'role thematic finedb user roles unavailable');
        return [];
      }
      throw error;
    }
  }
  if (!roleIds.length) return [];

  const resolved = [];
  const missing = [];
  for (const id of roleIds) {
    const hit = cache?.peek(id);
    if (hit !== undefined) resolved.push(hit);
    else missing.push(id);
  }
  if (missing.length) {
    try {
      const loaded = await fetchCompiledRoles(db, fineDb, missing, context.log, env);
      for (const [id, value] of loaded) {
        cache?.set(id, value);
        resolved.push(value);
      }
    } catch (error) {
      if (error.code === '42P01' || error.code === '42703') {
        context.log?.warn({ stage: 'role-thematic', code: error.code, reason: error.message }, 'role thematic tables unavailable');
        return [];
      }
      throw error;
    }
  } else if (cache) {
    context.log?.info({ stage: 'thematic-cache', result: 'hit', roles: roleIds.length }, 'role thematic cache');
  }

  const platformEntries = context.entryMap ?? new Map(context.entries.map(entry => [entry.id, entry]));
  return resolved
    .filter(item => item.configured)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .map(role => {
      const entries = [];
      for (const node of role.nodes) {
        if (node.nodeType === 'folder') {
          entries.push({
            id: node.id,
            parentId: node.parentId,
            name: node.name,
            type: 'folder',
            sort: node.sort,
          });
        } else if (context.ids.has(node.reportId)) {
          const platformEntry = platformEntries.get(node.reportId);
          if (platformEntry?.type === 'folder') continue;
          const type = platformEntry?.type || node.reportType;
          entries.push({
            id: node.reportId,
            parentId: node.parentId,
            name: node.name || platformEntry?.name || node.catalogName || '未命名报表',
            type,
            sort: node.sort,
            ...(platformEntry?.templateId ? { templateId: platformEntry.templateId } : {}),
            ...(platformEntry?.url ? { url: platformEntry.url } : {}),
            ...(platformEntry?.iconUrl ? { iconUrl: platformEntry.iconUrl } : {}),
          });
        }
      }
      return { id: role.id, name: role.name, entries };
    });
}

export async function roleSummaryCounts(db, roleIds) {
  if (!roleIds.length) return new Map();
  const { rows } = await db.query(
    `SELECT c.role_id,
            count(n.node_id) FILTER (WHERE n.node_type = 'report')::int AS total_reports,
            count(n.node_id) FILTER (WHERE n.node_type = 'report' AND n.is_enabled)::int AS enabled_reports
     FROM portal_role_thematic_config c
     LEFT JOIN portal_role_thematic_node n USING (role_id)
     WHERE c.role_id = ANY($1::text[])
     GROUP BY c.role_id`,
    [roleIds],
  );
  return new Map(rows.map(row => [row.role_id, {
    configured: true,
    totalReportCount: Number(row.total_reports || 0),
    enabledReportCount: Number(row.enabled_reports || 0),
  }]));
}

export function buildAuthorityObjectIndex(rows, catalogRows = []) {
  const catalogById = new Map();
  for (const item of catalogRows) {
    const id = typeof item.report_id === 'string' ? item.report_id.trim() : '';
    if (id && !catalogById.has(id)) catalogById.set(id, item);
  }
  const byId = new Map();
  const childrenByParent = new Map();
  for (const row of rows) {
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    if (!id || byId.has(id)) continue;
    const expandType = row.expand_type === null || row.expand_type === undefined ? null : Number(row.expand_type);
    if (expandType === 1 || expandType === 2) continue;
    const parentId = typeof row.parent_id === 'string' && row.parent_id.trim() ? row.parent_id.trim() : null;
    const displayName = typeof row.display_name === 'string' ? row.display_name.trim() : '';
    const catalog = catalogById.get(id);
    const catalogName = typeof (catalog?.report_name ?? row.catalog_name) === 'string' ? (catalog?.report_name ?? row.catalog_name).trim() : '';
    const fallbackType = catalog?.report_type ?? row.report_type ?? null;
    const node = {
      id,
      parentId,
      expandType,
      reportName: displayName || catalogName || id,
      catalogName: catalogName || displayName || id,
      reportType: inferReportTypeFromAuthorityObject(expandType, row.object_path, fallbackType),
    };
    byId.set(id, node);
    if (parentId) {
      const list = childrenByParent.get(parentId) || [];
      list.push(node);
      childrenByParent.set(parentId, list);
    }
  }
  return { byId, childrenByParent };
}

export function resolveAllowedReportsFromTree(tree, directAuthRows) {
  const directAuth = new Map();
  for (const row of directAuthRows) {
    const objectId = typeof row.object_id === 'string' ? row.object_id.trim() : '';
    const auth = Number(row.direct_auth);
    if (!objectId || (auth !== 1 && auth !== 2)) continue;
    const prev = directAuth.get(objectId);
    directAuth.set(objectId, prev === undefined ? auth : Math.min(prev, auth));
  }
  const visited = new Set();
  const queue = [];
  let head = 0;
  for (const [objectId, auth] of directAuth) {
    if (auth !== 2) continue;
    const node = tree.byId.get(objectId);
    if (!node || visited.has(node.id)) continue;
    visited.add(node.id);
    queue.push({ node, depth: 0 });
  }
  const reports = [];
  while (head < queue.length) {
    const { node, depth } = queue[head++];
    if (!node.id.includes('decision') && node.expandType !== null && ![1, 2, 3].includes(node.expandType)) {
      reports.push({
        reportId: node.id,
        reportName: node.reportName,
        reportType: node.reportType,
        catalogName: node.catalogName,
      });
    }
    if (depth >= 32) continue;
    const children = tree.childrenByParent.get(node.id);
    if (!children) continue;
    for (const child of children) {
      // Explicit deny (1) stops inheritance; explicit allow (2) is already seeded at depth 0.
      if (directAuth.has(child.id) || visited.has(child.id)) continue;
      visited.add(child.id);
      queue.push({ node: child, depth: depth + 1 });
    }
  }
  return reports.sort((a, b) => a.reportName.localeCompare(b.reportName, 'zh-CN') || a.reportId.localeCompare(b.reportId));
}

async function loadCatalogMetadataForTree(db, log) {
  try {
    const { rows } = await db.query(
      `/* portal: catalog metadata for authority tree */
       SELECT report_id, report_name, report_type
       FROM dim_bi_report_info_dtl
       WHERE report_id IS NOT NULL`,
    );
    return rows;
  } catch (error) {
    if (!['42P01', '42703'].includes(error.code)) throw error;
    log?.warn({ stage: 'finedb-object-tree-cache', code: error.code, reason: error.message }, 'dim_bi_report_info_dtl unavailable for authority tree');
    return [];
  }
}

async function loadFineAuthorityObjectTree(db, { fineDb = db, cache, forceRefresh = false, log, env = process.env } = {}) {
  const schema = fineDbSchema(env);
  const key = `${schema}:authority-object-tree`;
  if (forceRefresh) cache?.delete(key);
  const loader = async () => {
    const [faoResult, catalogRows] = await Promise.all([
      fineDb.query(
        `/* portal: finedb authority object tree */
         SELECT fao.id,
                fao.parentid AS parent_id,
                fao.displayname AS display_name,
                fao.expandtype AS expand_type,
                fao.path AS object_path
         FROM ${schema}.fine_authority_object fao
         WHERE fao.id IS NOT NULL
           AND trim(fao.id) <> ''
           AND coalesce(fao.expandtype, 0) NOT IN (1, 2)`,
      ),
      loadCatalogMetadataForTree(db, log),
    ]);
    return buildAuthorityObjectIndex(faoResult.rows, catalogRows);
  };
  if (!cache) return loader();
  return cache.getOrLoad(key, loader, {
    onEvent: (result, size) => log?.info({ stage: 'finedb-object-tree-cache', result, entries: size }, 'finedb object tree cache'),
  });
}

export async function availableReportsForRole(db, roleId, { fineDb = db, objectTreeCache, forceRefresh = false, log, env = process.env } = {}) {
  const schema = fineDbSchema(env);
  const [tree, authResult] = await Promise.all([
    loadFineAuthorityObjectTree(db, { fineDb, cache: objectTreeCache, forceRefresh, log, env }),
    fineDb.query(
      `/* portal: finedb role direct authority */
       SELECT fa.authorityentityid AS object_id,
              min(fa.authority)::int AS direct_auth
       FROM ${schema}.fine_authority fa
       WHERE fa.roleid = $1
         AND fa.authoritytype IN (1, 102, 206)
         AND fa.authority IN (1, 2)
         AND fa.authorityentityid IS NOT NULL
         AND trim(fa.authorityentityid) <> ''
       GROUP BY fa.authorityentityid`,
      [roleId],
    ),
  ]);
  return resolveAllowedReportsFromTree(tree, authResult.rows);
}

export async function roleThematicDetail(db, role, { fineDb = db, objectTreeCache, forceRefresh = false, log, env = process.env } = {}) {
  const [configResult, nodesResult, availableReports] = await Promise.all([
    db.query(
      `SELECT role_id, role_name, updated_by, updated_at
       FROM portal_role_thematic_config
       WHERE role_id = $1`,
      [role.id],
    ),
    db.query(
      `SELECT n.node_id, n.parent_node_id, n.node_type, n.report_id, n.node_name,
              n.sort_no, n.is_enabled, r.report_name AS catalog_name, r.report_type
       FROM portal_role_thematic_node n
       LEFT JOIN dim_bi_report_info_dtl r USING (report_id)
       WHERE n.role_id = $1
       ORDER BY n.parent_node_id NULLS FIRST, n.sort_no, n.node_id`,
      [role.id],
    ),
    availableReportsForRole(db, role.id, { fineDb, objectTreeCache, forceRefresh, log, env }),
  ]);

  const config = configResult.rows[0] || null;
  const availableMap = new Map(availableReports.map(item => [item.reportId, item]));
  const nodes = nodesResult.rows.map(row => {
    const avail = row.report_id ? availableMap.get(row.report_id) : undefined;
    return {
      id: row.node_id,
      parentId: row.parent_node_id,
      nodeType: row.node_type,
      reportId: row.report_id,
      name: row.node_name,
      reportType: row.node_type === 'report' ? normalizeReportType(row.report_type || avail?.reportType) : null,
      catalogName: row.node_type === 'report' ? (row.catalog_name || avail?.catalogName || row.node_name) : null,
      sort: Number(row.sort_no) || 0,
      enabled: Boolean(row.is_enabled),
      ...(row.node_type === 'report' ? { available: Boolean(avail) } : {}),
    };
  });

  return {
    role: {
      id: role.id,
      name: role.name || config?.role_name || role.id,
      updatedBy: config?.updated_by || null,
      updatedAt: config?.updated_at ? new Date(config.updated_at).toISOString() : null,
    },
    nodes,
    availableReports,
  };
}

export async function saveRoleThematicTree(db, { fineDb = db, role, userName, nodes, cache, objectTreeCache, log, env = process.env }) {
  const checked = validateRoleThematicNodes(nodes);
  if (!checked.ok) throw new ApiError(400, 'INVALID_REQUEST', checked.message);

  const available = await availableReportsForRole(db, role.id, { fineDb, objectTreeCache, log, env });
  const availableIds = new Set(available.map(item => item.reportId));
  for (const node of checked.nodes) {
    if (node.nodeType === 'report' && !availableIds.has(node.reportId)) {
      throw new ApiError(400, 'INVALID_REPORT', `报表“${node.name}”不在当前角色的可配置底表中，请移除后再保存`);
    }
  }

  await withTransaction(db, async client => {
    await client.query(
      `INSERT INTO portal_role_thematic_config (role_id, role_name, updated_by, updated_at)
       VALUES ($1, $2, $3, clock_timestamp())
       ON CONFLICT (role_id)
       DO UPDATE SET role_name = EXCLUDED.role_name, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at`,
      [role.id, role.name, userName],
    );
    await client.query('DELETE FROM portal_role_thematic_node WHERE role_id = $1', [role.id]);
    for (const node of checked.nodes) {
      await client.query(
        `INSERT INTO portal_role_thematic_node
          (node_id, role_id, parent_node_id, node_type, report_id, node_name, sort_no, is_enabled, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, clock_timestamp(), clock_timestamp())`,
        [node.id, role.id, node.parentId, node.nodeType, node.reportId, node.name, node.sort, node.enabled],
      );
    }
  });

  cache?.delete(role.id);
  return roleThematicDetail(db, role, { fineDb, objectTreeCache, log, env });
}
