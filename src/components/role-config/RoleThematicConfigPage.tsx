"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Modal, Tooltip, message } from 'antd';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart2,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ClipboardEdit,
  ExternalLink,
  FileSpreadsheet,
  Folder,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  UserCog,
  X,
} from 'lucide-react';
import { request } from '@/lib/portal-api';
import {
  folderAccessState,
  isDescendantNode,
  moveRoleThematicNode,
  normalizeSiblingSorts,
  themeFor,
  typeLabel,
  type EntryType,
  type FolderAccessState,
  type RoleAvailableReport,
  type RoleListPage,
  type RoleSummary,
  type RoleThematicDetail,
  type RoleThematicNode,
} from '@/lib/portal-model';
import { Pagination, RequestState, SectionTitle } from '@/components/portal/PortalProvider';
import ScrollArea from '@/components/portal/ScrollArea';
import ReportPickerModal from './ReportPickerModal';

type DropPosition = 'before' | 'after' | 'inside';

interface FlatTreeRow {
  node: RoleThematicNode;
  depth: number;
  hasChildren: boolean;
  siblingIndex: number;
  siblingCount: number;
}

const ROLE_ROW_HEIGHT = 42;
const ROLE_ROW_GAP = 4;
const ROLE_LIST_TOP_PAD = 10;
const ROLE_PAGE_SIZE_MIN = 5;
const ROLE_PAGE_SIZE_MAX = 50;

function calcRolePageSize(containerHeight: number) {
  const usable = Math.max(0, containerHeight - ROLE_LIST_TOP_PAD);
  const fit = Math.floor((usable + ROLE_ROW_GAP) / (ROLE_ROW_HEIGHT + ROLE_ROW_GAP));
  return Math.max(ROLE_PAGE_SIZE_MIN, Math.min(ROLE_PAGE_SIZE_MAX, fit));
}

function createNodeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatSavedTime(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

function serializeDraft(nodes: RoleThematicNode[]) {
  return JSON.stringify(
    normalizeSiblingSorts(nodes).map(n => ({
      id: n.id,
      parentId: n.parentId,
      nodeType: n.nodeType,
      reportId: n.reportId,
      name: n.name.trim(),
      sort: n.sort,
      enabled: n.enabled,
    })),
  );
}

function ReportNodeIcon({ type }: { type: Exclude<EntryType, 'folder'> | null }) {
  if (type === 'cpt') return <FileSpreadsheet size={16} />;
  if (type === 'frm') return <ClipboardEdit size={16} />;
  if (type === 'url') return <ExternalLink size={16} />;
  return <BarChart2 size={16} />;
}

function AccessSwitch({
  state,
  label,
  onClick,
}: {
  state: FolderAccessState;
  label: string;
  onClick: () => void;
}) {
  const statusText = state === 'all' ? '可访问' : state === 'partial' ? '部分开放' : '不可访问';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={state === 'all' ? true : state === 'partial' ? 'mixed' : false}
      aria-label={`${label}：${statusText}`}
      className={`role-access-switch is-${state}`}
      onClick={onClick}
    >
      <span className="role-switch-track" aria-hidden="true">
        <span className="role-switch-thumb" />
      </span>
      <span className="role-switch-label">{statusText}</span>
    </button>
  );
}

