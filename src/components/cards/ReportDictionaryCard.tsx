"use client";

import { cn } from "@/lib/utils";
import { Clock, User, Database, TrendingUp } from "lucide-react";

interface ReportDictionaryCardProps {
  report: {
    id: string;
    name: string;
    type: "dashboard" | "report" | "form";
    description?: string;
    module: string;
    owner: string;
    updateFrequency: string;
    totalViews: number;
    metrics?: string[];
    status: "active" | "archived";
  };
  viewMode: "grid" | "list";
  searchKeyword?: string;
}

const typeConfig = {
  dashboard: { label: "驾驶舱", color: "bg-blue-100 text-blue-700" },
  report: { label: "报表", color: "bg-green-100 text-green-700" },
  form: { label: "填报", color: "bg-purple-100 text-purple-700" },
};

export default function ReportDictionaryCard({
  report,
  viewMode,
  searchKeyword = "",
}: ReportDictionaryCardProps) {
  const highlightText = (text: string, keyword: string) => {
    if (!keyword) return text;
    const parts = text.split(new RegExp(`(${keyword})`, "gi"));
    return parts.map((part, index) =>
      part.toLowerCase() === keyword.toLowerCase() ? (
        <span key={index} className="bg-yellow-200 text-red-600 font-semibold">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  if (viewMode === "list") {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer">
        <div className="flex items-start gap-4">
          {/* 左侧图标 */}
          <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center">
            <span className="text-2xl">📊</span>
          </div>

          {/* 中间内容 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-base font-semibold text-gray-800">
                {highlightText(report.name, searchKeyword)}
              </h3>
              <span
                className={cn(
                  "px-2 py-0.5 text-xs rounded",
                  typeConfig[report.type].color
                )}
              >
                {typeConfig[report.type].label}
              </span>
              {report.status === "archived" && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                  已归档
                </span>
              )}
            </div>

            {report.description && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {report.description}
              </p>
            )}

            {report.metrics && report.metrics.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                <span className="text-xs text-gray-500">核心指标：</span>
                {report.metrics.slice(0, 4).map((metric, index) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded"
                  >
                    {metric}
                  </span>
                ))}
                {report.metrics.length > 4 && (
                  <span className="text-xs text-gray-400">
                    +{report.metrics.length - 4}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>{report.owner}</span>
              </div>
              <div className="flex items-center gap-1">
                <Database className="w-3 h-3" />
                <span>{report.module}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{report.updateFrequency}</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>{report.totalViews.toLocaleString()} 次访问</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer">
      {/* 类型标签 */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={cn(
            "px-2 py-1 text-xs rounded font-medium",
            typeConfig[report.type].color
          )}
        >
          {typeConfig[report.type].label}
        </span>
        {report.status === "archived" && (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
            已归档
          </span>
        )}
      </div>

      {/* 标题 */}
      <h3 className="text-sm font-semibold text-gray-800 mb-2 line-clamp-2 min-h-[40px]">
        {highlightText(report.name, searchKeyword)}
      </h3>

      {/* 描述 */}
      {report.description && (
        <p className="text-xs text-gray-600 mb-3 line-clamp-3 min-h-[48px]">
          {report.description}
        </p>
      )}

      {/* 核心指标 */}
      {report.metrics && report.metrics.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">核心指标：</p>
          <div className="flex flex-wrap gap-1">
            {report.metrics.slice(0, 3).map((metric, index) => (
              <span
                key={index}
                className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded"
              >
                {metric}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 底部信息 */}
      <div className="space-y-2 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {report.owner}
          </span>
          <span>{report.updateFrequency}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">{report.module}</span>
          <span className="text-blue-600 font-medium">
            {report.totalViews.toLocaleString()} 次
          </span>
        </div>
      </div>
    </div>
  );
}
