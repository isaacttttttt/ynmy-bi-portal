"use client";
import { useState } from 'react';
import { Modal } from 'antd';
import type { Notice, Page } from '@/lib/portal-model';
import { Pagination, RequestState, SectionTitle, usePortalRequest } from './PortalProvider';
import NoticeModal from './NoticeModal';

export default function NoticeModule() {
  const [all, setAll] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Notice | null>(null);
  const result = usePortalRequest<Page<Notice>>(`/notices?page=${all ? page : 1}&pageSize=${all ? 10 : 5}`);
  const list = <>{result.data?.items.length ? <div className="notice-list">{result.data.items.map(n => <button key={n.id} className="notice-row" aria-label={n.title} title={n.title} onClick={() => setSelected(n)}>
    <span className={`notice-dot ${n.pinned ? 'pinned' : ''}`} /><div className="notice-copy"><h3>{Array.from(n.title).length > 12 ? `${Array.from(n.title).slice(0, 12).join('')}......` : n.title}</h3><p>{n.category}</p></div><time>{n.publishedOn}</time><span className="notice-pin">{n.pinned && <span className="pin-badge">置顶</span>}</span>
  </button>)}</div> : <RequestState {...result} />}</>;
  return <><section className="panel notices"><div className="section-heading"><SectionTitle>制度公告</SectionTitle><button className="text-button" onClick={() => { setAll(true); setPage(1); }}>全部公告 ›</button></div>{!all ? list : <p className="muted">正在查看全部公告</p>}</section>
    <Modal open={all} onCancel={() => setAll(false)} title="制度公告" footer={null} width={760}>{list}{result.data && <Pagination data={result.data} onChange={setPage} />}</Modal>
    <NoticeModal notice={selected} onClose={() => setSelected(null)} />
  </>;
}
