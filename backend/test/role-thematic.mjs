import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { platformClient } from '../src/platform.js';
import { buildApp } from '../src/app.js';
import {
  availableReportsForRole,
  buildAuthorityObjectIndex,
  fineDbSchema,
  inferReportTypeFromAuthorityObject,
  parseUserRoleIds,
  resolveAllowedReportsFromTree,
  userRoleIds,
} from '../src/role-thematic-repository.js';

// Unit checks for FineDB schema validation & report type inference
assert.equal(fineDbSchema({}), 'finedb');
assert.equal(fineDbSchema({ FINEDB_SCHEMA: 'custom_finedb' }), 'custom_finedb');
assert.throws(() => fineDbSchema({ FINEDB_SCHEMA: 'finedb; DROP TABLE x' }), /Invalid FINEDB_SCHEMA/);

assert.equal(inferReportTypeFromAuthorityObject(201, 'any/path'), 'bi');
assert.equal(inferReportTypeFromAuthorityObject(5, 'https://example.com/a'), 'url');
assert.equal(inferReportTypeFromAuthorityObject(102, 'ops/board.fvs'), 'fvs');
assert.equal(inferReportTypeFromAuthorityObject(102, 'ops/input.frm?op=write'), 'frm');
assert.equal(inferReportTypeFromAuthorityObject(102, 'ops/detail.cpt'), 'cpt');
assert.equal(inferReportTypeFromAuthorityObject(102, 'ops/unknown', 'fvs'), 'fvs');
assert.equal(inferReportTypeFromAuthorityObject(102, 'ops/unknown', null), 'cpt');
assert.equal(inferReportTypeFromAuthorityObject(6, 'https://example.com/doc'), 'url');

// Unit checks for parseUserRoleIds helper
assert.deepEqual(
  parseUserRoleIds(['["c494004d-701e-4449-9244-cb4f9bb3c9a7","xxxx","xxx"]']),
  ['c494004d-701e-4449-9244-cb4f9bb3c9a7', 'xxx', 'xxxx'],
);
assert.deepEqual(parseUserRoleIds(['[]', '', null, undefined]), []);
assert.deepEqual(parseUserRoleIds([['role-2', 'role-1'], '["role-1","role-3"]']), ['role-1', 'role-2', 'role-3']);
assert.deepEqual(parseUserRoleIds(['role-a, role-b']), ['role-a', 'role-b']);

// In-memory mock FineBI upstream supporting session, tree, favorites and paginated /v10/roles
const roleCatalog = Array.from({ length: 18 }, (_, idx) => ({
  id: `role-${idx + 1}`,
  text: idx === 0 ? '供应链分析角色' : idx === 1 ? '健康品经营角色' : `测试角色${idx + 1}`,
  description: `角色说明 ${idx + 1}`,
  creationType: 1,
  privilegeDetailBeanList: null,
}));
const roleRequests = [];
let treeRequests = 0;
let thematicTreeQueries = 0;
const server = createServer((req, res) => {
  assert.equal(req.headers.authorization, 'Bearer admin-token');
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/v10/session') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: { userName: 'alice', name: 'Alice' } }));
    return;
  }
  if (url.pathname === '/v10/view/entry/tree') {
    treeRequests++;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      data: [
        { id: 'folder-ignored', pId: null, text: '平台旧目录', path: null, entryType: 1, sortIndex: 0 },
        { id: 'rep-bi-1', pId: 'folder-ignored', text: '库存总览', path: 'bi/stock', entryType: 1, templateId: 'tpl-bi-1', sortIndex: 1 },
        { id: 'rep-cpt-1', pId: 'folder-ignored', text: '仓储成本明细', path: 'stock/cost.cpt', entryType: 1, sortIndex: 2 },
        { id: 'rep-frm-1', pId: 'folder-ignored', text: '经营填报', path: 'ops/input.frm', entryType: 1, sortIndex: 3 },
      ],
    }));
    return;
  }
  if (url.pathname === '/v10/favorite/entry/list') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'rep-bi-1' }] }));
    return;
  }
  if (url.pathname === '/v10/roles') {
    roleRequests.push(url.searchParams);
    const page = Number(url.searchParams.get('page') || 1);
    const count = Number(url.searchParams.get('count') || 15);
    const keyword = (url.searchParams.get('keyword') || '').trim();
    assert.equal(url.searchParams.get('privilegeType'), '2');
    assert(/^\d+$/.test(url.searchParams.get('_') || ''), 'Timestamp parameter _ must be numeric');
    const filtered = keyword ? roleCatalog.filter(r => r.text.includes(keyword)) : roleCatalog;
    const start = (page - 1) * count;
    const items = filtered.slice(start, start + count);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      data: { page, hasNext: start + count < filtered.length, items },
    }));
    return;
  }
  res.writeHead(404);
  res.end();
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

