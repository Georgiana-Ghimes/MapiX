import React from 'react';
import { cn } from '@/lib/utils';

export const NUME_APLICATIE = 'MapiX';
export const SUBTITLU_APLICATIE = 'Instrument pentru taxe de acces, modul al Transitix';

/**
 * Marca aplicației: sigla, numele și subtitlul care o poziționează
 * ca modul separat din Transitix.
 */
export default function MarcaAplicatie({ className, cuSigla = true }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      {cuSigla ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-700 text-sm font-bold text-white">
          M
        </span>
      ) : null}
      <div className="min-w-0 leading-tight">
        <div className="font-heading text-sm font-semibold tracking-tight text-slate-900">{NUME_APLICATIE}</div>
        <div className="text-[11px] text-slate-700">{SUBTITLU_APLICATIE}</div>
      </div>
    </div>
  );
}