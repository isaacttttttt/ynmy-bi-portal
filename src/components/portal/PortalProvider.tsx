"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, message } from 'antd';
import { Star, RefreshCw, SearchX, ChevronLeft, ChevronRight } from 'lucide-react';
import { demoMode, loadWorkbench, openPlatformEntry, PortalRequestError, request } from '@/lib/portal-api';
import type { Bootstrap, Entry, Page, Report, WorkbenchData } from '@/lib/portal-model';

const REFRESH_MS = 10 * 60 * 1000;
export function usePortalRequest<T>(path: string, fetcher: (path: string, signal?: AbortSignal) => Promise<T> = request) {
  const [attempt, setAttempt] = useState(0);
  const key = `${path}|${attempt}`;
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: '' });
  const cache = useRef(new Map<string, { data: T; fetchedAt: number }>());
  const revision = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      const startedAtRevision = revision.current;
      try {
        const data = await fetcher(path, controller.signal);
        if (!controller.signal.aborted && revision.current === startedAtRevision) {
          cache.current.set(path, { data, fetchedAt: Date.now() });
          setState({ key, data });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          if (error instanceof PortalRequestError && [401, 403].includes(error.status)) cache.current.clear();
          if (!cache.current.has(path)) setState({ key, error: (error as Error).message });
        }
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, REFRESH_MS);
      }
    }
    const cached = cache.current.get(path);
    if (cached && !attempt) timer = setTimeout(refresh, Math.max(0, REFRESH_MS - (Date.now() - cached.fetchedAt)));
    else void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [key, path, attempt, fetcher]);
  const data = cache.current.get(path)?.data;
  const error = state.key === key ? state.error : undefined;
  function mutate(update: (data: T) => T) {
    const cached = cache.current.get(path);
    if (!cached) { setAttempt(n => n + 1); return; }
    revision.current++;
    const next = update(cached.data);
    cache.current.set(path, { ...cached, data: next });
    setState({ key, data: next });
  }
  return { data, previousData: state.data, error, loading: !data && !error, retry: () => setAttempt(n => n + 1), mutate };
}
const PortalContext = createContext<{
  bootstrap: Bootstrap; favorites: string[]; pending: string[];
  workbench: { data?: WorkbenchData; loading: boolean; error?: string; retry: () => void };
  toggleFavorite: (entry: Entry) => void; open: (entry: Entry) => void;
} | null>(null);
export function usePortal() {
  const context = useContext(PortalContext);
  if (!context) throw new Error('PortalProvider missing');
  return context;
}
export function PortalProvider({ children }: { children: ReactNode }) {
  const result = usePortalRequest<Bootstrap>('/bootstrap');
  const workbench = usePortalRequest<WorkbenchData>('/workbench', loadWorkbench);
  const pendingRef = useRef(new Set<string>());
  const [pending, setPending] = useState<string[]>([]);
  const [preview, setPreview] = useState<Entry | null>(null);
  const [toast, holder] = message.useMessage();
  const currentFavorites = result.data?.favoriteIds ?? [];
  async function toggleFavorite(entry: Entry) {
    if (pendingRef.current.has(entry.id)) return;
    pendingRef.current.add(entry.id); setPending([...pendingRef.current]);
    try {
      const res = await request<{ id: string; favorite: boolean; report: Report | null }>(`/favorites/${encodeURIComponent(entry.id)}`, undefined, { favorite: !currentFavorites.includes(entry.id) });
      result.mutate(previous => {
        const ids = previous.favoriteIds.filter(id => id !== res.id);
        return { ...previous, favoriteIds: res.favorite ? [...ids, res.id] : ids };
      });
      workbench.mutate(previous => {
        const items = previous.favorites.filter(report => report.id !== res.id);
        const report = res.report ?? [...previous.recent, ...previous.frequent, ...previous.favorites].find(report => report.id === res.id);
        if (res.favorite && report?.status === 'active') items.push(report);
        return { ...previous, favorites: items };
      });
      toast.success(res.favorite ? '已收藏，可在「我收藏的」查看' : '已取消收藏');
    } catch (error) { toast.error((error as Error).message); }
    finally { pendingRef.current.delete(entry.id); setPending([...pendingRef.current]); }
  }
  function open(entry: Entry) {
    if (demoMode) { setPreview(entry); return; }
    try { openPlatformEntry(entry); } catch (error) { toast.error((error as Error).message); }
  }
  if (!result.data) return <div className="portal-shell"><div className="startup panel"><h1>云南白药集团 · 数据门户</h1><RequestState {...result} /></div></div>;
  return <PortalContext.Provider value={{ bootstrap: result.data, favorites: currentFavorites, pending, workbench, toggleFavorite, open }}>
    {holder}{children}
    <Modal open={!!preview} title="报表预览 · 演示模式" onCancel={() => setPreview(null)} footer={<button className="primary-button" onClick={() => setPreview(null)}>知道了</button>}>
      <p className="preview-title">{preview?.name}</p><p>当前使用示例数据，尚未连接帆软报表。接入平台后，此操作将在平台标签页中打开对应报表。</p>
    </Modal>
  </PortalContext.Provider>;
}
export function FavoriteButton({ entry }: { entry: Entry }) {
  const { favorites, pending, toggleFavorite } = usePortal();
  const active = favorites.includes(entry.id);
  return <button className={`icon-button favorite ${active ? 'is-favorite' : ''}`} aria-label={`${active ? '取消收藏' : '收藏'}${entry.name}`} aria-pressed={active} disabled={pending.includes(entry.id)} onClick={() => toggleFavorite(entry)}><Star size={17} fill={active ? 'currentColor' : 'none'} /></button>;
}
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="section-title"><img src="/assets/图标装饰@2x.png" alt="" />{children}</h2>;
}
export function RequestState({ loading, error, retry }: { loading?: boolean; error?: string; retry?: () => void }) {
  return <div className="request-state" role={error ? 'alert' : 'status'}>{loading ? <><RefreshCw className="loading-spin" size={22} /><p>正在加载…</p></> : error ? <><p>{error}</p><button className="secondary-button" onClick={retry}>重新加载</button></> : <><SearchX size={30} /><p>暂无符合条件的内容</p><span>请调整搜索或筛选条件</span></>}</div>;
}
export function Pagination({ data, onChange }: { data: Pick<Page<unknown>, 'total' | 'page' | 'pageSize'>; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return <nav className="pagination" aria-label="分页"><span>共 {data.total} 项</span><button className="icon-button" aria-label="上一页" disabled={data.page <= 1} onClick={() => onChange(data.page - 1)}><ChevronLeft size={16} /></button><span>{data.page} / {pages}</span><button className="icon-button" aria-label="下一页" disabled={data.page >= pages} onClick={() => onChange(data.page + 1)}><ChevronRight size={16} /></button></nav>;
}
