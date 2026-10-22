"use client";

import { useState } from "react";
import { Search, BookOpen, Grid3x3, List } from "lucide-react";
import Image from "next/image";

interface PortalHeaderProps {
  title: string;
  subtitle: string;
  onSearch: (keyword: string) => void;
  showViewToggle?: boolean;
  viewMode?: "grid" | "list";
  onViewModeChange?: (mode: "grid" | "list") => void;
  onNavigateToDictionary?: () => void;
  onNavigateToHome?: () => void;
}

export default function PortalHeader({
  title,
  subtitle,
  onSearch,
  showViewToggle = false,
  viewMode = "grid",
  onViewModeChange,
  onNavigateToDictionary,
  onNavigateToHome
}: PortalHeaderProps) {
  const [searchInput, setSearchInput] = useState("");

  const handleSearch = () => {
    onSearch(searchInput);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleLogoClick = () => {
    if (onNavigateToHome) {
      onNavigateToHome();
    }
  };

  return (
    <header className="h-[136px] flex flex-col justify-between py-5">
      {/* 顶部品牌区 */}
      <div className="flex items-center">
        <div
          className="flex items-center cursor-pointer"
          onClick={handleLogoClick}
        >
          <Image
            src="/assets/company_title.png"
            alt="云南白药"
            width={48}
            height={48}
            className="object-contain"
          />
          <div className="h-7 w-[1px] bg-slate-300 mx-4" />
          <div>
            <h1 className="text-[22px] font-bold text-[#1D2129] tracking-wide">
              {title}
            </h1>
            <p className="text-[12px] text-[#4E5969] tracking-[0.25em] mt-1">
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* 搜索栏与按钮 */}
      <div className="flex items-center justify-center gap-3">
        {/* 搜索框 */}
        <div
          className="relative flex items-center bg-white rounded-full shadow-[0_4px_16px_rgba(29,99,255,0.08)]"
          style={{ width: "520px", height: "44px" }}
        >
          <Search className="absolute left-4 w-5 h-5 text-[#86909C]" />
          <input
            type="text"
            placeholder="输入报表名称，回车检索"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 px-12 text-[14px] text-[#1D2129] placeholder:text-[#86909C] bg-transparent outline-none"
          />
          <button
            onClick={handleSearch}
            className="mr-1 px-6 h-[36px] bg-gradient-to-r from-[#2B72FF] to-[#1D63FF] text-white text-[14px] font-medium rounded-full hover:shadow-md transition-all"
          >
            搜索
          </button>
        </div>

        {/* 报表字典按钮或视图切换 */}
        {!showViewToggle ? (
          <button
            onClick={onNavigateToDictionary}
            className="flex items-center gap-2 h-[44px] px-5 bg-white text-[#1D2129] font-medium rounded-full shadow-sm hover:text-[#1D63FF] transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            报表字典
          </button>
        ) : (
          <div className="flex items-center gap-1 h-[44px] bg-white rounded-full p-1 shadow-sm">
            <button
              onClick={() => onViewModeChange?.("grid")}
              className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                viewMode === "grid"
                  ? "bg-white text-[#1D63FF] shadow-sm"
                  : "text-[#86909C] hover:text-[#1D2129]"
              }`}
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange?.("list")}
              className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                viewMode === "list"
                  ? "bg-white text-[#1D63FF] shadow-sm"
                  : "text-[#86909C] hover:text-[#1D2129]"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
