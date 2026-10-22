"use client";

import { Filter } from "lucide-react";
import { useState } from "react";

interface FilterOption {
  label: string;
  count: number;
  checked: boolean;
}

interface FilterGroup {
  title: string;
  options: FilterOption[];
}

export default function FilterSidebar() {
  const [filters, setFilters] = useState<Record<string, FilterGroup>>({
    businessModule: {
      title: "业务模块",
      options: [
        { label: "临床一部", count: 38, checked: true },
        { label: "临床二部", count: 26, checked: false },
        { label: "健康品", count: 45, checked: true },
        { label: "药品零售", count: 31, checked: false }
      ]
    },
    reportStatus: {
      title: "报表状态",
      options: [
        { label: "在用", count: 189, checked: true },
        { label: "停用", count: 12, checked: false },
        { label: "开发中", count: 8, checked: false }
      ]
    },
    dataTimeliness: {
      title: "数据时效",
      options: [
        { label: "实时", count: 45, checked: false },
        { label: "T+1", count: 98, checked: false },
        { label: "周报", count: 32, checked: false },
        { label: "月报", count: 64, checked: false }
      ]
    },
    accessVolume: {
      title: "访问量级",
      options: [
        { label: "高频 (>100/天)", count: 23, checked: false },
        { label: "中频 (20-100/天)", count: 67, checked: false },
        { label: "低频 (<20/天)", count: 99, checked: false }
      ]
    }
  });

  const handleReset = () => {
    const resetFilters = Object.entries(filters).reduce(
      (acc, [key, group]) => ({
        ...acc,
        [key]: {
          ...group,
          options: group.options.map((opt) => ({ ...opt, checked: false }))
        }
      }),
      {}
    );
    setFilters(resetFilters);
  };

  const handleToggleOption = (groupKey: string, optionIndex: number) => {
    setFilters((prev) => ({
      ...prev,
      [groupKey]: {
        ...prev[groupKey],
        options: prev[groupKey].options.map((opt, idx) =>
          idx === optionIndex ? { ...opt, checked: !opt.checked } : opt
        )
      }
    }));
  };

  return (
    <div
      className="bg-white/88 backdrop-blur-md rounded-2xl p-5"
      style={{
        border: "1px solid rgba(255, 255, 255, 0.9)",
        boxShadow: "0 8px 24px -4px rgba(29, 99, 255, 0.05)"
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#1D63FF]" />
          <h2 className="text-[15px] font-bold text-[#1D2129]">筛选条件</h2>
        </div>
        <button
          onClick={handleReset}
          className="bg-[#1D63FF] text-white text-xs px-2.5 py-1 rounded-full hover:bg-[#1557E6] transition-colors"
        >
          重置筛选
        </button>
      </div>

      {/* 筛选分组 */}
      <div className="space-y-3">
        {Object.entries(filters).map(([key, group], groupIndex) => (
          <div
            key={key}
            className={`${
              groupIndex < Object.keys(filters).length - 1
                ? "border-b border-slate-100 pb-3"
                : ""
            }`}
          >
            <h3 className="text-xs font-bold text-[#4E5969] mb-2">{group.title}</h3>
            <div className="space-y-1">
              {group.options.map((option, optionIndex) => (
                <label
                  key={optionIndex}
                  className="flex items-center justify-between py-1 cursor-pointer hover:bg-slate-50/50 -mx-2 px-2 rounded transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={option.checked}
                      onChange={() => handleToggleOption(key, optionIndex)}
                      className="w-3.5 h-3.5 rounded border-2 border-[#1D63FF] text-[#1D63FF] focus:ring-[#1D63FF] focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-[13px] text-[#1D2129]">{option.label}</span>
                  </div>
                  <span className="text-xs text-[#86909C]">{option.count}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
