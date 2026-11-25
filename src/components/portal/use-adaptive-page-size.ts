"use client";

import { useLayoutEffect, useRef, useState } from 'react';

export interface AdaptivePageSizeOptions {
  rowHeight: number;
  rowGap?: number;
  reservedHeight?: number;
  min: number;
  max: number;
  debounceMs?: number;
  page: number;
  onPageAdjust: (nextPage: number) => void;
}

export function calcAdaptivePageSize(
  containerHeight: number,
  { rowHeight, rowGap = 0, reservedHeight = 0, min, max }: Pick<AdaptivePageSizeOptions, 'rowHeight' | 'rowGap' | 'reservedHeight' | 'min' | 'max'>,
): number {
  const usable = Math.max(0, containerHeight - reservedHeight);
  const fit = Math.floor((usable + rowGap) / (rowHeight + rowGap));
  return Math.max(min, Math.min(max, fit));
}

export function useAdaptivePageSize<T extends HTMLElement = HTMLDivElement>({
  rowHeight,
  rowGap = 0,
  reservedHeight = 0,
  min,
  max,
  debounceMs = 400,
  page,
  onPageAdjust,
}: AdaptivePageSizeOptions) {
  const containerRef = useRef<T>(null);
  const [pageSize, setPageSize] = useState<number | null>(null);
  const sizeRef = useRef<number | null>(null);
  const pageRef = useRef(page);
  const adjustRef = useRef(onPageAdjust);
  pageRef.current = page;
  adjustRef.current = onPageAdjust;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const apply = (height: number, immediate: boolean) => {
      if (height <= 0) return;
      const next = calcAdaptivePageSize(height, { rowHeight, rowGap, reservedHeight, min, max });
      const commit = () => {
        const prev = sizeRef.current;
        if (prev === next) return;
        sizeRef.current = next;
        setPageSize(next);
        if (prev !== null && pageRef.current > 1) {
          const firstIndex = (pageRef.current - 1) * prev;
          adjustRef.current(Math.floor(firstIndex / next) + 1);
        }
      };

      if (immediate) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        commit();
      } else {
        if (timer) clearTimeout(timer);
        timer = setTimeout(commit, debounceMs);
      }
    };

    apply(el.clientHeight, true);
    const observer = new ResizeObserver(() => {
      apply(el.clientHeight, sizeRef.current === null);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [rowHeight, rowGap, reservedHeight, min, max, debounceMs]);

  return { containerRef, pageSize };
}
