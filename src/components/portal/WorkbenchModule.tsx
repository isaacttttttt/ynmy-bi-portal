"use client";
import { useState } from 'react';
import { Clock, ChartNoAxesCombined } from 'lucide-react';
import type { WorkbenchTab } from '@/lib/portal-model';
import { typeLabel, themeFor } from '@/lib/portal-model';
import { FavoriteButton, RequestState, SectionTitle, usePortal } from './PortalProvider';
import { EntryIcon } from './ReportDetails';
import ScrollArea from './ScrollArea';

export default function WorkbenchModule() {
  const [tab, setTab] = useState<WorkbenchTab>('recent');
  const { open, bootstrap, workbench: result } = usePortal();
  const reports = result.data?.[tab];
  return <section className="panel workbench">
    <div className="section-heading"><SectionTitle>我的工作台</SectionTitle>
      <div className="segmented" role="group" aria-label="工作台分类">{([['recent', '最近打开'], ['frequent', '我常用的'], ['favorites', '我收藏的']] as const).map(([key, label]) =>
        <button key={key} aria-pressed={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</div>
    </div>
    <p className="section-note">{tab === 'frequent' ? '按近30天访问次数排序' : tab === 'favorites' ? '收藏与帆软平台同步' : '按最近访问日期排序'}<span>数据截至 {bootstrap.dataAsOf}</span></p>
    <ScrollArea key={tab} label="工作台报表列表">{reports?.length ? <div className="workbench-grid">{reports.map(report => <article className={`workbench-card tone-${themeFor(report.type)}`} key={report.id}>
      <div className="card-top"><EntryIcon entry={report} /><span className="type-badge">{typeLabel[report.type]}</span><FavoriteButton entry={report} /></div>
      <button className="card-main" onClick={() => open(report)}><h3>{report.name}</h3><p title={report.description}>{report.description}</p></button>
      <div className="card-foot"><span>{tab === 'frequent' ? <ChartNoAxesCombined size={13} /> : <Clock size={13} />}{tab === 'frequent' ? '近30天访问' : '最近访问'}</span><strong>{tab === 'frequent' ? `${report.visits30d} 次` : report.lastVisitedOn || '暂无记录'}</strong></div>
    </article>)}</div> : <RequestState {...result} />}</ScrollArea>
  </section>;
}
