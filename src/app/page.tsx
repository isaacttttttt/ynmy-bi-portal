"use client";
import { useRouter } from 'next/navigation';
import PortalHeader from '@/components/portal/PortalHeader';
import WorkbenchModule from '@/components/portal/WorkbenchModule';
import ThematicAnalysisModule from '@/components/portal/ThematicAnalysisModule';
import NoticeModule from '@/components/portal/NoticeModule';
import QuickEntryModule from '@/components/portal/QuickEntryModule';
export default function HomePage() {
  const router = useRouter();
  return <div className="portal-shell"><PortalHeader onSearch={q => router.push(`/report-dictionary/?q=${encodeURIComponent(q)}`)} />
    <main className="home-layout"><div className="home-main"><WorkbenchModule /><ThematicAnalysisModule /></div><aside className="home-aside"><NoticeModule /><QuickEntryModule /></aside></main>
  </div>;
}
