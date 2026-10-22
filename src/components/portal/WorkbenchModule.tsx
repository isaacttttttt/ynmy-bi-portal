"use client";

import { Grid3x3 } from "lucide-react";
import ReportCard from "./ReportCard";
import { RESPONSIVE_SIZES } from "@/lib/responsive";

interface WorkbenchModuleProps {
  searchKeyword: string;
}

const WORKBENCH_DATA = [
  {
    id: 1,
    icon: "/assets/驾驶舱.png",
    category: "驾驶舱",
    theme: "blue" as const,
    title: "临床纯销驾驶舱",
    subtitle: "实时经营分析看板",
    updateTime: "2小时前",
    updateLabel: "最近打开"
  },
  {
    id: 2,
    icon: "/assets/报表.png",
    category: "报表",
    theme: "teal" as const,
    title: "实时流向报表",
    subtitle: "下游客户流向明细",
    updateTime: "昨天 16:32",
    updateLabel: "最近打开"
  },
  {
    id: 3,
    icon: "/assets/填报.png",
    category: "填报",
    theme: "purple" as const,
    title: "DMS库存填报",
    subtitle: "商业公司月度库存",
    updateTime: "2026-09-18",
    updateLabel: "最近打开"
  },
  {
    id: 4,
    icon: "/assets/驾驶舱.png",
    category: "驾驶舱",
    theme: "blue" as const,
    title: "健康品经营分析",
    subtitle: "健康品事业群",
    updateTime: "2026-09-17",
    updateLabel: "最近打开"
  },
  {
    id: 5,
    icon: "/assets/报表.png",
    category: "报表",
    theme: "teal" as const,
    title: "商业纯销报表",
    subtitle: "终端销售数据",
    updateTime: "2026-09-16",
    updateLabel: "最近打开"
  },
  {
    id: 6,
    icon: "/assets/填报.png",
    category: "填报",
    theme: "purple" as const,
    title: "终端动销填报",
    subtitle: "门店销售明细",
    updateTime: "2026-09-15",
    updateLabel: "最近打开"
  },
  {
    id: 7,
    icon: "/assets/驾驶舱.png",
    category: "驾驶舱",
    theme: "blue" as const,
    title: "区域销售仪表盘",
    subtitle: "区域业绩对比",
    updateTime: "2026-09-14",
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
  const filteredData = searchKeyword
    ? WORKBENCH_DATA.filter(
        (item) =>
          item.title.includes(searchKeyword) ||
          item.subtitle.includes(searchKeyword) ||
          item.category.includes(searchKeyword)
      )
    : WORKBENCH_DATA;

  return (
    <div
      className="bg-white"
      style={{
        width: RESPONSIVE_SIZES.workbench.width,
        height: RESPONSIVE_SIZES.workbench.height,
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
          <Grid3x3 className="w-5 h-5 text-[#1D63FF]" />
          <h2 className="font-bold text-[#1D2129]" style={{ fontSize: RESPONSIVE_SIZES.fontSize.lg }}>
            我的工作台
          </h2>
        </div>

        {/* 分段控制器 */}
        <div className="flex items-center gap-1 bg-[#EEF3FA] rounded-full p-1">
          <button className="px-3.5 py-1 bg-white text-[#1D63FF] font-medium rounded-full shadow-sm" style={{ fontSize: RESPONSIVE_SIZES.fontSize.sm }}>
            最近打开
          </button>
          <button className="px-3.5 py-1 text-[#86909C] rounded-full hover:text-[#1D2129]" style={{ fontSize: RESPONSIVE_SIZES.fontSize.sm }}>
            我常用的
          </button>
          <button className="px-3.5 py-1 text-[#86909C] rounded-full hover:text-[#1D2129]" style={{ fontSize: RESPONSIVE_SIZES.fontSize.sm }}>
            我收藏的
          </button>
        </div>
      </div>

      {/* 卡片网格 */}
      <div
        className="grid grid-cols-4"
        style={{ gap: RESPONSIVE_SIZES.componentGap }}
      >
        {filteredData.map((item) => (
          <ReportCard key={item.id} {...item} />
        ))}
      </div>
    </div>
  );
}
