"use client";
import { useState } from 'react';
import { Modal } from 'antd';
import { FolderOpen, ExternalLink } from 'lucide-react';
import type { Entry, Report } from '@/lib/portal-model';
import { typeLabel } from '@/lib/portal-model';
import { FavoriteButton, usePortal } from './PortalProvider';
export function EntryIcon({ entry }: { entry: Entry }) {
  const [failed, setFailed] = useState(false);
  if (entry.type === 'folder') return <span className="folder-icon"><FolderOpen size={38} /></span>;
  if (entry.type === 'url') return <span className="folder-icon"><ExternalLink size={30} /></span>;
  const fallback = entry.type === 'frm' ? '填报' : entry.type === 'cpt' ? '报表' : '驾驶舱';
  return <img className="entry-icon" src={!failed && entry.iconUrl ? entry.iconUrl : `/assets/${fallback}.png`} alt="" onError={() => setFailed(true)} />;
}
export function ReportDetails({ report, onClose }: { report: Report | null; onClose: () => void }) {
  const { open } = usePortal();
  return <Modal open={!!report} title="报表详情" onCancel={onClose} width={820} footer={report && <div className="detail-footer"><FavoriteButton entry={report} /><button className="secondary-button" onClick={onClose}>关闭</button><button className="primary-button" disabled={report.status === 'archived'} onClick={() => { onClose(); open(report); }}>{report.status === 'archived' ? '已归档，暂停打开' : '打开报表'}</button></div>}>
    {report && <div className="report-details"><div className="detail-title"><EntryIcon entry={report} /><div><h2>{report.name}</h2><p>{typeLabel[report.type]} · {report.module} · {report.status === 'active' ? '在用' : '已归档'}</p></div></div><p>{report.description}</p>
      <dl>{[['业务负责人', report.owner], ['所属部门', report.department], ['开发负责人', report.developer], ['更新频率', report.frequency], ['数据来源', report.source], ['累计访问', `${report.views} 次`], ['最近更新', report.updatedOn], ['使用场景', report.useScene]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <h3>核心指标</h3><div className="metric-tags">{report.metrics.map(m => <span key={m}>{m}</span>)}</div><h3>计算口径</h3><p className="notice-content">{report.calcLogic || '暂未维护'}</p>
    </div>}
  </Modal>;
}
