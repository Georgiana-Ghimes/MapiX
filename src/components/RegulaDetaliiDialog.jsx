import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/StatusBadge';
import ZonaDescriere from '@/components/ZonaDescriere';
import { dataRo, masaRo, sumaRo, textSau } from '@/lib/format';
import { PRAG_REVERIFICARE_LUNI } from '@/lib/reguliTaxe';
import { luniDeLa } from '@/lib/format';


function Rand({ eticheta, children }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-2 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-full shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500 sm:w-56">{eticheta}</dt>
      <dd className="text-sm text-slate-800">{children || '—'}</dd>
    </div>
  );
}

export default function RegulaDetaliiDialog({ open, onOpenChange, regula, localitate, zona, sursa }) {
  if (!regula) return null;
  const luniDeLaVerificare = luniDeLa(regula.data_verificare);
  const verificareVechi = luniDeLaVerificare === null || luniDeLaVerificare >= PRAG_REVERIFICARE_LUNI;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6">{regula.denumire_regula}</DialogTitle>
          <DialogDescription>
            {localitate ? localitate.nume : 'Localitate necunoscută'}
            {zona ? ` · ${zona.nume_zona}` : ' · fără zonă definită'}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-3 flex flex-wrap gap-2">
          <StatusBadge valoare={regula.categorie_regula} />
          <StatusBadge valoare={regula.incredere} />
          <StatusBadge valoare={regula.status} />
          {regula.este_demo ? <StatusBadge valoare="DEMO — DATE FICTIVE" /> : null}
        </div>

        <ZonaDescriere zona={zona} className="mb-3" />

        <dl className="rounded-md border border-slate-200 px-4 py-1">
          <Rand eticheta="Zonă">{zona ? zona.nume_zona : 'Fără zonă definită'}</Rand>
          <Rand eticheta="Criteriu de masă">
            {regula.tip_masa || 'Necunoscut'}
            {regula.masa_min_t || regula.masa_max_t
              ? ` · ${masaRo(regula.masa_min_t)} – ${masaRo(regula.masa_max_t)}`
              : ' · interval nedocumentat'}
          </Rand>
          <Rand eticheta="Tip taxă">{regula.tip_taxa}</Rand>
          <Rand eticheta="Valoare">
            {regula.valoare === null || regula.valoare === undefined
              ? regula.tip_taxa === 'Gratuit'
                ? 'Gratuit (confirmat de sursă)'
                : 'Valoare nedocumentată'
              : sumaRo(regula.valoare, regula.moneda)}
          </Rand>
          <Rand eticheta="Unitate de tarifare">{regula.unitate_tarifare}</Rand>
          <Rand eticheta="Interval orar">
            {regula.ora_start && regula.ora_end ? `${regula.ora_start}–${regula.ora_end}` : regula.orar_restrictie || 'Fără restricție orară documentată'}
          </Rand>
          <Rand eticheta="Zile de aplicare">
            {Array.isArray(regula.zile_aplicare) && regula.zile_aplicare.length ? regula.zile_aplicare.join(', ') : 'Toate zilele'}
          </Rand>
          <Rand eticheta="Valabilitate">
            {regula.perioada_valabilitate_start || regula.perioada_valabilitate_end
              ? `${dataRo(regula.perioada_valabilitate_start)} – ${dataRo(regula.perioada_valabilitate_end)}`
              : 'Perioadă nedocumentată — necesită verificare'}
          </Rand>
          <Rand eticheta="Condiții de vehicul">{textSau(regula.conditii_vehicul, 'Nespecificate')}</Rand>
          <Rand eticheta="Excepții">{textSau(regula.exceptii, 'Nespecificate')}</Rand>
          <Rand eticheta="Cum se obține">{textSau(regula.cum_se_obtine, 'Nedocumentat')}</Rand>
          <Rand eticheta="Data sursei">{dataRo(regula.data_sursa)}</Rand>
          <Rand eticheta="Ultima verificare">
            <span className={verificareVechi ? 'text-amber-800' : ''}>
              {regula.data_verificare ? dataRo(regula.data_verificare) : 'Nu a fost verificată'}
              {verificareVechi ? ' · necesită reverificare' : ''}
            </span>
          </Rand>
          <Rand eticheta="Observații">{textSau(regula.observatii, 'Fără observații')}</Rand>
        </dl>

        <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Surse</h4>
          {sursa ? (
            <p className="text-sm text-slate-700">
              Act asociat: <span className="font-medium">{sursa.titlu_document}</span>
              {sursa.numar_act ? ` nr. ${sursa.numar_act}` : ''} · {sursa.tip_act} · verificat la {dataRo(sursa.data_verificare)}
            </p>
          ) : (
            <p className="text-sm text-amber-800">Nu există un act normativ asociat în baza de date.</p>
          )}
          {regula.sursa_url ? (
            <a
              href={regula.sursa_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
            >
              {/\.pdf($|\?)/i.test(regula.sursa_url) ? 'Vezi PDF regulament' : 'Deschide sursa oficială'}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : (
            <p className="text-sm text-amber-800">Nu există link către sursa oficială.</p>
          )}
          {regula.url_autorizatie ? (
            <a
              href={regula.url_autorizatie}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
            >
              Pagina de autorizare
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : null}
          <p className="text-xs text-slate-500">
            Verifică întotdeauna informația la sursa oficială înainte de deplasare. Absența unei reguli în baza de date nu
            înseamnă că nu există obligații legale.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Închide
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}