import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { buildApp } from '../src/app.js';
import {
  canViewDictionaryReport,
  createLiveDirectoryStore,
  extractLiveDirectoryReports,
  parseBusinessGroups,
  reportsFor,
} from '../src/source-repository.js';

// 1. Unit test extractLiveDirectoryReports + parseBusinessGroups + canViewDictionaryReport
{
  const live = extractLiveDirectoryReports([
    { id: 'decision-directory-root', parent_id: null, display_name: '目录', expand_type: 3, object_path: null },
    { id: 'folder-fin', parent_id: 'decision-directory-root', display_name: '财务目录', expand_type: 3, object_path: null },
    { id: 'rep-cpt', parent_id: 'folder-fin', display_name: '利润表', expand_type: 102, object_path: 'fin/profit.cpt' },
    { id: 'rep-frm', parent_id: 'folder-fin', display_name: '预算填报', expand_type: 102, object_path: 'fin/budget.frm?op=write' },
    { id: 'rep-fvs', parent_id: 'folder-fin', display_name: '财务驾驶舱', expand_type: 102, object_path: 'fin/board.fvs' },
    { id: 'rep-bi', parent_id: 'folder-fin', display_name: '销售分析', expand_type: 201, object_path: '' },
    { id: 'rep-url', parent_id: 'decision-directory-root', display_name: '外链系统', expand_type: 5, object_path: 'https://oa.example.com' },
    { id: 'decision-system-node', parent_id: 'decision-directory-root', display_name: '系统节点', expand_type: 102, object_path: 'sys.cpt' },
    { id: 'orphan-outside-dir', parent_id: 'decision-management-root', display_name: '管理节点', expand_type: 102, object_path: 'mgmt.cpt' },
  ]);

  assert.deepEqual([...live.keys()].sort(), ['rep-bi', 'rep-cpt', 'rep-frm', 'rep-fvs', 'rep-url']);
  assert.equal(live.get('rep-cpt').reportType, 'cpt');
  assert.equal(live.get('rep-frm').reportType, 'frm');
  assert.equal(live.get('rep-fvs').reportType, 'fvs');
  assert.equal(live.get('rep-bi').reportType, 'bi');
  assert.equal(live.get('rep-url').reportType, 'url');

  assert.deepEqual(parseBusinessGroups('药品事业群, 健康品事业群，供应链运营中心'), ['药品事业群', '健康品事业群', '供应链运营中心']);
  const depts = new Set(['药品事业群']);
  assert.equal(canViewDictionaryReport({ permission: 'granted', registered: false, businessGroup: '' }, depts), true);
  assert.equal(canViewDictionaryReport({ permission: 'denied', registered: false, businessGroup: '' }, depts), false);
  assert.equal(canViewDictionaryReport({ permission: 'granted', registered: true, businessGroup: '健康品事业群' }, depts), true);
  assert.equal(canViewDictionaryReport({ permission: 'denied', registered: true, businessGroup: '健康品事业群, 药品事业群' }, depts), true);
  assert.equal(canViewDictionaryReport({ permission: 'denied', registered: true, businessGroup: '健康品事业群' }, depts), false);
}

