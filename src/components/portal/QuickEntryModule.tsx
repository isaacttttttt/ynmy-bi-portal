"use client";
import { safeUrl } from '@/lib/portal-model';
import { SectionTitle, usePortal } from './PortalProvider';
import ScrollArea from './ScrollArea';
import { useState } from 'react';
import type { QuickEntry } from '@/lib/portal-model';
export default function QuickEntryModule() {
  const { bootstrap } = usePortal();
  return <section className="panel quick-entries"><div className="section-heading"><SectionTitle>快捷入口</SectionTitle></div><ScrollArea label="快捷入口列表"><div className="quick-list">{bootstrap.quickEntries.map((entry, i) => {
    let href: string | undefined;
    try { href = entry.url ? safeUrl(entry.url) : undefined; } catch { href = undefined; }
    const content = <><QuickIcon key={entry.iconUrl || ''} entry={entry} index={i} /><div><h3>{entry.name}</h3><p>{entry.description}</p></div>{href ? <img className="quick-arrow" src="/portal/assets/图标_综合_箭头4@2x.png" alt="" /> : <span className="unconfigured">待配置</span>}</>;
    return href ? <a className="quick-entry" key={entry.id} href={href} target="_blank" rel="noopener noreferrer">{content}</a> : <div className="quick-entry disabled" key={entry.id} title="管理员配置入口地址后可用">{content}</div>;
  })}</div></ScrollArea></section>;
}

function QuickIcon({ entry, index }: { entry: QuickEntry; index: number }) {
  const [loaded, setLoaded] = useState(false);
  return <span className="quick-icon" aria-hidden="true" style={loaded ? undefined : { backgroundImage: `url('/portal/assets/指标卡背景_${8 + index % 5}@2x.png')` }}>
    {entry.iconUrl && <img src={entry.iconUrl} alt="" loading="lazy" decoding="async" onLoad={() => setLoaded(true)} onError={() => setLoaded(false)} style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: loaded ? 1 : 0 }} />}
  </span>;
}
