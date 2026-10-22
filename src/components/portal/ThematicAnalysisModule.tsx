"use client";

import { Grid3x3, ChevronRight } from "lucide-react";
import Image from "next/image";
import { RESPONSIVE_SIZES } from "@/lib/responsive";

interface ThematicAnalysisModuleProps {
  searchKeyword: string;
}

interface HorizontalCardProps {
  id: number;
  type: "dashboard" | "folder";
  theme: "blue" | "orange";
  icon: string;
  title: string;
  tags: Array<{ text: string; primary: boolean }>;
  isFavorite?: boolean;
}

const THEMATIC_DATA: {
  row1: HorizontalCardProps[];
  row2: HorizontalCardProps[];
} = {
  row1: [
    {
      id: 1,
      type: "dashboard",
      theme: "blue",
      icon: "/assets/专题分析驾驶舱背景1.png",
      title: "健康品经营驾驶舱",
      tags: [
        { text: "驾驶舱", primary: true },
        { text: "经营分析", primary: false }
      ],
      isFavorite: true
    },
    {
      id: 2,
      type: "dashboard",
      theme: "blue",
      icon: "/assets/专题分析驾驶舱背景2.png",
      title: "临床事业群驾驶舱",
      tags: [
        { text: "驾驶舱", primary: true },
        { text: "临床", primary: false }
      ],
      isFavorite: false
    },
    {
      id: 3,
      type: "dashboard",
      theme: "blue",
      icon: "/assets/专题分析驾驶舱背景3.png",
      title: "区域销售驾驶舱",
      tags: [
        { text: "驾驶舱", primary: true },
        { text: "区域分析", primary: false }
      ],
      isFavorite: true
    }
  ],
  row2: [
    {
      id: 4,
      type: "folder",
      theme: "orange",
      icon: "/assets/专题分析专题背景.png",
      title: "健康品专题",
      tags: [
        { text: "专题", primary: true },
        { text: "4个对象", primary: false }
      ]
    },
    {
      id: 5,
      type: "folder",
      theme: "orange",
      icon: "/assets/专题分析专题背景.png",
      title: "临床专题",
      tags: [
        { text: "专题", primary: true },
        { text: "6个对象", primary: false }
      ]
    },
    {
      id: 6,
      type: "folder",
      theme: "orange",
      icon: "/assets/专题分析专题背景.png",
      title: "药品零售专题",
      tags: [
        { text: "专题", primary: true },
        { text: "3个对象", primary: false }
      ]
    }
  ]
};

export default function ThematicAnalysisModule({
  searchKeyword
}: ThematicAnalysisModuleProps) {
  return (
    <div
      className="bg-white"
      style={{
        width: RESPONSIVE_SIZES.thematic.width,
        height: RESPONSIVE_SIZES.thematic.height,
        padding: RESPONSIVE_SIZES.modulePadding,
        borderRadius: RESPONSIVE_SIZES.borderRadius.lg,
        border: "1px solid rgba(255, 255, 255, 0.9)",
        boxShadow: "0 8px 24px -4px rgba(29, 99, 255, 0.05)"
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2"
        style={{ marginBottom: RESPONSIVE_SIZES.headerMarginBottom }}
      >
        <Grid3x3 className="w-5 h-5 text-[#1D63FF]" />
        <h2
          className="font-bold text-[#1D2129]"
          style={{ fontSize: RESPONSIVE_SIZES.fontSize.lg }}
        >
          专题分析
        </h2>
        <span
          className="text-[#1D63FF] font-medium"
          style={{ fontSize: RESPONSIVE_SIZES.fontSize.sm }}
        >
          健康品事业群
        </span>
      </div>

      {/* 卡片网格 */}
      <div style={{ display: "flex", flexDirection: "column", gap: RESPONSIVE_SIZES.componentGap }}>
        {/* 第一行：蓝色驾驶舱横向卡 */}
        <div
          className="grid grid-cols-3"
          style={{ gap: RESPONSIVE_SIZES.componentGap }}
        >
          {THEMATIC_DATA.row1.map((item) => (
            <HorizontalCard key={item.id} {...item} />
          ))}
        </div>

        {/* 第二行：橙色文件夹横向卡 */}
        <div
          className="grid grid-cols-3"
          style={{ gap: RESPONSIVE_SIZES.componentGap }}
        >
          {THEMATIC_DATA.row2.map((item) => (
            <HorizontalCard key={item.id} {...item} />
          ))}
        </div>
      </div>
    </div>
  );
}

function HorizontalCard({
  type,
  theme,
  icon,
  title,
  tags,
  isFavorite
}: HorizontalCardProps) {
  const themeConfig =
    theme === "blue"
      ? {
          border: "#D8E7FF",
          primaryTagBg: "#D4E4FF",
          primaryTagText: "#1D63FF",
          secondaryTagBg: "#FFFFFF",
          secondaryTagText: "#86909C",
          arrowBg: "rgba(255, 255, 255, 0.8)",
          arrowText: "#1D63FF"
        }
      : {
          border: "#FFE4C4",
          primaryTagBg: "#FFE8CC",
          primaryTagText: "#D97706",
          secondaryTagBg: "#FFFFFF",
          secondaryTagText: "#86909C",
          arrowBg: "rgba(255, 255, 255, 0.8)",
          arrowText: "#D97706"
        };

  return (
    <div
      className="relative overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{
        width: RESPONSIVE_SIZES.horizontalCard.width,
        height: RESPONSIVE_SIZES.horizontalCard.height,
        borderRadius: RESPONSIVE_SIZES.borderRadius.md,
        border: `1px solid ${themeConfig.border}`
      }}
    >
      {/* 整个卡片的背景图 - 不受透明度影响 */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url('${icon}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      />

      {/* 内容容器 - 向左偏移112px */}
      <div
        className="relative z-10 h-full flex items-center pr-4"
        style={{ paddingLeft: RESPONSIVE_SIZES.horizontalCard.textOffset }}
      >
        {/* 文字内容 */}
        <div className="flex-1 flex flex-col justify-center gap-2">
          <h3
            className="font-bold text-[#1D2129]"
            style={{ fontSize: RESPONSIVE_SIZES.fontSize.md }}
          >
            {title}
          </h3>
          <div className="flex items-center gap-2">
            {tags.map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded font-medium"
                style={{
                  backgroundColor: tag.primary
                    ? themeConfig.primaryTagBg
                    : themeConfig.secondaryTagBg,
                  color: tag.primary ? themeConfig.primaryTagText : themeConfig.secondaryTagText,
                  border: tag.primary ? "none" : "1px solid #E5E7EB",
                  fontSize: RESPONSIVE_SIZES.fontSize.sm
                }}
              >
                {tag.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 右上角星标（仅驾驶舱卡片） */}
      {type === "dashboard" && (
        <Image
          src={isFavorite ? "/assets/faved_icon.png" : "/assets/fav_icon.png"}
          alt="收藏"
          width={20}
          height={20}
          className="absolute top-3 right-3 cursor-pointer z-20"
        />
      )}

      {/* 右下角箭头按钮 */}
      <div
        className="absolute bottom-3 right-3 w-5 h-5 rounded-full flex items-center justify-center z-20"
        style={{
          backgroundColor: themeConfig.arrowBg,
          color: themeConfig.arrowText
        }}
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </div>
    </div>
  );
}
