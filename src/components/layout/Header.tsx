"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import SearchBox from "@/components/search/SearchBox";

interface HeaderProps {
  searchKeyword: string;
  onSearchChange: (value: string) => void;
}

export default function Header({ searchKeyword, onSearchChange }: HeaderProps) {
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo和标题 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
          >
            <div className="relative w-[120px] h-[80px]">
              <Image
                src="/assets/logo.png"
                alt="云南白药"
                fill
                className="object-contain"
                unoptimized
                onError={(e) => {
                  // 图片加载失败时的降级处理
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                云南白药集团 · 数据门户
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                数据驱动经营 · 智慧赋能决策
              </p>
            </div>
          </motion.div>

          {/* 搜索框和按钮 */}
          <div className="flex items-center gap-4">
            <SearchBox
              searchKeyword={searchKeyword}
              onSearchChange={onSearchChange}
            />

            <Link
              href="/report-dictionary"
              className="px-6 py-2.5 border-2 border-blue-500 text-blue-500 rounded-full hover:bg-blue-50 transition-all font-medium hover:scale-105"
            >
              报表字典
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