// In-memory stateful PostgreSQL stub for role-thematic tables & FineDB real-time permission tables
const configs = new Map();
const nodesByRole = new Map();

// Simulated FineDB tables: fine_user, fine_user_role_middle, fine_custom_role, fine_authority_object, fine_authority
const fineUsers = [
  { id: 'u-alice', username: 'alice' },
];
const fineUserRoleMiddle = [
  { userid: 'u-alice', roleid: 'role-1', roletype: 2 },
  { userid: 'u-alice', roleid: 'role-2', roletype: 2 },
  { userid: 'u-alice', roleid: 'dep-role-ignored', roletype: 1 },
];
const fineCustomRoles = new Map([
  ['role-1', '供应链分析角色(实时名)'],
  ['role-2', '健康品经营角色'],
]);
const fineAuthorityObjects = [
  { id: 'decision-directory-root', parent_id: null, display_name: '目录根', expand_type: 3, object_path: null, catalog_name: null, report_type: null },
  { id: 'decision-mgmt', parent_id: null, display_name: '管理系统', expand_type: 1, object_path: null, catalog_name: null, report_type: null },
  { id: 'dir-supply', parent_id: 'decision-directory-root', display_name: '供应链目录', expand_type: 3, object_path: null, catalog_name: null, report_type: null },
  { id: 'dir-supply-sub', parent_id: 'dir-supply', display_name: '仓储子目录', expand_type: 3, object_path: null, catalog_name: null, report_type: null },
  { id: 'dir-denied', parent_id: 'dir-supply', display_name: '禁止子目录', expand_type: 3, object_path: null, catalog_name: null, report_type: null },
  { id: 'rep-bi-1', parent_id: 'dir-supply-sub', display_name: '库存总览', expand_type: 201, object_path: 'bi/stock', catalog_name: '库存总览', report_type: 'bi' },
  { id: 'rep-cpt-1', parent_id: 'dir-supply-sub', display_name: '仓储成本明细', expand_type: 102, object_path: 'stock/cost.cpt', catalog_name: '仓储成本明细', report_type: 'cpt' },
  { id: 'rep-denied-leaf', parent_id: 'dir-supply-sub', display_name: '显式拒绝报表', expand_type: 102, object_path: 'stock/secret.cpt', catalog_name: null, report_type: null },
  { id: 'rep-under-denied-dir', parent_id: 'dir-denied', display_name: '禁止目录下继承拒绝报表', expand_type: 102, object_path: 'stock/hidden.cpt', catalog_name: null, report_type: null },
  { id: 'rep-unauth', parent_id: 'dir-denied', display_name: '未授权报表', expand_type: 102, object_path: 'stock/reallowed.cpt', catalog_name: '未授权报表', report_type: 'cpt' },
  { id: 'rep-frm-1', parent_id: 'decision-directory-root', display_name: '经营填报', expand_type: 102, object_path: 'ops/input.frm', catalog_name: '经营填报', report_type: 'frm' },
];
const fineAuthorities = [
  // role-1: allowed on dir-supply (inherits rep-bi-1, rep-cpt-1), explicitly denied on rep-denied-leaf & dir-denied, re-allowed on rep-unauth
  { roleid: 'role-1', authorityentityid: 'dir-supply', authoritytype: 1, authority: 2 },
  { roleid: 'role-1', authorityentityid: 'rep-denied-leaf', authoritytype: 102, authority: 1 },
  { roleid: 'role-1', authorityentityid: 'dir-denied', authoritytype: 1, authority: 1 },
  { roleid: 'role-1', authorityentityid: 'rep-unauth', authoritytype: 102, authority: 2 },
  // role-2: direct allow on rep-frm-1
  { roleid: 'role-2', authorityentityid: 'rep-frm-1', authoritytype: 102, authority: 2 },
];

