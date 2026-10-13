import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

const PRAG_COMPACT = 280;

/**
 * Afișează delimitarea zonei (liste de străzi din act) când există pe câmpul `descriere`.
 */
export default function ZonaDescriere({ zona, className = '', compact = false, eticheta = 'Străzi / delimitare' }) {
  const text = typeof zona?.descriere === 'string' ? zona.descriere.trim() : '';
  const [extins, setExtins] = useState(false);

  if (!text) return null;

  const preaLung = compact && text.length > PRAG_COMPACT;
  const afisat = preaLung && !extins ? `${text.slice(0, PRAG_COMPACT).trim()}…` : text;

  return (
    <div className={`rounded-md border border-slate-200 bg-slate-50 px-3 py-2 ${className}`.trim()}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{eticheta}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">{afisat}</p>
      {preaLung ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="mt-1 h-auto px-0 text-xs text-blue-700"
          onClick={() => setExtins((v) => !v)}
        >
          {extins ? 'Arată mai puțin' : 'Arată lista completă'}
        </Button>
      ) : null}
    </div>
  );
}
