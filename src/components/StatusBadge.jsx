import React from 'react';
import { TONURI, tonStare } from '@/lib/enum';
import { cn } from '@/lib/utils';

export default function StatusBadge({ valoare, className = '' }) {
  if (!valoare) return null;
  const ton = TONURI[tonStare(valoare)] || TONURI.gri;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium',
        ton,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {valoare}
    </span>
  );
}