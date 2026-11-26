import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { buildApp } from '../src/app.js';
import { createLiveDirectoryStore, extractLiveDirectoryReports, reportsFor } from '../src/source-repository.js';

// 1. Unit test extractLiveDirectoryReports: scopes to decision-directory-root, excludes folders & decision/non-directory nodes, infers types
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
}

// 2. Full 3-state integration test + TTL cache hit verification via /portal/api/portal/v1/reports
{
  let fineAuthorityQueryCount = 0;
  let portalDictQueryCount = 0;
  let liveAuthorityRows = [
    { id: 'folder-root-1', parent_id: 'decision-directory-root', display_name: '经营目录', expand_type: 3, object_path: null },
    // Case 2: mounted + registered (granted)
    { id: 'rep-reg-granted', parent_id: 'folder-root-1', display_name: '实时利润看板', expand_type: 201, object_path: '' },
    // Case 2: mounted + registered (denied)
    { id: 'rep-reg-denied', parent_id: 'folder-root-1', display_name: '成本分析表', expand_type: 102, object_path: 'cost.cpt' },
    // Case 1: mounted + unregistered (granted)
    { id: 'rep-unreg-granted', parent_id: 'folder-root-1', display_name: '新上线看板(未登记)', expand_type: 102, object_path: 'new_board.fvs' },
    // Case 1: mounted + unregistered (denied)
    { id: 'rep-unreg-denied', parent_id: 'folder-root-1', display_name: '财务填报(未登记)', expand_type: 102, object_path: 'fin_input.frm' },
  ];

  const fineDb = {
    async query(sql) {
      if (sql === 'SELECT 1') return { rows: [{ '?column?': 1 }] };
      if (sql.includes('fine_authority_object')) {
        fineAuthorityQueryCount++;
        return { rows: liveAuthorityRows };
      }
      throw new Error(`Unexpected FineDB SQL: ${sql}`);
    },
    async end() {},
  };

  const portalDb = {
    async query(sql) {
      if (sql === 'SELECT 1') return { rows: [{ '?column?': 1 }] };
      if (sql.includes('/* portal: dictionary metadata */')) {
        portalDictQueryCount++;
        return {
          rows: [
            {
              report_id: 'rep-reg-granted', dictionary_id: 'dict-1',
              catalog_name: '旧利润看板', report_type: 'bi', total_views: 1200,
              dictionary_name: '实时利润看板', report_description: '集团利润核心分析',
              business_domain: '财务', tags: '利润,核心经营', business_group: '集团',
              belonging_department: '财务部', suggested_owner_name: '张三', developer_name: '李四',
              update_cycle: 'T+1', online_on: '2026-01-10', usage_scenario: '周会',
              core_metrics: '净利润', metrics_calc_logic: '收入-成本', data_source: 'ERP',
            },
            {
              report_id: 'rep-reg-denied', dictionary_id: 'dict-2',
              catalog_name: '成本分析表', report_type: 'cpt', total_views: 350,
              dictionary_name: '成本分析表', report_description: '成本明细',
              business_domain: '财务', tags: '成本', business_group: '集团',
              belonging_department: '财务部', suggested_owner_name: '王五', developer_name: '赵六',
              update_cycle: 'T+1', online_on: '2026-02-01', usage_scenario: '月度复盘',
              core_metrics: '单位成本', metrics_calc_logic: '', data_source: 'SAP',
            },
            // Case 3: NOT in FineDB live directory, but exists in dictionary with report_id -> 已下架 (archived)
            {
              report_id: 'rep-offline', dictionary_id: 'dict-3',
              catalog_name: '旧版库存表', report_type: 'cpt', total_views: 80,
              dictionary_name: '旧版库存表', report_description: '已停用替换',
              business_domain: '供应链', tags: '库存', business_group: '供应集团',
              belonging_department: '供应部', suggested_owner_name: '孙七', developer_name: '周八',
              update_cycle: 'T+1', online_on: '2025-06-01', usage_scenario: '',
              core_metrics: '库存周转率', metrics_calc_logic: '', data_source: 'WMS',
            },
            // Blank report_id row in dictionary should not appear as offline report
            {
              report_id: '', dictionary_id: 'dict-blank',
              catalog_name: null, report_type: null, total_views: null,
              dictionary_name: '草稿占位', report_description: '',
              business_domain: '', tags: null, business_group: '',
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
            { report_id: 'rep-reg-granted', report_name: '实时利润看板', report_type: 'bi', total_views: 1200 },
            { report_id: 'rep-unreg-granted', report_name: '新上线看板(未登记)', report_type: 'fvs', total_views: 260 },
            { report_id: 'rep-offline', report_name: '旧版库存表', report_type: 'cpt', total_views: 80 },
          ],
        };
      }
      throw new Error(`Unexpected portal DB SQL: ${sql}`);
    },
    async end() {},
  };

  const treeEntries = [
    { id: 'rep-reg-granted', parentId: null, name: '实时利润看板', type: 'bi', sort: 0 },
    { id: 'rep-unreg-granted', parentId: null, name: '新上线看板(未登记)', type: 'fvs', sort: 1 },
  ];
  const entryMap = new Map(treeEntries.map(e => [e.id, e]));
  const platform = {
    context: async () => ({
      user: { userName: 'alice', name: 'Alice' },
      entries: treeEntries,
      ids: new Set(['rep-reg-granted', 'rep-unreg-granted']),
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
    assert.equal(fineAuthorityQueryCount, 1, 'First request queries FineDB once');
    assert.equal(portalDictQueryCount, 1, 'First request queries dictionary once');

    const data = res.json().data;
    assert.equal(data.total, 5, 'Should return 2 registered + 2 unregistered + 1 offline (excluding blank report_id)');

    const byId = new Map(data.items.map(item => [item.id, item]));
    assert.equal(byId.get('rep-reg-granted').status, 'active');
    assert.equal(byId.get('rep-reg-granted').registered, true);
    assert.equal(byId.get('rep-reg-granted').permission, 'granted');
    assert.equal(byId.get('rep-reg-granted').views, 1200);

    assert.equal(byId.get('rep-reg-denied').status, 'active');
    assert.equal(byId.get('rep-reg-denied').registered, true);
    assert.equal(byId.get('rep-reg-denied').permission, 'denied');

    assert.equal(byId.get('rep-unreg-granted').status, 'active');
    assert.equal(byId.get('rep-unreg-granted').registered, false);
    assert.equal(byId.get('rep-unreg-granted').permission, 'granted');
    assert.equal(byId.get('rep-unreg-granted').type, 'fvs');
    assert.equal(byId.get('rep-unreg-granted').views, 260);

    assert.equal(byId.get('rep-unreg-denied').status, 'active');
    assert.equal(byId.get('rep-unreg-denied').registered, false);
    assert.equal(byId.get('rep-unreg-denied').permission, 'denied');
    assert.equal(byId.get('rep-unreg-denied').type, 'frm');
    assert.equal(byId.get('rep-unreg-denied').views, 0);

    assert.equal(byId.get('rep-offline').status, 'archived');
    assert.equal(byId.get('rep-offline').registered, true);
    assert.equal(byId.get('rep-offline').permission, 'denied');

    const statusFacet = Object.fromEntries(data.facets.status.map(f => [f.value, f.count]));
    assert.deepEqual(statusFacet, { active: 2, unregistered: 2, archived: 1 });
    assert(data.facets.frequency.every(f => f.value !== ''), 'Frequency facet must not include empty values');

    // Subsequent filtered requests hit TTL cache -> ZERO additional FineDB or dictionary SQL!
    const onlyUnreg = await app.inject('/portal/api/portal/v1/reports?status=unregistered');
    assert.equal(onlyUnreg.statusCode, 200, onlyUnreg.body);
    assert.deepEqual(onlyUnreg.json().data.items.map(i => i.id).sort(), ['rep-unreg-denied', 'rep-unreg-granted']);

    const onlyArchived = await app.inject('/portal/api/portal/v1/reports?status=archived');
    assert.equal(onlyArchived.statusCode, 200, onlyArchived.body);
    assert.deepEqual(onlyArchived.json().data.items.map(i => i.id), ['rep-offline']);

    assert.equal(fineAuthorityQueryCount, 1, 'Filtered requests must reuse FineDB TTL cache (0 extra FineDB queries)');
    assert.equal(portalDictQueryCount, 1, 'Filtered requests must reuse catalogCache (0 extra dictionary queries)');
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
    // 3a. Single-flight: 8 concurrent cold requests trigger only 1 FineDB query
    const results = await Promise.all(Array.from({ length: 8 }, () => store.get()));
    assert.equal(queries, 1, 'Concurrent cold requests must coalesce into 1 FineDB query');
    assert.equal(results[0].size, 1);

    // 3b. Background periodic refresh picks up directory changes automatically
    store.start();
    rows = [
      ...rows,
      { id: 'rep-2', parent_id: 'decision-directory-root', display_name: '新增报表2', expand_type: 201, object_path: '' },
    ];
    await delay(110);
    const refreshed = await store.get();
    assert.deepEqual([...refreshed.keys()].sort(), ['rep-1', 'rep-2'], 'Background timer must proactively refresh snapshot');
    const queriesAfterRefresh = queries;

    // 3c. Stale-while-error fallback: if refresh fails after TTL expires, serve last valid snapshot instead of throwing
    store.stop(); // stop timer and test fresh store for stale fallback on expired TTL
    const staleStore = createLiveDirectoryStore({
      fineDb: slowFineDb,
      ttlMs: 40,
      refreshIntervalMs: 0,
      env: { FINEDB_SCHEMA: 'finedb' },
      log: { info() {}, warn: (meta, msg) => warnings.push({ meta, msg }) },
    });
    const initial = await staleStore.get();
    assert.equal(initial.size, 2);
    await delay(60); // let TTL expire
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

console.log('PASS: FineDB dictionary 3-state merge, TTL + background refresh, single-flight, stale fallback, and 42P01 fallback verified.');
