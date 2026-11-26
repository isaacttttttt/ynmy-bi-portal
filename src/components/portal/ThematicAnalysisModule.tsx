"use client";
import { Fragment, useState } from 'react';
import { Dropdown } from 'antd';
import { ChevronDown, ChevronRight, FolderOpen } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { roleThematicBreadcrumb, themeFor, typeLabel } from '@/lib/portal-model';
import { FavoriteButton, RequestState, SectionTitle, usePortal } from './PortalProvider';
import { EntryIcon } from './ReportDetails';
import ScrollArea from './ScrollArea';

export default function ThematicAnalysisModule() {
  const { bootstrap, open } = usePortal();
  const roles = bootstrap.thematicRoles ?? [];
  const [roleId, setRoleId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const activeRole = roles.find(role => role.id === roleId) ?? roles[0] ?? null;
  const entries = activeRole?.entries ?? [];
  const currentFolderId = folderId && entries.some(entry => entry.id === folderId && entry.type === 'folder') ? folderId : null;
  const path = roleThematicBreadcrumb(entries, currentFolderId);
  const visible = entries.filter(entry => entry.parentId === currentFolderId).sort((a, b) => a.sort - b.sort);

  function selectRole(nextRoleId: string) {
    setRoleId(nextRoleId);
    setFolderId(null);
  }

  const roleMenu = {
    selectedKeys: activeRole ? [activeRole.id] : [],
    items: roles.map(role => ({ key: role.id, label: role.name })),
    onClick: ({ key }: { key: string }) => selectRole(key),
  };

  return <section className="panel thematic">
    <div className="section-heading"><SectionTitle>专题分析</SectionTitle>
      {activeRole && roles.length > 1 && <Dropdown trigger={['click']} overlayClassName="topic-dropdown" getPopupContainer={() => document.body} menu={roleMenu}>
        <button className="group-select" aria-label="选择角色" aria-haspopup="menu">{activeRole.name}<ChevronDown size={14} /></button>
      </Dropdown>}
    </div>
    {activeRole && path.length > 0 && <Breadcrumb className="breadcrumbs" aria-label="专题目录路径"><BreadcrumbList>
      <BreadcrumbItem>
        <FolderOpen size={14} />
        <button onClick={() => setFolderId(null)}>{activeRole.name}</button>
      </BreadcrumbItem>
      {path.map((entry, index) => <Fragment key={entry.id}><BreadcrumbSeparator /><BreadcrumbItem>
        <button aria-current={index === path.length - 1 ? 'page' : undefined} onClick={() => setFolderId(entry.id)}>{entry.name}</button>
        <Dropdown trigger={['click']} overlayClassName="topic-dropdown" getPopupContainer={() => document.body} menu={{
          selectedKeys: [entry.id],
          items: entries.filter(item => item.parentId === entry.parentId && item.type === 'folder').sort((a, b) => a.sort - b.sort).map(item => ({ key: item.id, label: item.name })),
          onClick: ({ key }) => setFolderId(key),
        }}>
          <button aria-label={`切换${entry.name}同级目录`} aria-haspopup="menu"><ChevronDown size={12} /></button>
        </Dropdown>
      </BreadcrumbItem></Fragment>)}
    </BreadcrumbList></Breadcrumb>}
    <ScrollArea key={`${activeRole?.id ?? 'none'}:${currentFolderId ?? 'root'}`} label="专题目录列表">{visible.length ? <div className="topic-grid">{visible.map((entry, index) => <article key={`${entry.type}:${entry.id}`} className={`topic-card tone-${themeFor(entry.type)}`} style={{ backgroundImage: `url('/portal/assets/${entry.type === 'folder' ? '专题分析专题背景' : `专题分析驾驶舱背景${index % 3 + 1}`}.png')` }}>
      <button className="topic-main" onClick={() => entry.type === 'folder' ? setFolderId(entry.id) : open(entry)}>
        <EntryIcon entry={entry} /><div><h3>{entry.name}</h3><p><span className="type-badge">{typeLabel[entry.type]}</span>{entry.type === 'folder' && <span>{entries.filter(item => item.parentId === entry.id).length} 个对象</span>}</p></div><ChevronRight className="topic-arrow" size={17} />
      </button>{entry.type !== 'folder' && <FavoriteButton entry={entry} />}
    </article>)}</div> : <RequestState />}</ScrollArea>
  </section>;
}
