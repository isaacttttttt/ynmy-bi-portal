"use client";

import { Building2, Clock, User } from "lucide-react";
import Image from "next/image";
import { CardTheme } from "./ReportCard";

interface DictionaryCardProps {
  icon: string;
  status: string;
  theme: CardTheme;
  title: string;
  description: string;
  department: string;
  frequency: string;
  owner: string;
  dataSource: string;
  businessTags: string[];
  listMode?: boolean;
}

const THEME_CONFIG = {
  blue: {
    background: "linear-gradient(135deg, #EBF3FF 0%, #F7FAFF 55%, #FFFFFF 100%)",
    border: "#D8E7FF",
    sourceColor: "#1D63FF",
    tagBg: "#E6F0FF",
    tagText: "#1D63FF"
  },
  teal: {
    background: "linear-gradient(135deg, #E6FAF7 0%, #F4FFFD 55%, #FFFFFF 100%)",
    border: "#C8F2EB",
    sourceColor: "#009A84",
    tagBg: "#E0F8F4",
    tagText: "#009A84"
  },
  purple: {
    background: "linear-gradient(135deg, #F3ECFF 0%, #FAF7FF 55%, #FFFFFF 100%)",
    border: "#E4D6FF",
    sourceColor: "#722ED1",
    tagBg: "#F2EAFF",
    tagText: "#722ED1"
  },
  orange: {
    background: "linear-gradient(135deg, #FFF5E8 0%, #FFFDF9 60%, #FFFFFF 100%)",
    border: "#FFE4C4",
    sourceColor: "#D97706",
    tagBg: "#FFF4E6",
    tagText: "#D97706"
  }
};

export default function DictionaryCard({
  icon,
  status,
  theme,
  title,
  description,
  department,
  frequency,
  owner,
  dataSource,
  businessTags,
  listMode = false
}: DictionaryCardProps) {
  const config = THEME_CONFIG[theme];

  if (listMode) {
    // 列表模式（备用，当前主要使用网格模式）
    return (
      <div
        className="rounded-2xl p-5 flex items-center gap-5 cursor-pointer transition-all hover:shadow-md"
        style={{
          background: config.background,
          border: `1px solid ${config.border}`
        }}
      >
        <div className="relative w-12 h-12 flex-shrink-0">
          <Image src={icon} alt={title} width={48} height={48} className="object-contain" />
        </div>
        <div className="flex-1">
          <h3 className="text-[17px] font-bold text-[#1D2129]">{title}</h3>
          <p className="text-[12px] text-[#86909C] mt-1">{description}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-5 flex flex-col cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{
        background: config.background,
        border: `1px solid ${config.border}`
      }}
    >
      {/* 1. 顶栏：图标 + 状态标签 */}
      <div className="flex items-start justify-between">
        <div className="relative w-10 h-10 flex-shrink-0">
          <Image src={icon} alt={title} width={40} height={40} className="object-contain" />
        </div>
        <span className="bg-[#D5F6E5] text-[#009A62] text-xs font-medium px-2.5 py-0.5 rounded-md">
          {status}
        </span>
      </div>

      {/* 2. 标题 */}
      <h3 className="text-[17px] font-bold text-[#1D2129] mt-3">{title}</h3>

      {/* 3. 多行描述 */}
      <p className="text-[12px] text-[#86909C] leading-relaxed line-clamp-2 mt-1.5 h-[36px]">
        {description}
      </p>

      {/* 4. 元数据小徽章行 */}
      <div className="flex items-center gap-2 mt-3">
        <div className="bg-white/80 border border-slate-200/80 rounded px-2 py-0.5 text-[11px] text-[#4E5969] flex items-center gap-1">
          <Building2 className="w-3 h-3" />
          <span>{department}</span>
        </div>
        <div className="bg-white/80 border border-slate-200/80 rounded px-2 py-0.5 text-[11px] text-[#4E5969] flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{frequency}</span>
        </div>
        <div className="bg-white/80 border border-slate-200/80 rounded px-2 py-0.5 text-[11px] text-[#4E5969] flex items-center gap-1">
          <User className="w-3 h-3" />
          <span>{owner}</span>
        </div>
      </div>

      {/* 5. 分割线与数据源 */}
      <div
        className="border-t pt-2.5 my-3 text-[12px] flex items-center gap-1"
        style={{ borderColor: "rgba(148, 163, 184, 0.15)" }}
      >
        <span className="text-[#86909C]">@ 数据源</span>
        <span className="font-bold" style={{ color: config.sourceColor }}>
          {dataSource}
        </span>
      </div>

      {/* 6. 底部业务标签组 */}
      <div className="flex flex-wrap gap-2">
        {businessTags.map((tag, idx) => (
          <span
            key={idx}
            className="px-2.5 py-1 rounded text-[12px] font-medium"
            style={{
              backgroundColor: config.tagBg,
              color: config.tagText
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
