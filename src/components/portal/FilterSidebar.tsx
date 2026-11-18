"use client";
import type { Filters, FilterKey, ReportPage } from '@/lib/portal-model';
import { filterLabels, optionLabels } from '@/lib/portal-model';
import { SectionTitle } from './PortalProvider';
import ScrollArea from './ScrollArea';
import { Skeleton } from '@/components/ui/skeleton';

export default function FilterSidebar({ filters, facets, loading, visitStatsUnavailable, onChange, onReset }: {
  filters: Filters; facets?: ReportPage['facets']; loading?: boolean; visitStatsUnavailable?: boolean;
  onChange: (key: FilterKey, value: string) => void; onReset: () => void;
}) {
  return <aside className="panel filters"><div className="section-heading"><SectionTitle>筛选条件</SectionTitle><button className="text-button" onClick={onReset}>重置</button></div>
    <ScrollArea label="报表筛选条件">{(Object.keys(filterLabels) as FilterKey[]).map(key => <fieldset key={key}><legend>{filterLabels[key]}</legend>
      {facets?.[key].map(option => <label className="filter-option" key={option.value}>
        <input type="checkbox" checked={filters[key].includes(option.value)} onChange={() => onChange(key, option.value)} /><span>{optionLabels[option.value] || option.value}</span><span className="filter-count">{option.count}</span>
      </label>)}
      {key === 'volume' && visitStatsUnavailable && <p className="filter-hint" role="status">访问统计暂不可用{filters.volume.length > 0 ? '，已暂停访问量级筛选' : ''}</p>}
      {!facets && loading && <div aria-label="加载筛选项" aria-busy="true" className="space-y-3"><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-3/4" /></div>}
    </fieldset>)}<p className="filter-hint">同组多选取并集，不同组取交集。</p></ScrollArea>
  </aside>;
}
