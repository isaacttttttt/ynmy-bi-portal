"use client";
import { useEffect, useRef, useState } from 'react';
import { Drawer } from 'antd';
import { FolderOpen, ExternalLink } from 'lucide-react';
import type { Entry, Report } from '@/lib/portal-model';
import { FavoriteButton, usePortal } from './PortalProvider';
import ScrollArea from './ScrollArea';
export function EntryIcon({ entry, unregistered = false }: { entry: Entry; unregistered?: boolean }) {
  const container = useRef<HTMLSpanElement>(null);
  const [loaded, setLoaded] = useState('');
  const key = `${entry.id}:${entry.iconUrl || ''}`;
  useEffect(() => {
    if (unregistered || !entry.iconUrl || !container.current) return;
    const url = entry.iconUrl;
    let cancelled = false;
    const observer = new IntersectionObserver(records => {
      if (!records.some(record => record.isIntersecting)) return;
      observer.disconnect();
      const image = new Image();
      image.src = url;
      void image.decode().then(() => { if (!cancelled) setLoaded(key); }).catch(() => {});
    });
    observer.observe(container.current);
    return () => { cancelled = true; observer.disconnect(); };
  }, [entry.iconUrl, key, unregistered]);
  if (unregistered) {
    return <span ref={container} className="entry-icon" aria-hidden="true"><img src="/portal/assets/icon-unregistered.png" alt="" /></span>;
  }
  const fallback = entry.type === 'frm' ? '填报' : entry.type === 'cpt' ? '报表' : '驾驶舱';
  return <span ref={container} className={entry.type === 'folder' || entry.type === 'url' ? 'folder-icon' : 'entry-icon'} aria-hidden="true">
    {entry.iconUrl && loaded === key ? <img src={entry.iconUrl} alt="" onError={() => setLoaded('')} />
      : entry.type === 'folder' ? <FolderOpen />
      : entry.type === 'url' ? <ExternalLink />
      : <img src={`/portal/assets/${fallback}.png`} alt="" />}
  </span>;
}
export function ReportDetails({ report, onClose }: { report: Report | null; onClose: () => void }) {
  const { open } = usePortal();
  const [previous, setPrevious] = useState(report);
  useEffect(() => { if (report) setPrevious(report); }, [report]);
  const shown = report || previous; // Keep content visible throughout the closing animation.
  const isArchived = shown?.status === 'archived';
  const isUnregistered = Boolean(shown && !isArchived && shown.registered === false);
  const text = (value: string | null) => value || (isUnregistered ? '未登记' : '暂未维护');
  return <Drawer open={!!report} onClose={onClose} placement="right" width="min(680px, 100vw)" rootClassName="report-drawer" title={shown && <><h2>{shown.name}</h2><p>{[isArchived ? '已下架' : isUnregistered ? '未登记' : null, shown.department, shown.owner, shown.frequency].filter(Boolean).join(' · ')}</p></>} footer={shown && <div className="detail-footer"><FavoriteButton entry={shown} /><button className="secondary-button" onClick={onClose}>关闭</button><button className="primary-button" disabled={isArchived || shown.permission === 'denied'} onClick={() => { onClose(); open(shown); }}>{isArchived ? '已下架，暂停打开' : shown.permission === 'denied' ? '无访问权限' : '打开报表'}</button></div>}>
    {shown && <ScrollArea label="报表详情">
      {isArchived && <div className="report-drawer-banner is-archived" role="status">该报表已从平台目录移除（已下架），仅保留报表字典历史记录，暂不支持打开。</div>}
      {isUnregistered && <div className="report-drawer-banner is-unregistered" role="status">该报表已挂载至平台目录，暂未在报表字典中登记元数据信息。</div>}
      <section><h3>业务场景</h3><p>{text(shown.useScene)}</p></section>
      <section><h3>报表简介</h3><p>{text(shown.description)}</p></section>
      <section><h3>核心指标</h3>{shown.metrics.length ? <div className="metric-tags">{shown.metrics.map(m => <span key={m}>{m}</span>)}</div> : <p>暂未维护</p>}</section>
      <section><h3>数据来源</h3><dl><div><dt>数据源系统</dt><dd>{text(shown.source)}</dd></div><div><dt>计算逻辑</dt><dd className="calculation">{text(shown.calcLogic)}</dd></div></dl></section>
      <section><h3>管理信息</h3><dl>{[
        ['报表 Owner', [shown.owner, shown.department && `（${shown.department}）`].filter(Boolean).join(' ')],
        ['开发负责人', [shown.developer, shown.developerDepartment && `（${shown.developerDepartment}）`].filter(Boolean).join(' ')],
        ['上线时间', shown.onlineOn], ['最近更新时间', [shown.updatedOn, shown.updateNote].filter(Boolean).join(' · ')],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{text(value)}</dd></div>)}<div><dt>累计访问量</dt><dd className="visit-count">{shown.views === null ? '暂不可用' : <span className="visit-count-inline"><img className="flame-icon" src="/portal/assets/icon-flame.png" alt="" aria-hidden="true" />{`${shown.views.toLocaleString('zh-CN')} 次`}</span>}</dd></div></dl></section>
    </ScrollArea>}
  </Drawer>;
}
