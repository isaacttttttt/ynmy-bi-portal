"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PortalHeader from "@/components/portal/PortalHeader";
import WorkbenchModule from "@/components/portal/WorkbenchModule";
import ThematicAnalysisModule from "@/components/portal/ThematicAnalysisModule";
import NoticeModule from "@/components/portal/NoticeModule";
import QuickEntryModule from "@/components/portal/QuickEntryModule";
import { RESPONSIVE_SIZES } from "@/lib/responsive";

export default function HomePage() {
  const router = useRouter();
  const [searchKeyword, setSearchKeyword] = useState("");

  const handleSearch = (keyword: string) => {
    setSearchKeyword(keyword);
    console.log("搜索关键词:", keyword);
  };

  const handleNavigateToDictionary = () => {
    router.push("/report-dictionary");
  };

  return (
    <div
      className="min-h-screen bg-[#EDF3FA]"
      style={{
        backgroundImage: "url('/assets/页面背景@2x.png')",
        backgroundSize: "100% auto",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "top center"
      }}
    >
      <div
        className="max-w-[1440px] mx-auto"
        style={{
          paddingLeft: RESPONSIVE_SIZES.pagePaddingX,
          paddingRight: RESPONSIVE_SIZES.pagePaddingX,
          paddingBottom: RESPONSIVE_SIZES.pagePaddingBottom
        }}
      >
        <PortalHeader
          title="云南白药集团·数据门户"
          subtitle="数据驱动经营 · 智慧赋能决策"
          onSearch={handleSearch}
          onNavigateToDictionary={handleNavigateToDictionary}
        />

        <main
          className="grid grid-cols-12 items-start"
          style={{ gap: RESPONSIVE_SIZES.moduleGap }}
        >
          <div
            className="col-span-9"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: RESPONSIVE_SIZES.moduleGap
            }}
          >
            <WorkbenchModule searchKeyword={searchKeyword} />
            <ThematicAnalysisModule searchKeyword={searchKeyword} />
          </div>

          <aside
            className="col-span-3"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: RESPONSIVE_SIZES.moduleGap
            }}
          >
            <NoticeModule />
            <QuickEntryModule />
          </aside>
        </main>
      </div>
    </div>
  );
}
