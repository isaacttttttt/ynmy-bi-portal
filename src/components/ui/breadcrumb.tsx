import type { ComponentProps } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Breadcrumb(props: ComponentProps<'nav'>) {
  return <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />;
}

export function BreadcrumbList({ className, ...props }: ComponentProps<'ol'>) {
  return <ol data-slot="breadcrumb-list" className={cn('flex flex-wrap items-center gap-[3px]', className)} {...props} />;
}

export function BreadcrumbItem({ className, ...props }: ComponentProps<'li'>) {
  return <li data-slot="breadcrumb-item" className={cn('inline-flex items-center gap-[3px]', className)} {...props} />;
}

export function BreadcrumbSeparator() {
  return <li role="presentation" aria-hidden="true"><ChevronRight size={13} /></li>;
}
