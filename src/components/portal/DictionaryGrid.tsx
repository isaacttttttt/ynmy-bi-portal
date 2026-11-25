"use client";
import { useState } from 'react';
import { Tooltip } from 'antd';
import { Building2, Clock3, UserRound, Database } from 'lucide-react';
import type { Report, ReportPage } from '@/lib/portal-model';
import { createSearchHighlighter } from './highlight-search-text';
import { FavoriteButton, Pagination, RequestState, SectionTitle, usePortal } from './PortalProvider';
import { EntryIcon, ReportDetails } from './ReportDetails';
import ScrollArea from './ScrollArea';
import { Skeleton } from '@/components/ui/skeleton';

export default function DictionaryGrid({ result, onPage, query, onReset, view }: { result: { data?: ReportPage; loading: boolean; error?: string; retry: () => void }; onPage: (page: number) => void; query: string; onReset: () => void; view: 'grid' | 'list' }) {
  const [selected, setSelected] = useState<Report | null>(null);
  const { open } = usePortal();
  const data = result.data;
  const highlight = createSearchHighlighter(query);
  return <section className="panel dictionary-panel">
    <div className="section-heading"><div className="heading-with-count"><SectionTitle>报表字典</SectionTitle><span className="muted" role="status">{data ? `${data.total} 份报表` : result.loading && <Skeleton className="h-4 w-20" />}</span></div>
      <p className="dictionary-summary"><span>{query ? `“${query}” 的搜索结果` : ''}</span><button className="text-button" onClick={onReset}>清除全部条件</button></p>
    </div>
    <div className="dictionary-results" role="region" aria-label="报表字典列表" aria-busy={result.loading}>{data?.items.length ? <div className={view === 'grid' ? 'dictionary-grid' : 'dictionary-list'}>{data.items.map(report => {
      const content = <>
        <button className="card-main" onClick={() => setSelected(report)}><h3 className="dictionary-title"><span>{highlight(report.name)}</span><Tooltip title={report.permission === 'granted' ? '当前账号有权限访问此报表' : '当前账号无访问权限，可查看报表说明'}><span className={`permission-badge ${report.permission}`}>{report.permission === 'granted' ? '有权限' : '无权限'}</span></Tooltip></h3><p>{highlight(report.description)}</p></button>
        <div className="metadata-row">
          <span><Building2 size={13} /><span>{highlight(report.department)}</span></span>
          <span><Clock3 size={13} /><span>{highlight(report.frequency)}</span></span>
          <span><UserRound size={13} /><span>{highlight(report.owner)}</span></span>
        </div>
        <div className="source-row"><Database size={13} /><span>数据源</span><strong>{highlight(report.source)}</strong></div>
        <div className="metric-tags">{report.metrics.map(metric => <span key={metric}>{highlight(metric)}</span>)}</div>
      </>;
      return <article key={report.metadataId} className={`dictionary-card ${report.type === 'cpt' ? 'tone-teal' : 'tone-purple'}`}>
        <div className="card-top"><EntryIcon entry={report} /><span className={`status-badge ${report.status}`}>{report.status === 'active' ? '在用' : '已归档'}</span><FavoriteButton entry={report} /></div>
        {view === 'grid' ? <ScrollArea label={`${report.name}的报表简介与指标`}>{content}</ScrollArea> : <div className="dictionary-body">{content}</div>}
        <div className="dictionary-actions"><button className="text-button" onClick={() => setSelected(report)}>查看详情</button><button className="open-report" disabled={report.permission === 'denied' || report.status === 'archived'} onClick={() => open(report)}>{report.permission === 'denied' ? '无访问权限' : report.status === 'archived' ? '已归档' : '打开报表'}<span aria-hidden="true">↗</span></button></div>
      </article>;
    })}</div> : result.loading ? <div className={view === 'grid' ? 'dictionary-grid' : 'dictionary-list'}>{Array.from({ length: 6 }, (_, i) => <div key={i} className="dictionary-placeholder tone-purple"><RequestState loading /></div>)}</div> : <RequestState {...result} />}</div>
    {data && <Pagination data={data} onChange={onPage} />}
    <ReportDetails report={selected} onClose={() => setSelected(null)} />
  </section>;
}
