"use client";
import { Suspense, useState, useOptimistic, startTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PortalHeader from '@/components/portal/PortalHeader';
import FilterSidebar from '@/components/portal/FilterSidebar';
import DictionaryGrid from '@/components/portal/DictionaryGrid';
import { usePortalRequest } from '@/components/portal/PortalProvider';
import { reportPath } from '@/lib/portal-api';
import { emptyFilters, type Filters, type ReportPage, type FilterKey } from '@/lib/portal-model';
function Dictionary() {
  const router = useRouter();
  const urlParams = useSearchParams();
  const [optimisticSearch, setOptimisticSearch] = useOptimistic(urlParams.toString());
  const params = new URLSearchParams(optimisticSearch);
  const query = params.get('q') || '';
  const filters: Filters = { module: params.getAll('module'), status: params.getAll('status'), frequency: params.getAll('frequency'), volume: params.getAll('volume') };
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const result = usePortalRequest<ReportPage>(reportPath(query, filters, page));
  function navigate(q: string, next: Filters, p = 1) {
    const search = new URLSearchParams();
    if (q) search.set('q', q);
    for (const [key, values] of Object.entries(next)) values.forEach(value => search.append(key, value));
    if (p > 1) search.set('page', String(p));
    startTransition(() => {
      setOptimisticSearch(search.toString());
      router.push(`/report-dictionary/?${search}`, { scroll: false });
    });
  }
  function toggle(key: FilterKey, value: string) {
    navigate(query, { ...filters, [key]: filters[key].includes(value) ? filters[key].filter(v => v !== value) : [...filters[key], value] });
  }
  const reset = () => navigate('', emptyFilters());
  return <div className="portal-shell"><PortalHeader dictionary query={query} onSearch={q => navigate(q, filters)} view={view} onViewChange={setView} />
    <main className="dictionary-layout"><FilterSidebar filters={filters} facets={result.data?.facets ?? result.previousData?.facets} onChange={toggle} onReset={() => navigate(query, emptyFilters())} />
      <DictionaryGrid result={result} onPage={p => navigate(query, filters, p)} query={query} onReset={reset} view={view} />
    </main>
  </div>;
}
export default function ReportDictionaryPage() { return <Suspense fallback={<div className="request-state">正在加载报表字典…</div>}><Dictionary /></Suspense>; }
