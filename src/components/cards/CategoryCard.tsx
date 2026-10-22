"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CategoryCardProps {
  category: {
    id: string;
    name: string;
    type: "folder" | "dashboard";
    icon?: string;
    reportCount?: number;
  };
  searchKeyword?: string;
  onClick?: () => void;
}

export default function CategoryCard({ category, searchKeyword = "", onClick }: CategoryCardProps) {
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
      onClick={onClick}
      className={cn(
        "relative group cursor-pointer rounded-xl overflow-hidden",
        "bg-gradient-to-br from-blue-500/10 via-blue-400/5 to-transparent",
        "border-2 border-blue-200/30",
        "hover:shadow-lg transition-all duration-200"
      )}
    >
      {/* 背景 */}
      <div className="absolute inset-0 bg-white/60 backdrop-blur-md"></div>

      {/* 内容 */}
      <div className="relative z-10 p-6 flex flex-col items-center text-center h-full">
        {/* 图标 */}
        <div className="flex items-center justify-center w-16 h-16 mb-3 bg-gradient-to-br from-blue-500/20 to-blue-400/10 rounded-2xl">
          <span className="text-4xl">
            {category.type === "folder" ? "📁" : "🎯"}
          </span>
        </div>

        {/* 分类名称 */}
        <h3 className="text-base font-semibold text-gray-800 mb-2">
          {highlightText(category.name, searchKeyword)}
        </h3>

        {/* 报表数量 */}
        {category.reportCount !== undefined && (
          <p className="text-sm text-gray-500">
            {category.reportCount} 个报表
          </p>
        )}

        {/* 类型标识 */}
        <div className="mt-auto pt-3">
          <span className="px-3 py-1 bg-blue-100/80 text-blue-700 text-xs rounded-full">
            {category.type === "folder" ? "文件夹" : "驾驶舱"}
          </span>
        </div>
      </div>

      {/* Hover光晕 */}
      <motion.div
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="absolute inset-0 bg-blue-500/5 pointer-events-none"
      />
    </motion.div>
  );
}