// 2. Full 3-state + mapping organization visibility + TTL cache verification via /portal/api/portal/v1/reports
{
  let fineAuthorityQueryCount = 0;
  let fineDeptQueryCount = 0;
  let portalDictQueryCount = 0;
  let portalDeptMapQueryCount = 0;
  const liveAuthorityRows = [
    { id: 'folder-root-1', parent_id: 'decision-directory-root', display_name: '经营目录', expand_type: 3, object_path: null },
    // Case 2a: mounted + registered + granted (cross-org: 健康品事业群) -> VISIBLE because granted
    { id: 'rep-reg-granted-cross', parent_id: 'folder-root-1', display_name: '跨组织利润看板', expand_type: 201, object_path: '' },
    // Case 2b: mounted + registered + denied + same-org (药品事业群) -> VISIBLE
    { id: 'rep-reg-denied-same', parent_id: 'folder-root-1', display_name: '药品成本分析表', expand_type: 102, object_path: 'cost.cpt' },
    // Case 2c: mounted + registered + denied + multi-org (健康品事业群，药品事业群) -> VISIBLE
    { id: 'rep-reg-denied-multi', parent_id: 'folder-root-1', display_name: '联合经营月报', expand_type: 102, object_path: 'joint.cpt' },
    // Case 2d: mounted + registered + denied + other-org (供应链运营中心) -> HIDDEN
    { id: 'rep-reg-denied-other', parent_id: 'folder-root-1', display_name: '外组织仓储表', expand_type: 102, object_path: 'wms.cpt' },
    // Case 1a: mounted + unregistered + granted -> VISIBLE
    { id: 'rep-unreg-granted', parent_id: 'folder-root-1', display_name: '新上线看板(未登记)', expand_type: 102, object_path: 'new_board.fvs' },
    // Case 1b: mounted + unregistered + denied -> HIDDEN
    { id: 'rep-unreg-denied', parent_id: 'folder-root-1', display_name: '财务填报(未登记无权)', expand_type: 102, object_path: 'fin_input.frm' },
  ];

  const fineDb = {
    async query(sql) {
      if (sql === 'SELECT 1') return { rows: [{ '?column?': 1 }] };
      if (sql.includes('fine_authority_object')) {
        fineAuthorityQueryCount++;
        return { rows: liveAuthorityRows };
      }
      if (sql.includes('/* portal: finedb user departments */')) {
        fineDeptQueryCount++;
        return { rows: [{ dep_id: 'oa-dept-pharma' }] };
      }
      throw new Error(`Unexpected FineDB SQL: ${sql}`);
    },
    async end() {},
  };

  const portalDb = {
    async query(sql, params = []) {
      if (sql === 'SELECT 1') return { rows: [{ '?column?': 1 }] };
      if (sql.includes('/* portal: user mapped departments */')) {
        portalDeptMapQueryCount++;
        assert(params[2]?.includes('oa-dept-pharma'), 'Should pass FineDB department id to dim_dept_mapping lookup');
        return { rows: [{ dept_name: '药品事业群' }] };
      }
      if (sql.includes('/* portal: dictionary metadata */')) {
        portalDictQueryCount++;
        return {
          rows: [
            {
              report_id: 'rep-reg-granted-cross', dictionary_id: 'dict-1',
              catalog_name: '跨组织利润看板', report_type: 'bi', total_views: 1200,
              dictionary_name: '跨组织利润看板', report_description: '跨组织已授权看板',
              business_domain: '财务', tags: '利润,核心经营', business_group: '健康品事业群',
              belonging_department: '健康品财务部', suggested_owner_name: '张三', developer_name: '李四',
              update_cycle: 'T+1', online_on: '2026-01-10', usage_scenario: '周会',
              core_metrics: '净利润', metrics_calc_logic: '收入-成本', data_source: 'ERP',
            },
            {
              report_id: 'rep-reg-denied-same', dictionary_id: 'dict-2',
              catalog_name: '药品成本分析表', report_type: 'cpt', total_views: 350,
              dictionary_name: '药品成本分析表', report_description: '本组织成本明细',
              business_domain: '财务', tags: '成本', business_group: '药品事业群',
              belonging_department: '药品财务部', suggested_owner_name: '王五', developer_name: '赵六',
              update_cycle: 'T+1', online_on: '2026-02-01', usage_scenario: '月度复盘',
              core_metrics: '单位成本', metrics_calc_logic: '', data_source: 'SAP',
            },
            {
              report_id: 'rep-reg-denied-multi', dictionary_id: 'dict-multi',
              catalog_name: '联合经营月报', report_type: 'cpt', total_views: 180,
              dictionary_name: '联合经营月报', report_description: '多组织联合分析',
              business_domain: '经营', tags: '月报', business_group: '健康品事业群，药品事业群',
              belonging_department: '运营部', suggested_owner_name: '陈九', developer_name: '赵六',
              update_cycle: 'T+1', online_on: '2026-03-01', usage_scenario: '',
              core_metrics: '营收', metrics_calc_logic: '', data_source: 'SAP',
            },
            {
              report_id: 'rep-reg-denied-other', dictionary_id: 'dict-other',
              catalog_name: '外组织仓储表', report_type: 'cpt', total_views: 90,
              dictionary_name: '外组织仓储表', report_description: '仅供应链可见',
              business_domain: '供应链', tags: '仓储', business_group: '供应链运营中心',
              belonging_department: '仓储部', suggested_owner_name: '周八', developer_name: '周八',
              update_cycle: 'T+1', online_on: '2026-03-01', usage_scenario: '',
              core_metrics: '库存', metrics_calc_logic: '', data_source: 'WMS',
            },
            // Case 3a: unmounted + same-org -> VISIBLE (archived)
            {
              report_id: 'rep-offline-same', dictionary_id: 'dict-3',
              catalog_name: '旧版药品库存表', report_type: 'cpt', total_views: 80,
              dictionary_name: '旧版药品库存表', report_description: '已停用替换',
              business_domain: '供应链', tags: '库存', business_group: '药品事业群',
              belonging_department: '药品供应部', suggested_owner_name: '孙七', developer_name: '周八',
              update_cycle: 'T+1', online_on: '2025-06-01', usage_scenario: '',
              core_metrics: '库存周转率', metrics_calc_logic: '', data_source: 'WMS',
            },
            // Case 3b: unmounted + other-org -> HIDDEN
            {
              report_id: 'rep-offline-other', dictionary_id: 'dict-4',
              catalog_name: '旧版供应链表', report_type: 'cpt', total_views: 40,
              dictionary_name: '旧版供应链表', report_description: '外组织已下架',
              business_domain: '供应链', tags: '库存', business_group: '供应链运营中心',
              belonging_department: '供应部', suggested_owner_name: '孙七', developer_name: '周八',
              update_cycle: 'T+1', online_on: '2025-06-01', usage_scenario: '',
              core_metrics: '', metrics_calc_logic: '', data_source: 'WMS',
            },
            // Blank report_id row in dictionary should not appear as offline report
            {
              report_id: '', dictionary_id: 'dict-blank',
              catalog_name: null, report_type: null, total_views: null,
              dictionary_name: '草稿占位', report_description: '',
              business_domain: '', tags: null, business_group: '药品事业群',
              belonging_department: '', suggested_owner_name: '', developer_name: '',
              update_cycle: '', online_on: null, usage_scenario: '',
              core_metrics: '', metrics_calc_logic: '', data_source: '',
            },
          ],
        };
      }
      if (sql.includes('/* portal: report info views lookup */')) {
        return {
          rows: [
            { report_id: 'rep-reg-granted-cross', report_name: '跨组织利润看板', report_type: 'bi', total_views: 1200 },
            { report_id: 'rep-unreg-granted', report_name: '新上线看板(未登记)', report_type: 'fvs', total_views: 260 },
            { report_id: 'rep-offline-same', report_name: '旧版药品库存表', report_type: 'cpt', total_views: 80 },
          ],
        };
      }
      throw new Error(`Unexpected portal DB SQL: ${sql}`);
    },
    async end() {},
  };

  const treeEntries = [
    { id: 'rep-reg-granted-cross', parentId: null, name: '跨组织利润看板', type: 'bi', sort: 0 },
    { id: 'rep-unreg-granted', parentId: null, name: '新上线看板(未登记)', type: 'fvs', sort: 1 },
  ];
  const entryMap = new Map(treeEntries.map(e => [e.id, e]));
  const platform = {
    context: async () => ({
      user: { userName: 'alice', name: 'Alice', fineUserIds: ['u-1'] },
      entries: treeEntries,
      ids: new Set(['rep-reg-granted-cross', 'rep-unreg-granted']),
      entryMap,
    }),
    favorites: async () => [],
    favorite: async () => {},
  };

  process.env.PUBLIC_ORIGIN = 'https://portal.example';
  delete process.env.FINEDB_DIRECTORY_CACHE_TTL_SECONDS;
  delete process.env.FINEDB_DIRECTORY_REFRESH_INTERVAL_SECONDS;
  const app = await buildApp({ platform, db: portalDb, fineDb });
  try {
    const res = await app.inject('/portal/api/portal/v1/reports?pageSize=20');
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(fineAuthorityQueryCount, 1, 'First request queries FineDB directory once');
    assert.equal(fineDeptQueryCount, 1, 'First request queries FineDB user departments once');
    assert.equal(portalDictQueryCount, 1, 'First request queries dictionary once');
    assert.equal(portalDeptMapQueryCount, 1, 'First request queries dim_dept_mapping once');

    const data = res.json().data;
    assert.deepEqual(
      data.items.map(i => i.id).sort(),
      ['rep-offline-same', 'rep-reg-denied-multi', 'rep-reg-denied-same', 'rep-reg-granted-cross', 'rep-unreg-granted'],
      'Visible set must include granted reports (even cross-org/unregistered) and same-org/multi-org reports, while hiding other-org denied/offline and ungranted unregistered reports',
    );

    const byId = new Map(data.items.map(item => [item.id, item]));
    assert.equal(byId.get('rep-reg-granted-cross').permission, 'granted');
    assert.equal(byId.get('rep-reg-granted-cross').status, 'active');
    assert.equal(byId.get('rep-reg-denied-same').permission, 'denied');
    assert.equal(byId.get('rep-reg-denied-multi').permission, 'denied');
    assert.equal(byId.get('rep-unreg-granted').registered, false);
    assert.equal(byId.get('rep-unreg-granted').views, 260);
    assert.equal(byId.get('rep-offline-same').status, 'archived');

    const statusFacet = Object.fromEntries(data.facets.status.map(f => [f.value, f.count]));
    assert.deepEqual(statusFacet, { active: 3, unregistered: 1, archived: 1 });
    assert(data.facets.frequency.every(f => f.value !== ''), 'Frequency facet must not include empty values');

    // Subsequent filtered requests hit ALL caches (fineDirectoryStore + catalogCache + userDeptsCache) -> ZERO extra DB queries!
    const onlyUnreg = await app.inject('/portal/api/portal/v1/reports?status=unregistered');
    assert.equal(onlyUnreg.statusCode, 200, onlyUnreg.body);
    assert.deepEqual(onlyUnreg.json().data.items.map(i => i.id), ['rep-unreg-granted']);

    const onlyArchived = await app.inject('/portal/api/portal/v1/reports?status=archived');
    assert.equal(onlyArchived.statusCode, 200, onlyArchived.body);
    assert.deepEqual(onlyArchived.json().data.items.map(i => i.id), ['rep-offline-same']);

    assert.equal(fineAuthorityQueryCount, 1, 'Filtered requests must reuse FineDB TTL cache');
    assert.equal(fineDeptQueryCount, 1, 'Filtered requests must reuse userDeptsCache');
    assert.equal(portalDictQueryCount, 1, 'Filtered requests must reuse catalogCache');
    assert.equal(portalDeptMapQueryCount, 1, 'Filtered requests must reuse userDeptsCache');
  } finally {
    await app.close();
  }
}

