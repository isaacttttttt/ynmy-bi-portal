"use client";

import { useState, useRef, useEffect } from "react";
import { Input, Tabs } from "antd";
import { SearchOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface SearchBoxProps {
  searchKeyword: string;
  onSearchChange: (value: string) => void;
}

interface SearchHistoryItem {
  text: string;
  count: number;
  lastSearch: string;
}

export default function SearchBox({ searchKeyword, onSearchChange }: SearchBoxProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [activeTab, setActiveTab] = useState("report");
  const searchRef = useRef<HTMLDivElement>(null);

  // Mock搜索历史和推荐数据
  const searchHistory: SearchHistoryItem[] = [
    { text: "集团经营分析", count: 25, lastSearch: "2小时前" },
    { text: "应收账款", count: 18, lastSearch: "昨天" },
    { text: "库存周转", count: 15, lastSearch: "3天前" },
    { text: "销售达成率", count: 12, lastSearch: "1周前" },
    { text: "资金日报", count: 10, lastSearch: "2周前" },
  ];

  const reportSuggestions = [
    "集团经营分析总览驾驶舱",
    "财务共享中心月度报表",
    "库存周转分析",
    "应收账款分析报表",
  ];

  const tagSuggestions = [
    "驾驶舱",
    "财务分析",
    "供应链",
    "销售分析",
  ];

  const metricSuggestions = [
    "终端销售",
    "数据质量",
    "商业库存",
    "达成率",
  ];

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    <div ref={searchRef} className="relative w-[500px]">
      <Input
        size="large"
        placeholder="输入报表名称、回车检索"
        prefix={<SearchOutlined className="text-blue-400" />}
        value={searchKeyword}
        onChange={(e) => onSearchChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        className="rounded-full shadow-sm hover:shadow-md transition-shadow"
      />

      {/* 搜索下拉面板 */}
      <AnimatePresence>
        {isFocused && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50"
          >
            {/* 历史搜索 */}
            {!searchKeyword && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <ClockCircleOutlined className="text-blue-500" />
                    历史搜索 · 报表
                  </h3>
                  <button className="text-xs text-gray-400 hover:text-gray-600">
                    清空
                  </button>
                </div>
                <div className="space-y-2">
                  {searchHistory.map((item, index) => (
                    <motion.div
                      key={index}
                      whileHover={{ x: 4 }}
                      onClick={() => onSearchChange(item.text)}
                      className="flex items-center justify-between p-2 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <SearchOutlined className="text-gray-400" />
                        <span className="text-sm text-gray-700">{item.text}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{item.count}次</span>
                        <span>{item.lastSearch}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* 搜索结果分类 */}
            {searchKeyword && (
              <div className="p-4">
                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  items={[
                    { key: "report", label: `报表 (${reportSuggestions.length})` },
                    { key: "tag", label: `标签 (${tagSuggestions.length})` },
                    { key: "metric", label: `指标 (${metricSuggestions.length})` },
                  ]}
                  className="search-tabs"
                />

                {/* 报表结果 */}
                {activeTab === "report" && (
                  <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto">
                    {reportSuggestions.map((item, index) => (
                      <motion.div
                        key={index}
                        whileHover={{ x: 4 }}
                        onClick={() => {
                          onSearchChange(item);
                          setIsFocused(false);
                        }}
                        className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span className="text-blue-600 text-lg">📊</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-800">
                              {highlightText(item, searchKeyword)}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              驾驶舱 · 集团经营专题
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* 标签结果 */}
                {activeTab === "tag" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {tagSuggestions.map((tag, index) => (
                      <motion.div
                        key={index}
                        whileHover={{ scale: 1.05 }}
                        onClick={() => {
                          onSearchChange(tag);
                          setIsFocused(false);
                        }}
                        className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full cursor-pointer hover:bg-blue-100 transition-colors"
                      >
                        <span className="text-sm">
                          {highlightText(tag, searchKeyword)}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* 指标结果 */}
                {activeTab === "metric" && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {metricSuggestions.map((metric, index) => (
                      <motion.div
                        key={index}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => {
                          onSearchChange(metric);
                          setIsFocused(false);
                        }}
                        className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
                            <span className="text-xs">📈</span>
                          </div>
                          <span className="text-sm text-gray-700">
                            {highlightText(metric, searchKeyword)}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 猜你想搜 */}
            {!searchKeyword && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  猜你想搜 · 报表
                </h3>
                <div className="flex flex-wrap gap-2">
                  {["集团经营分析", "应收账款", "库存周转", "销售达成率"].map(
                    (tag, index) => (
                      <div
                        key={index}
                        onClick={() => onSearchChange(tag)}
                        className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full cursor-pointer hover:bg-blue-100 hover:text-blue-600 transition-colors"
                      >
                        {tag}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
