"use client";

import { Zap, ChevronRight } from "lucide-react";
import Image from "next/image";
import { RESPONSIVE_SIZES } from "@/lib/responsive";

const QUICK_ENTRY_DATA = [
  {
    id: 1,
    icon: "/assets/图标_综合_1@2x.png",
    title: "数据填报",
    description: "进入数据填报系统",
    link: "/data-entry"
  },
  {
    id: 2,
    icon: "/assets/图标_综合_2@2x.png",
    title: "报表申请",
    description: "提交新报表需求",
    link: "/report-request"
  },
  {
    id: 3,
    icon: "/assets/图标_综合_3@2x.png",
    title: "数据服务",
    description: "API接口文档",
    link: "/data-service"
  },
  {
    id: 4,
    icon: "/assets/icon_blue.png",
    title: "帮助中心",
    description: "使用指南与FAQ",
    link: "/help-center"
  },
  {
    id: 5,
    icon: "/assets/icon_blue.png",
    title: "系统设置",
    description: "个人偏好配置",
    link: "/settings"
  }
];

export default function QuickEntryModule() {
  return (
    <div
      className="bg-white"
      style={{
        width: RESPONSIVE_SIZES.quickEntry.width,
        height: RESPONSIVE_SIZES.quickEntry.height,
        padding: RESPONSIVE_SIZES.modulePadding,
        borderRadius: RESPONSIVE_SIZES.borderRadius.lg,
        border: "1px solid rgba(255, 255, 255, 0.9)",
        boxShadow: "0 8px 24px -4px rgba(29, 99, 255, 0.05)"
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2"
        style={{ marginBottom: RESPONSIVE_SIZES.headerMarginBottom }}
      >
        <Zap className="w-5 h-5 text-[#1D63FF]" />
        <h2
          className="font-bold text-[#1D2129]"
          style={{ fontSize: RESPONSIVE_SIZES.fontSize.lg }}
        >
          快捷入口
        </h2>
      </div>

      {/* 入口列表 */}
      <div style={{ display: "flex", flexDirection: "column", gap: RESPONSIVE_SIZES.componentGap }}>
        {QUICK_ENTRY_DATA.map((item) => (
          <div
            key={item.id}
            className="bg-[#F5F8FF] hover:bg-[#EBF2FF] rounded-xl px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition-colors"
            style={{
              border: "1px solid #DDEEFF"
            }}
          >
            {/* 左侧图标 */}
            <div className="relative flex-shrink-0" style={{ width: RESPONSIVE_SIZES.iconSize.sm, height: RESPONSIVE_SIZES.iconSize.sm }}>
              <Image
                src={item.icon}
                alt={item.title}
                width={28}
                height={28}
                className="object-contain"
              />
            </div>

            {/* 中间标题 */}
            <div className="ml-2.5 flex-shrink-0" style={{ width: "5rem" }}>
              <h3
                className="font-bold text-[#1D2129]"
                style={{ fontSize: RESPONSIVE_SIZES.fontSize.base }}
              >
                {item.title}
              </h3>
            </div>

            {/* 右侧描述 */}
            <div className="flex-1 min-w-0">
              <p
                className="text-[#86909C] truncate"
                style={{ fontSize: RESPONSIVE_SIZES.fontSize.sm }}
              >
                {item.description}
              </p>
            </div>

            {/* 右箭头 */}
            <div className="w-5 h-5 rounded bg-[#D4E4FF] text-[#1D63FF] flex items-center justify-center flex-shrink-0 ml-2">
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
