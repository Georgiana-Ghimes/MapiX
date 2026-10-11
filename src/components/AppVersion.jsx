import React from 'react';
import { formatAppVersion } from '@/lib/appVersion';
import { cn } from '@/lib/utils';

/** Afișaj fix versiune + build (login, sidebar etc.). */
export default function AppVersion({ className, compact = false }) {
  return (
    <p
      className={cn(
        'select-none font-mono text-xs tabular-nums tracking-wide text-slate-500',
        className
      )}
      title={`MapiX ${formatAppVersion()}`}
      aria-label={`Versiune ${formatAppVersion()}`}
    >
      {formatAppVersion({ compact })}
    </p>
  );
}
