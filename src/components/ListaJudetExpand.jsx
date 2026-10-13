import React from 'react';
import { ExpandToggle, useExpandSet } from '@/components/ExpandToggle';
import { numarRo } from '@/lib/format';
import { NEST_ITEM, NEST_JUDET, NEST_LOCALITATE, NEST_ZONA } from '@/lib/uiPanel';
import { cn } from '@/lib/utils';

/**
 * Arbore expandabil județ → localitate → (opțional) zonă → iteme.
 */
export default function ListaJudetExpand({
  judete = [],
  renderItem,
  cuLocalitati = true,
  etichetaItems = 'elemente',
  itemClassName = NEST_ITEM,
}) {
  const judeteExp = useExpandSet();
  const locExp = useExpandSet();
  const zonaExp = useExpandSet();
  const unSingurJudet = judete.length === 1;

  const renderItems = (items) => (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className={cn(itemClassName, itemClassName ? 'p-3' : undefined)}>
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-3">
      {judete.map((j) => {
        const deschis = unSingurJudet || judeteExp.has(j.judet);
        const nrLoc = j.nrLocalitati ?? j.localitati?.length;
        return (
          <section key={j.judet} className={cn(NEST_JUDET, 'overflow-hidden')}>
            <div className="border-b border-slate-300/60 bg-slate-200/50 px-3 py-2.5">
              <ExpandToggle
                deschis={deschis}
                peClick={() => !unSingurJudet && judeteExp.toggle(j.judet)}
                eticheta={`${deschis ? 'Restrânge' : 'Extinde'} ${j.judet}`}
                className="font-heading text-sm font-semibold text-slate-900"
              >
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span>{j.judet}</span>
                  <span className="text-xs font-normal text-slate-600">
                    {nrLoc != null ? `${numarRo(nrLoc, 0)} loc. · ` : ''}
                    {numarRo(j.nrItems, 0)} {etichetaItems}
                    {j.nrP1 ? ` · ${numarRo(j.nrP1, 0)} P1` : ''}
                  </span>
                </span>
              </ExpandToggle>
            </div>

            {deschis ? (
              <div className="space-y-2 p-3">
                {cuLocalitati && j.localitati
                  ? j.localitati.map((loc) => {
                      const locKey = `${j.judet}::${loc.localitate_id || loc.localitateNume}`;
                      const locDeschis = locExp.has(locKey) || (unSingurJudet && j.localitati.length === 1);
                      const areZone = Array.isArray(loc.zone) && loc.zone.length > 0;
                      const maiMulteZone = areZone && loc.zone.length > 1;

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
                                <span className="block text-xs text-slate-500">
                                  {numarRo(loc.items.length, 0)} {etichetaItems}
                                  {maiMulteZone ? ` · ${numarRo(loc.zone.length, 0)} zone` : ''}
                                </span>
                              </span>
                            </ExpandToggle>
                          </div>
                          {locDeschis ? (
                            <div className="space-y-2 border-t border-slate-200 bg-slate-50/80 px-3 py-2">
                              {maiMulteZone
                                ? loc.zone.map((zona) => {
                                    const zKey = `${locKey}::${zona.zona_id || zona.zonaNume}`;
                                    const zDeschis = zonaExp.has(zKey) || loc.zone.length <= 2;
                                    return (
                                      <div key={zKey} className={cn(NEST_ZONA, 'overflow-hidden')}>
                                        <div className="px-3 py-2">
                                          <ExpandToggle
                                            deschis={zDeschis}
                                            peClick={() => zonaExp.toggle(zKey)}
                                            eticheta={`${zDeschis ? 'Restrânge' : 'Extinde'} ${zona.zonaNume}`}
                                          >
                                            <span className="min-w-0 flex-1">
                                              <span className="block text-sm font-semibold text-slate-900">
                                                {zona.zonaNume}
                                              </span>
                                              <span className="block text-xs text-slate-500">
                                                {numarRo(zona.items.length, 0)} {etichetaItems}
                                              </span>
                                            </span>
                                          </ExpandToggle>
                                        </div>
                                        {zDeschis ? (
                                          <div className="border-t border-slate-200/80 bg-white/80 px-2 py-2">
                                            {renderItems(zona.items)}
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })
                                : renderItems(loc.items)}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  : renderItems(j.items)}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
