"use client";

import { useState } from "react";
import CategoryCard from "@/components/cards/CategoryCard";
import { mockThematicData } from "@/lib/mockData";

interface ThematicAnalysisSectionProps {
  searchKeyword: string;
}

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export default function ThematicAnalysisSection({ searchKeyword }: ThematicAnalysisSectionProps) {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: "根目录" }
  ]);

  // 获取当前层级数据
  const getCurrentData = () => {
    const currentId = breadcrumbs[breadcrumbs.length - 1].id;
    const key = currentId || "root";
    return mockThematicData[key] || [];
  };

  const handleCategoryClick = (category: any) => {
    if (category.type === "folder") {
      // 文件夹，进行下钻
      setBreadcrumbs([...breadcrumbs, { id: category.id, name: category.name }]);
    } else {
      // 驾驶舱，打开报表
      console.log("打开驾驶舱:", category.name);
      // 这里应该调用帆软平台的API打开报表
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  const currentData = getCurrentData();

  return (
    <section className="bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-gray-100 flex flex-col" style={{ height: '450px' }}>
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
          <h2 className="text-xl font-bold text-gray-800">专题分析</h2>
        </div>
        <button className="text-blue-500 text-sm hover:text-blue-600 transition-colors">
          健康品事业群
        </button>
      </div>

      {/* 面包屑导航 - 左对齐 */}
      {breadcrumbs.length > 1 && (
        <div className="mb-4 flex items-center gap-2 text-sm flex-shrink-0">
          {breadcrumbs.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && <span className="text-gray-400">/</span>}
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className={`${
                  index === breadcrumbs.length - 1
                    ? "text-gray-800 font-medium"
                    : "text-blue-500 hover:text-blue-600"
                } transition-colors`}
              >
                {item.name}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 卡片网格 - 3列对齐，固定高度，滚动 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="grid grid-cols-3 gap-4">
          {currentData.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              searchKeyword={searchKeyword}
              onClick={() => handleCategoryClick(category)}
            />
          ))}
        </div>

        {currentData.length === 0 && (
          <div className="text-center py-16 text-gray-400 flex flex-col items-center justify-center h-full">
            <div className="text-5xl mb-4">📁</div>
            <p>暂无子目录</p>
          </div>
        )}
      </div>
    </section>
  );
}
