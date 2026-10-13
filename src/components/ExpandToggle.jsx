import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ExpandToggle({ deschis, peClick, eticheta, children, className }) {
  return (
    <button
      type="button"
      onClick={peClick}
      aria-expanded={deschis}
      aria-label={eticheta}
      className={cn('flex w-full items-center gap-2 text-left', className)}
    >
      {deschis ? (
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-800" strokeWidth={2.35} aria-hidden="true" />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-800" strokeWidth={2.35} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

export function useExpandSet(initial = []) {
  const [set, setSet] = React.useState(() => new Set(initial));
  const toggle = React.useCallback((key) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const has = React.useCallback((key) => set.has(key), [set]);
  return { has, toggle, set };
}
