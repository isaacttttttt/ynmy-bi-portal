"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Download, FileSpreadsheet, FileText, Image as ImageIcon, Loader2, Presentation, ZoomIn, ZoomOut } from 'lucide-react';
import { attachmentExtension, attachmentPreviewKind, safeUrl } from '@/lib/portal-model';
import type { AttachmentPreviewKind } from '@/lib/portal-model';

type SheetData = {
  name: string;
  rows: string[][];
};

type PreviewParams = {
  url: string;
  name: string;
  ext: string;
  kind: AttachmentPreviewKind;
  error?: string;
};

function parsePreviewParams(): PreviewParams {
  if (typeof window === 'undefined') {
    return { url: '', name: '', ext: '', kind: 'unsupported' };
  }
  const search = new URLSearchParams(window.location.search);
  const rawUrl = (search.get('url') || '').trim();
  const rawName = (search.get('name') || '').trim();
  if (!rawUrl) {
    return { url: '', name: rawName || '附件预览', ext: '', kind: 'unsupported', error: '缺少附件地址参数' };
  }
  let resolvedHref: string;
  try {
    resolvedHref = safeUrl(rawUrl);
  } catch {
    return { url: '', name: rawName || '附件预览', ext: '', kind: 'unsupported', error: '附件地址格式无效' };
  }
  const parsed = new URL(resolvedHref);
  if (parsed.origin !== window.location.origin) {
    return { url: '', name: rawName || '附件预览', ext: '', kind: 'unsupported', error: '仅支持预览同源附件地址' };
  }
  const fallbackName = decodeURIComponent(parsed.pathname.split('/').pop() || '附件');
  const name = rawName || fallbackName;
  const ext = attachmentExtension(name, resolvedHref);
  const kind = attachmentPreviewKind(name, resolvedHref);
  return { url: resolvedHref, name, ext, kind };
}

function KindIcon({ kind }: { kind: AttachmentPreviewKind }) {
  if (kind === 'xlsx') return <FileSpreadsheet size={18} />;
  if (kind === 'pptx') return <Presentation size={18} />;
  if (kind === 'image') return <ImageIcon size={18} />;
  return <FileText size={18} />;
}

function paginateAndNumberDocx(host: HTMLElement): number {
  const wrapper = host.querySelector<HTMLElement>('.docx-wrapper') ?? host;
  const initialSections = Array.from(wrapper.querySelectorAll<HTMLElement>(':scope > section.docx'));
  if (!initialSections.length) return 0;

  for (const section of initialSections) {
    const style = window.getComputedStyle(section);
    const minHeight = parseFloat(style.minHeight) || 1122;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    const headerHeight = section.querySelector<HTMLElement>(':scope > header')?.offsetHeight || 0;
    const footerHeight = section.querySelector<HTMLElement>(':scope > footer')?.offsetHeight || 0;
    const maxContentHeight = Math.max(320, minHeight - paddingTop - paddingBottom - headerHeight - footerHeight - 16);

    // Only auto-split when a section has no soft page breaks and overflows a single page significantly.
    if (section.scrollHeight <= minHeight * 1.15) continue;

    const article = section.querySelector<HTMLElement>(':scope > article');
    if (!article) continue;
    const blocks = Array.from(article.children) as HTMLElement[];
    if (blocks.length <= 1) continue;

    // Measure each block's height including vertical margins before moving nodes.
    const measured = blocks.map(el => {
      const cs = window.getComputedStyle(el);
      const h = el.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
      return { el, h };
    });

    const pages: HTMLElement[][] = [[]];
    let currentHeight = 0;
    for (const { el, h } of measured) {
      if (pages[pages.length - 1].length > 0 && currentHeight + h > maxContentHeight) {
        pages.push([el]);
        currentHeight = h;
      } else {
        pages[pages.length - 1].push(el);
        currentHeight += h;
      }
    }
    if (pages.length <= 1) continue;

    // Keep the first page's blocks in the original section, and clone the section shell for subsequent pages.
    article.replaceChildren(...pages[0]);
    let insertAfter: HTMLElement = section;
    for (let i = 1; i < pages.length; i++) {
      const nextSection = section.cloneNode(true) as HTMLElement;
      const nextArticle = nextSection.querySelector<HTMLElement>(':scope > article');
      if (nextArticle) nextArticle.replaceChildren(...pages[i]);
      insertAfter.insertAdjacentElement('afterend', nextSection);
      insertAfter = nextSection;
    }
  }

  const finalSections = Array.from(wrapper.querySelectorAll<HTMLElement>(':scope > section.docx'));
  const total = finalSections.length;
  finalSections.forEach((section, index) => {
    section.querySelectorAll(':scope > .docx-page-number').forEach(el => el.remove());
    const badge = document.createElement('div');
    badge.className = 'docx-page-number';
    badge.textContent = `第 ${index + 1} / ${total} 页`;
    section.appendChild(badge);
  });
  return total;
}

