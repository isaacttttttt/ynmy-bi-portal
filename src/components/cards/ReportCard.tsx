"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Image from "next/image";
import { useState } from "react";
import { FiClock } from "react-icons/fi";

interface ReportCardProps {
  report: {
    id: string;
    name: string;
    type: "dashboard" | "report" | "form";
    icon?: string;
    lastOpenTime?: string;
    tags?: string[];
    description?: string;
  };
  searchKeyword?: string;
  onClick?: () => void;
}

const typeStyles = {
  dashboard: {
    gradient: "from-blue-100/80 to-blue-50/80",
    border: "border-blue-200/30",
    icon: "🎯",
    label: "驾驶舱",
    tagBg: "bg-blue-100",
    tagText: "text-blue-600",
  },
  report: {
    gradient: "from-green-100/80 to-green-50/80",
    border: "border-green-200/30",
    icon: "📊",
    label: "报表",
    tagBg: "bg-green-100",
    tagText: "text-green-600",
  },
  form: {
    gradient: "from-purple-100/80 to-purple-50/80",
    border: "border-purple-200/30",
    icon: "📝",
    label: "填报",
    tagBg: "bg-purple-100",
    tagText: "text-purple-600",
  },
};

export default function ReportCard({ report, searchKeyword = "", onClick }: ReportCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const style = typeStyles[report.type];

  const highlightText = (text: string, keyword: string) => {
    if (!keyword) return text;
    const parts = text.split(new RegExp(`(${keyword})`, "gi"));
    return parts.map((part, index) =>
      part.toLowerCase() === keyword.toLowerCase() ? (
        <span key={index} className="text-red-500 font-semibold">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      style={{ width: '120%' }} // 宽度1.2倍
      className={cn(
        "relative group cursor-pointer rounded-2xl overflow-hidden",
        "bg-white/60 backdrop-blur-lg", // 玻璃效果
        "border",
        report.type === "dashboard" && "border-blue-300/60",
        report.type === "report" && "border-green-300/60",
        report.type === "form" && "border-purple-300/60",
        "hover:shadow-lg transition-all duration-200",
        "h-[175px]" // 高度增加15px
      )}
    >
      {/* 内容容器 */}
      <div className="relative z-10 p-4 h-full flex flex-col">
        {/* 顶部：左侧ICON + 右侧标签 */}
        <div className="flex items-start gap-3 mb-3">
          {/* 左侧ICON */}
          <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-white/80 rounded-xl shadow-sm">
            {report.icon ? (
              <Image
                src={report.icon}
                alt={report.name}
                width={32}
                height={32}
                className="object-contain"
                unoptimized
              />
            ) : (
              <span className="text-2xl">{style.icon}</span>
            )}
          </div>

          {/* 右侧：模板类型标签 */}
          <div className="flex-1 flex items-start">
            <span className={cn(
              "px-3 py-1 rounded-full text-xs font-medium",
              style.tagBg,
              style.tagText
            )}>
              {style.label}
            </span>
          </div>
        </div>

        {/* 报表名称 - 加粗 */}
        <h3 className="text-sm font-bold text-gray-900 line-clamp-2 mb-1">
          {highlightText(report.name, searchKeyword)}
        </h3>

        {/* 介绍文字 - 浅色，字号减小2pt */}
        <p className="text-[10px] text-gray-500 line-clamp-2 mb-3 flex-1">
          {report.description || "集团核心指标总览与趋势分析..."}
        </p>

        {/* 分割线 */}
        <div className="w-full h-px bg-gray-200 mb-2"></div>

        {/* 底部：最近打开 + 时间（左右对齐）*/}
        {report.lastOpenTime && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <FiClock className="w-3 h-3" />
              <span>最近打开</span>
            </div>
            <span className="text-blue-600 font-medium">{report.lastOpenTime}</span>
          </div>
        )}
      </div>

      {/* Hover光晕 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "absolute inset-0 pointer-events-none",
          report.type === "dashboard" && "bg-blue-500/5",
          report.type === "report" && "bg-green-500/5",
          report.type === "form" && "bg-purple-500/5"
        )}
      />
    </motion.div>
  );
}
