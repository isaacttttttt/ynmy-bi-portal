"use client";

import { Clock } from "lucide-react";
import Image from "next/image";
import { pxToRem, REM_SIZES } from "@/lib/rem";

export type CardTheme = "blue" | "teal" | "purple" | "orange";

interface ReportCardProps {
  icon: string;
  category: string;
  theme: CardTheme;
  title: string;
  subtitle: string;
  updateTime: string;
  updateLabel: string;
}

const THEME_CONFIG = {
  blue: {
    background: "linear-gradient(135deg, #EBF3FF 0%, #F7FAFF 55%, #FFFFFF 100%)",
    border: "#D8E7FF",
    badgeBg: "#D4E4FF",
    badgeText: "#1D63FF",
    timeColor: "#1D63FF"
  },
  teal: {
    background: "linear-gradient(135deg, #E6FAF7 0%, #F4FFFD 55%, #FFFFFF 100%)",
    border: "#C8F2EB",
    badgeBg: "#C6F3EB",
    badgeText: "#009A84",
    timeColor: "#009A84"
  },
  purple: {
    background: "linear-gradient(135deg, #F3ECFF 0%, #FAF7FF 55%, #FFFFFF 100%)",
    border: "#E4D6FF",
    badgeBg: "#E7D9FF",
    badgeText: "#722ED1",
    timeColor: "#722ED1"
  },
  orange: {
    background: "linear-gradient(135deg, #FFF5E8 0%, #FFFDF9 60%, #FFFFFF 100%)",
    border: "#FFE4C4",
    badgeBg: "#FFE8CC",
    badgeText: "#D97706",
    timeColor: "#D97706"
  }
};

export default function ReportCard({
  icon,
  category,
  theme,
  title,
  subtitle,
  updateTime,
  updateLabel
}: ReportCardProps) {
  const config = THEME_CONFIG[theme];

  return (
    <div
      className="p-4 flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{
        height: REM_SIZES.card.reportHeight,
        background: config.background,
        border: `1px solid ${config.border}`,
        borderRadius: REM_SIZES.card.borderRadius
      }}
    >
      {/* 顶部：图标 + 标签 */}
      <div className="flex items-start" style={{ gap: pxToRem(8) }}>
        <div className="relative flex-shrink-0" style={{ width: REM_SIZES.icon.md, height: REM_SIZES.icon.md }}>
          <Image
            src={icon}
            alt={title}
            width={36}
            height={36}
            className="object-contain"
          />
        </div>
        <span
          className="px-2.5 py-0.5 rounded-md font-medium"
          style={{
            backgroundColor: config.badgeBg,
            color: config.badgeText,
            fontSize: REM_SIZES.fontSize.sm
          }}
        >
          {category}
        </span>
      </div>

      {/* 中部：标题与描述 */}
      <div className="flex-1" style={{ marginTop: pxToRem(8) }}>
        <h3
          className="font-bold text-[#1D2129] leading-tight"
          style={{ fontSize: REM_SIZES.fontSize.md }}
        >
          {title}
        </h3>
        <p
          className="text-[#86909C] truncate"
          style={{
            fontSize: REM_SIZES.fontSize.sm,
            marginTop: pxToRem(4)
          }}
        >
          {subtitle}
        </p>
      </div>

      {/* 底部：状态与时间 */}
      <div
        className="border-t flex justify-between items-center"
        style={{
          borderColor: "rgba(148, 163, 184, 0.15)",
          paddingTop: pxToRem(10),
          marginTop: pxToRem(8),
          fontSize: REM_SIZES.fontSize.sm
        }}
      >
        <div className="flex items-center text-[#86909C]" style={{ gap: pxToRem(4) }}>
          <Clock style={{ width: pxToRem(14), height: pxToRem(14) }} />
          <span>{updateLabel}</span>
        </div>
        <span className="font-medium" style={{ color: config.timeColor }}>
          {updateTime}
        </span>
      </div>
    </div>
  );
}
