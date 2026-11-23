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
export interface ThematicRole {
  id: string;
  name: string;
  entries: Entry[];
}
export interface Bootstrap {
  platform?: { entryAccessUrl: string; biServiceName: string; biTabType: string };
  user: { name: string }; rootId: string; entries: Entry[]; thematicRoles?: ThematicRole[]; favoriteIds: string[];
  quickEntries: QuickEntry[]; dataAsOf: string | null;
}
export interface RoleSummary {
  id: string;
  name: string;
  description: string;
  configured?: boolean;
  enabledReportCount?: number;
  totalReportCount?: number;
}
export interface RoleListPage {
  items: RoleSummary[];
  page: number;
  pageSize: number;
  hasNext: boolean;
}
export interface RoleAvailableReport {
  reportId: string;
  reportName: string;
  reportType: Exclude<EntryType, 'folder'>;
  catalogName: string;
}
export interface RoleThematicNode {
  id: string;
  parentId: string | null;
  nodeType: 'folder' | 'report';
  reportId: string | null;
  name: string;
  reportType: Exclude<EntryType, 'folder'> | null;
  catalogName: string | null;
  sort: number;
  enabled: boolean;
  available?: boolean;
}
export interface RoleThematicDetail {
  role: {
    id: string;
    name: string;
    updatedBy: string | null;
    updatedAt: string | null;
  };
  nodes: RoleThematicNode[];
  availableReports: RoleAvailableReport[];
}
export interface RoleThematicSaveNode {
  id: string;
  parentId: string | null;
  nodeType: 'folder' | 'report';
  reportId: string | null;
  name: string;
  sort: number;
  enabled: boolean;
}
export type FolderAccessState = 'all' | 'partial' | 'none';
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

const VALID_NODE_ID = /^[\w.:-]{1,128}$/;

export function normalizeSiblingSorts<T extends { id: string; parentId: string | null; sort: number }>(nodes: T[]): T[] {
  const byParent = new Map<string, T[]>();
  for (const node of nodes) {
    const key = node.parentId ?? '';
    const list = byParent.get(key) || [];
    list.push(node);
    byParent.set(key, list);
  }
  const sortMap = new Map<string, number>();
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
    list.forEach((item, index) => sortMap.set(item.id, index));
  }
  return nodes.map(node => ({ ...node, sort: sortMap.get(node.id) ?? 0 }));
}

export function validateRoleThematicNodes(nodes: RoleThematicSaveNode[]): { ok: true; nodes: RoleThematicSaveNode[] } | { ok: false; message: string } {
  if (!Array.isArray(nodes)) return { ok: false, message: '节点数据格式不正确' };
  if (nodes.length > 2000) return { ok: false, message: '单个角色最多配置 2000 个节点' };
  const byId = new Map<string, RoleThematicSaveNode>();
  const reportIds = new Set<string>();
  const cleaned: RoleThematicSaveNode[] = [];
  for (const raw of nodes) {
    if (!raw || typeof raw !== 'object') return { ok: false, message: '存在无效节点' };
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    const parentId = raw.parentId === null || raw.parentId === undefined ? null : typeof raw.parentId === 'string' ? raw.parentId.trim() : '';
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    const reportId = raw.reportId === null || raw.reportId === undefined ? null : typeof raw.reportId === 'string' ? raw.reportId.trim() : '';
    if (!VALID_NODE_ID.test(id)) return { ok: false, message: '节点 ID 格式无效' };
    if (byId.has(id)) return { ok: false, message: '存在重复的节点 ID' };
    if (parentId !== null && !VALID_NODE_ID.test(parentId)) return { ok: false, message: '父目录 ID 格式无效' };
    if (parentId === id) return { ok: false, message: '目录不能以自身作为父目录' };
    if (raw.nodeType !== 'folder' && raw.nodeType !== 'report') return { ok: false, message: '节点类型无效' };
    if (!name || name.length > 256) return { ok: false, message: '目录或报表名称不能为空且不能超过 256 个字符' };
    if (raw.nodeType === 'folder' && reportId !== null && reportId !== '') return { ok: false, message: '目录节点不能绑定报表 ID' };
    if (raw.nodeType === 'report') {
      if (!reportId || !VALID_NODE_ID.test(reportId)) return { ok: false, message: '报表节点缺少有效的报表 ID' };
      if (reportIds.has(reportId)) return { ok: false, message: `同一角色下不能重复添加报表（${name}）` };
      reportIds.add(reportId);
    }
    const sort = Number.isFinite(Number(raw.sort)) ? Math.max(0, Math.trunc(Number(raw.sort))) : 0;
    const item: RoleThematicSaveNode = {
      id, parentId: parentId || null, nodeType: raw.nodeType,
      reportId: raw.nodeType === 'report' ? reportId : null,
      name, sort, enabled: Boolean(raw.enabled),
    };
    byId.set(id, item);
    cleaned.push(item);
  }
  for (const node of cleaned) {
    let cursor = node.parentId;
    let depth = 0;
    const visited = new Set<string>([node.id]);
    while (cursor !== null) {
      const parent = byId.get(cursor);
      if (!parent) return { ok: false, message: `节点“${node.name}”的父目录不存在` };
      if (parent.nodeType !== 'folder') return { ok: false, message: `节点“${node.name}”不能挂载在报表下方` };
      if (visited.has(parent.id)) return { ok: false, message: '目录层级存在循环引用' };
      visited.add(parent.id);
      depth++;
      if (depth > 10) return { ok: false, message: '目录层级最多支持 10 级嵌套' };
      cursor = parent.parentId;
    }
  }
  return { ok: true, nodes: normalizeSiblingSorts(cleaned) };
}

