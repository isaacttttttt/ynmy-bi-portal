"use client";
import { useEffect, useRef, type ReactNode } from 'react';

export default function ScrollArea({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return <div ref={ref} className="panel-scroll" tabIndex={0} role="region" aria-label={label} onScroll={() => {
    ref.current?.classList.add('is-scrolling');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => ref.current?.classList.remove('is-scrolling'), 800);
  }}>{children}</div>;
}
