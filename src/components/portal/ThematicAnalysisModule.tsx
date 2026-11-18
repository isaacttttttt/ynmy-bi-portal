"use client";
import { Fragment, useState } from 'react';
import { Dropdown } from 'antd';
import { ChevronDown, ChevronRight, FolderOpen } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
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
      <Dropdown trigger={['click']} overlayClassName="topic-dropdown" getPopupContainer={() => document.body} menu={{ selectedKeys: [path[0]?.id || bootstrap.rootId], items: [{ key: bootstrap.rootId, label: '全部专题' }, ...groups.map(g => ({ key: g.id, label: g.name }))], onClick: ({ key }) => setFolderId(key) }}>
        <button className="group-select" aria-label="选择事业群" aria-haspopup="menu">{path[0]?.name || '全部专题'}<ChevronDown size={14} /></button>
      </Dropdown>
    </div>
    {path.length > 1 && <Breadcrumb className="breadcrumbs" aria-label="专题目录路径"><BreadcrumbList>
      <BreadcrumbItem><FolderOpen size={14} /><button onClick={() => setFolderId(bootstrap.rootId)}>全部专题</button></BreadcrumbItem>
      {path.map((e, i) => <Fragment key={e.id}><BreadcrumbSeparator /><BreadcrumbItem>
        <button aria-current={i === path.length - 1 ? 'page' : undefined} onClick={() => setFolderId(e.id)}>{e.name}</button>
        <Dropdown trigger={['click']} overlayClassName="topic-dropdown" getPopupContainer={() => document.body} menu={{ selectedKeys: [e.id], items: entries.filter(item => item.parentId === e.parentId && item.type === 'folder').sort((a,b) => a.sort - b.sort).map(item => ({ key: item.id, label: item.name })), onClick: ({ key }) => setFolderId(key) }}>
          <button aria-label={`切换${e.name}同级目录`} aria-haspopup="menu"><ChevronDown size={12} /></button>
        </Dropdown>
      </BreadcrumbItem></Fragment>)}
    </BreadcrumbList></Breadcrumb>}
    <ScrollArea key={currentId} label="专题目录列表">{visible.length ? <div className="topic-grid">{visible.map((entry, i) => <article key={entry.id} className={`topic-card tone-${themeFor(entry.type)}`} style={{ backgroundImage: `url('/portal/assets/${entry.type === 'folder' ? '专题分析专题背景' : `专题分析驾驶舱背景${i % 3 + 1}`}.png')` }}>
      <button className="topic-main" onClick={() => entry.type === 'folder' ? setFolderId(entry.id) : open(entry)}>
        <EntryIcon entry={entry} /><div><h3>{entry.name}</h3><p><span className="type-badge">{typeLabel[entry.type]}</span>{entry.type === 'folder' && <span>{entries.filter(e => e.parentId === entry.id).length} 个对象</span>}</p></div><ChevronRight className="topic-arrow" size={17} />
      </button>{entry.type !== 'folder' && <FavoriteButton entry={entry} />}
    </article>)}</div> : <RequestState />}</ScrollArea>
  </section>;
}
