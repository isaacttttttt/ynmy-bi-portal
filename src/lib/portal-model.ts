export type EntryType = 'folder' | 'bi' | 'fvs' | 'frm' | 'cpt' | 'url';
export interface Entry {
  id: string; parentId: string | null; name: string; type: EntryType;
  templateId?: string; url?: string; iconUrl?: string; sort: number;
}
export interface Report extends Entry {
  metadataId: string; description: string; module: string; businessGroup: string; department: string;
  owner: string; developer: string; developerDepartment: string; frequency: string; status: 'active' | 'archived';
  permission: 'granted' | 'denied'; onlineOn: string | null; updateNote: string;
  source: string; metrics: string[]; views: number | null; visits30d: number;
  lastVisitedOn: string | null; useScene: string; calcLogic: string; updatedOn: string;
}
export interface Notice {
  id: string; title: string; category: string; pinned: boolean; publishedOn: string;
  content: string; url?: string; attachment?: { name: string; url: string };
}
export interface QuickEntry { id: string; name: string; description: string; url: string | null; iconUrl?: string | null }
export interface Bootstrap {
  platform?: { entryAccessUrl: string; biServiceName: string; biTabType: string };
  user: { name: string }; rootId: string; entries: Entry[]; favoriteIds: string[];
  quickEntries: QuickEntry[]; dataAsOf: string | null;
}
export type WorkbenchTab = 'recent' | 'frequent' | 'favorites';
export type WorkbenchData = Record<WorkbenchTab, Report[]>;
export type FilterKey = 'organization' | 'status' | 'permission' | 'frequency' | 'volume';
export type Filters = Record<FilterKey, string[]>;
export const searchCategories = ['all', 'report', 'tag', 'metric'] as const;
export type SearchCategory = typeof searchCategories[number];
export const searchLabels: Record<SearchCategory, string> = { all: '综合', report: '报表', tag: '标签', metric: '指标' };
export interface SearchHistory { items: { query: string; searchedAt: string }[] }
export interface SearchItem { category: Exclude<SearchCategory, 'all'>; value: string; subtitle: string; report?: Report }
export interface SearchResult { items: SearchItem[]; total: number }
export interface ReportQuery { q: string; category?: SearchCategory; filters: Filters; page: number; pageSize: number }
export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }
export interface ReportPage extends Page<Report> {
  facets: Record<FilterKey, { value: string; count: number }[]>;
  visitStatsUnavailable?: boolean;
}
export const emptyFilters = (): Filters => ({ organization: [], status: [], permission: [], frequency: [], volume: [] });
export const volume = (views: number) => views > 1000 ? 'high' : views >= 100 ? 'medium' : 'low';
export const typeLabel: Record<EntryType, string> = { folder: '专题目录', bi: 'BI 分析', fvs: '驾驶舱', frm: '填报', cpt: '报表', url: '外部链接' };
export const themeFor = (type: EntryType) => type === 'folder' ? 'orange' : type === 'frm' ? 'purple' : type === 'cpt' ? 'teal' : 'blue';
export const filterLabels: Record<FilterKey, string> = { organization: '所属组织', status: '报表状态', permission: '权限状态', frequency: '数据时效', volume: '访问量级' };
export const optionLabels: Record<string, string> = { granted: '有访问权限', denied: '无访问权限', active: '在用', archived: '已归档', high: '高频（>1000）', medium: '中频（100–1000）', low: '低频（<100）' };
export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}
export function queryReports(reports: Report[], query: ReportQuery): ReportPage {
  const q = query.q.trim().toLocaleLowerCase();
  const visitStatsUnavailable = reports.some(r => r.views === null);
  const keys = (Object.keys(query.filters) as FilterKey[]).filter(key => key !== 'volume' || !visitStatsUnavailable);
  const groups = keys.map(key => ({ key, selected: new Set(query.filters[key]), counts: new Map<string, number>() }));
  const matches: Report[] = [];
  for (const report of reports) {
    const values = {
      organization: report.businessGroup || '暂未维护', status: report.status, permission: report.permission,
      frequency: report.frequency, volume: report.views === null ? '' : volume(report.views),
    };
    const searched = matchesReportQuery(report, query.category ?? 'all', q);
    let excludedBy: FilterKey | undefined;
    let exclusions = 0;
    for (const { key, selected, counts } of groups) {
      const value = values[key];
      if (!counts.has(value)) counts.set(value, 0);
      if (selected.size && !selected.has(value)) { excludedBy = key; exclusions++; }
    }
    if (!searched || exclusions > 1) continue;
    if (!excludedBy) matches.push(report);
    // A facet ignores its own filter, so a report excluded by one group still counts for that group.
    for (const { key, counts } of groups) {
      if (!excludedBy || excludedBy === key) counts.set(values[key], counts.get(values[key])! + 1);
    }
  }
  const facets: ReportPage['facets'] = { organization: [], status: [], permission: [], frequency: [], volume: [] };
  for (const { key, counts } of groups) facets[key] = Array.from(counts, ([value, count]) => ({ value, count }));
  return { ...paginate(matches, query.page, query.pageSize), facets, ...(visitStatsUnavailable ? { visitStatsUnavailable } : {}) };
}
function matchesText(value: string, q: string) { return !q || value.toLocaleLowerCase().includes(q); }
function matchesReportFields(report: Report, q: string) {
  return matchesText(report.name, q) || matchesText(report.description, q) || matchesText(report.owner, q) || matchesText(report.source, q);
}
function matchesReportQuery(report: Report, category: SearchCategory, q: string) {
  if (category === 'tag') return matchesText(report.module, q);
  if (category === 'metric') return report.metrics.some(metric => matchesText(metric, q));
  return matchesReportFields(report, q) || (category === 'all' && matchesText(report.module, q)) || report.metrics.some(metric => matchesText(metric, q));
}
export function searchCatalog(reports: Report[], category: SearchCategory, query: string): SearchResult {
  const q = query.trim().toLocaleLowerCase();
  const wantReports = category === 'all' || category === 'report';
  const wantTags = category === 'all' || category === 'tag';
  const wantMetrics = category === 'all' || category === 'metric';
  const items: SearchItem[] = [];
  const tags = new Map<string, number>(), metrics = new Map<string, number>();
  let reportTotal = 0;
  for (const report of reports) {
    if (report.status !== 'active') continue;
    if (wantTags && report.module && matchesText(report.module, q)) {
      tags.set(report.module, (tags.get(report.module) || 0) + 1);
    }
    let reportMatch = wantReports && matchesReportFields(report, q);
    if (wantMetrics) {
      for (const metric of new Set(report.metrics)) {
        if (!metric || !matchesText(metric, q)) continue;
        metrics.set(metric, (metrics.get(metric) || 0) + 1);
        if (wantReports) reportMatch = true;
      }
    } else if (wantReports && !reportMatch) {
      reportMatch = report.metrics.some(metric => matchesText(metric, q));
    }
    if (reportMatch) {
      reportTotal++;
      if (items.length < 20) items.push({ category: 'report', value: report.name, subtitle: `${typeLabel[report.type]} · ${report.module}`, report });
    }
  }
  for (const [group, counts] of [['tag', tags], ['metric', metrics]] as const) {
    let remaining = 20;
    for (const [value, count] of counts) {
      if (remaining-- === 0) break;
      items.push({ category: group, value, subtitle: `${count} 份相关报表` });
    }
  }
  return { items, total: reportTotal + tags.size + metrics.size };
}
export function descendants(entries: Entry[], rootId: string): Entry[] {
  // ponytail: one scan per depth; index parentId if large catalogs cause measured delay.
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of entries) if (entry.parentId && ids.has(entry.parentId) && !ids.has(entry.id)) { ids.add(entry.id); changed = true; }
  }
  return entries.filter(e => e.id !== rootId && ids.has(e.id));
}
export function breadcrumb(entries: Entry[], id: string, rootId: string): Entry[] {
  const path: Entry[] = []; const seen = new Set<string>();
  let current = entries.find(e => e.id === id);
  while (current && current.id !== rootId && !seen.has(current.id)) {
    path.unshift(current); seen.add(current.id); current = entries.find(e => e.id === current?.parentId);
  }
  return path;
}
export function safeUrl(value: string): string {
  const url = new URL(value, typeof window === 'undefined' ? 'https://portal.invalid' : window.location.origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('链接地址无效，请联系管理员');
  return url.href;
}
