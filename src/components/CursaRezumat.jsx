import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { dataOraRo, dataRo, numarRo, sumaRo } from '@/lib/format';
import { sintetizeazaCalcul } from '@/lib/reguliTaxe';

function Rand({ eticheta, copil }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-1.5 last:border-b-0">
      <span className="text-xs text-slate-500">{eticheta}</span>
      <span className="text-right text-sm font-medium text-slate-800">{copil}</span>
    </div>
  );
}

export default function CursaRezumat({ cursa, randuri = [], afiseazaDetalii = true }) {
  const sintetic = sintetizeazaCalcul(randuri);
  const liniiCuCost = randuri.filter((r) => r.cost_calculat !== null && r.cost_calculat !== undefined);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusBadge valoare={cursa.status_calcul} />
          <StatusBadge valoare={cursa.moneda_rezultat} />
          {cursa.data_calcul ? (
            <span className="text-xs text-slate-500">Calcul efectuat la {dataOraRo(cursa.data_calcul)}</span>
          ) : null}
        </div>

        <div className="grid gap-x-8 sm:grid-cols-2">
          <div>
            <Rand eticheta="Total taxe confirmate" copil={sumaRo(sintetic.totalConfirmat, sintetic.monedaRezultat === 'Mixt' ? null : sintetic.monedaRezultat)} />
            <Rand eticheta="Costuri neconfirmate" copil={sumaRo(sintetic.totalNeconfirmat, sintetic.monedaRezultat === 'Mixt' ? null : sintetic.monedaRezultat)} />
            <Rand
              eticheta="Total estimare"
              copil={
                sintetic.totalEstimare === null
                  ? 'Se afișează separat pe monedă'
                  : sumaRo(sintetic.totalEstimare, sintetic.monedaRezultat === 'Necalculabil' ? null : sintetic.monedaRezultat)
              }
            />
          </div>
          <div>
            <Rand eticheta="Reguli evaluate" copil={numarRo(sintetic.numarLinii, 0)} />
            <Rand eticheta="Reguli care necesită verificare" copil={numarRo(sintetic.necesitaVerificare, 0)} />
            <Rand
              eticheta="Localități de pe traseu"
              copil={numarRo(Array.isArray(cursa.localitati_traseu) ? cursa.localitati_traseu.length : 0, 0)}
            />
          </div>
        </div>

        {sintetic.monede.length > 1 ? (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Sunt implicate mai multe monede. Valorile nu se însumează fără o conversie documentată.
            </p>
            <ul className="mt-1 list-inside list-disc">
              {Object.entries(sintetic.subtotaleConfirmate).map(([moneda, valoare]) => (
                <li key={`c-${moneda}`}>
                  Confirmate: {sumaRo(valoare, moneda)}
                </li>
              ))}
              {Object.entries(sintetic.subtotaleNeconfirmate).map(([moneda, valoare]) => (
                <li key={`n-${moneda}`}>
                  Neconfirmate: {sumaRo(valoare, moneda)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {cursa.status_calcul !== 'Complet' ? (
          <p className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Estimare parțială — unele taxe sau condiții nu au putut fi calculate. Verifică sursele oficiale înainte de
            deplasare.
          </p>
        ) : null}

        {cursa.masa_utilizata_t !== undefined && cursa.masa_utilizata_t !== null ? (
          <p className="mt-3 text-xs text-slate-500">
            Masa utilizată la calcul: {numarRo(cursa.masa_utilizata_t, 2)} t ({cursa.tip_masa_utilizata}) · Data deplasării:{' '}
            {dataRo(cursa.data_deplasare)}
          </p>
        ) : null}
      </div>

      {afiseazaDetalii ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <caption className="sr-only">Defalcarea costurilor pe fiecare regulă aplicabilă</caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-3 py-2 font-medium">Localitate</th>
                <th scope="col" className="px-3 py-2 font-medium">Regula aplicabilă</th>
                <th scope="col" className="px-3 py-2 font-medium">Valoare</th>
                <th scope="col" className="px-3 py-2 font-medium">Cost calculat</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Ultima verificare</th>
                <th scope="col" className="px-3 py-2 font-medium">Sursa</th>
              </tr>
            </thead>
            <tbody>
              {randuri.map((rand) => (
                <tr key={rand.id || `${rand.taxa_id}-${rand.denumire_regula_snapshot}`} className="border-b border-slate-100 last:border-b-0 align-top">
                  <td className="px-3 py-2 text-slate-700">{rand.localitate_nume || '—'}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-slate-800">{rand.denumire_regula_snapshot}</span>
                    {rand.categorie_snapshot ? <span className="block text-xs text-slate-500">{rand.categorie_snapshot}</span> : null}
                    {rand.motiv_status ? <span className="block text-xs text-slate-500">{rand.motiv_status}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {rand.valoare_snapshot === null || rand.valoare_snapshot === undefined
                      ? 'Nedocumentată'
                      : sumaRo(rand.valoare_snapshot, rand.moneda_snapshot)}
                    {rand.unitate_tarifare_snapshot ? (
                      <span className="block text-xs text-slate-500">{rand.unitate_tarifare_snapshot}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {rand.cost_calculat === null || rand.cost_calculat === undefined
                      ? '—'
                      : sumaRo(rand.cost_calculat, rand.moneda_snapshot)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge valoare={rand.status_calcul} />
                  </td>
                  <td className="px-3 py-2 text-slate-700">{dataRo(rand.data_verificare_snapshot)}</td>
                  <td className="px-3 py-2">
                    {rand.sursa_url_snapshot ? (
                      <a
                        href={rand.sursa_url_snapshot}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 underline underline-offset-2 hover:text-blue-800"
                      >
                        Deschide sursa
                      </a>
                    ) : (
                      <span className="text-amber-800">Sursă lipsă</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {liniiCuCost.length === 0 ? (
            <p className="border-t border-slate-100 px-3 py-3 text-sm text-amber-800">
              Nu a fost calculat nici un cost: valorile sau condițiile necesare lipsesc din baza de date.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}