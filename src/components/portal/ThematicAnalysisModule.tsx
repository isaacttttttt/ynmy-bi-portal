"use client";
import { useState } from 'react';
import { ChevronRight, FolderOpen } from 'lucide-react';
import { breadcrumb, descendants, themeFor, typeLabel } from '@/lib/portal-model';
import { FavoriteButton, RequestState, SectionTitle, usePortal } from './PortalProvider';
import { EntryIcon } from './ReportDetails';
import ScrollArea from './ScrollArea';

export default function ThematicAnalysisModule() {
  const { bootstrap, open } = usePortal();
  const entries = descendants(bootstrap.entries, bootstrap.rootId);
  const groups = entries.filter(e => e.parentId === bootstrap.rootId && e.type === 'folder').sort((a,b) => a.sort - b.sort);
  const [folderId, setFolderId] = useState<string | null>(null);
  const currentId = folderId && (folderId === bootstrap.rootId || entries.some(e => e.id === folderId)) ? folderId : groups[0]?.id || bootstrap.rootId;
  const path = breadcrumb(entries, currentId, bootstrap.rootId);
  const visible = entries.filter(e => e.parentId === currentId).sort((a,b) => a.sort - b.sort);
  return <section className="panel thematic">
    <div className="section-heading"><SectionTitle>专题分析</SectionTitle>
      <label className="group-select"><select aria-label="选择事业群" value={path[0]?.id || bootstrap.rootId} onChange={e => setFolderId(e.target.value)} disabled={!groups.length}>
        <option value={bootstrap.rootId}>全部专题</option>
        {groups.length ? groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>) : <option value="">暂无授权事业群</option>}
      </select></label>
    </div>
    {path.length > 1 && <nav className="breadcrumbs" aria-label="专题目录路径"><FolderOpen size={14} />
      <button aria-current={currentId === bootstrap.rootId ? 'page' : undefined} onClick={() => setFolderId(bootstrap.rootId)}>全部专题</button>
      {path.map((e, i) => <span key={e.id}><ChevronRight size={13} /><button aria-current={i === path.length - 1 ? 'page' : undefined} onClick={() => setFolderId(e.id)}>{e.name}</button></span>)}
    </nav>}
    <ScrollArea key={currentId} label="专题目录列表">{visible.length ? <div className="topic-grid">{visible.map((entry, i) => <article key={entry.id} className={`topic-card tone-${themeFor(entry.type)}`} style={{ backgroundImage: `url('/assets/${entry.type === 'folder' ? '专题分析专题背景' : `专题分析驾驶舱背景${i % 3 + 1}`}.png')` }}>
      <button className="topic-main" onClick={() => entry.type === 'folder' ? setFolderId(entry.id) : open(entry)}>
        <EntryIcon entry={entry} /><div><h3>{entry.name}</h3><p><span className="type-badge">{typeLabel[entry.type]}</span>{entry.type === 'folder' && <span>{entries.filter(e => e.parentId === entry.id).length} 个对象</span>}</p></div><ChevronRight className="topic-arrow" size={17} />
      </button>{entry.type !== 'folder' && <FavoriteButton entry={entry} />}
    </article>)}</div> : <RequestState />}</ScrollArea>
  </section>;
}