export default function AttachmentPreviewPage() {
  const [params, setParams] = useState<PreviewParams>(() => ({ url: '', name: '附件预览', ext: '', kind: 'unsupported' }));
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [docxPages, setDocxPages] = useState(0);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const parsed = parsePreviewParams();
    setParams(parsed);
    setReady(true);
    if (parsed.name) document.title = `${parsed.name} - 附件预览`;
  }, []);

  useEffect(() => {
    if (!ready || params.error || !params.url) return;
    if (params.kind === 'image' || params.kind === 'pdf' || params.kind === 'unsupported') return;

    const controller = new AbortController();
    let disposed = false;
    let pptxCleanup: (() => void) | null = null;

    async function loadDocument() {
      setLoading(true);
      setLoadError(null);
      setSheets([]);
      setActiveSheet(0);
      setDocxPages(0);
      if (hostRef.current) hostRef.current.innerHTML = '';

      try {
        const response = await fetch(params.url, { credentials: 'include', signal: controller.signal });
        if (!response.ok) {
          throw new Error(`附件加载失败（HTTP ${response.status}）`);
        }
        const buffer = await response.arrayBuffer();
        if (disposed) return;

        if (params.kind === 'docx') {
          const docx = await import('docx-preview');
          if (disposed || !hostRef.current) return;
          await docx.renderAsync(buffer, hostRef.current, undefined, {
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            breakPages: true,
            ignoreLastRenderedPageBreak: false,
            renderHeaders: true,
            renderFooters: true,
            experimental: false,
          });
          if (!disposed && hostRef.current) {
            setDocxPages(paginateAndNumberDocx(hostRef.current));
          }
        } else if (params.kind === 'xlsx') {
          const XLSX = await import('xlsx');
          if (disposed) return;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const parsedSheets: SheetData[] = workbook.SheetNames.map(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' });
            const maxCols = matrix.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
            const normalizedRows = matrix.slice(0, 5000).map(row => {
              const cells = Array.isArray(row) ? row.map(cell => (cell === null || cell === undefined ? '' : String(cell))) : [];
              while (cells.length < maxCols) cells.push('');
              return cells;
            });
            return { name: sheetName, rows: normalizedRows };
          });
          setSheets(parsedSheets);
        } else if (params.kind === 'pptx') {
          const pptxPreview = await import('pptx-preview');
          if (disposed || !hostRef.current) return;
          const stageWidth = Math.min(1080, Math.max(680, window.innerWidth - 96));
          const stageHeight = Math.round(stageWidth * 9 / 16);
          const previewer = pptxPreview.init(hostRef.current, {
            width: stageWidth,
            height: stageHeight,
            mode: 'list',
          });
          pptxCleanup = () => {
            try {
              (previewer as { destroy?: () => void }).destroy?.();
            } catch {
              // Ignore cleanup errors on unmount.
            }
          };
          await previewer.preview(buffer);
        }
      } catch (err) {
        if (disposed || controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : '文档解析失败，请点击右上角下载原文件查看';
        setLoadError(message);
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    loadDocument();
    return () => {
      disposed = true;
      controller.abort();
      pptxCleanup?.();
    };
  }, [ready, params.url, params.kind, params.error]);

  const currentSheet = useMemo(() => sheets[activeSheet] ?? null, [sheets, activeSheet]);
  const showZoom = params.kind === 'docx' || params.kind === 'pptx';
  const effectiveError = params.error || loadError;

  return (
    <div className="attachment-preview-shell">
      <header className="attachment-preview-header">
        <div className="attachment-preview-title-group">
          <span className={`attachment-kind-badge kind-${params.kind}`}>
            <KindIcon kind={params.kind} />
            <span>{(params.ext || 'FILE').toUpperCase()}</span>
          </span>
          <h1 className="attachment-preview-title" title={params.name}>{params.name}</h1>
        </div>
        <div className="attachment-preview-actions">
          {params.kind === 'docx' && docxPages > 0 && !effectiveError && (
            <span className="attachment-page-count">共 {docxPages} 页</span>
          )}
          {showZoom && !effectiveError && (
            <div className="attachment-zoom-controls" aria-label="缩放控制">
              <button
                type="button"
                className="attachment-tool-btn"
                onClick={() => setZoom(z => Math.max(50, z - 10))}
                title="缩小"
              >
                <ZoomOut size={15} />
              </button>
              <span className="attachment-zoom-value">{zoom}%</span>
              <button
                type="button"
                className="attachment-tool-btn"
                onClick={() => setZoom(z => Math.min(180, z + 10))}
                title="放大"
              >
                <ZoomIn size={15} />
              </button>
            </div>
          )}
          {params.url && (
            <a
              className="primary-button attachment-download-btn"
              href={params.url}
              download={params.name}
            >
              <Download size={15} />
              <span>下载原文件</span>
            </a>
          )}
        </div>
      </header>

      {params.kind === 'xlsx' && sheets.length > 1 && (
        <div className="attachment-sheet-tabs" role="tablist" aria-label="工作表切换">
          {sheets.map((sheet, index) => (
            <button
              key={sheet.name}
              type="button"
              role="tab"
              aria-selected={index === activeSheet}
              className={`attachment-sheet-tab ${index === activeSheet ? 'active' : ''}`}
              onClick={() => setActiveSheet(index)}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      <main className="attachment-preview-body">
        {loading && (
          <div className="attachment-preview-state">
            <Loader2 size={28} className="attachment-spin" />
            <p>正在加载并解析文档，请稍候...</p>
          </div>
        )}

        {!loading && effectiveError && (
          <div className="attachment-preview-state is-error">
            <AlertCircle size={32} />
            <p>{effectiveError}</p>
            {params.url && (
              <a className="primary-button attachment-download-btn" href={params.url} download={params.name}>
                <Download size={15} />
                <span>下载原文件查看</span>
              </a>
            )}
          </div>
        )}

        {!loading && !effectiveError && ready && params.kind === 'unsupported' && (
          <div className="attachment-preview-state">
            <AlertCircle size={32} />
            <p>
              当前文件格式（{params.ext ? `.${params.ext}` : '未知格式'}）暂不支持浏览器纯前端在线预览
              {params.ext === 'ppt' || params.ext === 'doc' ? '（旧版 Office 二进制格式请转换为 .pptx / .docx 或直接下载查看）' : ''}。
            </p>
            {params.url && (
              <a className="primary-button attachment-download-btn" href={params.url} download={params.name}>
                <Download size={15} />
                <span>下载原文件</span>
              </a>
            )}
          </div>
        )}

        {!loading && !effectiveError && ready && params.kind === 'image' && params.url && (
          <div className="attachment-image-stage">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={params.url} alt={params.name} className="attachment-image-item" />
          </div>
        )}

        {!loading && !effectiveError && ready && params.kind === 'pdf' && params.url && (
          <iframe src={params.url} title={params.name} className="attachment-pdf-frame" />
        )}

        {!loading && !effectiveError && params.kind === 'xlsx' && currentSheet && (
          <div className="attachment-xlsx-stage">
            {currentSheet.rows.length ? (
              <table className="attachment-xlsx-table">
                <tbody>
                  {currentSheet.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex === 0 ? 'is-header' : undefined}>
                      <th className="attachment-xlsx-rownum">{rowIndex + 1}</th>
                      {row.map((cell, colIndex) => (
                        <td key={colIndex}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="attachment-preview-state"><p>当前工作表为空</p></div>
            )}
          </div>
        )}

        <div
          className={`attachment-office-stage ${params.kind === 'docx' || params.kind === 'pptx' ? '' : 'is-hidden'}`}
          style={showZoom ? { zoom: `${zoom}%` } : undefined}
        >
          <div ref={hostRef} className={`attachment-office-host kind-${params.kind}`} />
        </div>
      </main>
    </div>
  );
}
