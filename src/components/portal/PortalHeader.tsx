"use client";
import Link from 'next/link';
import { BookOpen, ArrowLeft, LayoutGrid, List } from 'lucide-react';
import { demoMode } from '@/lib/portal-api';
import type { SearchCategory } from '@/lib/portal-model';
import { DisplayModeSwitch } from './PortalViewport';
import PortalGuide from './PortalGuide';
import PortalSearch from './PortalSearch';

export default function PortalHeader({ dictionary = false, query = '', category, onSearch, view, onViewChange }: { dictionary?: boolean; query?: string; category?: SearchCategory; onSearch: (q: string, category: SearchCategory) => void; view?: 'grid' | 'list'; onViewChange?: (view: 'grid' | 'list') => void }) {
  return <header className="portal-header">
    <div className="brand-row">
      <Link href="/" className="brand-logo" aria-label="云南白药数据门户首页"><img src="/assets/company_title.png" alt="云南白药 YUNNANBAIYAO" /></Link>
      <div className="brand-copy"><h1>{dictionary ? '数据门户 · 报表字典' : '云南白药集团 · 数据门户'}</h1>{!dictionary && <p>数据驱动经营 · 智慧赋能决策</p>}</div>
      <div className="header-tools"><DisplayModeSwitch /><div className="header-help"><span className="environment-label">{demoMode ? '演示环境 · 示例数据' : '企业数据门户'}</span><PortalGuide dictionary={dictionary} /></div>
        {dictionary && <Link href="/" className="home-link"><ArrowLeft size={14} />返回首页</Link>}
      </div>
    </div>
    <div className="search-row">
      <PortalSearch query={query} category={category} onSearch={onSearch} />
      {dictionary ? <div className="segmented view-toggle" role="group" aria-label="视图切换"><button aria-label="卡片视图" aria-pressed={view === 'grid'} className={view === 'grid' ? 'active' : ''} onClick={() => onViewChange?.('grid')}><LayoutGrid size={22} /></button><button aria-label="列表视图" aria-pressed={view === 'list'} className={view === 'list' ? 'active' : ''} onClick={() => onViewChange?.('list')}><List size={22} /></button></div> : <Link href="/report-dictionary/" className="dictionary-link"><BookOpen size={20} />报表字典</Link>}
    </div>
  </header>;
}
