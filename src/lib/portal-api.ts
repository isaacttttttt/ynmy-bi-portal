import type { Bootstrap, Notice, Page, Report, ReportPage, Filters, WorkbenchData, Entry, SearchCategory } from './portal-model';
import { safeUrl } from './portal-model';
import portalConfig from '../config/portal.json';

const apiBase = process.env.NEXT_PUBLIC_PORTAL_API_BASE || `${portalConfig.basePath}/api/portal/v1`;
export const platformBase = process.env.NEXT_PUBLIC_FINE_BASE || '/webroot/decision';
export interface Endpoints {
  bootstrap: Bootstrap; reports: ReportPage; workbench: Page<Report>; notices: Page<Notice>;
}
export class PortalRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function request<T>(path: string, signal?: AbortSignal, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method, credentials: 'include', cache: 'no-store', signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    if (response.status === 401) throw new PortalRequestError(result?.error?.code === 'INVALID_IDENTITY'
      ? result.error.message : '登录已过期，请返回帆软平台重新登录', 401);
    if (response.status === 403) throw new PortalRequestError('当前账号没有访问权限，请联系管理员', 403);
    throw new PortalRequestError(result?.error?.message || '服务暂时不可用，请重试', response.status);
  }
  return result.data as T;
}
export function reportPath(q: string, filters: Filters, page: number, category: SearchCategory = 'all') {
  const params = new URLSearchParams({ q, category, page: String(page), pageSize: '6' });
  for (const [key, values] of Object.entries(filters)) values.forEach(v => params.append(key, v));
  return `/reports?${params}`;
}
export async function loadWorkbench(path: string, signal?: AbortSignal): Promise<WorkbenchData> {
  return request<WorkbenchData>(`${path}/snapshot`, signal);
}

type PlatformWindow = Window & {
  FS?: { tabPane?: { addItem: (item: { title: string; src: string }) => void } };
  BI?: { Services: { getService: (name: string) => { openCustomTab: (title: string, id: string, type: string, options: Record<string, unknown>) => void } } };
};
export function openPlatformEntry(entry: Entry, config?: Bootstrap['platform']) {
  let host: PlatformWindow;
  try { host = window.top as PlatformWindow; void host.location.href; }
  catch { throw new Error('门户与帆软平台跨域，请配置同源部署或由平台提供跨域打开桥接接口'); }
  if (entry.type === 'folder') throw new Error('目录需在专题分析中打开');
  if (entry.type === 'bi') {
    if (!entry.templateId || !host.BI?.Services) throw new Error('平台预览接口或发布任务 ID 未就绪');
    host.BI.Services.getService(config?.biServiceName || 'dec.service.frame.tab_pane').openCustomTab(entry.name, entry.id, config?.biTabType || 'bi.subject.publink', {
      subjectEntryType: 2, publishTaskId: entry.templateId, entryId: entry.id, hideType: 'display',
    });
  } else {
    if (!host.FS?.tabPane) throw new Error('请在帆软平台内打开此报表');
    if (entry.type === 'url' && !entry.url) throw new Error('报表链接未配置');
    host.FS.tabPane.addItem({ title: entry.name, src: safeUrl(entry.type === 'url' ? entry.url! : (config?.entryAccessUrl || `${platformBase}/v10/entry/access/{entryId}`).replaceAll('{entryId}', encodeURIComponent(entry.id))) });
  }
}