function directAuthRowsForRole(roleId) {
  const byObj = new Map();
  for (const fa of fineAuthorities) {
    if (fa.roleid !== roleId || ![1, 102, 206].includes(fa.authoritytype) || ![1, 2].includes(fa.authority)) continue;
    const prev = byObj.get(fa.authorityentityid);
    byObj.set(fa.authorityentityid, prev === undefined ? fa.authority : Math.min(prev, fa.authority));
  }
  return [...byObj.entries()].map(([object_id, direct_auth]) => ({ object_id, direct_auth }));
}

let lastObjectTreeSql = '';
let lastDirectAuthSql = '';
let lastUserRolesSql = '';
let objectTreeQueries = 0;
let directAuthQueries = 0;
let userRolesQueries = 0;
const db = {
  async query(sql, params = []) {
    if (sql.includes('SELECT 1')) return { rows: [{ '?column?': 1 }] };
    if (sql.includes('max(day_id)')) return { rows: [{ day: '2026-11-19' }] };
    if (sql.includes('FROM fr_quick_entry_app')) return { rows: [] };
    if (sql.includes('/* portal: finedb user roles */')) {
      lastUserRolesSql = sql;
      userRolesQueries++;
      const user = fineUsers.find(u => u.username === params[0]);
      if (!user) return { rows: [] };
      const roleIds = [...new Set(fineUserRoleMiddle
        .filter(m => m.userid === user.id && m.roletype === 2)
        .map(m => m.roleid))].sort();
      return { rows: roleIds.map(role_id => ({ role_id })) };
    }
    if (sql.includes('/* portal: finedb authority object tree */')) {
      lastObjectTreeSql = sql;
      objectTreeQueries++;
      return { rows: fineAuthorityObjects.filter(o => ![1, 2].includes(o.expand_type ?? 0)) };
    }
    if (sql.includes('/* portal: finedb role direct authority */')) {
      lastDirectAuthSql = sql;
      directAuthQueries++;
      return { rows: directAuthRowsForRole(params[0]) };
    }
    if (sql.includes('FROM portal_role_thematic_config c') && sql.includes('GROUP BY c.role_id')) {
      const ids = params[0] || [];
      return {
        rows: ids.filter(id => configs.has(id)).map(id => {
          const list = nodesByRole.get(id) || [];
          const reports = list.filter(n => n.node_type === 'report');
          return {
            role_id: id,
            total_reports: reports.length,
            enabled_reports: reports.filter(n => n.is_enabled).length,
          };
        }),
      };
    }
    if (sql.includes('/* portal: role thematic tree */')) {
      thematicTreeQueries++;
      const ids = new Set(params[0] || []);
      const tree = buildAuthorityObjectIndex(fineAuthorityObjects);
      const rows = [];
      for (const cfg of [...configs.values()].filter(c => ids.has(c.role_id)).sort((a, b) => a.role_name.localeCompare(b.role_name))) {
        const liveRoleName = fineCustomRoles.get(cfg.role_id) || cfg.role_name;
        const avail = new Map(resolveAllowedReportsFromTree(tree, directAuthRowsForRole(cfg.role_id)).map(r => [r.reportId, r]));
        const enabledNodes = (nodesByRole.get(cfg.role_id) || []).filter(n => n.is_enabled);
        if (!enabledNodes.length) {
          rows.push({
            role_id: cfg.role_id, role_name: liveRoleName,
            node_id: null, parent_node_id: null, node_type: null, report_id: null,
            node_name: null, sort_no: null, catalog_name: null, report_type: null,
          });
        } else {
          for (const n of enabledNodes) {
            const r = n.report_id ? avail.get(n.report_id) : null;
            rows.push({
              role_id: cfg.role_id, role_name: liveRoleName,
              ...n, catalog_name: r?.catalogName || null, report_type: r?.reportType || null,
            });
          }
        }
      }
      return { rows };
    }
    if (sql.includes('FROM portal_role_thematic_config') && sql.includes('WHERE role_id = $1')) {
      const cfg = configs.get(params[0]);
      return { rows: cfg ? [cfg] : [] };
    }
    if (sql.includes('FROM portal_role_thematic_node n') && sql.includes('WHERE n.role_id = $1')) {
      const id = params[0];
      const tree = buildAuthorityObjectIndex(fineAuthorityObjects);
      const avail = new Map(resolveAllowedReportsFromTree(tree, directAuthRowsForRole(id)).map(r => [r.reportId, r]));
      return {
        rows: (nodesByRole.get(id) || []).map(n => {
          const r = n.report_id ? avail.get(n.report_id) : null;
          return { ...n, catalog_name: r?.catalogName || null, report_type: r?.reportType || null };
        }),
      };
    }
    if (sql.includes('INSERT INTO portal_role_thematic_config')) {
      configs.set(params[0], {
        role_id: params[0],
        role_name: params[1],
        updated_by: params[2],
        updated_at: new Date('2026-11-19T14:00:00.000Z'),
      });
      return { rows: [] };
    }
    if (sql.includes('DELETE FROM portal_role_thematic_node')) {
      nodesByRole.set(params[0], []);
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO portal_role_thematic_node')) {
      const list = nodesByRole.get(params[1]) || [];
      list.push({
        node_id: params[0],
        role_id: params[1],
        parent_node_id: params[2],
        node_type: params[3],
        report_id: params[4],
        node_name: params[5],
        sort_no: params[6],
        is_enabled: params[7],
      });
      nodesByRole.set(params[1], list);
      return { rows: [] };
    }
    throw new Error(`Unexpected SQL in test: ${sql}`);
  },
  async end() {},
};

