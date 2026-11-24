"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

const designWidth = 1920;

export default function PortalViewport({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith('/attachment-preview')) {
    return <>{children}</>;
  }
  return <FitPortalViewport>{children}</FitPortalViewport>;
}

function FitPortalViewport({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: designWidth, height: 1080 });
  useLayoutEffect(() => {
    const container = viewport.current!;
    function measure() {
      const next = { width: container.clientWidth, height: window.innerHeight };
      setSize(previous => previous.width === next.width && previous.height === next.height ? previous : next);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  const scale = Math.max(1280, size.width) / designWidth;
  // Short embeds keep a usable desktop layout and scroll instead of compressing content.
  const fitHeight = Math.max(800, size.height / scale);
  return <div ref={viewport} className="portal-viewport" data-display-mode="fit">
    <div className="portal-frame is-scaled" style={{ width: designWidth * scale, height: fitHeight * scale }}>
      <div className="portal-canvas" style={{ width: designWidth, transform: `scale(${scale})`, '--fit-height': `${fitHeight}px`, '--fit-scale': scale } as CSSProperties}>{children}</div>
    </div>
  </div>;
}