// 3. Dedicated test for createLiveDirectoryStore: single-flight, background periodic refresh, and stale-while-error fallback
{
  let queries = 0;
  let shouldFail = false;
  let rows = [
    { id: 'rep-1', parent_id: 'decision-directory-root', display_name: '报表1', expand_type: 102, object_path: 'r1.cpt' },
  ];
  const warnings = [];
  const slowFineDb = {
    async query() {
      queries++;
      await delay(20);
      if (shouldFail) throw Object.assign(new Error('finedb busy'), { code: '08006' });
      return { rows };
    },
  };

  const store = createLiveDirectoryStore({
    fineDb: slowFineDb,
    ttlMs: 120,
    refreshIntervalMs: 60,
    env: { FINEDB_SCHEMA: 'finedb' },
    log: { info() {}, warn: (meta, msg) => warnings.push({ meta, msg }) },
  });

  try {
    const results = await Promise.all(Array.from({ length: 8 }, () => store.get()));
    assert.equal(queries, 1, 'Concurrent cold requests must coalesce into 1 FineDB query');
    assert.equal(results[0].size, 1);

    store.start();
    rows = [
      ...rows,
      { id: 'rep-2', parent_id: 'decision-directory-root', display_name: '新增报表2', expand_type: 201, object_path: '' },
    ];
    await delay(110);
    const refreshed = await store.get();
    assert.deepEqual([...refreshed.keys()].sort(), ['rep-1', 'rep-2'], 'Background timer must proactively refresh snapshot');
    const queriesAfterRefresh = queries;

    store.stop();
    const staleStore = createLiveDirectoryStore({
      fineDb: slowFineDb,
      ttlMs: 40,
      refreshIntervalMs: 0,
      env: { FINEDB_SCHEMA: 'finedb' },
      log: { info() {}, warn: (meta, msg) => warnings.push({ meta, msg }) },
    });
    const initial = await staleStore.get();
    assert.equal(initial.size, 2);
    await delay(60);
    shouldFail = true;
    const staleServed = await staleStore.get();
    assert.equal(staleServed.size, 2, 'Expired cache with transient FineDB error must serve stale snapshot');
    assert(warnings.some(w => w.meta.result === 'stale-fallback'), 'Stale fallback must log warning');
    assert(queries >= queriesAfterRefresh + 2);
    staleStore.stop();
  } finally {
    store.stop();
  }
}

