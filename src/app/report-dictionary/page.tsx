"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PortalHeader from "@/components/portal/PortalHeader";
import FilterSidebar from "@/components/portal/FilterSidebar";
import DictionaryGrid from "@/components/portal/DictionaryGrid";

export default function ReportDictionaryPage() {
  const router = useRouter();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const handleSearch = (keyword: string) => {
    setSearchKeyword(keyword);
    console.log("搜索关键词:", keyword);
  };

  const handleNavigateToHome = () => {
    router.push("/");
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
      <div className="max-w-[1440px] mx-auto px-6 pb-8">
        <PortalHeader
          title="数据门户·报表字典"
          subtitle="数据驱动经营 · 智慧赋能决策"
          onSearch={handleSearch}
          showViewToggle
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onNavigateToHome={handleNavigateToHome}
        />

        <main className="grid grid-cols-12 gap-5">
          <aside className="col-span-2" style={{ minWidth: "220px" }}>
            <FilterSidebar />
          </aside>

          <div className="col-span-10">
            <DictionaryGrid searchKeyword={searchKeyword} viewMode={viewMode} />
          </div>
        </main>
      </div>
    </div>
  );
}
