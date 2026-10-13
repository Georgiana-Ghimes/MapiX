import React from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '@/components/StatusBadge';
import { ExpandToggle, useExpandSet } from '@/components/ExpandToggle';
import { numarRo } from '@/lib/format';
import { NEST_ITEM, NEST_JUDET, NEST_LOCALITATE } from '@/lib/uiPanel';
import { cn } from '@/lib/utils';

/**
 * Expand: județ → localități → iteme (reguli / localitate).
 * @param {{ judete: object[] }} props
 */
export default function VerificariJudetExpand({ judete = [] }) {
  const judeteExp = useExpandSet();
  const locExp = useExpandSet();

  return (
    <div className="space-y-3">
      {judete.map((j) => {
        const deschis = judeteExp.has(j.judet);
        return (
          <section key={j.judet} className={cn(NEST_JUDET, 'overflow-hidden')}>
            <div className="border-b border-slate-300/60 bg-slate-200/50 px-3 py-2.5">
              <ExpandToggle
                deschis={deschis}
                peClick={() => judeteExp.toggle(j.judet)}
                eticheta={`${deschis ? 'Restrânge' : 'Extinde'} județul ${j.judet}`}
                className="font-heading text-sm font-semibold text-slate-900"
              >
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span>{j.judet}</span>
                  <span className="text-xs font-medium text-slate-700">
                    {numarRo(j.nrLocalitati, 0)} loc. · {numarRo(j.nrProbleme, 0)} probleme
                    {j.nrP1 ? ` · ${numarRo(j.nrP1, 0)} P1` : ''}
                  </span>
                </span>
              </ExpandToggle>
            </div>

            {deschis ? (
              <div className="space-y-2 p-3">
                {j.localitati.map((loc) => {
                  const locKey = `${j.judet}::${loc.localitate_id || loc.localitateNume}`;
                  const locDeschis = locExp.has(locKey);
                  const rezumat = [
                    loc.nrReguli ? `${loc.nrReguli} ${loc.nrReguli === 1 ? 'regulă' : 'reguli'}` : null,
                    loc.areLocalitateOnly ? 'acoperire neverificată' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <div key={locKey} className={cn(NEST_LOCALITATE, 'overflow-hidden')}>
                      <div className="px-3 py-2">
                        <ExpandToggle
                          deschis={locDeschis}
                          peClick={() => locExp.toggle(locKey)}
                          eticheta={`${locDeschis ? 'Restrânge' : 'Extinde'} ${loc.localitateNume}`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium text-slate-900">{loc.localitateNume}</span>
                            <span className="block text-xs text-slate-700">
                              {rezumat || 'Necesită verificare'}
                              {loc.motivAgregat ? ` · ${loc.motivAgregat}` : ''}
                            </span>
                          </span>
                          {loc.prioritate ? <StatusBadge valoare={loc.prioritate} /> : null}
                        </ExpandToggle>
                      </div>

                      {locDeschis ? (
                        <ul className="space-y-2 border-t border-slate-200 bg-slate-50/80 px-3 py-2">
                          {loc.items.map((item) => (
                            <li key={item.id} className={cn(NEST_ITEM, 'p-3')}>
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                                    {item.tip}
                                    {item.prioritate ? ` · ${item.prioritate}` : ''}
                                  </p>
                                  <p className="mt-0.5 text-sm font-medium text-slate-900">{item.titlu}</p>
                                  <p className="mt-0.5 text-xs text-slate-700">{item.motiv}</p>
                                </div>
                                <StatusBadge valoare={item.incredere || item.status} />
                              </div>
                              <div className="mt-2 flex flex-wrap gap-3">
                                <Link
                                  to={item.href}
                                  className="text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
                                >
                                  {item.hrefLabel || 'Deschide'}
                                </Link>
                                {item.hrefLoc ? (
                                  <Link
                                    to={item.hrefLoc}
                                    className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-800"
                                  >
                                    Fișa localității
                                  </Link>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