export default function RoleThematicConfigPage() {
  const [toast, toastHolder] = message.useMessage();
  const [modal, modalHolder] = Modal.useModal();

  // Left sidebar: roles pagination & search
  const [roleKeywordInput, setRoleKeywordInput] = useState('');
  const [roleKeyword, setRoleKeyword] = useState('');
  const [rolePage, setRolePage] = useState(1);
  const [rolesData, setRolesData] = useState<RoleListPage | null>(null);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState<string | undefined>();
  const [rolesReloadTick, setRolesReloadTick] = useState(0);

  // Active role & right panel detail
  const [selectedRole, setSelectedRole] = useState<RoleSummary | null>(null);
  const [detail, setDetail] = useState<RoleThematicDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | undefined>();
  const [detailReloadTick, setDetailReloadTick] = useState(0);

  // Editable draft tree state
  const [draftNodes, setDraftNodes] = useState<RoleThematicNode[]>([]);
  const [savedSignature, setSavedSignature] = useState('[]');
  const [saving, setSaving] = useState(false);

  // Tree view UI state
  const [treeQuery, setTreeQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Drag & drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string | null; position: DropPosition } | null>(null);

  // Report picker modal
  const [pickerTarget, setPickerTarget] = useState<{ parentId: string | null; name: string } | null>(null);

  // Adaptive role pageSize based on real sidebar container height (no scrollbar + pagination conflict)
  const roleListStageRef = useRef<HTMLDivElement>(null);
  const [rolePageSize, setRolePageSize] = useState<number | null>(null);
  const rolePageSizeRef = useRef<number | null>(null);
  const rolePageRef = useRef(rolePage);
  rolePageRef.current = rolePage;

  useLayoutEffect(() => {
    const el = roleListStageRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const applySize = (height: number, immediate: boolean) => {
      if (height <= 0) return;
      const next = calcRolePageSize(height);
      const commit = () => {
        const prev = rolePageSizeRef.current;
        if (prev === next) return;
        rolePageSizeRef.current = next;
        setRolePageSize(next);
        if (prev !== null && rolePageRef.current > 1) {
          const firstIndex = (rolePageRef.current - 1) * prev;
          setRolePage(Math.floor(firstIndex / next) + 1);
        }
      };
      if (immediate) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        commit();
      } else {
        if (timer) clearTimeout(timer);
        timer = setTimeout(commit, 150);
      }
    };
    applySize(el.clientHeight, true);
    const observer = new ResizeObserver(entries => {
      const height = entries[0]?.contentRect.height ?? el.clientHeight;
      applySize(height, rolePageSizeRef.current === null);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const isDirty = useMemo(
    () => detail !== null && serializeDraft(draftNodes) !== savedSignature,
    [detail, draftNodes, savedSignature],
  );

  // Debounce role search keyword
  useEffect(() => {
    const timer = setTimeout(() => {
      setRoleKeyword(roleKeywordInput.trim());
      setRolePage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [roleKeywordInput]);

  // Warn before closing tab with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // Fetch roles list using container-adaptive pageSize
  useEffect(() => {
    if (rolePageSize === null) return;
    const controller = new AbortController();
    setRolesLoading(true);
    setRolesError(undefined);
    const params = new URLSearchParams({
      page: String(rolePage),
      pageSize: String(rolePageSize),
      ...(roleKeyword ? { q: roleKeyword } : {}),
    });
    request<RoleListPage>(`/role-thematic/roles?${params}`, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return;
        setRolesData(data);
        setSelectedRole(current => {
          if (current && data.items.some(item => item.id === current.id)) {
            return data.items.find(item => item.id === current.id) || current;
          }
          if (!current && data.items.length > 0) return data.items[0];
          return current;
        });
      })
      .catch(error => {
        if (!controller.signal.aborted) setRolesError((error as Error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRolesLoading(false);
      });
    return () => controller.abort();
  }, [rolePage, rolePageSize, roleKeyword, rolesReloadTick]);

  // Fetch selected role's thematic mapping detail & available reports
  useEffect(() => {
    if (!selectedRole) {
      setDetail(null);
      setDraftNodes([]);
      setSavedSignature('[]');
      return;
    }
    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError(undefined);
    const qs = new URLSearchParams({ roleName: selectedRole.name });
    request<RoleThematicDetail>(`/role-thematic/roles/${encodeURIComponent(selectedRole.id)}?${qs}`, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return;
        const normalized = normalizeSiblingSorts(data.nodes);
        setDetail(data);
        setDraftNodes(normalized);
        setSavedSignature(serializeDraft(normalized));
        setExpandedIds(new Set(normalized.filter(n => n.nodeType === 'folder').map(n => n.id)));
        setCheckedIds(new Set());
        setEditingId(null);
        setTreeQuery('');
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          setDetail(null);
          setDetailError((error as Error).message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [selectedRole?.id, detailReloadTick]);

  // Focus inline rename input when opened
  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

  const confirmDiscardIfDirty = useCallback(
    (action: () => void) => {
      if (!isDirty) {
        action();
        return;
      }
      modal.confirm({
        title: '有尚未保存的更改',
        content: '切换角色或翻页将放弃当前角色的未保存修改，确定继续吗？',
        okText: '放弃并继续',
        cancelText: '留在当前页',
        onOk: action,
      });
    },
    [isDirty, modal],
  );

  // Derived tree structures & metrics
  const childrenByParent = useMemo(() => {
    const map = new Map<string, RoleThematicNode[]>();
    for (const node of draftNodes) {
      const key = node.parentId ?? '';
      const list = map.get(key) || [];
      list.push(node);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
    }
    return map;
  }, [draftNodes]);

  const matchedVisibleIds = useMemo(() => {
    const q = treeQuery.trim().toLocaleLowerCase();
    if (!q) return null;
    const parentMap = new Map(draftNodes.map(n => [n.id, n.parentId]));
    const visible = new Set<string>();
    for (const node of draftNodes) {
      const hit =
        node.name.toLocaleLowerCase().includes(q) ||
        (node.reportId && node.reportId.toLocaleLowerCase().includes(q)) ||
        (node.nodeType === 'folder' && '目录'.includes(q)) ||
        (node.reportType && typeLabel[node.reportType].toLocaleLowerCase().includes(q));
      if (!hit) continue;
      visible.add(node.id);
      let cursor = node.parentId;
      const seen = new Set<string>([node.id]);
      while (cursor && !seen.has(cursor)) {
        visible.add(cursor);
        seen.add(cursor);
        cursor = parentMap.get(cursor) ?? null;
      }
    }
    return visible;
  }, [draftNodes, treeQuery]);

  const flatRows = useMemo<FlatTreeRow[]>(() => {
    const rows: FlatTreeRow[] = [];
    const searching = matchedVisibleIds !== null;
    function walk(parentId: string | null, depth: number) {
      const siblings = (childrenByParent.get(parentId ?? '') || []).filter(
        node => !matchedVisibleIds || matchedVisibleIds.has(node.id),
      );
      siblings.forEach((node, index) => {
        const children = childrenByParent.get(node.id) || [];
        rows.push({
          node,
          depth,
          hasChildren: children.length > 0,
          siblingIndex: index,
          siblingCount: siblings.length,
        });
        if (node.nodeType === 'folder' && children.length > 0 && (searching || expandedIds.has(node.id))) {
          walk(node.id, depth + 1);
        }
      });
    }
    walk(null, 0);
    return rows;
  }, [childrenByParent, expandedIds, matchedVisibleIds]);

  const stats = useMemo(() => {
    const folders = draftNodes.filter(n => n.nodeType === 'folder');
    const reports = draftNodes.filter(n => n.nodeType === 'report');
    const enabledMap = new Map<string, boolean>();
    const byId = new Map(draftNodes.map(n => [n.id, n]));
    function isEffectivelyEnabled(node: RoleThematicNode): boolean {
      if (enabledMap.has(node.id)) return enabledMap.get(node.id)!;
      if (!node.enabled) {
        enabledMap.set(node.id, false);
        return false;
      }
      if (!node.parentId) {
        enabledMap.set(node.id, true);
        return true;
      }
      const parent = byId.get(node.parentId);
      const val = parent ? isEffectivelyEnabled(parent) : true;
      enabledMap.set(node.id, val);
      return val;
    }
    const enabledReports = reports.filter(isEffectivelyEnabled).length;
    const staleReports = reports.filter(r => r.available === false).length;
    return {
      folderCount: folders.length,
      reportCount: reports.length,
      enabledReports,
      staleReports,
    };
  }, [draftNodes]);

  const existingReportIds = useMemo(
    () => new Set(draftNodes.filter(n => n.nodeType === 'report' && n.reportId).map(n => n.reportId!)),
    [draftNodes],
  );

  const allFolders = useMemo(() => draftNodes.filter(n => n.nodeType === 'folder'), [draftNodes]);
  const allExpanded = allFolders.length > 0 && allFolders.every(f => expandedIds.has(f.id));
  const allRowsChecked = flatRows.length > 0 && flatRows.every(row => checkedIds.has(row.node.id));
  const someRowsChecked = flatRows.some(row => checkedIds.has(row.node.id)) && !allRowsChecked;

  // Tree operations
  function toggleExpand(folderId: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function toggleExpandAll() {
    if (allExpanded) setExpandedIds(new Set());
    else setExpandedIds(new Set(allFolders.map(f => f.id)));
  }

  function addFolder(parentId: string | null) {
    const siblings = draftNodes.filter(n => n.parentId === parentId);
    const id = createNodeId();
    const newFolder: RoleThematicNode = {
      id,
      parentId,
      nodeType: 'folder',
      reportId: null,
      name: parentId ? '新建子目录' : '新建一级目录',
      reportType: null,
      catalogName: null,
      sort: siblings.length,
      enabled: true,
    };
    setDraftNodes(prev => normalizeSiblingSorts([...prev, newFolder]));
    if (parentId) {
      setExpandedIds(prev => new Set(prev).add(parentId).add(id));
    } else {
      setExpandedIds(prev => new Set(prev).add(id));
    }
    setEditingId(id);
    setEditingName(newFolder.name);
  }

  function addReportsTo(parentId: string | null, reports: RoleAvailableReport[]) {
    if (!reports.length) return;
    setDraftNodes(prev => {
      const existing = new Set(prev.filter(n => n.reportId).map(n => n.reportId!));
      const baseSort = prev.filter(n => n.parentId === parentId).length;
      const additions: RoleThematicNode[] = [];
      for (const report of reports) {
        if (existing.has(report.reportId)) continue;
        existing.add(report.reportId);
        additions.push({
          id: createNodeId(),
          parentId,
          nodeType: 'report',
          reportId: report.reportId,
          name: report.reportName,
          reportType: report.reportType,
          catalogName: report.catalogName,
          sort: baseSort + additions.length,
          enabled: true,
          available: true,
        });
      }
      return normalizeSiblingSorts([...prev, ...additions]);
    });
    if (parentId) setExpandedIds(prev => new Set(prev).add(parentId));
    setPickerTarget(null);
    toast.success(`已添加 ${reports.length} 张报表`);
  }

  function commitRename() {
    if (!editingId) return;
    const trimmed = editingName.trim();
    if (!trimmed) {
      toast.warning('名称不能为空');
      setEditingId(null);
      return;
    }
    setDraftNodes(prev => prev.map(n => (n.id === editingId ? { ...n, name: trimmed } : n)));
    setEditingId(null);
  }

  function collectSubtreeIds(rootId: string, nodes: RoleThematicNode[]) {
    const ids = new Set<string>([rootId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of nodes) {
        if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
          ids.add(node.id);
          changed = true;
        }
      }
    }
    return ids;
  }

  function collectAncestorIds(nodeId: string, nodes: RoleThematicNode[]) {
    const parentMap = new Map(nodes.map(n => [n.id, n.parentId]));
    const ancestors = new Set<string>();
    let cursor = parentMap.get(nodeId) ?? null;
    while (cursor && !ancestors.has(cursor)) {
      ancestors.add(cursor);
      cursor = parentMap.get(cursor) ?? null;
    }
    return ancestors;
  }

  function toggleNodeAccess(node: RoleThematicNode) {
    if (node.nodeType === 'folder') {
      const state = folderAccessState(draftNodes, node.id);
      const nextEnabled = state !== 'all';
      const subtree = collectSubtreeIds(node.id, draftNodes);
      const ancestors = nextEnabled ? collectAncestorIds(node.id, draftNodes) : new Set<string>();
      setDraftNodes(prev =>
        prev.map(item => {
          if (subtree.has(item.id) || ancestors.has(item.id)) {
            return { ...item, enabled: nextEnabled };
          }
          return item;
        }),
      );
    } else {
      const nextEnabled = !node.enabled;
      const ancestors = nextEnabled ? collectAncestorIds(node.id, draftNodes) : new Set<string>();
      setDraftNodes(prev =>
        prev.map(item => {
          if (item.id === node.id) return { ...item, enabled: nextEnabled };
          if (ancestors.has(item.id)) return { ...item, enabled: true };
          return item;
        }),
      );
    }
  }

  function deleteNode(node: RoleThematicNode) {
    const subtree = collectSubtreeIds(node.id, draftNodes);
    const remove = () => {
      setDraftNodes(prev => normalizeSiblingSorts(prev.filter(item => !subtree.has(item.id))));
      setCheckedIds(prev => {
        const next = new Set(prev);
        for (const id of subtree) next.delete(id);
        return next;
      });
    };
    if (node.nodeType === 'folder' && subtree.size > 1) {
      modal.confirm({
        title: `删除目录「${node.name}」`,
        content: `该目录下包含 ${subtree.size - 1} 个子项，删除后将一并移除，是否继续？`,
        okText: '确认移除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: remove,
      });
    } else {
      remove();
    }
  }

  function moveSibling(node: RoleThematicNode, direction: -1 | 1) {
    const siblings = (childrenByParent.get(node.parentId ?? '') || []);
    const index = siblings.findIndex(item => item.id === node.id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= siblings.length) return;
    const target = siblings[swapIndex];
    setDraftNodes(prev => moveRoleThematicNode(prev, node.id, target.id, direction < 0 ? 'before' : 'after'));
  }

  function batchSetAccess(enabled: boolean) {
    if (!checkedIds.size) return;
    const affected = new Set<string>();
    for (const id of checkedIds) {
      for (const subId of collectSubtreeIds(id, draftNodes)) affected.add(subId);
      if (enabled) {
        for (const ancId of collectAncestorIds(id, draftNodes)) affected.add(ancId);
      }
    }
    setDraftNodes(prev => prev.map(item => (affected.has(item.id) ? { ...item, enabled } : item)));
    toast.success(enabled ? '已批量设为可访问' : '已批量设为不可访问');
  }

  function batchDelete() {
    if (!checkedIds.size) return;
    const toRemove = new Set<string>();
    for (const id of checkedIds) {
      for (const subId of collectSubtreeIds(id, draftNodes)) toRemove.add(subId);
    }
    modal.confirm({
      title: `移除所选 ${toRemove.size} 个项目`,
      content: '确认从当前角色的专题目录中移除所选目录与报表吗？',
      okText: '确认移除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        setDraftNodes(prev => normalizeSiblingSorts(prev.filter(item => !toRemove.has(item.id))));
        setCheckedIds(new Set());
      },
    });
  }

  function cleanStaleReports() {
    setDraftNodes(prev => normalizeSiblingSorts(prev.filter(item => item.available !== false)));
    toast.success('已清理失效报表节点');
  }

  // Drag & Drop handlers
  function handleDragStart(event: DragEvent, nodeId: string) {
    if (editingId) {
      event.preventDefault();
      return;
    }
    setDraggingId(nodeId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', nodeId);
  }

  function handleDragOverRow(event: DragEvent<HTMLDivElement>, targetNode: RoleThematicNode) {
    if (!draggingId || draggingId === targetNode.id) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / Math.max(1, rect.height);
    let position: DropPosition;
    if (targetNode.nodeType === 'folder') {
      position = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside';
    } else {
      position = ratio < 0.5 ? 'before' : 'after';
    }
    // Disallow dropping into own descendant
    const nextParentId = position === 'inside' ? targetNode.id : targetNode.parentId;
    if (nextParentId && isDescendantNode(draftNodes, draggingId, nextParentId)) {
      setDropTarget(null);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTarget(prev =>
      prev?.id === targetNode.id && prev.position === position ? prev : { id: targetNode.id, position },
    );
  }

  function handleDropRow(event: DragEvent) {
    event.preventDefault();
    if (!draggingId || !dropTarget) {
      setDraggingId(null);
      setDropTarget(null);
      return;
    }
    setDraftNodes(prev => moveRoleThematicNode(prev, draggingId, dropTarget.id, dropTarget.position));
    if (dropTarget.position === 'inside' && dropTarget.id) {
      setExpandedIds(prev => new Set(prev).add(dropTarget.id!));
    }
    setDraggingId(null);
    setDropTarget(null);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
  }

  function handleResetDraft() {
    if (!detail) return;
    const normalized = normalizeSiblingSorts(detail.nodes);
    setDraftNodes(normalized);
    setExpandedIds(new Set(normalized.filter(n => n.nodeType === 'folder').map(n => n.id)));
    setCheckedIds(new Set());
    setEditingId(null);
    toast.info('已还原为上次保存的配置');
  }

  async function handleSave() {
    if (!selectedRole || saving) return;
    const normalized = normalizeSiblingSorts(draftNodes);
    setSaving(true);
    try {
      const updated = await request<RoleThematicDetail>(
        `/role-thematic/roles/${encodeURIComponent(selectedRole.id)}/tree`,
        undefined,
        {
          roleName: selectedRole.name,
          nodes: normalized.map(n => ({
            id: n.id,
            parentId: n.parentId,
            nodeType: n.nodeType,
            reportId: n.nodeType === 'report' ? n.reportId : null,
            name: n.name.trim(),
            sort: n.sort,
            enabled: n.enabled,
          })),
        },
      );
      const nextNodes = normalizeSiblingSorts(updated.nodes);
      setDetail(updated);
      setDraftNodes(nextNodes);
      setSavedSignature(serializeDraft(nextNodes));
      setRolesData(prev => {
        if (!prev) return prev;
        const enabledReports = nextNodes.filter(n => n.nodeType === 'report' && n.enabled).length;
        const totalReports = nextNodes.filter(n => n.nodeType === 'report').length;
        return {
          ...prev,
          items: prev.items.map(item =>
            item.id === selectedRole.id
              ? { ...item, configured: true, enabledReportCount: enabledReports, totalReportCount: totalReports }
              : item,
          ),
        };
      });
      toast.success('角色专题目录配置已保存');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const savedTimeLabel = formatSavedTime(detail?.role.updatedAt ?? null);
  const draggingNode = draggingId ? draftNodes.find(n => n.id === draggingId) : null;

  return (
    <div className="role-config-page">
      {toastHolder}
      {modalHolder}

      <header className="role-config-topbar">
        <div className="role-config-brand">
          <img src="/portal/assets/company_title.png" alt="云南白药" className="role-config-logo" />
          <div className="role-config-title-group">
            <h1>专题分析 · 目录配置</h1>
            <p>为角色定制门户首页专题分析板块的目录结构、报表归属与排序</p>
          </div>
        </div>
      </header>

      <main className="role-config-workspace">
        {/* Left Sidebar: Flat Role List (15 per page) */}
        <aside className="panel role-sidebar" aria-label="角色列表">
          <div className="role-sidebar-head">
            <SectionTitle>角色</SectionTitle>
            <label className="role-search-input">
              <Search size={15} aria-hidden="true" />
              <input
                type="text"
                value={roleKeywordInput}
                onChange={e => setRoleKeywordInput(e.target.value)}
                placeholder="搜索角色"
                aria-label="搜索角色"
              />
              {roleKeywordInput && (
                <button
                  type="button"
                  className="role-input-clear"
                  aria-label="清空角色搜索"
                  onClick={() => setRoleKeywordInput('')}
                >
                  <X size={14} />
                </button>
              )}
            </label>
          </div>

          <div ref={roleListStageRef} className="role-list-stage" role="region" aria-label="角色列表">
            {rolesLoading ? (
              <RequestState loading />
            ) : rolesError ? (
              <RequestState error={rolesError} retry={() => setRolesReloadTick(n => n + 1)} />
            ) : rolesData?.items.length ? (
              <ul className="role-list" role="listbox" aria-label="可配置角色">
                {rolesData.items.map(role => {
                  const active = selectedRole?.id === role.id;
                  return (
                    <li key={role.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`role-list-item${active ? ' is-active' : ''}`}
                        title={role.description ? `${role.name}：${role.description}` : role.name}
                        onClick={() => {
                          if (active) return;
                          confirmDiscardIfDirty(() => setSelectedRole(role));
                        }}
                      >
                        <UserCog size={16} className="role-list-icon" aria-hidden="true" />
                        <span className="role-list-name">{role.name}</span>
                        {role.configured && (
                          <span className="role-list-badge" title="已开放 / 已配置报表数">
                            {role.enabledReportCount ?? 0}/{role.totalReportCount ?? 0}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : rolePage > 1 ? (
              <div className="request-state" role="status">
                <p>第 {rolePage} 页暂无更多角色</p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => confirmDiscardIfDirty(() => setRolePage(1))}
                >
                  返回第 1 页
                </button>
              </div>
            ) : (
              <RequestState />
            )}
          </div>

          <div className="role-sidebar-foot">
            <Pagination
              compact
              disabled={rolesLoading}
              data={{
                page: rolePage,
                pageSize: rolesData?.pageSize ?? rolePageSize ?? 15,
                ...(typeof rolesData?.total === 'number' ? { total: rolesData.total } : {}),
                hasNext: rolesData?.hasNext ?? false,
              }}
              onChange={nextPage => confirmDiscardIfDirty(() => setRolePage(nextPage))}
            />
            <p className="role-sidebar-hint">选择角色，查看并调整专题目录与访问权限</p>
          </div>
        </aside>

        {/* Right Main Panel: Directory & Report Tree Configuration */}
        <section className="panel role-editor" aria-label="目录与报表配置">
          {!selectedRole ? (
            <div className="role-editor-empty">
              <RequestState />
            </div>
          ) : (
            <>
              <div className="role-editor-head">
                <div className="role-editor-title">
                  <SectionTitle>目录与报表</SectionTitle>
                  <span className="role-active-pill">{selectedRole.name}</span>
                </div>
                {detail && (
                  <div className="role-editor-stats">
                    <span>
                      已开放 <strong>{stats.enabledReports}</strong> / {stats.reportCount} 张报表
                    </span>
                    <span className="role-editor-stats-sub">
                      底表可配置 {detail.availableReports.length} 张
                    </span>
                  </div>
                )}
              </div>

              {detailLoading ? (
                <div className="role-editor-loading">
                  <RequestState loading />
                </div>
              ) : detailError ? (
                <div className="role-editor-loading">
                  <RequestState error={detailError} retry={() => setDetailReloadTick(n => n + 1)} />
                </div>
              ) : (
                <>
                  <div className="role-editor-toolbar">
                    <div className="role-toolbar-left">
                      {stats.staleReports > 0 && (
                        <button
                          type="button"
                          className="role-warning-btn"
                          onClick={cleanStaleReports}
                        >
                          <AlertTriangle size={14} />
                          清理 {stats.staleReports} 项失效报表
                        </button>
                      )}
                      {checkedIds.size > 0 && (
                        <div className="role-batch-bar" role="group" aria-label="批量操作">
                          <span>已选 {checkedIds.size} 项</span>
                          <button type="button" onClick={() => batchSetAccess(true)}>
                            设为可访问
                          </button>
                          <button type="button" onClick={() => batchSetAccess(false)}>
                            设为不可访问
                          </button>
                          <button type="button" className="is-danger" onClick={batchDelete}>
                            移除
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="role-toolbar-right">
                      <label className="role-search-input role-tree-search">
                        <Search size={15} aria-hidden="true" />
                        <input
                          type="text"
                          value={treeQuery}
                          onChange={e => setTreeQuery(e.target.value)}
                          placeholder="搜索目录或报表"
                          aria-label="搜索目录或报表"
                        />
                        {treeQuery && (
                          <button
                            type="button"
                            className="role-input-clear"
                            aria-label="清空目录搜索"
                            onClick={() => setTreeQuery('')}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </label>
                      <Tooltip title={allExpanded ? '全部折叠' : '全部展开'}>
                        <button
                          type="button"
                          className="role-expand-toggle"
                          aria-label={allExpanded ? '全部折叠' : '全部展开'}
                          disabled={allFolders.length === 0}
                          onClick={toggleExpandAll}
                        >
                          <ChevronsUpDown size={16} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="role-tree-header">
                    <div className="role-col-check">
                      <input
                        type="checkbox"
                        aria-label="全选目录和报表"
                        checked={allRowsChecked}
                        ref={el => {
                          if (el) el.indeterminate = someRowsChecked;
                        }}
                        onChange={() => {
                          if (allRowsChecked) setCheckedIds(new Set());
                          else setCheckedIds(new Set(flatRows.map(r => r.node.id)));
                        }}
                      />
                    </div>
                    <div className="role-col-name role-tree-header-name">
                      <span>目录 / 报表</span>
                      <div className="role-header-actions">
                        <button
                          type="button"
                          className="role-add-root-btn"
                          onClick={() => addFolder(null)}
                        >
                          <Plus size={14} />
                          新增一级目录
                        </button>
                        <button
                          type="button"
                          className="role-add-report-root-btn"
                          onClick={() => setPickerTarget({ parentId: null, name: '根目录' })}
                        >
                          <Plus size={14} />
                          添加报表
                        </button>
                      </div>
                    </div>
                    <div className="role-col-type">类型</div>
                    <div className="role-col-access">角色访问权限</div>
                    <div className="role-col-ops">操作</div>
                  </div>

                  <ScrollArea label="目录与报表树列表">
                    {flatRows.length ? (
                      <div className="role-tree-body" onDragOver={e => e.preventDefault()}>
                        {flatRows.map(({ node, depth, hasChildren, siblingIndex, siblingCount }) => {
                          const isFolder = node.nodeType === 'folder';
                          const isExpanded = matchedVisibleIds !== null || expandedIds.has(node.id);
                          const isEditing = editingId === node.id;
                          const isChecked = checkedIds.has(node.id);
                          const accessState: FolderAccessState = isFolder
                            ? folderAccessState(draftNodes, node.id)
                            : node.enabled
                              ? 'all'
                              : 'none';
                          const dropClass =
                            dropTarget?.id === node.id ? ` is-drop-${dropTarget.position}` : '';

                          return (
                            <div
                              key={node.id}
                              draggable={!isEditing}
                              onDragStart={e => handleDragStart(e, node.id)}
                              onDragOver={e => handleDragOverRow(e, node)}
                              onDrop={handleDropRow}
                              onDragEnd={handleDragEnd}
                              className={`role-tree-row${draggingId === node.id ? ' is-dragging' : ''}${dropClass}${isChecked ? ' is-checked' : ''}`}
                            >
                              <div className="role-col-check">
                                <input
                                  type="checkbox"
                                  aria-label={`选择 ${node.name}`}
                                  checked={isChecked}
                                  onChange={() => {
                                    setCheckedIds(prev => {
                                      const next = new Set(prev);
                                      if (next.has(node.id)) next.delete(node.id);
                                      else next.add(node.id);
                                      return next;
                                    });
                                  }}
                                />
                              </div>

                              <div className="role-col-name">
                                <span
                                  className="role-drag-handle"
                                  title="拖动调整顺序或移入目录"
                                  aria-hidden="true"
                                >
                                  <GripVertical size={15} />
                                </span>

                                <div
                                  className="role-tree-indent"
                                  style={{ paddingLeft: `${depth * 24}px` }}
                                >
                                  {isFolder ? (
                                    <button
                                      type="button"
                                      className="role-caret-btn"
                                      aria-label={isExpanded ? `折叠${node.name}` : `展开${node.name}`}
                                      disabled={!hasChildren}
                                      onClick={() => toggleExpand(node.id)}
                                    >
                                      {hasChildren ? (
                                        isExpanded ? (
                                          <ChevronDown size={15} />
                                        ) : (
                                          <ChevronRight size={15} />
                                        )
                                      ) : (
                                        <span className="role-caret-spacer" />
                                      )}
                                    </button>
                                  ) : (
                                    <span className="role-caret-spacer" />
                                  )}

                                  <span
                                    className={`role-node-icon ${isFolder ? 'is-folder' : `tone-${themeFor(node.reportType || 'cpt')}`}`}
                                  >
                                    {isFolder ? (
                                      isExpanded ? (
                                        <FolderOpen size={17} />
                                      ) : (
                                        <Folder size={17} />
                                      )
                                    ) : (
                                      <ReportNodeIcon type={node.reportType} />
                                    )}
                                  </span>

                                  {isEditing ? (
                                    <input
                                      ref={editInputRef}
                                      className="role-inline-input"
                                      value={editingName}
                                      maxLength={256}
                                      aria-label="编辑名称"
                                      onChange={e => setEditingName(e.target.value)}
                                      onBlur={commitRename}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          commitRename();
                                        }
                                        if (e.key === 'Escape') {
                                          e.preventDefault();
                                          setEditingId(null);
                                        }
                                      }}
                                    />
                                  ) : (
                                    <span className={`role-node-title${isFolder ? ' is-folder' : ''}`}>
                                      {node.name}
                                    </span>
                                  )}

                                  {!isEditing && (
                                    <button
                                      type="button"
                                      className="role-inline-icon-btn"
                                      aria-label={`重命名 ${node.name}`}
                                      title="编辑名称"
                                      onClick={() => {
                                        setEditingId(node.id);
                                        setEditingName(node.name);
                                      }}
                                    >
                                      <Pencil size={13} />
                                    </button>
                                  )}

                                  {!isFolder && node.available === false && (
                                    <Tooltip title="该报表已不在当前角色的可配置底表中，请移除后再保存">
                                      <span className="role-stale-pill">已不在底表</span>
                                    </Tooltip>
                                  )}

                                  {isFolder && !isEditing && (
                                    <div className="role-folder-inline-actions">
                                      <button
                                        type="button"
                                        className="role-inline-link"
                                        onClick={() => addFolder(node.id)}
                                      >
                                        + 新增子目录
                                      </button>
                                      <button
                                        type="button"
                                        className="role-inline-link"
                                        onClick={() => setPickerTarget({ parentId: node.id, name: node.name })}
                                      >
                                        + 添加报表
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="role-col-type">
                                <span
                                  className={`role-type-pill ${isFolder ? 'is-folder' : `tone-${themeFor(node.reportType || 'cpt')}`}`}
                                >
                                  {isFolder ? '目录' : typeLabel[node.reportType || 'cpt']}
                                </span>
                              </div>

                              <div className="role-col-access">
                                <AccessSwitch
                                  state={accessState}
                                  label={node.name}
                                  onClick={() => toggleNodeAccess(node)}
                                />
                              </div>

                              <div className="role-col-ops">
                                <Tooltip title="上移">
                                  <button
                                    type="button"
                                    className="role-op-btn"
                                    aria-label={`上移 ${node.name}`}
                                    disabled={siblingIndex <= 0}
                                    onClick={() => moveSibling(node, -1)}
                                  >
                                    <ArrowUp size={14} />
                                  </button>
                                </Tooltip>
                                <Tooltip title="下移">
                                  <button
                                    type="button"
                                    className="role-op-btn"
                                    aria-label={`下移 ${node.name}`}
                                    disabled={siblingIndex >= siblingCount - 1}
                                    onClick={() => moveSibling(node, 1)}
                                  >
                                    <ArrowDown size={14} />
                                  </button>
                                </Tooltip>
                                <Tooltip title="移除">
                                  <button
                                    type="button"
                                    className="role-op-btn is-danger"
                                    aria-label={`移除 ${node.name}`}
                                    onClick={() => deleteNode(node)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </Tooltip>
                              </div>
                            </div>
                          );
                        })}

                        {draggingNode && draggingNode.parentId !== null && (
                          <div
                            className={`role-root-dropzone${dropTarget?.id === null && dropTarget.position === 'inside' ? ' is-active' : ''}`}
                            onDragOver={e => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              setDropTarget({ id: null, position: 'inside' });
                            }}
                            onDrop={handleDropRow}
                          >
                            拖放到此处移至一级目录
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="role-tree-empty">
                        <FolderPlus size={36} />
                        <p>
                          {treeQuery
                            ? '没有找到匹配的目录或报表'
                            : '当前角色尚未配置专题目录与报表'}
                        </p>
                        {!treeQuery && (
                          <div className="role-tree-empty-actions">
                            <button
                              type="button"
                              className="primary-button"
                              onClick={() => addFolder(null)}
                            >
                              + 新增一级目录
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => setPickerTarget({ parentId: null, name: '根目录' })}
                            >
                              + 直接添加报表
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </ScrollArea>

                  <div className="role-editor-foot">
                    <span>拖动调整顺序或移入目录，点击名称旁的铅笔编辑。</span>
                    <span>
                      共 {stats.folderCount} 个目录 · {stats.reportCount} 张报表
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </main>

      {/* Bottom Save Bar (No Preview Button per requirements) */}
      <footer className="role-config-footer">
        <div className={`role-save-status${isDirty ? ' is-dirty' : ''}`}>
          <span className="role-status-dot" aria-hidden="true" />
          {isDirty
            ? '有尚未保存的更改'
            : savedTimeLabel
              ? `已保存于 ${savedTimeLabel}${detail?.role.updatedBy ? `（${detail.role.updatedBy}）` : ''}`
              : '该角色尚未保存配置'}
        </div>
        <div className="role-footer-actions">
          <button
            type="button"
            className="secondary-button role-reset-btn"
            disabled={!isDirty || saving}
            onClick={handleResetDraft}
          >
            <RotateCcw size={15} />
            重置修改
          </button>
          <button
            type="button"
            className="primary-button role-save-btn"
            disabled={!selectedRole || !detail || saving}
            onClick={handleSave}
          >
            <Save size={15} />
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </footer>

      <ReportPickerModal
        open={pickerTarget !== null}
        targetName={pickerTarget?.name || '根目录'}
        availableReports={detail?.availableReports ?? []}
        existingReportIds={existingReportIds}
        onCancel={() => setPickerTarget(null)}
        onConfirm={selected => addReportsTo(pickerTarget?.parentId ?? null, selected)}
      />
    </div>
  );
}
