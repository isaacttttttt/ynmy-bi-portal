"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Clock, ChartNoAxesCombined, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Report, WorkbenchTab } from '@/lib/portal-model';
import { typeLabel, themeFor } from '@/lib/portal-model';
import { FavoriteButton, RequestState, SectionTitle, usePortal } from './PortalProvider';
import { EntryIcon } from './ReportDetails';

interface ActivePreview {
  report: Report;
  style: CSSProperties;
}

const VIEWPORT_MARGIN = 16;
const WORKBENCH_PAGE_SIZE = 8;

function descriptionText(report: Report) {
  return report.description.trim() || '暂未维护模板介绍';
}

function computePreviewStyle(element: HTMLElement): CSSProperties & { '--preview-arrow-left': string } {
  const rect = element.getBoundingClientRect();
  const width = Math.min(rect.width, window.innerWidth - VIEWPORT_MARGIN * 2);
  const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, window.innerWidth - width - VIEWPORT_MARGIN));
  const arrowLeft = Math.max(12, Math.min(rect.left + rect.width / 2 - left, width - 12));
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
  const spaceAbove = rect.top - VIEWPORT_MARGIN;
  const above = spaceBelow < 180 && spaceAbove > spaceBelow;
  return {
    left,
    width,
    ...(above ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
    maxHeight: Math.max(120, (above ? spaceAbove : spaceBelow) - 8),
    '--preview-arrow-left': `${arrowLeft}px`,
  };
}

export default function WorkbenchModule() {
  const [tab, setTab] = useState<WorkbenchTab>('recent');
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<ActivePreview | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorEl = useRef<HTMLElement | null>(null);
  const { open, bootstrap, workbench: result } = usePortal();
  const reports = result.data?.[tab];
  const totalPages = reports?.length ? Math.ceil(reports.length / WORKBENCH_PAGE_SIZE) : 1;
  const currentPage = Math.min(page, totalPages);
  const visibleReports = reports?.slice((currentPage - 1) * WORKBENCH_PAGE_SIZE, currentPage * WORKBENCH_PAGE_SIZE);

  const clearPreview = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    anchorEl.current = null;
    setPreview(null);
  }, []);

  const showPreview = useCallback((report: Report, element: HTMLElement, delayMs: number) => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    anchorEl.current = element;
    const commit = () => {
      if (anchorEl.current !== element || !element.isConnected) return;
      setPreview({ report, style: computePreviewStyle(element) });
    };
    if (delayMs <= 0) commit();
    else hoverTimer.current = setTimeout(commit, delayMs);
  }, []);

  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);

  useEffect(() => {
    if (!preview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearPreview();
    };
    const onViewportChange = () => clearPreview();
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [preview, clearPreview]);

  const activeId = preview?.report.id ?? null;
  const activeTooltipId = activeId ? `workbench-preview-${encodeURIComponent(activeId)}` : undefined;

  return <section className="panel workbench">
    <div className="section-heading"><SectionTitle>我的工作台</SectionTitle>
      <div className="workbench-heading-tools">
        {totalPages > 1 && <div className="workbench-pager" role="navigation" aria-label="工作台分页">
          <button type="button" className="icon-button" aria-label="上一页" disabled={currentPage <= 1} onClick={() => { clearPreview(); setPage(Math.max(1, currentPage - 1)); }}><ChevronLeft size={14} /></button>
          <span>{currentPage} / {totalPages}</span>
          <button type="button" className="icon-button" aria-label="下一页" disabled={currentPage >= totalPages} onClick={() => { clearPreview(); setPage(Math.min(totalPages, currentPage + 1)); }}><ChevronRight size={14} /></button>
        </div>}
        <div className="segmented" role="group" aria-label="工作台分类">{([['recent', '最近打开'], ['frequent', '我常用的'], ['favorites', '我收藏的']] as const).map(([key, label]) =>
          <button key={key} aria-pressed={tab === key} className={tab === key ? 'active' : ''} onClick={() => { clearPreview(); setTab(key); setPage(1); }}>{label}</button>)}</div>
      </div>
    </div>
    <p className="section-note">{tab === 'frequent' ? '按近30天访问次数排序' : tab === 'favorites' ? '收藏与帆软平台同步' : '按最近访问日期排序'}{bootstrap.dataAsOf && <span>数据截至 {bootstrap.dataAsOf}</span>}</p>
    <div key={`${tab}:${currentPage}`} className="workbench-stage" role="region" aria-label="工作台报表列表">{visibleReports?.length ? <div className="workbench-grid workbench-top-eight">{visibleReports.map(report => (
      <article
        key={report.id}
        className={`workbench-card tone-${themeFor(report.type)}`}
        data-workbench-report={report.id}
        onPointerEnter={event => showPreview(report, event.currentTarget, preview ? 40 : 200)}
        onPointerLeave={event => {
          if (anchorEl.current === event.currentTarget) clearPreview();
        }}
        onFocusCapture={event => showPreview(report, event.currentTarget, 0)}
        onBlurCapture={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) clearPreview();
        }}
      >
        <div className="card-top"><EntryIcon entry={report} /><span className="type-badge">{typeLabel[report.type]}</span><FavoriteButton entry={report} /></div>
        <button className="card-main" aria-describedby={activeId === report.id ? activeTooltipId : undefined} onClick={() => { clearPreview(); open(report); }}>
          <h3>{report.name}</h3>
          <p>{descriptionText(report)}</p>
        </button>
        <div className="card-foot"><span>{tab === 'frequent' ? <ChartNoAxesCombined size={13} /> : <Clock size={13} />}{tab === 'frequent' ? '近30天访问' : '最近访问'}</span><strong>{tab === 'frequent' ? `${report.visits30d} 次` : report.lastVisitedOn || '暂无记录'}</strong></div>
      </article>
    ))}</div> : <RequestState {...result} />}</div>
    {preview && typeof document !== 'undefined' && createPortal(
      <div id={activeTooltipId} role="tooltip" className={`workbench-tooltip-popover${preview.style.bottom ? ' is-above' : ''}`} style={preview.style}>
        <div className="workbench-preview">
          <div className="workbench-preview-copy">
            <EntryIcon entry={preview.report} />
            <div>
              <strong>{preview.report.name}</strong>
              <p>{descriptionText(preview.report)}</p>
            </div>
          </div>
          <div className="workbench-preview-meta">
            <span className="workbench-preview-type">{typeLabel[preview.report.type]}</span>
            <span className="workbench-preview-domain" aria-label="所属领域">{preview.report.module || '暂未维护所属领域'}</span>
            <span>更新于 {preview.report.updatedOn || '暂未维护'}</span>
          </div>
        </div>
      </div>,
      document.body,
    )}
  </section>;
}