// Direct unit checks for FineDB SQL generation and in-memory BFS inheritance / deny filtering (zero PG WITH RECURSIVE!)
const directUserRoles = await userRoleIds(db, 'alice');
assert.deepEqual(directUserRoles, ['role-1', 'role-2']);
assert(lastUserRolesSql.includes('finedb.fine_user_role_middle'));
assert(lastUserRolesSql.includes('finedb.fine_user'));
assert(lastUserRolesSql.includes('urm.roletype = 2'));

const role1Reports = await availableReportsForRole(db, 'role-1');
assert.deepEqual(
  role1Reports.map(r => [r.reportId, r.reportType]).sort(),
  [['rep-bi-1', 'bi'], ['rep-cpt-1', 'cpt'], ['rep-unauth', 'cpt']],
);
assert(!lastObjectTreeSql.includes('WITH RECURSIVE'), 'Object tree load must not run recursive CTE in PG');
assert(lastObjectTreeSql.includes('finedb.fine_authority_object'));
assert(lastDirectAuthSql.includes('finedb.fine_authority'));
assert(!lastDirectAuthSql.includes('WITH RECURSIVE'), 'Direct authority query must be a flat single-table lookup');

let app;
try {
  const origin = 'https://portal.example';
  process.env.PUBLIC_ORIGIN = origin;
  delete process.env.FINE_ROOT_ID;
  const platform = platformClient({
    FINE_BASE_URL: base,
    FINE_SESSION_PATH: '/v10/session',
    FINE_ROLES_PATH: '/v10/roles',
    FINE_ROLES_PRIVILEGE_TYPE: '2',
  }, db);
  app = await buildApp({ platform, db });
  const cookie = 'fine_auth_token=admin-token';

  // 1. Standalone route served under /portal/role-thematic-config/ (and redirects without trailing slash)
  const html = await app.inject('/portal/role-thematic-config/');
  assert.equal(html.statusCode, 200);
  assert.equal(html.headers['cache-control'], 'private, no-store');
  const redirectNoSlash = await app.inject('/portal/role-thematic-config');
  assert.equal(redirectNoSlash.statusCode, 308);
  assert.equal(redirectNoSlash.headers.location, '/portal/role-thematic-config/');

  // 2. Paginated role listing (default 15 per page) + next page + search (A1: zero /v10/view/entry/tree calls!)
  const page1 = await app.inject({ url: '/portal/api/portal/v1/role-thematic/roles?page=1&pageSize=15', headers: { cookie } });
  assert.equal(page1.statusCode, 200, page1.body);
  assert.equal(treeRequests, 0, 'Role config endpoints must skip /v10/view/entry/tree');
  const p1Data = page1.json().data;
  assert.equal(p1Data.items.length, 15);
  assert.equal(p1Data.hasNext, true);
  assert.equal(p1Data.items[0].name, '供应链分析角色');
  const rolesCallsBeforeRepeat = roleRequests.length;
  const page1Cached = await app.inject({ url: '/portal/api/portal/v1/role-thematic/roles?page=1&pageSize=15', headers: { cookie } });
  assert.equal(page1Cached.statusCode, 200);
  assert.equal(roleRequests.length, rolesCallsBeforeRepeat, 'Repeated role page request hits roles cache');

  const page2 = await app.inject({ url: '/portal/api/portal/v1/role-thematic/roles?page=2&pageSize=15', headers: { cookie } });
  assert.equal(page2.json().data.items.length, 3);
  assert.equal(page2.json().data.hasNext, false);

  const searchRes = await app.inject({ url: '/portal/api/portal/v1/role-thematic/roles?page=1&pageSize=15&q=' + encodeURIComponent('健康品'), headers: { cookie } });
  assert.equal(searchRes.json().data.items.length, 1);
  assert.equal(searchRes.json().data.items[0].id, 'role-2');

  // 3. Unauthorized role ID returns 403
  const forbiddenRole = await app.inject({ url: '/portal/api/portal/v1/role-thematic/roles/role-not-granted', headers: { cookie } });
  assert.equal(forbiddenRole.statusCode, 403);

  // 4. Read detail for role-1 (empty tree + 3 available reports; object tree cached, direct auth real-time, ?refresh=1 forces tree reload)
  const treeQueriesBefore = objectTreeQueries;
  const authQueriesBefore = directAuthQueries;
  const detailBefore = await app.inject({ url: '/portal/api/portal/v1/role-thematic/roles/role-1', headers: { cookie } });
  assert.equal(detailBefore.statusCode, 200, detailBefore.body);
  assert.equal(detailBefore.json().data.nodes.length, 0);
  assert.equal(detailBefore.json().data.availableReports.length, 3);
  assert.equal(objectTreeQueries, treeQueriesBefore + 1);
  assert.equal(directAuthQueries, authQueriesBefore + 1);

  const detailCachedTree = await app.inject({ url: '/portal/api/portal/v1/role-thematic/roles/role-1', headers: { cookie } });
  assert.equal(detailCachedTree.statusCode, 200);
  assert.equal(objectTreeQueries, treeQueriesBefore + 1, 'Global fine_authority_object tree hits hot cache');
  assert.equal(directAuthQueries, authQueriesBefore + 2, 'Role fine_authority remains real-time per request');

  const detailRefreshed = await app.inject({ url: '/portal/api/portal/v1/role-thematic/roles/role-1?refresh=1', headers: { cookie } });
  assert.equal(detailRefreshed.statusCode, 200);
  assert.equal(objectTreeQueries, treeQueriesBefore + 2, '?refresh=1 bypasses and reloads object tree hot cache');

  // 5. CSRF check on save
  const badOrigin = await app.inject({
    method: 'POST',
    url: '/portal/api/portal/v1/role-thematic/roles/role-1/tree',
    headers: { cookie, origin: 'https://evil.example' },
    payload: { nodes: [] },
  });
  assert.equal(badOrigin.statusCode, 403);

  // 6. Reject report not belonging to role-1's available table
  const badReport = await app.inject({
    method: 'POST',
    url: '/portal/api/portal/v1/role-thematic/roles/role-1/tree',
    headers: { cookie, origin },
    payload: {
      roleName: '供应链分析角色',
      nodes: [
        { id: 'n-bad', parentId: null, nodeType: 'report', reportId: 'rep-frm-1', name: '越权报表', sort: 0, enabled: true },
      ],
    },
  });
  assert.equal(badReport.statusCode, 400);

  // 7. Save valid hierarchical tree for role-1 (including disabled folder, disabled report, and unauthorized-in-FineBI report)
  const save1 = await app.inject({
    method: 'POST',
    url: '/portal/api/portal/v1/role-thematic/roles/role-1/tree',
    headers: { cookie, origin },
    payload: {
      roleName: '供应链分析角色',
      nodes: [
        { id: 'f-root', parentId: null, nodeType: 'folder', reportId: null, name: '仓储管理', sort: 0, enabled: true },
        { id: 'n-bi', parentId: 'f-root', nodeType: 'report', reportId: 'rep-bi-1', name: '库存总览(定制名)', sort: 0, enabled: true },
        { id: 'n-unauth', parentId: 'f-root', nodeType: 'report', reportId: 'rep-unauth', name: '未授权报表', sort: 1, enabled: true },
        { id: 'f-hidden', parentId: null, nodeType: 'folder', reportId: null, name: '停用目录', sort: 1, enabled: false },
        { id: 'n-cpt', parentId: 'f-hidden', nodeType: 'report', reportId: 'rep-cpt-1', name: '仓储成本明细', sort: 0, enabled: true },
      ],
    },
  });
  assert.equal(save1.statusCode, 200, save1.body);
  assert.equal(save1.json().data.nodes.length, 5);
  assert.equal(save1.json().data.role.updatedBy, 'alice');

  // Save tree for role-2 as well so alice has 2 configured roles
  const save2 = await app.inject({
    method: 'POST',
    url: '/portal/api/portal/v1/role-thematic/roles/role-2/tree',
    headers: { cookie, origin },
    payload: {
      roleName: '健康品经营角色',
      nodes: [
        { id: 'n-frm', parentId: null, nodeType: 'report', reportId: 'rep-frm-1', name: '经营填报', sort: 0, enabled: true },
      ],
    },
  });
  assert.equal(save2.statusCode, 200, save2.body);

  // 8. Verify /bootstrap returns both configured roles via finedb.fine_user_role_middle + live fine_custom_role name,
  //    excludes disabled folders + their children, intersects reports with FineBI tree, and enriches BI templateId!
  const userRolesQueriesBefore = userRolesQueries;
  const bootstrapRes = await app.inject({ url: '/portal/api/portal/v1/bootstrap', headers: { cookie } });
  assert.equal(bootstrapRes.statusCode, 200, bootstrapRes.body);
  const { thematicRoles } = bootstrapRes.json().data;
  assert.equal(thematicRoles.length, 2);
  const r1 = thematicRoles.find(r => r.id === 'role-1');
  const r2 = thematicRoles.find(r => r.id === 'role-2');
  assert(r1 && r2);
  assert.equal(r1.name, '供应链分析角色(实时名)', 'Role name reflects live finedb.fine_custom_role.name');
  assert.deepEqual(r1.entries.map(e => e.id), ['f-root', 'rep-bi-1']);
  assert.equal(r1.entries[1].name, '库存总览(定制名)');
  assert.equal(r1.entries[1].templateId, 'tpl-bi-1');
  assert.equal(r1.entries[1].parentId, 'f-root');
  assert.deepEqual(r2.entries.map(e => e.id), ['rep-frm-1']);
  assert.equal(r2.entries[0].type, 'frm');
  assert.equal(treeRequests, 1, 'Only /bootstrap fetched /v10/view/entry/tree once');
  assert.equal(userRolesQueries, userRolesQueriesBefore + 1);
  // A3 + FineDB hot cache: Second /bootstrap hits both userRolesCache and thematicCache (0 extra DB queries)
  const queriesAfterFirstBootstrap = thematicTreeQueries;
  const bootstrapRes2 = await app.inject({ url: '/portal/api/portal/v1/bootstrap', headers: { cookie } });
  assert.equal(bootstrapRes2.statusCode, 200);
  assert.equal(userRolesQueries, userRolesQueriesBefore + 1, 'User roles hit hot cache');
  assert.equal(thematicTreeQueries, queriesAfterFirstBootstrap, 'Thematic tree is served from shared role cache');
  // A3: Saving role-2 immediately invalidates its thematic cache entry
  const save2Updated = await app.inject({
    method: 'POST',
    url: '/portal/api/portal/v1/role-thematic/roles/role-2/tree',
    headers: { cookie, origin },
    payload: {
      roleName: '健康品经营角色',
      nodes: [
        { id: 'n-frm', parentId: null, nodeType: 'report', reportId: 'rep-frm-1', name: '经营填报-已更新', sort: 0, enabled: true },
      ],
    },
  });
  assert.equal(save2Updated.statusCode, 200);
  const bootstrapRes3 = await app.inject({ url: '/portal/api/portal/v1/bootstrap', headers: { cookie } });
  assert.equal(bootstrapRes3.json().data.thematicRoles.find(r => r.id === 'role-2').entries[0].name, '经营填报-已更新');
  assert.equal(thematicTreeQueries, queriesAfterFirstBootstrap + 1, 'Only the invalidated role is reloaded from DB');

  // 9. Verify role list reflects configured report counts
  const page1After = await app.inject({ url: '/portal/api/portal/v1/role-thematic/roles?page=1&pageSize=15', headers: { cookie } });
  const role1Summary = page1After.json().data.items.find(i => i.id === 'role-1');
  assert.equal(role1Summary.configured, true);
  assert.equal(role1Summary.totalReportCount, 3);
  assert.equal(role1Summary.enabledReportCount, 3);

  console.log('PASS: role-thematic proxy, lazy tree, role/thematic cache & invalidation, bootstrap role switching, and static route.');
} finally {
  if (app) await app.close();
  await new Promise(resolve => server.close(resolve));
}