export function isDescendantNode(nodes: ReadonlyArray<{ id: string; parentId: string | null }>, ancestorId: string, targetId: string | null): boolean {
  if (!targetId) return false;
  if (ancestorId === targetId) return true;
  const parentMap = new Map(nodes.map(n => [n.id, n.parentId]));
  let cursor: string | null | undefined = targetId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    if (cursor === ancestorId) return true;
    seen.add(cursor);
    cursor = parentMap.get(cursor);
  }
  return false;
}

export function folderAccessState(nodes: ReadonlyArray<Pick<RoleThematicNode, 'id' | 'parentId' | 'nodeType' | 'enabled'>>, folderId: string): FolderAccessState {
  const folder = nodes.find(n => n.id === folderId);
  if (!folder || !folder.enabled) return 'none';
  const childrenByParent = new Map<string, typeof nodes[number][]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const list = childrenByParent.get(node.parentId) || [];
    list.push(node);
    childrenByParent.set(node.parentId, list);
  }
  let totalReports = 0;
  let enabledReports = 0;
  const stack: Array<{ id: string; effectiveParentEnabled: boolean }> = [{ id: folderId, effectiveParentEnabled: true }];
  const seen = new Set<string>([folderId]);
  while (stack.length) {
    const current = stack.pop()!;
    for (const child of childrenByParent.get(current.id) || []) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      const effective = current.effectiveParentEnabled && child.enabled;
      if (child.nodeType === 'report') {
        totalReports++;
        if (effective) enabledReports++;
      } else {
        stack.push({ id: child.id, effectiveParentEnabled: effective });
      }
    }
  }
  if (totalReports === 0) return folder.enabled ? 'all' : 'none';
  if (enabledReports === 0) return 'none';
  if (enabledReports === totalReports) return 'all';
  return 'partial';
}

export function moveRoleThematicNode<T extends { id: string; parentId: string | null; nodeType: 'folder' | 'report'; sort: number }>(
  nodes: T[],
  sourceId: string,
  targetId: string | null,
  position: 'before' | 'after' | 'inside',
): T[] {
  const source = nodes.find(n => n.id === sourceId);
  if (!source) return nodes;
  if (targetId === sourceId) return nodes;
  let nextParentId: string | null = null;
  if (position === 'inside') {
    if (targetId !== null) {
      const target = nodes.find(n => n.id === targetId);
      if (!target || target.nodeType !== 'folder') return nodes;
      if (isDescendantNode(nodes, sourceId, targetId)) return nodes;
      nextParentId = target.id;
    } else {
      nextParentId = null;
    }
  } else {
    const target = targetId ? nodes.find(n => n.id === targetId) : undefined;
    if (!target) return nodes;
    if (target.parentId && isDescendantNode(nodes, sourceId, target.parentId)) return nodes;
    nextParentId = target.parentId;
  }
  const siblings = nodes
    .filter(n => n.parentId === nextParentId && n.id !== sourceId)
    .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
  let insertAt = siblings.length;
  if (position !== 'inside' && targetId) {
    const idx = siblings.findIndex(n => n.id === targetId);
    insertAt = idx < 0 ? siblings.length : position === 'before' ? idx : idx + 1;
  }
  const updatedSource = { ...source, parentId: nextParentId };
  siblings.splice(insertAt, 0, updatedSource);
  const sortLookup = new Map<string, number>();
  siblings.forEach((item, index) => sortLookup.set(item.id, index));
  const updated = nodes.map(node => {
    if (node.id === sourceId) return { ...updatedSource, sort: sortLookup.get(sourceId) ?? 0 };
    if (sortLookup.has(node.id)) return { ...node, sort: sortLookup.get(node.id)! };
    return node;
  });
  return normalizeSiblingSorts(updated);
}

export function roleThematicBreadcrumb(entries: Entry[], folderId: string | null): Entry[] {
  if (!folderId) return [];
  const path: Entry[] = [];
  const seen = new Set<string>();
  let current = entries.find(e => e.id === folderId);
  while (current && !seen.has(current.id)) {
    path.unshift(current);
    seen.add(current.id);
    current = current.parentId ? entries.find(e => e.id === current?.parentId) : undefined;
  }
  return path;
}

export type AttachmentPreviewKind = 'image' | 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'unsupported';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);
const SHEET_EXTENSIONS = new Set(['xlsx', 'xls', 'csv']);

export function attachmentExtension(name?: string | null, url?: string | null): string {
  const candidates = [name || '', (url || '').split(/[?#]/)[0]];
  for (const raw of candidates) {
    const cleaned = raw.trim().toLowerCase();
    const match = cleaned.match(/\.([a-z0-9]{1,8})$/);
    if (match) return match[1];
  }
  return '';
}

export function attachmentPreviewKind(name?: string | null, url?: string | null): AttachmentPreviewKind {
  const ext = attachmentExtension(name, url);
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (SHEET_EXTENSIONS.has(ext)) return 'xlsx';
  if (ext === 'pptx') return 'pptx';
  return 'unsupported';
}

export function buildAttachmentPreviewUrl(url: string, name: string, basePath = '/portal'): string {
  const params = new URLSearchParams({ url, name });
  return `${basePath.replace(/\/$/, '')}/attachment-preview/?${params.toString()}`;
}
