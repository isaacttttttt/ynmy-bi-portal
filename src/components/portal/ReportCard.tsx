"use client";

import { Clock } from "lucide-react";
import Image from "next/image";
import { RESPONSIVE_SIZES } from "@/lib/responsive";

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
        width: RESPONSIVE_SIZES.reportCard.width,
        height: RESPONSIVE_SIZES.reportCard.height,
        background: config.background,
        border: `1px solid ${config.border}`,
        borderRadius: RESPONSIVE_SIZES.borderRadius.md
      }}
    >
      {/* 顶部：图标 + 标签 */}
      <div className="flex items-start gap-2">
        <div
          className="relative flex-shrink-0"
          style={{
            width: RESPONSIVE_SIZES.iconSize.md,
            height: RESPONSIVE_SIZES.iconSize.md
          }}
        >
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
            fontSize: RESPONSIVE_SIZES.fontSize.sm
          }}
        >
          {category}
        </span>
      </div>

      {/* 中部：标题与描述 */}
      <div className="flex-1 mt-2">
        <h3
          className="font-bold text-[#1D2129] leading-tight"
          style={{ fontSize: RESPONSIVE_SIZES.fontSize.md }}
        >
          {title}
        </h3>
        <p
          className="text-[#86909C] truncate mt-1"
          style={{ fontSize: RESPONSIVE_SIZES.fontSize.sm }}
        >
          {subtitle}
        </p>
      </div>

      {/* 底部：状态与时间 */}
      <div
        className="border-t pt-2.5 mt-2 flex justify-between items-center"
        style={{ borderColor: "rgba(148, 163, 184, 0.15)" }}
      >
        <div
          className="flex items-center gap-1 text-[#86909C]"
          style={{ fontSize: RESPONSIVE_SIZES.fontSize.sm }}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{updateLabel}</span>
        </div>
        <span
          className="font-medium"
          style={{
            color: config.timeColor,
            fontSize: RESPONSIVE_SIZES.fontSize.sm
          }}
        >
          {updateTime}
        </span>
      </div>
    </div>
  );
}
