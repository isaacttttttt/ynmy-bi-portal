import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { platformClient } from '../src/platform.js';
import { buildApp } from '../src/app.js';
import { parseUserRoleIds } from '../src/role-thematic-repository.js';

// Unit checks for dim_bi_user.role_id JSON array / string / array parsing
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
const server = createServer((req, res) => {
  assert.equal(req.headers.authorization, 'Bearer admin-token');
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/v10/session') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: { userName: 'alice', name: 'Alice' } }));
    return;
  }
  if (url.pathname === '/v10/view/entry/tree') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      data: [
        { id: 'rep-bi-1', pId: null, text: '库存总览', path: 'bi/stock', entryType: 1, templateId: 'tpl-bi-1', sortIndex: 1 },
        { id: 'rep-cpt-1', pId: null, text: '仓储成本明细', path: 'stock/cost.cpt', entryType: 1, sortIndex: 2 },
        { id: 'rep-frm-1', pId: null, text: '经营填报', path: 'ops/input.frm', entryType: 1, sortIndex: 3 },
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

// In-memory stateful PostgreSQL stub for role-thematic tables & user roles
const configs = new Map();
const nodesByRole = new Map();
const roleReports = new Map([
  ['role-1', [
    { report_id: 'rep-bi-1', report_name: '库存总览', catalog_name: '库存总览', report_type: 'bi' },
    { report_id: 'rep-cpt-1', report_name: '仓储成本明细', catalog_name: '仓储成本明细', report_type: 'cpt' },
    { report_id: 'rep-unauth', report_name: '未授权报表', catalog_name: '未授权报表', report_type: 'cpt' },
  ]],
  ['role-2', [
    { report_id: 'rep-frm-1', report_name: '经营填报', catalog_name: '经营填报', report_type: 'frm' },
  ]],
]);
// User alice has two roles stored as JSON array string in dim_bi_user.role_id
const userRolesMap = new Map([['alice', ['["role-1","role-2"]']]]);

const db = {
  async query(sql, params = []) {
    if (sql.includes('SELECT 1')) return { rows: [{ '?column?': 1 }] };
    if (sql.includes('max(day_id)')) return { rows: [{ day: '2026-11-19' }] };
    if (sql.includes('FROM fr_quick_entry_app')) return { rows: [] };
    if (sql.includes('FROM dim_bi_user u') && sql.includes('role_id')) {
      return { rows: (userRolesMap.get(params[0]) || []).map(role_id => ({ role_id })) };
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
    if (sql.includes('FROM portal_role_thematic_config') && sql.includes('ANY($1::text[])')) {
      const ids = new Set(params[0] || []);
      return {
        rows: [...configs.values()]
          .filter(c => ids.has(c.role_id))
          .sort((a, b) => a.role_name.localeCompare(b.role_name)),
      };
    }
    if (sql.includes('FROM portal_role_thematic_config') && sql.includes('WHERE role_id = $1')) {
      const cfg = configs.get(params[0]);
      return { rows: cfg ? [cfg] : [] };
    }
    if (sql.includes('FROM portal_role_thematic_node n') && sql.includes('ANY($1::text[])')) {
      const ids = params[0] || [];
      const rows = [];
      for (const id of ids) {
        const avail = new Map((roleReports.get(id) || []).map(r => [r.report_id, r]));
        for (const n of nodesByRole.get(id) || []) {
          if (!n.is_enabled) continue;
          const r = n.report_id ? avail.get(n.report_id) : null;
          rows.push({ ...n, catalog_name: r?.catalog_name || null, report_type: r?.report_type || null });
        }
      }
      return { rows };
    }
    if (sql.includes('FROM portal_role_thematic_node n') && sql.includes('WHERE n.role_id = $1')) {
      const id = params[0];
      const avail = new Map((roleReports.get(id) || []).map(r => [r.report_id, r]));
      return {
        rows: (nodesByRole.get(id) || []).map(n => {
          const r = n.report_id ? avail.get(n.report_id) : null;
          return { ...n, catalog_name: r?.catalog_name || null, report_type: r?.report_type || null };
        }),
      };
    }
    if (sql.includes('FROM dim_bi_role_report_rel rel')) {
      return { rows: roleReports.get(params[0]) || [] };
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

  // 2. Paginated role listing (default 15 per page) + next page + search
  const page1 = await app.inject({ url: '/portal/api/portal/v1/role-thematic/roles?page=1&pageSize=15', headers: { cookie } });
  assert.equal(page1.statusCode, 200, page1.body);
  const p1Data = page1.json().data;
  assert.equal(p1Data.items.length, 15);
  assert.equal(p1Data.hasNext, true);
  assert.equal(p1Data.items[0].name, '供应链分析角色');

  const page2 = await app.inject({ url: '/portal/api/portal/v1/role-thematic/roles?page=2&pageSize=15', headers: { cookie } });
  assert.equal(page2.json().data.items.length, 3);
  assert.equal(page2.json().data.hasNext, false);

  const searchRes = await app.inject({ url: '/portal/api/portal/v1/role-thematic/roles?page=1&pageSize=15&q=' + encodeURIComponent('健康品'), headers: { cookie } });
  assert.equal(searchRes.json().data.items.length, 1);
  assert.equal(searchRes.json().data.items[0].id, 'role-2');

  // 3. Unauthorized role ID returns 403
  const forbiddenRole = await app.inject({ url: '/portal/api/portal/v1/role-thematic/roles/role-not-granted', headers: { cookie } });
  assert.equal(forbiddenRole.statusCode, 403);

  // 4. Read detail for role-1 (empty tree + 3 available reports from dim_bi_role_report_rel)
  const detailBefore = await app.inject({ url: '/portal/api/portal/v1/role-thematic/roles/role-1', headers: { cookie } });
  assert.equal(detailBefore.statusCode, 200, detailBefore.body);
  assert.equal(detailBefore.json().data.nodes.length, 0);
  assert.equal(detailBefore.json().data.availableReports.length, 3);

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

  // 8. Verify /bootstrap returns both configured roles via dim_bi_user.role_id,
  //    excludes disabled folders + their children, intersects reports with FineBI tree, and enriches BI templateId!
  const bootstrapRes = await app.inject({ url: '/portal/api/portal/v1/bootstrap', headers: { cookie } });
  assert.equal(bootstrapRes.statusCode, 200, bootstrapRes.body);
  const { thematicRoles } = bootstrapRes.json().data;
  assert.equal(thematicRoles.length, 2);
  const r1 = thematicRoles.find(r => r.id === 'role-1');
  const r2 = thematicRoles.find(r => r.id === 'role-2');
  assert(r1 && r2);
  assert.deepEqual(r1.entries.map(e => e.id), ['f-root', 'rep-bi-1']);
  assert.equal(r1.entries[1].name, '库存总览(定制名)');
  assert.equal(r1.entries[1].templateId, 'tpl-bi-1');
  assert.equal(r1.entries[1].parentId, 'f-root');
  assert.deepEqual(r2.entries.map(e => e.id), ['rep-frm-1']);
  assert.equal(r2.entries[0].type, 'frm');

  // 9. Verify role list reflects configured report counts
  const page1After = await app.inject({ url: '/portal/api/portal/v1/role-thematic/roles?page=1&pageSize=15', headers: { cookie } });
  const role1Summary = page1After.json().data.items.find(i => i.id === 'role-1');
  assert.equal(role1Summary.configured, true);
  assert.equal(role1Summary.totalReportCount, 3);
  assert.equal(role1Summary.enabledReportCount, 3);

  console.log('PASS: role-thematic proxy, permission verification, tree persistence, bootstrap role switching, and static route.');
} finally {
  if (app) await app.close();
  await new Promise(resolve => server.close(resolve));
}
