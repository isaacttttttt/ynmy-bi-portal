"use client";
import { useLayoutEffect, useRef, useState } from 'react';
import { Modal } from 'antd';
import type { Notice, Page } from '@/lib/portal-model';
import { Pagination, RequestState, SectionTitle, usePortalRequest } from './PortalProvider';
import NoticeModal from './NoticeModal';

const MODAL_NOTICE_ROW_HEIGHT = 52;
const MODAL_NOTICE_MIN = 4;
const MODAL_NOTICE_MAX = 15;

function calcModalNoticePageSize(height: number) {
  const fit = Math.floor(Math.max(0, height) / MODAL_NOTICE_ROW_HEIGHT);
  return Math.max(MODAL_NOTICE_MIN, Math.min(MODAL_NOTICE_MAX, fit));
}

function initialModalNoticePageSize() {
  if (typeof window === 'undefined') return 8;
  const stageHeight = Math.min(520, window.innerHeight * 0.6) - 52;
  return calcModalNoticePageSize(stageHeight);
}

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
  const stageRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialModalNoticePageSize);
  const pageRef = useRef(page);
  const sizeRef = useRef(pageSize);
  pageRef.current = page;
  sizeRef.current = pageSize;

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const apply = (height: number, immediate: boolean) => {
      if (height <= 0) return;
      const next = calcModalNoticePageSize(height);
      const commit = () => {
        const prev = sizeRef.current;
        if (prev === next) return;
        sizeRef.current = next;
        setPageSize(next);
        if (pageRef.current > 1) {
          const firstIndex = (pageRef.current - 1) * prev;
          setPage(Math.floor(firstIndex / next) + 1);
        }
      };
      if (immediate) {
        if (timer) { clearTimeout(timer); timer = null; }
        commit();
      } else {
        if (timer) clearTimeout(timer);
        timer = setTimeout(commit, 150);
      }
    };
    apply(el.clientHeight, true);
    const observer = new ResizeObserver(entries => {
      apply(entries[0]?.contentRect.height ?? el.clientHeight, false);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const result = usePortalRequest<Page<Notice>>(`/notices?page=${page}&pageSize=${pageSize}`);
  return <div className="all-notices-body">
    <div ref={stageRef} className="all-notices-stage" role="region" aria-label="全部公告列表">
      {result.data?.items.length ? <NoticeList notices={result.data.items} onSelect={onSelect} /> : <RequestState {...result} />}
    </div>
    {result.data && <Pagination data={result.data} onChange={setPage} />}
  </div>;
}