// 4. Fallback test: 42P01 on FineDB falls back cleanly to dim_bi_report_dictionary with warning
{
  const warnings = [];
  const missingFineDb = {
    async query() {
      throw Object.assign(new Error('relation "finedb.fine_authority_object" does not exist'), { code: '42P01' });
    },
  };
  const fallbackPortalDb = {
    async query() {
      return {
        rows: [{
          report_id: 'rep-fallback', dictionary_id: 'd-fb',
          catalog_name: '兜底报表', report_type: 'cpt', total_views: 10,
          dictionary_name: '兜底报表', report_description: '说明',
          business_domain: '', tags: null, business_group: '集团',
          belonging_department: '财务部', suggested_owner_name: '张三', developer_name: '',
          update_cycle: 'T+1', online_on: null, usage_scenario: '',
          core_metrics: '', metrics_calc_logic: '', data_source: '',
        }],
      };
    },
  };
  const reports = await reportsFor(
    fallbackPortalDb,
    { ids: new Set(['rep-fallback']), entries: [], entryMap: new Map(), log: { warn: (meta, msg) => warnings.push({ meta, msg }) } },
    true,
    { fineDb: missingFineDb, env: { FINEDB_SCHEMA: 'finedb' } },
  );
  assert.equal(reports.length, 1);
  assert.equal(reports[0].id, 'rep-fallback');
  assert.equal(reports[0].status, 'active');
  assert.equal(reports[0].registered, true);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].meta.code, '42P01');
}

console.log('PASS: FineDB dictionary 3-state merge, mapping organization visibility filter, TTL + background refresh, single-flight, stale fallback, and 42P01 fallback verified.');
