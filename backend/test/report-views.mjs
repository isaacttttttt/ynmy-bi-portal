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
            report_id: 'rep-high', dictionary_id: 'd-1', granted: true,
            catalog_name: '高频报表', report_type: 'bi', total_views: '1500',
            dictionary_name: '高频报表', report_description: '说明1', business_domain: '供应链',
            business_group: '集团', belonging_department: '供应部', suggested_owner_name: '张三',
            developer_name: '李四', update_cycle: 'T+1', online_on: '2026-01-01',
            usage_scenario: '例会', core_metrics: '销售额', metrics_calc_logic: '', data_source: 'ERP',
          },
          {
            report_id: 'rep-mid', dictionary_id: 'd-2', granted: true,
            catalog_name: '中频报表', report_type: 'cpt', total_views: 320,
            dictionary_name: '中频报表', report_description: '说明2', business_domain: '财务',
            business_group: '集团', belonging_department: '财务部', suggested_owner_name: '王五',
            developer_name: '赵六', update_cycle: 'T+1', online_on: null,
            usage_scenario: '', core_metrics: '毛利率', metrics_calc_logic: '', data_source: 'ERP',
          },
          {
            report_id: 'rep-null', dictionary_id: 'd-3', granted: false,
            catalog_name: null, report_type: null, total_views: null,
            dictionary_name: '低频未同步报表', report_description: '', business_domain: '运营',
            business_group: '集团', belonging_department: '运营部', suggested_owner_name: '',
            developer_name: '', update_cycle: '周更新', online_on: null,
            usage_scenario: '', core_metrics: '', metrics_calc_logic: '', data_source: '',
          },
        ],
      };
    }
    if (sql.includes('/* portal: catalog metadata */')) {
      assert(!sql.includes('dim_bi_visit_log'), 'Search query must not touch dim_bi_visit_log');
      return {
        rows: [
          {
            report_id: 'rep-high', granted: true,
            catalog_name: '高频报表', report_type: 'bi', total_views: '1500',
            dictionary_name: '高频报表', report_description: '说明1', business_domain: '供应链',
            business_group: '集团', belonging_department: '供应部', suggested_owner_name: '张三',
            developer_name: '李四', update_cycle: 'T+1', online_on: '2026-01-01',
            usage_scenario: '例会', core_metrics: '销售额', metrics_calc_logic: '', data_source: 'ERP',
          },
        ],
      };
    }
    if (sql.includes('FROM dim_bi_visit_log')) {
      assert(sql.includes('WHERE user_code=$2'), 'Workbench visit query must filter by current user_code');
      assert(!sql.includes('sum(visit_num::bigint) AS total_views'), 'Workbench must read total_views from dim_bi_report_info_dtl');
      return {
        rows: [
          {
            report_id: 'rep-high', granted: true,
            catalog_name: '高频报表', report_type: 'bi', total_views: 1500,
            dictionary_name: '高频报表', report_description: '说明1', business_domain: '供应链',
            business_group: '集团', belonging_department: '供应部', suggested_owner_name: '张三',
            developer_name: '李四', update_cycle: 'T+1', online_on: '2026-01-01',
            usage_scenario: '例会', core_metrics: '销售额', metrics_calc_logic: '', data_source: 'ERP',
            visits30d: 18, last_visited: '2026-11-20',
          },
        ],
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
const platform = {
  context: async () => ({ user: { userName: 'alice', name: 'Alice' }, entries, ids: new Set(entries.map(e => e.id)) }),
  favorites: async () => ['rep-high'],
  favorite: async () => {},
};

process.env.PUBLIC_ORIGIN = 'https://portal.example';
const app = await buildApp({ platform, db });
try {
  // 1. Dictionary /reports reads report_total_views and never touches dim_bi_visit_log
  queries.length = 0;
  const all = await app.inject('/portal/api/portal/v1/reports?pageSize=10');
  assert.equal(all.statusCode, 200, all.body);
  const allData = all.json().data;
  assert.equal(allData.total, 3);
  assert.equal(allData.items.find(r => r.id === 'rep-high').views, 1500);
  assert.equal(allData.items.find(r => r.id === 'rep-mid').views, 320);
  assert.equal(allData.items.find(r => r.id === 'rep-null').views, 0);
  assert(queries.every(q => !q.sql.includes('dim_bi_visit_log')), 'Dictionary must execute zero visit_log queries');

  const high = await app.inject('/portal/api/portal/v1/reports?volume=high');
  assert.deepEqual(high.json().data.items.map(r => r.id), ['rep-high']);
  const medium = await app.inject('/portal/api/portal/v1/reports?volume=medium');
  assert.deepEqual(medium.json().data.items.map(r => r.id), ['rep-mid']);
  const low = await app.inject('/portal/api/portal/v1/reports?volume=low');
  assert.deepEqual(low.json().data.items.map(r => r.id), ['rep-null']);

  // 2. Search skips dim_bi_visit_log completely
  queries.length = 0;
  const searched = await app.inject('/portal/api/portal/v1/search?category=all&q=' + encodeURIComponent('高频'));
  assert.equal(searched.statusCode, 200, searched.body);
  assert.equal(searched.json().data.items[0].report.views, 1500);
  assert(queries.every(q => !q.sql.includes('dim_bi_visit_log')), 'Search must execute zero visit_log queries');

  // 3. Workbench snapshot reads total_views from dim_bi_report_info_dtl and filters visit_log by user_code
  queries.length = 0;
  const snap = await app.inject('/portal/api/portal/v1/workbench/snapshot');
  assert.equal(snap.statusCode, 200, snap.body);
  assert.equal(snap.json().data.recent[0].views, 1500);
  assert.equal(snap.json().data.frequent[0].visits30d, 18);

  console.log('PASS: report_total_views read directly for dictionary/search/workbench without scanning full dim_bi_visit_log.');
} finally {
  await app.close();
}
