"use client";

import { useState } from "react";
import { Tabs } from "antd";
import { motion } from "framer-motion";
import ReportCard from "@/components/cards/ReportCard";
import { mockWorkbenchData } from "@/lib/mockData";
import { cn } from "@/lib/utils";

interface WorkbenchSectionProps {
  searchKeyword: string;
}

export default function WorkbenchSection({ searchKeyword }: WorkbenchSectionProps) {
  const [activeTab, setActiveTab] = useState("recent");

  const tabs = [
    { key: "recent", label: "最近打开" },
    { key: "frequent", label: "我常用的" },
    { key: "favorite", label: "我收藏的" },
  ];

  const currentData =
    activeTab === "recent" ? mockWorkbenchData.recent :
    activeTab === "frequent" ? mockWorkbenchData.frequent :
    mockWorkbenchData.favorite;

  return (
    <section className="bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-gray-100 flex flex-col" style={{ height: '625px' }}>
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
          <h2 className="text-xl font-bold text-gray-800">我的工作台</h2>
        </div>

        {/* 自定义Tab切换 */}
        <div className="flex items-center gap-2 bg-gray-100/80 rounded-full p-1 flex-shrink-0">
          {tabs.map((tab) => (
            <motion.button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "relative px-6 py-2 rounded-full text-sm font-medium transition-all duration-300",
                activeTab === tab.key
                  ? "text-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* 选中背景 */}
              {activeTab === tab.key && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-white rounded-full shadow-sm"
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 30,
                  }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* 卡片网格 - 4列对齐，滚动容器 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="grid grid-cols-4 gap-4">
          {currentData.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            searchKeyword={searchKeyword}
          />
          ))}
        </div>

        {currentData.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">📊</div>
            <p>暂无数据</p>
          </div>
        )}
      </div>
    </section>
  );
}
