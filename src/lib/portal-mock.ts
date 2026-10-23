import { bootstrap, notices, reports } from './portal-fixtures';
import { emptyFilters, paginate, queryReports } from './portal-model';
import type { FilterKey, WorkbenchTab } from './portal-model';

let favorites = [...bootstrap.favoriteIds];
const storageKey = 'ynby.portal.demo.favorites.v1';
function readFavorites() {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (Array.isArray(saved) && saved.every(id => typeof id === 'string')) favorites = saved.filter(id => reports.some(r => r.id === id));
  } catch { /* Storage may be unavailable in an embedded browser; keep this session's state. */ }
  return favorites;
}
export function mockRequest(path: string, body?: unknown): unknown {
  const url = new URL(path, 'https://demo.invalid'); const params = url.searchParams;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize')) || 8));
  if (url.pathname === '/bootstrap') return { ...bootstrap, favoriteIds: [...readFavorites()] };
  if (url.pathname === '/reports') {
    const filters = emptyFilters();
    for (const key of Object.keys(filters) as FilterKey[]) filters[key] = params.getAll(key);
    const order = ['entry-12', 'entry-16', 'entry-17', 'entry-18', 'entry-13', 'entry-14'];
    const sorted = [...reports].sort((a,b) => (order.includes(a.id) ? order.indexOf(a.id) : 100 + a.sort) - (order.includes(b.id) ? order.indexOf(b.id) : 100 + b.sort));
    return queryReports(sorted, { q: params.get('q') || '', filters, page, pageSize });
  }
  if (url.pathname === '/workbench') {
    const tab = params.get('tab') as WorkbenchTab;
    const list = reports.filter(r => r.status === 'active' && (tab === 'favorites' ? readFavorites().includes(r.id) : tab === 'recent' ? r.lastVisitedOn : r.visits30d > 0));
    if (tab === 'recent') list.sort((a, b) => (b.lastVisitedOn || '').localeCompare(a.lastVisitedOn || ''));
    if (tab === 'frequent') list.sort((a, b) => b.visits30d - a.visits30d || a.id.localeCompare(b.id));
    return paginate(list, page, pageSize);
  }
  if (url.pathname === '/notices') return paginate(notices, page, pageSize);
  if (url.pathname.startsWith('/favorites/')) {
    const id = decodeURIComponent(url.pathname.slice('/favorites/'.length));
    if (!reports.some(r => r.id === id) || !body || typeof (body as { favorite?: unknown }).favorite !== 'boolean') throw new Error('收藏请求无效');
    const favorite = (body as { favorite: boolean }).favorite;
    favorites = readFavorites().filter(v => v !== id);
    if (favorite) favorites.push(id);
    try { localStorage.setItem(storageKey, JSON.stringify(favorites)); } catch { /* Session-only demo when storage is blocked. */ }
    return { id, favorite, report: reports.find(r => r.id === id) ?? null };
  }
  throw new Error('模拟接口不存在');
}
