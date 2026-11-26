import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

const queries = [];
const db = {
  async query(sql, params = []) {
    queries.push({ sql, params });
    if (sql.includes('SELECT 1')) return { rows: [{ '?column?': 1 }] };
    if (sql.includes('SELECT max(day_id) AS day')) return { rows: [{ day: '2026-11-20' }] };
    if (sql.includes('/* portal: dictionary metadata */')) {
      assert(sql.includes('r.report_total_views'), 'Dictionary query must read report_total_views from dim_bi_report_info_dtl');
      assert(!sql.includes('dim_bi_visit_log'), 'Dictionary query must not touch dim_bi_visit_log');
      return {
        rows: [
          {
            report_id: 'rep-high', dictionary_id: 'd-1',
            catalog_name: '高频报表', report_type: 'bi', total_views: '1500',
            dictionary_name: '高频报表', report_description: '说明1', business_domain: '供应链',
            tags: '核心经营, 重点看板',
            business_group: '集团', belonging_department: '供应部', suggested_owner_name: '张三',
            developer_name: '李四', update_cycle: 'T+1', online_on: '2026-01-01',
            usage_scenario: '例会', core_metrics: '销售额', metrics_calc_logic: '', data_source: 'ERP',
          },
          {
            report_id: 'rep-mid', dictionary_id: 'd-2',
            catalog_name: '中频报表', report_type: 'cpt', total_views: 320,
            dictionary_name: '中频报表', report_description: '说明2', business_domain: '财务',
            tags: '月报、预算分析',
            business_group: '集团', belonging_department: '财务部', suggested_owner_name: '王五',
            developer_name: '赵六', update_cycle: 'T+1', online_on: null,
            usage_scenario: '', core_metrics: '毛利率', metrics_calc_logic: '', data_source: 'ERP',
          },
          {
            report_id: 'rep-null', dictionary_id: 'd-3',
            catalog_name: null, report_type: null, total_views: null,
            dictionary_name: '低频未同步报表', report_description: '', business_domain: '运营',
            tags: null,
            business_group: '集团', belonging_department: '运营部', suggested_owner_name: '',
            developer_name: '', update_cycle: '周更新', online_on: null,
            usage_scenario: '', core_metrics: '', metrics_calc_logic: '', data_source: '',
          },
        ],
      };
    }
    if (sql.includes('/* portal: catalog metadata */')) {
      assert(!sql.includes('dim_bi_visit_log'), 'Catalog metadata query must not touch dim_bi_visit_log');
      return {
        rows: [
          {
            report_id: 'rep-high',
            catalog_name: '高频报表', report_type: 'bi', total_views: '1500',
            dictionary_name: '高频报表', report_description: '说明1', business_domain: '供应链',
            tags: '核心经营, 重点看板',
            business_group: '集团', belonging_department: '供应部', suggested_owner_name: '张三',
            developer_name: '李四', update_cycle: 'T+1', online_on: '2026-01-01',
            usage_scenario: '例会', core_metrics: '销售额', metrics_calc_logic: '', data_source: 'ERP',
          },
          {
            report_id: 'rep-mid',
            catalog_name: '中频报表', report_type: 'cpt', total_views: 320,
            dictionary_name: '中频报表', report_description: '说明2', business_domain: '财务',
            tags: '月报、预算分析',
            business_group: '集团', belonging_department: '财务部', suggested_owner_name: '王五',
            developer_name: '赵六', update_cycle: 'T+1', online_on: null,
            usage_scenario: '', core_metrics: '毛利率', metrics_calc_logic: '', data_source: 'ERP',
          },
        ],
      };
    }
    if (sql.includes('/* portal: user visits */')) {
      assert(sql.includes('WHERE user_code=$2'), 'Workbench visit query must filter by current user_code');
      assert(!sql.includes('sum(visit_num::bigint) AS total_views'), 'Workbench must read total_views from dim_bi_report_info_dtl');
      return {
        rows: [
          { report_id: 'rep-high', visits30d: 18, last_visited: '2026-11-20' },
        ],
      };
    }
    if (sql.includes('/* portal: user mapped departments */')) {
      assert.deepEqual(params[0], ['DEPT-001']);
      return { rows: [{ dept_name: '集团' }] };
    }
    if (sql.includes('FROM fr_index_noticement')) {
      assert(!sql.includes('dim_bi_user'), 'Notices query skips dim_bi_user when oaDeptCodes is preloaded on context.user');
      assert.deepEqual(params[0], ['DEPT-001']);
      return {
        rows: [{
          notice_uuid: 'n-1', notice_title: '测试公告', notice_category: '通知',
          notice_is_top: '1', notice_register_day_id: '2026-11-20', notice_content: '正文',
        }],
      };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  },
  async end() {},
};

const entries = [
  { id: 'rep-high', parentId: null, name: '高频报表', type: 'bi', templateId: 'tpl-1', sort: 0 },
  { id: 'rep-mid', parentId: null, name: '中频报表', type: 'cpt', sort: 1 },
];
const entryMap = new Map(entries.map(e => [e.id, e]));
let activeIds = new Set(['rep-high', 'rep-mid']);
let treeRequestedOnNotices = false;
const platform = {
  context: async (_req, options = {}) => {
    if (options.needTree === false) {
      return { user: { userName: 'alice', name: 'Alice', oaDeptCodes: ['DEPT-001'] }, entries: [], ids: new Set(), entryMap: new Map() };
    }
    treeRequestedOnNotices = true;
    return { user: { userName: 'alice', name: 'Alice', oaDeptCodes: ['DEPT-001'] }, entries, ids: activeIds, entryMap };
  },
  favorites: async () => ['rep-high'],
  favorite: async () => {},
};

process.env.PUBLIC_ORIGIN = 'https://portal.example';
const app = await buildApp({ platform, db, fineDb: null });
try {
  // 1. Dictionary /reports reads report_total_views, never touches dim_bi_visit_log, and caches metadata across users/filters
  queries.length = 0;
  const all = await app.inject('/portal/api/portal/v1/reports?pageSize=10');
  assert.equal(all.statusCode, 200, all.body);
  const allData = all.json().data;
  assert.equal(allData.total, 3);
  assert.equal(allData.items.find(r => r.id === 'rep-high').views, 1500);
  assert.equal(allData.items.find(r => r.id === 'rep-mid').views, 320);
  assert.equal(allData.items.find(r => r.id === 'rep-null').views, 0);
  assert.equal(queries.length, 2, 'First dictionary query executes 1 metadata SQL + 1 user mapped departments SQL and 0 visit_log SQL');

  // Subsequent filtered requests & different user permission sets reuse cached dictionary metadata (0 SQL!)
  queries.length = 0;
  const high = await app.inject('/portal/api/portal/v1/reports?volume=high');
  assert.deepEqual(high.json().data.items.map(r => r.id), ['rep-high']);
  const medium = await app.inject('/portal/api/portal/v1/reports?volume=medium');
  assert.deepEqual(medium.json().data.items.map(r => r.id), ['rep-mid']);
  const low = await app.inject('/portal/api/portal/v1/reports?volume=low');
  assert.deepEqual(low.json().data.items.map(r => r.id), ['rep-null']);
  // Verify permission evaluation stays per-user even with shared catalog cache
  activeIds = new Set(['rep-high']);
  const restricted = await app.inject('/portal/api/portal/v1/reports?permission=granted');
  assert.deepEqual(restricted.json().data.items.map(r => r.id), ['rep-high']);
  activeIds = new Set(['rep-high', 'rep-mid']);
  assert.equal(queries.length, 0, 'Cached dictionary metadata serves filters and different users with 0 SQL');

  // 2. Search skips dim_bi_visit_log, populates shared catalog-rows cache, and searches tags from dim_bi_report_dictionary.tags (not business_domain)
  queries.length = 0;
  const searched = await app.inject('/portal/api/portal/v1/search?category=all&q=' + encodeURIComponent('高频'));
  assert.equal(searched.statusCode, 200, searched.body);
  assert.equal(searched.json().data.items[0].report.views, 1500);
  assert.equal(queries.length, 1);
  assert(queries[0].sql.includes('d.tags'), 'Catalog query must select d.tags');
  assert(queries.every(q => !q.sql.includes('dim_bi_visit_log')), 'Search must execute zero visit_log queries');

  const tagHit = await app.inject('/portal/api/portal/v1/search?category=tag&q=' + encodeURIComponent('重点看板'));
  assert.equal(tagHit.statusCode, 200, tagHit.body);
  assert.deepEqual(tagHit.json().data.items.map(i => i.value), ['重点看板']);

  const domainNotTag = await app.inject('/portal/api/portal/v1/search?category=tag&q=' + encodeURIComponent('供应链'));
  assert.equal(domainNotTag.statusCode, 200, domainNotTag.body);
  assert.equal(domainNotTag.json().data.items.length, 0, 'Tag search must use d.tags instead of business_domain');

  const dictByTag = await app.inject('/portal/api/portal/v1/reports?category=tag&q=' + encodeURIComponent('预算分析'));
  assert.equal(dictByTag.statusCode, 200, dictByTag.body);
  assert.deepEqual(dictByTag.json().data.items.map(r => r.id), ['rep-mid']);

  const dictByDomainOnTag = await app.inject('/portal/api/portal/v1/reports?category=tag&q=' + encodeURIComponent('供应链'));
  assert.equal(dictByDomainOnTag.statusCode, 200, dictByDomainOnTag.body);
  assert.equal(dictByDomainOnTag.json().data.items.length, 0);

  // 3. Workbench snapshot reuses cached catalog-rows + queries only current user visits
  queries.length = 0;
  const snap = await app.inject('/portal/api/portal/v1/workbench/snapshot');
  assert.equal(snap.statusCode, 200, snap.body);
  assert.equal(snap.json().data.recent[0].views, 1500);
  assert.equal(snap.json().data.frequent[0].visits30d, 18);
  assert(queries.every(q => !q.sql.includes('/* portal: catalog metadata */')), 'Workbench reuses cached catalog rows');

  // 4. Notices skip both /v10/view/entry/tree and dim_bi_user join when oaDeptCodes is preloaded
  queries.length = 0;
  treeRequestedOnNotices = false;
  const notices = await app.inject('/portal/api/portal/v1/notices');
  assert.equal(notices.statusCode, 200, notices.body);
  assert.equal(notices.json().data.total, 1);
  assert.equal(treeRequestedOnNotices, false, 'Notices route must not request tree');

  console.log('PASS: report_total_views, shared catalog cache with per-user auth, scoped user visits, and lazy-tree notices.');
} finally {
  await app.close();
}
