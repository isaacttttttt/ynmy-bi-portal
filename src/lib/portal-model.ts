export type EntryType = 'folder' | 'bi' | 'fvs' | 'frm' | 'cpt' | 'url';
export interface Entry {
  id: string; parentId: string | null; name: string; type: EntryType;
  templateId?: string; url?: string; iconUrl?: string; sort: number;
}
export interface Report extends Entry {
  metadataId: string; description: string; module: string; department: string;
  owner: string; developer: string; frequency: string; status: 'active' | 'archived';
  source: string; metrics: string[]; views: number; visits30d: number;
  lastVisitedOn: string | null; useScene: string; calcLogic: string; updatedOn: string;
}
export interface Notice {
  id: string; title: string; category: string; pinned: boolean; publishedOn: string;
  content: string; url?: string;
}
export interface QuickEntry { id: string; name: string; description: string; url: string | null }
export interface Bootstrap {
  user: { name: string }; rootId: string; entries: Entry[]; favoriteIds: string[];
  quickEntries: QuickEntry[]; dataAsOf: string;
}
export type WorkbenchTab = 'recent' | 'frequent' | 'favorites';
export type WorkbenchData = Record<WorkbenchTab, Report[]>;
export type FilterKey = 'module' | 'status' | 'frequency' | 'volume';
export type Filters = Record<FilterKey, string[]>;
export const searchCategories = ['report', 'tag', 'metric'] as const;
export type SearchCategory = typeof searchCategories[number];
export const searchLabels: Record<SearchCategory, string> = { report: '报表', tag: '标签', metric: '指标' };
export interface SearchHistory { items: { query: string; searchedAt: string }[] }
export interface SearchItem { value: string; subtitle: string; report?: Report }
export interface SearchResult { items: SearchItem[]; total: number }
export interface ReportQuery { q: string; category?: SearchCategory; filters: Filters; page: number; pageSize: number }
export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }
export interface ReportPage extends Page<Report> { facets: Record<FilterKey, { value: string; count: number }[]> }
export const emptyFilters = (): Filters => ({ module: [], status: [], frequency: [], volume: [] });
export const volume = (views: number) => views > 1000 ? 'high' : views >= 100 ? 'medium' : 'low';
export const typeLabel: Record<EntryType, string> = { folder: '专题目录', bi: 'BI 分析', fvs: '驾驶舱', frm: '填报', cpt: '报表', url: '外部链接' };
export const themeFor = (type: EntryType) => type === 'folder' ? 'orange' : type === 'frm' ? 'purple' : type === 'cpt' ? 'teal' : 'blue';
export const filterLabels: Record<FilterKey, string> = { module: '业务模块', status: '报表状态', frequency: '数据时效', volume: '累计访问量' };
export const optionLabels: Record<string, string> = { active: '在用', archived: '已归档', high: '高频（>1000）', medium: '中频（100–1000）', low: '低频（<100）' };
export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}
export function queryReports(reports: Report[], query: ReportQuery): ReportPage {
  const q = query.q.trim().toLocaleLowerCase();
  const searched = reports.filter(r => searchValues(r, query.category).some(v => v.toLocaleLowerCase().includes(q)));
  const keys = Object.keys(query.filters) as FilterKey[];
  const value = (r: Report, k: FilterKey) => k === 'volume' ? volume(r.views) : r[k];
  const matches = (r: Report, except?: FilterKey) => keys.every(k => k === except || !query.filters[k].length || query.filters[k].includes(value(r, k)));
  const facets = {} as ReportPage['facets'];
  for (const key of keys) {
    facets[key] = [...new Set(reports.map(r => value(r, key)))].map(v => ({ value: v, count: searched.filter(r => matches(r, key) && value(r, key) === v).length }));
  }
  return { ...paginate(searched.filter(r => matches(r)), query.page, query.pageSize), facets };
}
function searchValues(r: Report, category: SearchCategory = 'report') {
  return category === 'tag' ? [r.module] : category === 'metric' ? r.metrics : [r.name, r.description, r.owner, r.source, ...r.metrics];
}
export function searchCatalog(reports: Report[], category: SearchCategory, query: string): SearchResult {
  const q = query.trim().toLocaleLowerCase(), active = reports.filter(r => r.status === 'active');
  if (category === 'report') {
    const found = active.filter(r => searchValues(r).some(v => v.toLocaleLowerCase().includes(q)));
    return { items: found.slice(0, 20).map(r => ({ value: r.name, subtitle: `${typeLabel[r.type]} · ${r.module}`, report: r })), total: found.length };
  }
  const counts = new Map<string, number>();
  for (const r of active) for (const value of new Set(searchValues(r, category))) {
    if (value && value.toLocaleLowerCase().includes(q)) counts.set(value, (counts.get(value) || 0) + 1);
  }
  return { items: [...counts].slice(0, 20).map(([value, count]) => ({ value, subtitle: `${count} 份相关报表` })), total: counts.size };
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
