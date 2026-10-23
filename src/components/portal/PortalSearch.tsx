"use client";
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { AppWindow, History, Search, Tag, Hash, X } from 'lucide-react';
import { message } from 'antd';
import { request } from '@/lib/portal-api';
import { searchCategories, searchLabels, searchCatalog, type SearchCategory, type SearchHistory, type SearchItem, type SearchResult } from '@/lib/portal-model';
import { usePortal } from './PortalProvider';
import ScrollArea from './ScrollArea';

export default function PortalSearch({ query, category: selectedCategory = 'report', onSearch }: { query: string; category?: SearchCategory; onSearch: (q: string, category: SearchCategory) => void }) {
  const { workbench, open: openReport } = usePortal();
  const [input, setInput] = useState(query), [category, setCategory] = useState(selectedCategory);
  const [open, setOpen] = useState(false), [active, setActive] = useState(-1), [attempt, setAttempt] = useState(0);
  const [history, setHistory] = useState<SearchHistory>({ items: [] });
  const [historyError, setHistoryError] = useState(''), [clearing, setClearing] = useState(false);
  const [result, setResult] = useState<{ key: string; data?: SearchResult; error?: string }>({ key: '' });
  const [position, setPosition] = useState<CSSProperties>({});
  const anchor = useRef<HTMLFormElement>(null), dropdown = useRef<HTMLDivElement>(null), field = useRef<HTMLInputElement>(null);
  const [toast, holder] = message.useMessage();
  const q = input.trim(), searchKey = `${category}:${q}`;
  useEffect(() => { setInput(query); setCategory(selectedCategory); }, [query, selectedCategory]);
  useEffect(() => { setActive(-1); }, [searchKey, open]);
  useEffect(() => {
    if (!open) return;
    function place() {
      const rect = anchor.current!.getBoundingClientRect();
      const width = Math.min(rect.width, window.innerWidth - 32);
      setPosition({ left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)), top: rect.bottom + 10, width, maxHeight: Math.max(120, Math.min(400, window.innerHeight - rect.bottom - 26)) });
    }
    function outside(event: PointerEvent) { if (!anchor.current?.contains(event.target as Node) && !dropdown.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') { field.current?.focus(); setOpen(false); } }
    place(); const observer = new ResizeObserver(place); observer.observe(anchor.current!);
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); setHistory({ items: [] }); setHistoryError('');
    request<SearchHistory>(`/search-history?category=${category}`, controller.signal).then(setHistory).catch(error => { if (!controller.signal.aborted) setHistoryError(error.message); });
    return () => controller.abort();
  }, [open, category, attempt]);
  useEffect(() => {
    if (!open || !q) return;
    const controller = new AbortController();
    const timer = setTimeout(() => request<SearchResult>(`/search?${new URLSearchParams({ category, q })}`, controller.signal)
      .then(data => { if (!controller.signal.aborted) setResult({ key: searchKey, data }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ key: searchKey, error: error.message }); }), 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, q, category, searchKey, attempt]);
  const recent = searchCatalog(workbench.data?.recent || [], category, '');
  const data = q ? result.key === searchKey ? result.data : undefined : recent;
  const error = q ? result.key === searchKey ? result.error : undefined : workbench.error;
  const loading = q ? !data && !error : workbench.loading;
  const items = data?.items || [];
  useEffect(() => { if (active >= 0) document.getElementById(`portal-search-option-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active]);
  function remember(value: string) {
    if (!value.trim()) return;
    void request<SearchHistory>('/search-history', AbortSignal.timeout(8000), { category, query: value }).catch(() => toast.error('本次搜索记录未保存，请稍后重试'));
  }
  function submit(value = q) { remember(value); setOpen(false); onSearch(value, category); }
  function choose(item: SearchItem) {
    remember(item.value); setOpen(false);
    if (item.report) openReport(item.report); else { setInput(item.value); onSearch(item.value, category); }
  }
  async function clearHistory() {
    setClearing(true);
    try { setHistory(await request<SearchHistory>(`/search-history?category=${category}`, AbortSignal.timeout(8000), undefined, 'DELETE')); }
    catch (error) { toast.error((error as Error).message); }
    finally { setClearing(false); }
  }
  const ResultIcon = category === 'report' ? AppWindow : category === 'tag' ? Tag : Hash;
  return <>{holder}<form ref={anchor} className="portal-search" onSubmit={event => { event.preventDefault(); submit(); }}>
    <Search size={20} aria-hidden="true" /><input ref={field} role="combobox" aria-label="搜索报表" aria-expanded={open} aria-controls="portal-search-results" aria-autocomplete="list" aria-activedescendant={open && active >= 0 ? `portal-search-option-${active}` : undefined} placeholder="搜索报表名称、标签、指标、Owner、数据源…" maxLength={200} value={input} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onChange={event => { setInput(event.target.value); setOpen(true); }} onKeyDown={event => {
      if (event.nativeEvent.isComposing) { if (event.key === 'Enter') event.preventDefault(); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); if (items.length) setActive(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length); }
      if (event.key === 'Enter' && open && active >= 0 && items[active]) { event.preventDefault(); choose(items[active]); }
    }} />
    {input && <button className="icon-button" type="button" aria-label="清空搜索" onClick={() => { setInput(''); setOpen(true); field.current?.focus(); if (query) onSearch('', category); }}><X size={16} /></button>}
    <button type="submit" className="search-submit"><Search size={21} />搜索</button>
  </form>{open && createPortal(<div ref={dropdown} className="search-dropdown" style={position} aria-label="搜索面板">
    <div className="search-category-tabs" role="tablist" aria-label="搜索类别">{searchCategories.map((value, index) => <button type="button" role="tab" id={`search-tab-${value}`} aria-controls="search-category-panel" aria-selected={category === value} tabIndex={category === value ? 0 : -1} key={value} onClick={() => setCategory(value)} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : -1) + 3) % 3;
      setCategory(searchCategories[next]); document.getElementById(`search-tab-${searchCategories[next]}`)?.focus();
    }}>{searchLabels[value]}</button>)}</div>
    <ScrollArea label="搜索内容"><div id="search-category-panel" role="tabpanel" aria-labelledby={`search-tab-${category}`}>
      <div className="search-section-title"><span>历史搜索 · {searchLabels[category]}</span><button type="button" disabled={!history.items.length || clearing} onClick={clearHistory}>{clearing ? '清空中…' : '清空'}</button></div>
      {historyError ? <div className="search-empty" role="alert">{historyError}<button className="text-button" onClick={() => setAttempt(n => n + 1)}>重试</button></div> : history.items.length ? <div className="search-history-chips">{history.items.map(item => <button key={item.query} type="button" title={item.query} onClick={() => { setInput(item.query); submit(item.query); }}><History size={15} /><span>{item.query}</span></button>)}</div> : <p className="search-empty">暂无搜索记录</p>}
      <div className="search-section-title"><span>{q ? `搜索结果 · ${searchLabels[category]}` : category === 'report' ? '最近打开的报表' : `最近打开报表的${searchLabels[category]}`}</span>{q && data && <span>{data.total} 项</span>}</div>
      <div id="portal-search-results" role="listbox" aria-label={`${searchLabels[category]}搜索结果`} aria-busy={loading}>
        {items.map((item, index) => <button type="button" role="option" id={`portal-search-option-${index}`} aria-selected={active === index} className="search-result-row" key={item.report?.id || item.value} onClick={() => choose(item)}><span className="search-result-icon"><ResultIcon size={21} /></span><span className="search-result-copy"><strong>{item.value}</strong><small>{item.subtitle}</small></span><span className="search-result-badge">{searchLabels[category]}</span></button>)}
      </div>
      {loading ? <p className="search-empty" role="status">正在加载…</p> : error ? <div className="search-empty" role="alert">{error}<button className="text-button" onClick={() => { setAttempt(n => n + 1); if (!q) workbench.retry(); }}>重试</button></div> : !items.length && <p className="search-empty">{q ? '没有匹配结果，请换个关键词' : '暂无最近打开的报表'}</p>}
      {q && !!data?.total && <button type="button" className="search-all" onClick={() => submit()}>查看全部相关报表</button>}
    </div></ScrollArea>
  </div>, document.body)}</>;
}
