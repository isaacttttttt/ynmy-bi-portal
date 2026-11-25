"use client";
import { useState } from 'react';
import { Modal } from 'antd';
import type { Notice, Page } from '@/lib/portal-model';
import { Pagination, RequestState, SectionTitle, usePortalRequest } from './PortalProvider';
import NoticeModal from './NoticeModal';
import ScrollArea from './ScrollArea';

export default function NoticeModule() {
  const [all, setAll] = useState(false);
  const [selected, setSelected] = useState<Notice | null>(null);
  const result = usePortalRequest<Page<Notice>>('/notices?page=1&pageSize=7');
  const detail = <NoticeModal notice={selected} onClose={() => setSelected(null)} />;
  return <><section className="panel notices"><div className="section-heading"><SectionTitle>制度公告</SectionTitle><button className="text-button" onClick={() => setAll(true)}>全部公告 ›</button></div><ScrollArea label="制度公告列表">{result.data?.items.length ? <NoticeList notices={result.data.items} onSelect={setSelected} /> : <RequestState {...result} />}</ScrollArea></section>
    <Modal open={all} onCancel={() => { setAll(false); setSelected(null); }} title="制度公告" footer={null} width={760} destroyOnHidden><AllNotices onSelect={setSelected} />{all && detail}</Modal>
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
  const result = usePortalRequest<Page<Notice>>(`/notices?page=${page}&pageSize=10`);
  return <>{result.data?.items.length ? <NoticeList notices={result.data.items} onSelect={onSelect} /> : <RequestState {...result} />}{result.data && <Pagination data={result.data} onChange={setPage} />}</>;
}
