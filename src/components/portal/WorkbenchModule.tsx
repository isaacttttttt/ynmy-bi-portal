"use client";
import { useEffect, useRef, useState } from 'react';
import { Tooltip } from 'antd';
import { Clock, ChartNoAxesCombined } from 'lucide-react';
import type { WorkbenchTab } from '@/lib/portal-model';
import { typeLabel, themeFor } from '@/lib/portal-model';
import { FavoriteButton, RequestState, SectionTitle, usePortal } from './PortalProvider';
import { EntryIcon } from './ReportDetails';
import ScrollArea from './ScrollArea';

export default function WorkbenchModule() {
  const [tab, setTab] = useState<WorkbenchTab>('recent');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const dismissed = useRef(false);
  const { open, bootstrap, workbench: result } = usePortal();
  const reports = result.data?.[tab];
  useEffect(() => {
    if (!previewId) return;
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') { dismissed.current = true; setPreviewId(null); } };
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [previewId]);
  return <section className="panel workbench" onScrollCapture={event => { if (event.currentTarget.contains(event.target as Node)) { dismissed.current = true; setPreviewId(null); } }}>
    <div className="section-heading"><SectionTitle>我的工作台</SectionTitle>
      <div className="segmented" role="group" aria-label="工作台分类">{([['recent', '最近打开'], ['frequent', '我常用的'], ['favorites', '我收藏的']] as const).map(([key, label]) =>
        <button key={key} aria-pressed={tab === key} className={tab === key ? 'active' : ''} onClick={() => { setPreviewId(null); setTab(key); }}>{label}</button>)}</div>
    </div>
    <p className="section-note">{tab === 'frequent' ? '按近30天访问次数排序' : tab === 'favorites' ? '收藏与帆软平台同步' : '按最近访问日期排序'}<span>数据截至 {bootstrap.dataAsOf}</span></p>
    <ScrollArea key={tab} label="工作台报表列表">{reports?.length ? <div className="workbench-grid">{reports.map(report => {
      const tooltipId = `workbench-preview-${encodeURIComponent(report.id)}`;
      return <Tooltip key={report.id} id={tooltipId} placement="bottomLeft" trigger={['hover', 'focus']} mouseEnterDelay={0.25} mouseLeaveDelay={0.1} color="#1b2c38" classNames={{ root: 'workbench-tooltip' }} destroyOnHidden
        open={previewId === report.id} onOpenChange={visible => {
          if (visible && dismissed.current) return;
          if (!visible && document.activeElement?.closest('[data-workbench-report]')?.getAttribute('data-workbench-report') === report.id) return;
          setPreviewId(current => visible ? report.id : current === report.id ? null : current);
        }}
        title={<div className="workbench-preview"><strong>{report.name}</strong><p>{report.description || '暂未维护看板介绍'}</p><div className="workbench-preview-meta"><span>{typeLabel[report.type]}</span><span className="workbench-preview-domain" aria-label="所属领域">{report.module || '暂未维护所属领域'}</span><span>更新于 {report.updatedOn || '暂未维护'}</span></div></div>}>
      <article className={`workbench-card tone-${themeFor(report.type)}`} data-workbench-report={report.id} onFocusCapture={() => { setPreviewId(report.id); }} onPointerMove={() => {
        // Removing a tooltip exposes the card underneath; reopen only on an actual pointer move or focus.
        if (dismissed.current) { dismissed.current = false; setPreviewId(report.id); }
      }}>
      <div className="card-top"><EntryIcon entry={report} /><span className="type-badge">{typeLabel[report.type]}</span><FavoriteButton entry={report} /></div>
      <button className="card-main" aria-describedby={previewId === report.id ? tooltipId : undefined} onClick={() => { setPreviewId(null); open(report); }}><h3>{report.name}</h3><p>{report.description}</p></button>
      <div className="card-foot"><span>{tab === 'frequent' ? <ChartNoAxesCombined size={13} /> : <Clock size={13} />}{tab === 'frequent' ? '近30天访问' : '最近访问'}</span><strong>{tab === 'frequent' ? `${report.visits30d} 次` : report.lastVisitedOn || '暂无记录'}</strong></div>
    </article></Tooltip>; })}</div> : <RequestState {...result} />}</ScrollArea>
  </section>;
}
