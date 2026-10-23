"use client";

import { useState } from "react";
import { Grid3x3 } from "lucide-react";
import ReportCard from "./ReportCard";

interface WorkbenchModuleProps {
  searchKeyword: string;
}

type TabType = "recent" | "favorite" | "collected";

const WORKBENCH_DATA = [
  {
    id: 1,
    icon: "/assets/驾驶舱.png",
    category: "驾驶舱",
    theme: "blue" as const,
    title: "临床纯销驾驶舱",
    subtitle: "实时临床业务数据监控",
    updateTime: "2小时前",
    updateLabel: "最近打开"
  },
  {
    id: 2,
    icon: "/assets/报表.png",
    category: "报表",
    theme: "teal" as const,
    title: "实时流向可视化",
    subtitle: "商品流向轨迹分析",
    updateTime: "今天 09:15",
    updateLabel: "最近打开"
  },
  {
    id: 3,
    icon: "/assets/填报.png",
    category: "填报",
    theme: "purple" as const,
    title: "DMS库存填报",
    subtitle: "库存数据填报系统",
    updateTime: "昨天 16:32",
    updateLabel: "最近打开"
  },
  {
    id: 4,
    icon: "/assets/驾驶舱.png",
    category: "驾驶舱",
    theme: "blue" as const,
    title: "经营分析驾驶舱",
    subtitle: "全局经营指标监控",
    updateTime: "昨天 14:20",
    updateLabel: "最近打开"
  },
  {
    id: 5,
    icon: "/assets/报表.png",
    category: "报表",
    theme: "teal" as const,
    title: "销售业绩报表",
    subtitle: "销售数据统计分析",
    updateTime: "2026-09-12",
    updateLabel: "最近打开"
  },
  {
    id: 6,
    icon: "/assets/填报.png",
    category: "填报",
    theme: "purple" as const,
    title: "费用填报",
    subtitle: "费用报销填报系统",
    updateTime: "2026-09-12",
    updateLabel: "最近打开"
  },
  {
    id: 7,
    icon: "/assets/驾驶舱.png",
    category: "驾驶舱",
    theme: "blue" as const,
    title: "供应链驾驶舱",
    subtitle: "供应链全流程监控",
    updateTime: "2026-09-13",
    updateLabel: "最近打开"
  },
  {
    id: 8,
    icon: "/assets/报表.png",
    category: "报表",
    theme: "teal" as const,
    title: "库存周转分析",
    subtitle: "库存健康度监控",
    updateTime: "2026-09-13",
    updateLabel: "最近打开"
  }
];

export default function WorkbenchModule({ searchKeyword }: WorkbenchModuleProps) {
  const [activeTab, setActiveTab] = useState<TabType>("recent");

  const filteredData = searchKeyword
    ? WORKBENCH_DATA.filter(
        (item) =>
          item.title.includes(searchKeyword) ||
          item.subtitle.includes(searchKeyword) ||
          item.category.includes(searchKeyword)
      )
    : WORKBENCH_DATA;

  return (
    <div className="bg-white/88 backdrop-blur-md rounded-fluid-lg p-module border border-white/90 shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-card">
        <div className="flex items-center gap-item">
          <Grid3x3 className="w-icon-xs h-icon-xs text-[#1D63FF]" />
          <h2 className="text-md font-bold text-[#1D2129]">我的工作台</h2>
        </div>

        {/* 分段控制器 */}
        <div className="flex items-center gap-compact bg-[#EEF3FA] rounded-full p-1">
          <button
            onClick={() => setActiveTab("recent")}
            className={`px-[0.875rem] py-[0.25rem] text-xs rounded-full transition-all ${
              activeTab === "recent"
                ? "bg-white text-[#1D63FF] font-medium shadow-sm"
                : "text-[#86909C] hover:text-[#1D2129]"
            }`}
          >
            最近打开
          </button>
          <button
            onClick={() => setActiveTab("favorite")}
            className={`px-[0.875rem] py-[0.25rem] text-xs rounded-full transition-all ${
              activeTab === "favorite"
                ? "bg-white text-[#1D63FF] font-medium shadow-sm"
                : "text-[#86909C] hover:text-[#1D2129]"
            }`}
          >
            我常用的
          </button>
          <button
            onClick={() => setActiveTab("collected")}
            className={`px-[0.875rem] py-[0.25rem] text-xs rounded-full transition-all ${
              activeTab === "collected"
                ? "bg-white text-[#1D63FF] font-medium shadow-sm"
                : "text-[#86909C] hover:text-[#1D2129]"
            }`}
          >
            我收藏的
          </button>
        </div>
      </div>

      {/* 卡片网格 - 使用 Flexbox 代替 Grid */}
      <div className="flex flex-wrap gap-card">
        {filteredData.map((item) => (
          <div
            key={item.id}
            style={{
              flexBasis: "calc(25% - 0.75rem)",  /* 4列布局，减去gap */
              minWidth: "clamp(12rem, 23%, 15rem)",  /* 最小宽度防止过窄 */
            }}
          >
            <ReportCard {...item} />
          </div>
        ))}
      </div>
    </div>
  );
}
