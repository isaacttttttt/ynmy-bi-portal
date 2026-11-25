"use client";

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export default function PortalViewport({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith('/attachment-preview')) {
    return <>{children}</>;
  }
  return (
    <div className="portal-viewport" data-display-mode="fit">
      {children}
    </div>
  );
}
