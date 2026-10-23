"use client";
import type { Filters, FilterKey, ReportPage } from '@/lib/portal-model';
import { filterLabels, optionLabels } from '@/lib/portal-model';
import { SectionTitle } from './PortalProvider';

export default function FilterSidebar({ filters, facets, onChange, onReset }: {
  filters: Filters; facets?: ReportPage['facets']; onChange: (key: FilterKey, value: string) => void; onReset: () => void;
}) {
  return <aside className="panel filters"><div className="section-heading"><SectionTitle>筛选条件</SectionTitle><button className="text-button" onClick={onReset}>重置</button></div>
    {(Object.keys(filterLabels) as FilterKey[]).map(key => <fieldset key={key}><legend>{filterLabels[key]}</legend>
      {facets?.[key].map(option => <label className="filter-option" key={option.value}>
        <input type="checkbox" checked={filters[key].includes(option.value)} onChange={() => onChange(key, option.value)} /><span>{optionLabels[option.value] || option.value}</span><span className="filter-count">{option.count}</span>
      </label>)}
      {!facets && <p className="muted">加载筛选项…</p>}
    </fieldset>)}<p className="filter-hint">同组多选取并集，不同组取交集。</p>
  </aside>;
}
