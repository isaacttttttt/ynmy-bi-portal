import { ApiError } from './http.js';
import { validateRoleThematicNodes } from '../../src/lib/portal-model.ts';

const VALID_TABLE = /^[a-z_][a-z0-9_]*$/i;
const VALID_TYPES = new Set(['bi', 'fvs', 'frm', 'cpt', 'url']);

function roleReportTable(env = process.env) {
  const name = (env.DB_ROLE_REPORT_TABLE || 'dim_bi_role_report_rel').trim();
  if (!VALID_TABLE.test(name)) throw new Error('Invalid DB_ROLE_REPORT_TABLE');
  return name;
}

function normalizeReportType(value) {
  const lowered = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return VALID_TYPES.has(lowered) ? lowered : 'cpt';
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

export async function userRoleIds(db, userName) {
  const { rows } = await db.query(
    `SELECT DISTINCT trim(rid) AS role_id
     FROM dim_bi_user u,
          LATERAL unnest(string_to_array(coalesce(u.role_id, ''), ',')) AS rid
     WHERE u.username = $1 AND u.enable = 'true' AND trim(rid) <> ''
     ORDER BY role_id`,
    [userName],
  );
  return rows.map(row => row.role_id);
}

export async function thematicRolesFor(db, context) {
  let roleIds;
  try {
    roleIds = await userRoleIds(db, context.user.userName);
  } catch (error) {
    if (error.code === '42P01' || error.code === '42703') {
      context.log?.warn({ stage: 'role-thematic', code: error.code, reason: error.message }, 'role thematic user column unavailable');
      return [];
    }
    throw error;
  }
  if (!roleIds.length) return [];
  let configs, nodes;
  try {
    ({ rows: configs } = await db.query(
      `SELECT role_id, role_name
       FROM portal_role_thematic_config
       WHERE role_id = ANY($1::text[])
       ORDER BY role_name, role_id`,
      [roleIds],
    ));
    if (!configs.length) return [];
    const configuredIds = configs.map(row => row.role_id);
    ({ rows: nodes } = await db.query(
      `SELECT n.node_id, n.role_id, n.parent_node_id, n.node_type, n.report_id,
              n.node_name, n.sort_no, r.report_name AS catalog_name, r.report_type
       FROM portal_role_thematic_node n
       LEFT JOIN dim_bi_report_info_dtl r USING (report_id)
       WHERE n.role_id = ANY($1::text[]) AND n.is_enabled = TRUE
       ORDER BY n.role_id, n.parent_node_id NULLS FIRST, n.sort_no, n.node_id`,
      [configuredIds],
    ));
  } catch (error) {
    if (error.code === '42P01' || error.code === '42703') {
      context.log?.warn({ stage: 'role-thematic', code: error.code, reason: error.message }, 'role thematic tables unavailable');
      return [];
    }
    throw error;
  }

  const platformEntries = new Map(context.entries.map(entry => [entry.id, entry]));
  const nodesByRole = new Map();
  for (const row of nodes) {
    const list = nodesByRole.get(row.role_id) || [];
    list.push(row);
    nodesByRole.set(row.role_id, list);
  }

  return configs.map(config => {
    const rawNodes = nodesByRole.get(config.role_id) || [];
    const childrenByParent = new Map();
    for (const row of rawNodes) {
      const key = row.parent_node_id ?? '';
      const list = childrenByParent.get(key) || [];
      list.push(row);
      childrenByParent.set(key, list);
    }
    const entries = [];
    const visited = new Set();
    const stack = [...(childrenByParent.get('') || [])].reverse();
    while (stack.length) {
      const row = stack.pop();
      if (visited.has(row.node_id)) continue;
      visited.add(row.node_id);
      if (row.node_type === 'folder') {
        entries.push({
          id: row.node_id,
          parentId: row.parent_node_id,
          name: row.node_name,
          type: 'folder',
          sort: Number(row.sort_no) || 0,
        });
        const children = childrenByParent.get(row.node_id) || [];
        for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
      } else if (row.node_type === 'report' && row.report_id && context.ids.has(row.report_id)) {
        const platformEntry = platformEntries.get(row.report_id);
        if (platformEntry?.type === 'folder') continue;
        const type = platformEntry?.type || normalizeReportType(row.report_type);
        entries.push({
          id: row.report_id,
          parentId: row.parent_node_id,
          name: row.node_name?.trim() || platformEntry?.name || row.catalog_name || '未命名报表',
          type,
          sort: Number(row.sort_no) || 0,
          ...(platformEntry?.templateId ? { templateId: platformEntry.templateId } : {}),
          ...(platformEntry?.url ? { url: platformEntry.url } : {}),
          ...(platformEntry?.iconUrl ? { iconUrl: platformEntry.iconUrl } : {}),
        });
      }
    }
    return { id: config.role_id, name: config.role_name, entries };
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

export async function availableReportsForRole(db, roleId) {
  const table = roleReportTable();
  const { rows } = await db.query(
    `SELECT DISTINCT ON (rel.report_id)
            rel.report_id,
            coalesce(nullif(trim(rel.report_name), ''), nullif(trim(r.report_name), ''), rel.report_id) AS report_name,
            coalesce(nullif(trim(r.report_name), ''), nullif(trim(rel.report_name), ''), rel.report_id) AS catalog_name,
            r.report_type
     FROM ${table} rel
     LEFT JOIN dim_bi_report_info_dtl r USING (report_id)
     WHERE rel.role_id = $1 AND rel.report_id IS NOT NULL AND trim(rel.report_id) <> ''
     ORDER BY rel.report_id`,
    [roleId],
  );
  return rows
    .map(row => ({
      reportId: row.report_id,
      reportName: row.report_name,
      reportType: normalizeReportType(row.report_type),
      catalogName: row.catalog_name,
    }))
    .sort((a, b) => a.reportName.localeCompare(b.reportName, 'zh-CN') || a.reportId.localeCompare(b.reportId));
}

export async function roleThematicDetail(db, role) {
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
    availableReportsForRole(db, role.id),
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

export async function saveRoleThematicTree(db, { role, userName, nodes }) {
  const checked = validateRoleThematicNodes(nodes);
  if (!checked.ok) throw new ApiError(400, 'INVALID_REQUEST', checked.message);

  const available = await availableReportsForRole(db, role.id);
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

  return roleThematicDetail(db, role);
}
