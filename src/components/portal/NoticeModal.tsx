"use client";
import { Modal } from 'antd';
import type { Notice } from '@/lib/portal-model';
import { safeUrl } from '@/lib/portal-model';
export default function NoticeModal({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  let href: string | undefined;
  try { href = notice?.url ? safeUrl(notice.url) : undefined; } catch { href = undefined; }
  return <Modal title={notice?.title} open={!!notice} onCancel={onClose} width={760} footer={<button className="primary-button" onClick={onClose}>我知道了</button>}>
    <p className="notice-meta">{notice?.category} · {notice?.publishedOn}</p><div className="notice-content">{notice?.content || '暂无公告正文'}</div>
    {href && <a className="text-button" href={href} target="_blank" rel="noopener noreferrer">查看公告原文 ↗</a>}
  </Modal>;
}
