"use client";
import { useState } from 'react';
import { Modal } from 'antd';
import type { Notice, Page } from '@/lib/portal-model';
import { Pagination, RequestState, SectionTitle, usePortalRequest } from './PortalProvider';
import { useAdaptivePageSize } from './use-adaptive-page-size';
import NoticeModal from './NoticeModal';

const MODAL_NOTICE_LAYOUT = { rowHeight: 52, reservedHeight: 48, min: 4, max: 15, debounceMs: 400 } as const;

export default function NoticeModule() {
  const [all, setAll] = useState(false);
  const [selected, setSelected] = useState<Notice | null>(null);
  const result = usePortalRequest<Page<Notice>>('/notices?page=1&pageSize=7');
  const detail = <NoticeModal notice={selected} onClose={() => setSelected(null)} />;
  return <>
    <section className="panel notices">
      <div className="section-heading">
        <SectionTitle>制度公告</SectionTitle>
        <button className="text-button" onClick={() => setAll(true)}>全部公告 ›</button>
      </div>
      <div className="notice-stage" role="region" aria-label="制度公告列表">
        {result.data?.items.length ? <NoticeList notices={result.data.items} onSelect={setSelected} /> : <RequestState {...result} />}
      </div>
    </section>
    <Modal open={all} onCancel={() => { setAll(false); setSelected(null); }} title="制度公告" footer={null} width={760} rootClassName="all-notices-modal" destroyOnHidden>
      <AllNotices onSelect={setSelected} />
      {all && detail}
    </Modal>
    {!all && detail}
  </>;
}

function NoticeList({ notices, onSelect }: { notices: Notice[]; onSelect: (notice: Notice) => void }) {
  return <div className="notice-list">{notices.map(n => <button key={n.id} className="notice-row" aria-label={n.title} title={n.title} onClick={() => onSelect(n)}>
    <span className={`notice-dot ${n.pinned ? 'pinned' : ''}`} aria-hidden="true" />
    <span className="notice-copy">
      <span className="notice-title"><span>{n.title}</span>{n.pinned && <span className="pin-badge">置顶</span>}</span>
      {n.category && <span className="notice-category">{n.category}</span>}
    </span>
    <time dateTime={n.publishedOn}>{n.publishedOn}</time>
  </button>)}</div>;
}

function AllNotices({ onSelect }: { onSelect: (notice: Notice) => void }) {
  const [page, setPage] = useState(1);
  const { containerRef, pageSize } = useAdaptivePageSize({
    ...MODAL_NOTICE_LAYOUT,
    page,
    onPageAdjust: setPage,
  });

  return <div ref={containerRef} className="all-notices-body">
    {pageSize !== null ? (
      <AllNoticesContent page={page} pageSize={pageSize} onPageChange={setPage} onSelect={onSelect} />
    ) : (
      <div className="all-notices-stage" role="region" aria-label="全部公告列表">
        <RequestState loading />
      </div>
    )}
  </div>;
}

function AllNoticesContent({
  page,
  pageSize,
  onPageChange,
  onSelect,
}: {
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onSelect: (notice: Notice) => void;
}) {
  const result = usePortalRequest<Page<Notice>>(`/notices?page=${page}&pageSize=${pageSize}`);
  const activeData = result.data ?? result.previousData;
  return <>
    <div className={`all-notices-stage${result.loading && activeData ? ' is-loading' : ''}`} role="region" aria-label="全部公告列表" aria-busy={result.loading}>
      {result.error ? <RequestState {...result} /> : activeData?.items.length ? <NoticeList notices={activeData.items} onSelect={onSelect} /> : <RequestState {...result} />}
    </div>
    {activeData && <Pagination data={activeData} disabled={result.loading} onChange={onPageChange} />}
  </>;
}
