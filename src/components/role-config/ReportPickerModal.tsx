"use client";

import { useEffect, useMemo, useState } from 'react';
import { Modal } from 'antd';
import { BarChart2, ClipboardEdit, ExternalLink, FileSpreadsheet, Search, CheckCircle2 } from 'lucide-react';
import type { EntryType, RoleAvailableReport } from '@/lib/portal-model';
import { themeFor, typeLabel } from '@/lib/portal-model';
import { createSearchHighlighter } from '@/components/portal/highlight-search-text';
import ScrollArea from '@/components/portal/ScrollArea';

function ReportTypeIcon({ type }: { type: Exclude<EntryType, 'folder'> }) {
  if (type === 'cpt') return <FileSpreadsheet size={16} />;
  if (type === 'frm') return <ClipboardEdit size={16} />;
  if (type === 'url') return <ExternalLink size={16} />;
  return <BarChart2 size={16} />;
}

export default function ReportPickerModal({
  open,
  targetName,
  availableReports,
  existingReportIds,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  targetName: string;
  availableReports: RoleAvailableReport[];
  existingReportIds: Set<string>;
  onCancel: () => void;
  onConfirm: (selected: RoleAvailableReport[]) => void;
}) {
  const [keyword, setKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setKeyword('');
      setSelectedIds(new Set());
    }
  }, [open]);

  const highlight = useMemo(() => createSearchHighlighter(keyword), [keyword]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLocaleLowerCase();
    if (!q) return availableReports;
    return availableReports.filter(
      item =>
        item.reportName.toLocaleLowerCase().includes(q) ||
        (item.description || '').toLocaleLowerCase().includes(q) ||
        item.reportId.toLocaleLowerCase().includes(q) ||
        typeLabel[item.reportType].toLocaleLowerCase().includes(q),
    );
  }, [availableReports, keyword]);

  const selectableFiltered = useMemo(
    () => filtered.filter(item => !existingReportIds.has(item.reportId)),
    [filtered, existingReportIds],
  );

  const allFilteredSelected =
    selectableFiltered.length > 0 && selectableFiltered.every(item => selectedIds.has(item.reportId));

  function toggleOne(reportId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(reportId)) next.delete(reportId);
      else next.add(reportId);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const item of selectableFiltered) next.delete(item.reportId);
      } else {
        for (const item of selectableFiltered) next.add(item.reportId);
      }
      return next;
    });
  }

  function handleConfirm() {
    const chosen = availableReports.filter(item => selectedIds.has(item.reportId));
    if (!chosen.length) return;
    onConfirm(chosen);
  }

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      width={680}
      rootClassName="role-picker-modal"
      title={
        <div className="role-picker-header">
          <h3>添加报表到「{targetName}」</h3>
          <p>仅展示当前角色在权限底表中可配置的报表，同一角色下每张报表仅可添加一次</p>
        </div>
      }
      footer={
        <div className="role-picker-footer">
          <span className="muted">
            已选择 <strong>{selectedIds.size}</strong> 张报表（共 {availableReports.length} 张可配置）
          </span>
          <div className="role-picker-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>
              取消
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={selectedIds.size === 0}
              onClick={handleConfirm}
            >
              添加所选 ({selectedIds.size})
            </button>
          </div>
        </div>
      }
      destroyOnHidden
    >
      <div className="role-picker-toolbar">
        <label className="role-search-input">
          <Search size={15} aria-hidden="true" />
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="搜索报表名称、报表介绍或类型…"
            aria-label="搜索可配置报表"
          />
        </label>
        <button
          type="button"
          className="text-button"
          disabled={selectableFiltered.length === 0}
          onClick={toggleAllFiltered}
        >
          {allFilteredSelected ? '取消全选' : `全选未添加 (${selectableFiltered.length})`}
        </button>
      </div>
      <div className="role-picker-body">
        <ScrollArea label="可配置报表列表">
          {filtered.length ? (
            <div className="role-picker-list">
              {filtered.map(report => {
                const alreadyAdded = existingReportIds.has(report.reportId);
                const checked = selectedIds.has(report.reportId);
                const description = report.description?.trim() || '暂未维护报表介绍';
                return (
                  <label
                    key={report.reportId}
                    className={`role-picker-item${alreadyAdded ? ' is-added' : ''}${checked ? ' is-selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      disabled={alreadyAdded}
                      checked={alreadyAdded || checked}
                      onChange={() => toggleOne(report.reportId)}
                    />
                    <span className={`role-node-icon tone-${themeFor(report.reportType)}`}>
                      <ReportTypeIcon type={report.reportType} />
                    </span>
                    <span className="role-picker-copy">
                      <strong>{highlight(report.reportName)}</strong>
                      <small title={description}>{highlight(description)}</small>
                    </span>
                    <span className={`role-type-pill tone-${themeFor(report.reportType)}`}>
                      {typeLabel[report.reportType]}
                    </span>
                    {alreadyAdded && (
                      <span className="role-added-tag">
                        <CheckCircle2 size={13} />
                        已添加
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="role-picker-empty">
              {availableReports.length === 0
                ? '该角色在底表中暂无可配置的报表，请先确认角色-报表底表数据。'
                : '没有匹配条件的报表，请尝试其他关键词。'}
            </div>
          )}
        </ScrollArea>
      </div>
    </Modal>
  );
}
