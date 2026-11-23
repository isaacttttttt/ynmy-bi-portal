"use client";
import { Modal } from 'antd';
import { Download, Eye, Paperclip } from 'lucide-react';
import type { Notice } from '@/lib/portal-model';
import { attachmentPreviewKind, buildAttachmentPreviewUrl, safeUrl } from '@/lib/portal-model';
import portalConfig from '@/config/portal.json';

export default function NoticeModal({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  let href: string | undefined;
  try { href = notice?.url ? safeUrl(notice.url) : undefined; } catch { href = undefined; }
  let attachmentHref: string | undefined;
  try { attachmentHref = notice?.attachment ? safeUrl(notice.attachment.url) : undefined; } catch { attachmentHref = undefined; }

  const attachmentName = notice?.attachment?.name || '附件';
  const previewKind = attachmentHref ? attachmentPreviewKind(attachmentName, attachmentHref) : 'unsupported';
  const canPreview = previewKind !== 'unsupported';

  function openAttachmentPreview() {
    if (!attachmentHref) return;
    if (previewKind === 'image' || previewKind === 'pdf') {
      window.open(attachmentHref, '_blank', 'noopener,noreferrer');
      return;
    }
    if (previewKind === 'docx' || previewKind === 'xlsx' || previewKind === 'pptx') {
      const previewUrl = buildAttachmentPreviewUrl(attachmentHref, attachmentName, portalConfig.basePath);
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    // Unsupported legacy binary formats (e.g. .ppt / .doc / .zip) fall back to direct download.
    window.open(attachmentHref, '_blank', 'noopener,noreferrer');
  }

  return <Modal title={notice?.title} open={!!notice} onCancel={onClose} width={760} footer={<button className="primary-button" onClick={onClose}>我知道了</button>}>
    <p className="notice-meta">{notice?.category} · {notice?.publishedOn}</p>
    <div className="notice-content">{notice?.content || '暂无公告正文'}</div>
    {href && <p className="notice-link-row"><a className="text-button" href={href} target="_blank" rel="noopener noreferrer">查看公告原文 ↗</a></p>}
    {attachmentHref && (
      <div className="notice-attachment-bar">
        <button
          type="button"
          className="notice-attachment-preview"
          title={canPreview ? `新窗口预览：${attachmentName}` : `当前格式暂不支持在线预览，点击下载：${attachmentName}`}
          onClick={openAttachmentPreview}
        >
          <Paperclip size={15} className="notice-attachment-icon" />
          <span className="notice-attachment-name">附件：{attachmentName}</span>
          {canPreview && (
            <span className="notice-attachment-tag">
              <Eye size={12} />
              <span>预览</span>
            </span>
          )}
        </button>
        <a
          className="notice-attachment-download"
          href={attachmentHref}
          download={attachmentName}
          target="_blank"
          rel="noopener noreferrer"
          title={`下载附件：${attachmentName}`}
        >
          <Download size={14} />
          <span>下载</span>
        </a>
      </div>
    )}
  </Modal>;
}
