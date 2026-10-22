"use client";

import { Bell } from "lucide-react";
import { RESPONSIVE_SIZES } from "@/lib/responsive";

const NOTICE_DATA = [
  {
    id: 1,
    title: "关于规范数据填报流程的通知",
    category: "管理办法",
    date: "2026-09-01",
    isPinned: true
  },
  {
    id: 2,
    title: "数据安全管理制度（2026年修订版）",
    category: "管理办法",
    date: "2026-08-28",
    isPinned: true
  },
  {
    id: 3,
    title: "9月份经营数据分析会议通知",
    category: "通知",
    date: "2026-08-25",
    isPinned: false
  },
  {
    id: 4,
    title: "数据门户系统升级维护公告",
    category: "通知",
    date: "2026-08-20",
    isPinned: false
  },
  {
    id: 5,
    title: "关于开展数据质量专项检查的通知",
    category: "通知",
    date: "2026-08-15",
    isPinned: false
  }
];

export default function NoticeModule() {
  return (
    <div
      className="bg-white"
      style={{
        width: RESPONSIVE_SIZES.notice.width,
        height: RESPONSIVE_SIZES.notice.height,
        padding: RESPONSIVE_SIZES.modulePadding,
        borderRadius: RESPONSIVE_SIZES.borderRadius.lg,
        border: "1px solid rgba(255, 255, 255, 0.9)",
        boxShadow: "0 8px 24px -4px rgba(29, 99, 255, 0.05)"
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: RESPONSIVE_SIZES.headerMarginBottom }}
      >
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#1D63FF]" />
          <h2
            className="font-bold text-[#1D2129]"
            style={{ fontSize: RESPONSIVE_SIZES.fontSize.lg }}
          >
            制度公告
          </h2>
        </div>
        <span
          className="text-[#86909C] cursor-pointer hover:text-[#1D63FF]"
          style={{ fontSize: RESPONSIVE_SIZES.fontSize.sm }}
        >
          更多 &gt;&gt;
        </span>
      </div>

      {/* 列表 */}
      <div className="divide-y divide-slate-100">
        {NOTICE_DATA.map((item) => (
          <div
            key={item.id}
            className="py-3 first:pt-0 last:pb-0 flex items-start gap-3 cursor-pointer hover:bg-slate-50/50 -mx-2 px-2 rounded transition-colors"
          >
            {/* 左侧蓝点 */}
            <div
              className="rounded-full bg-[#1D63FF] mt-1.5 flex-shrink-0"
              style={{
                width: RESPONSIVE_SIZES.fontSize.xs,
                height: RESPONSIVE_SIZES.fontSize.xs
              }}
            />

            {/* 中间内容 */}
            <div className="flex-1 min-w-0">
              <h3
                className="font-medium text-[#1D2129] truncate"
                style={{ fontSize: RESPONSIVE_SIZES.fontSize.base }}
              >
                {item.title}
              </h3>
              <p
                className="text-[#86909C] mt-1"
                style={{ fontSize: RESPONSIVE_SIZES.fontSize.xs }}
              >
                {item.category}
              </p>
            </div>

            {/* 右侧日期与标签 */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span
                className="text-[#86909C]"
                style={{ fontSize: RESPONSIVE_SIZES.fontSize.sm }}
              >
                {item.date}
              </span>
              {item.isPinned && (
                <span
                  className="bg-[#FFECE8] text-[#F53F3F] px-1.5 py-0.5 rounded"
                  style={{ fontSize: RESPONSIVE_SIZES.fontSize.xs }}
                >
                  置顶
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
