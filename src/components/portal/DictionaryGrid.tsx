"use client";
import { useState } from 'react';
import { Building2, Clock3, UserRound, Database } from 'lucide-react';
import type { Report, ReportPage } from '@/lib/portal-model';
import { themeFor } from '@/lib/portal-model';
import { FavoriteButton, Pagination, RequestState, SectionTitle, usePortal } from './PortalProvider';
import { EntryIcon, ReportDetails } from './ReportDetails';
import ScrollArea from './ScrollArea';

export default function DictionaryGrid({ result, onPage, query, onReset, view }: { result: { data?: ReportPage; loading: boolean; error?: string; retry: () => void }; onPage: (page: number) => void; query: string; onReset: () => void; view: 'grid' | 'list' }) {
  const [selected, setSelected] = useState<Report | null>(null);
  const { open } = usePortal();
  const data = result.data;
  return <section className="panel dictionary-panel">
    <div className="section-heading"><div className="heading-with-count"><SectionTitle>报表字典</SectionTitle><span className="muted" role="status">{data ? `${data.total} 份报表` : '正在查询'}</span></div>
    </div>
    <p className="dictionary-summary"><span>{query ? `“${query}” 的搜索结果` : ''}</span><button className="text-button" onClick={onReset}>清除全部条件</button></p>
    <ScrollArea label="报表字典列表">{data?.items.length ? <div className={view === 'grid' ? 'dictionary-grid' : 'dictionary-list'}>{data.items.map(report => <article key={report.id} className={`dictionary-card tone-${themeFor(report.type)}`}>
      <div className="card-top"><EntryIcon entry={report} /><span className={`status-badge ${report.status}`}>{report.status === 'active' ? '在用' : '已归档'}</span><FavoriteButton entry={report} /></div>
      <div className="dictionary-body"><button className="card-main" onClick={() => setSelected(report)}><h3>{report.name}</h3><p>{report.description}</p></button>
        <div className="metadata-row"><span><Building2 size={13} />{report.department}</span><span><Clock3 size={13} />{report.frequency}</span><span><UserRound size={13} />{report.owner}</span></div>
        <div className="source-row"><Database size={13} /><span>数据源</span><strong>{report.source}</strong></div>
        <div className="metric-tags">{report.metrics.map(metric => <span key={metric}>{metric}</span>)}</div>
      </div>
      <div className="dictionary-actions"><button className="text-button" onClick={() => setSelected(report)}>查看详情</button><button className="open-report" disabled={report.status === 'archived'} onClick={() => open(report)}>{report.status === 'archived' ? '已归档' : '打开报表'}<span aria-hidden="true">↗</span></button></div>
    </article>)}</div> : <RequestState {...result} />}</ScrollArea>
    {data && <Pagination data={data} onChange={onPage} />}
    <ReportDetails report={selected} onClose={() => setSelected(null)} />
  </section>;
}
