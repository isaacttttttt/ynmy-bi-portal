"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, BookOpen, ArrowLeft, X, LayoutGrid, List } from 'lucide-react';
import { demoMode } from '@/lib/portal-api';
import { DisplayModeSwitch } from './PortalViewport';

export default function PortalHeader({ dictionary = false, query = '', onSearch, view, onViewChange }: { dictionary?: boolean; query?: string; onSearch: (q: string) => void; view?: 'grid' | 'list'; onViewChange?: (view: 'grid' | 'list') => void }) {
  const [input, setInput] = useState(query);
  useEffect(() => setInput(query), [query]);
  return <header className="portal-header">
    <div className="brand-row">
      <Link href="/" className="brand-logo" aria-label="云南白药数据门户首页"><img src="/assets/company_title.png" alt="云南白药 YUNNANBAIYAO" /></Link>
      <div className="brand-copy"><h1>{dictionary ? '数据门户 · 报表字典' : '云南白药集团 · 数据门户'}</h1>{!dictionary && <p>数据驱动经营 · 智慧赋能决策</p>}</div>
      <div className="header-tools"><DisplayModeSwitch /><span className="environment-label">{demoMode ? '演示环境 · 示例数据' : '企业数据门户'}</span>
        {dictionary && <Link href="/" className="home-link"><ArrowLeft size={14} />返回首页</Link>}
      </div>
    </div>
    <div className="search-row">
      <form className="portal-search" onSubmit={e => { e.preventDefault(); onSearch(input.trim()); }}>
        <Search size={20} aria-hidden="true" /><input aria-label="搜索报表" placeholder="搜索报表名称、指标、Owner、数据源…" value={input} onChange={e => setInput(e.target.value)} />
        {input && <button className="icon-button" type="button" aria-label="清空搜索" onClick={() => { setInput(''); onSearch(''); }}><X size={16} /></button>}
        <button type="submit" className="search-submit"><Search size={21} />搜索</button>
      </form>
      {dictionary ? <div className="segmented view-toggle" role="group" aria-label="视图切换"><button aria-label="卡片视图" aria-pressed={view === 'grid'} className={view === 'grid' ? 'active' : ''} onClick={() => onViewChange?.('grid')}><LayoutGrid size={22} /></button><button aria-label="列表视图" aria-pressed={view === 'list'} className={view === 'list' ? 'active' : ''} onClick={() => onViewChange?.('list')}><List size={22} /></button></div> : <Link href="/report-dictionary/" className="dictionary-link"><BookOpen size={20} />报表字典</Link>}
    </div>
  </header>;
}
