"use client";
import { safeUrl } from '@/lib/portal-model';
import { SectionTitle, usePortal } from './PortalProvider';
import ScrollArea from './ScrollArea';
export default function QuickEntryModule() {
  const { bootstrap } = usePortal();
  return <section className="panel quick-entries"><div className="section-heading"><SectionTitle>快捷入口</SectionTitle></div><ScrollArea label="快捷入口列表"><div className="quick-list">{bootstrap.quickEntries.map((entry, i) => {
    let href: string | undefined;
    try { href = entry.url ? safeUrl(entry.url) : undefined; } catch { href = undefined; }
    const style = { backgroundImage: `url('/assets/指标卡背景_${8 + i % 5}@2x.png')` };
    const content = <><span className="quick-icon" style={style} aria-hidden="true" /><div><h3>{entry.name}</h3><p>{entry.description}</p></div>{href ? <img className="quick-arrow" src="/assets/图标_综合_箭头4@2x.png" alt="" /> : <span className="unconfigured">待配置</span>}</>;
    return href ? <a className="quick-entry" key={entry.id} href={href} target="_blank" rel="noopener noreferrer">{content}</a> : <div className="quick-entry disabled" key={entry.id} title="管理员配置入口地址后可用">{content}</div>;
  })}</div></ScrollArea></section>;
}
