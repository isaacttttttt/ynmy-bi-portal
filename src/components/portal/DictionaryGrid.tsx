"use client";

import { Grid3x3 } from "lucide-react";
import DictionaryCard from "./DictionaryCard";

interface DictionaryGridProps {
  searchKeyword: string;
  viewMode: "grid" | "list";
}

const DICTIONARY_DATA = [
  {
    id: 1,
    icon: "/assets/指标卡背景_1@2x.png",
    status: "在用",
    theme: "blue" as const,
    title: "临床纯销驾驶舱",
    description: "实时展示临床事业群各产品线的纯销数据、市场占有率、库存周转等核心经营指标",
    department: "临床一部",
    frequency: "实时",
    owner: "张三",
    dataSource: "分销系统（营销）",
    businessTags: ["纯销分析", "库存监控", "市场份额", "经营分析"]
  },
  {
    id: 2,
    icon: "/assets/指标卡背景_2@2x.png",
    status: "在用",
    theme: "teal" as const,
    title: "实时流向报表",
    description: "追踪产品从经销商到终端的全链路流向数据，支持按产品、区域、时间多维度钻取分析",
    department: "临床二部",
    frequency: "实时",
    owner: "李四",
    dataSource: "流向平台",
    businessTags: ["流向追踪", "渠道分析", "终端覆盖"]
  },
  {
    id: 3,
    icon: "/assets/指标卡背景_3@2x.png",
    status: "在用",
    theme: "purple" as const,
    title: "DMS库存填报",
    description: "商业公司月度库存数据填报系统，自动校验数据合规性并生成库存健康度分析报告",
    department: "临床一部",
    frequency: "月报",
    owner: "王五",
    dataSource: "DMS系统",
    businessTags: ["库存填报", "数据校验", "健康度分析"]
  },
  {
    id: 4,
    icon: "/assets/指标卡背景_4@2x.png",
    status: "在用",
    theme: "blue" as const,
    title: "健康品经营分析",
    description: "健康品事业群整体经营状况看板，覆盖销售、毛利、费用、客户等核心财务与业务指标",
    department: "健康品",
    frequency: "T+1",
    owner: "赵六",
    dataSource: "ERP系统",
    businessTags: ["经营分析", "财务指标", "客户洞察", "费用管控"]
  },
  {
    id: 5,
    icon: "/assets/指标卡背景_5@2x.png",
    status: "在用",
    theme: "teal" as const,
    title: "商业纯销报表",
    description: "按商业公司统计的终端纯销数据，支持日、周、月多时间粒度查询与同环比分析",
    department: "临床二部",
    frequency: "T+1",
    owner: "孙七",
    dataSource: "分销系统（营销）",
    businessTags: ["纯销统计", "商业分析", "趋势对比"]
  },
  {
    id: 6,
    icon: "/assets/指标卡背景_6@2x.png",
    status: "在用",
    theme: "purple" as const,
    title: "终端动销填报",
    description: "零售终端（药店/医院）的销售数据填报与审核系统，自动生成动销率与铺货率分析",
    department: "药品零售",
    frequency: "周报",
    owner: "周八",
    dataSource: "零售管理系统",
    businessTags: ["终端填报", "动销分析", "铺货监控"]
  }
];

export default function DictionaryGrid({ searchKeyword, viewMode }: DictionaryGridProps) {
  const filteredData = searchKeyword
    ? DICTIONARY_DATA.filter(
        (item) =>
          item.title.includes(searchKeyword) ||
          item.description.includes(searchKeyword) ||
          item.businessTags.some((tag) => tag.includes(searchKeyword))
      )
    : DICTIONARY_DATA;

  return (
    <div
      className="bg-white/88 backdrop-blur-md rounded-2xl p-5"
      style={{
        border: "1px solid rgba(255, 255, 255, 0.9)",
        boxShadow: "0 8px 24px -4px rgba(29, 99, 255, 0.05)"
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Grid3x3 className="w-5 h-5 text-[#1D63FF]" />
        <h2 className="text-[16px] font-bold text-[#1D2129]">报表字典</h2>
      </div>

      {/* 字典卡片网格 */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-3 gap-5">
          {filteredData.map((item) => (
            <DictionaryCard key={item.id} {...item} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredData.map((item) => (
            <DictionaryCard key={item.id} {...item} listMode />
          ))}
        </div>
      )}
    </div>
  );
}
