"use client";
import { useEffect, useRef, useState } from 'react';
import { Drawer } from 'antd';
import { FolderOpen, ExternalLink } from 'lucide-react';
import type { Entry, Report } from '@/lib/portal-model';
import { FavoriteButton, usePortal } from './PortalProvider';
import ScrollArea from './ScrollArea';
export function EntryIcon({ entry }: { entry: Entry }) {
  const container = useRef<HTMLSpanElement>(null);
  const [loaded, setLoaded] = useState('');
  const key = `${entry.id}:${entry.iconUrl || ''}`;
  useEffect(() => {
    if (!entry.iconUrl || !container.current) return;
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
  }, [entry.iconUrl, key]);
  const fallback = entry.type === 'frm' ? '填报' : entry.type === 'cpt' ? '报表' : '驾驶舱';
  return <span ref={container} className={entry.type === 'folder' || entry.type === 'url' ? 'folder-icon' : 'entry-icon'} aria-hidden="true">
    {entry.iconUrl && loaded === key ? <img src={entry.iconUrl} alt="" onError={() => setLoaded('')} />
      : entry.type === 'folder' ? <FolderOpen size={38} />
      : entry.type === 'url' ? <ExternalLink size={30} />
      : <img src={`/assets/${fallback}.png`} alt="" />}
  </span>;
}
export function ReportDetails({ report, onClose }: { report: Report | null; onClose: () => void }) {
  const { open } = usePortal();
  const [previous, setPrevious] = useState(report);
  useEffect(() => { if (report) setPrevious(report); }, [report]);
  const shown = report || previous; // Keep content visible throughout the closing animation.
  const text = (value: string | null) => value || '暂未维护';
  return <Drawer open={!!report} onClose={onClose} placement="right" width="min(680px, 100vw)" rootClassName="report-drawer" title={shown && <><h2>{shown.name}</h2><p>{[shown.department, shown.owner, shown.frequency].filter(Boolean).join(' · ')}</p></>} footer={shown && <div className="detail-footer"><FavoriteButton entry={shown} /><button className="secondary-button" onClick={onClose}>关闭</button><button className="primary-button" disabled={shown.status === 'archived'} onClick={() => { onClose(); open(shown); }}>{shown.status === 'archived' ? '已归档，暂停打开' : '打开报表'}</button></div>}>
    {shown && <ScrollArea label="报表详情"><section><h3>报表说明</h3><p>{text(shown.useScene)}</p></section>
      <section><h3>报表简介</h3><p>{text(shown.description)}</p></section>
      <section><h3>核心指标</h3>{shown.metrics.length ? <div className="metric-tags">{shown.metrics.map(m => <span key={m}>{m}</span>)}</div> : <p>暂未维护</p>}</section>
      <section><h3>数据来源</h3><dl><div><dt>数据源系统</dt><dd>{text(shown.source)}</dd></div><div><dt>计算逻辑</dt><dd className="calculation">{text(shown.calcLogic)}</dd></div></dl></section>
      <section><h3>管理信息</h3><dl>{[
        ['报表 Owner', [shown.owner, shown.department && `（${shown.department}）`].filter(Boolean).join(' ')],
        ['开发负责人', [shown.developer, shown.developerDepartment && `（${shown.developerDepartment}）`].filter(Boolean).join(' ')],
        ['上线时间', shown.onlineOn], ['最近更新时间', [shown.updatedOn, shown.updateNote].filter(Boolean).join(' · ')],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{text(value)}</dd></div>)}<div><dt>累计访问量</dt><dd className="visit-count">{shown.views.toLocaleString('zh-CN')} 次</dd></div></dl></section>
    </ScrollArea>}
  </Drawer>;
}
