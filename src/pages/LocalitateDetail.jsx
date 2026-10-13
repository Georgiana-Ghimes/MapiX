import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarCheck, ExternalLink, FileText, MapPin, Pencil, Plus, Search } from 'lucide-react';
import { api } from '@/api/client';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import StareIncarcare from '@/components/StareIncarcare';
import StareEroare from '@/components/StareEroare';
import HartaLeaflet from '@/components/HartaLeaflet';
import LocalitateFormDialog from '@/components/LocalitateFormDialog';
import ZonaFormDialog from '@/components/ZonaFormDialog';
import ZonaDescriere from '@/components/ZonaDescriere';

import TaxaFormDialog from '@/components/TaxaFormDialog';
import SursaFormDialog from '@/components/SursaFormDialog';
import RegulaDetaliiDialog from '@/components/RegulaDetaliiDialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/AuthContext';
import { dataRo, masaRo, numarRo, sumaRo } from '@/lib/format';
import { valideazaGeoJSON } from '@/lib/reguliTaxe';

export default function LocalitateDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const esteAdmin = user?.role === 'admin';
  const [localitate, setLocalitate] = useState(null);
  const [zone, setZone] = useState([]);
  const [reguli, setReguli] = useState([]);
  const [surse, setSurse] = useState([]);
  const [seIncarca, setSeIncarca] = useState(true);
  const [eroare, setEroare] = useState(null);
  const [dialog, setDialog] = useState({ tip: null, item: null });
  const [regulaDetaliata, setRegulaDetaliata] = useState(null);

  const incarca = useCallback(async () => {
    setSeIncarca(true);
    setEroare(null);
    try {
      const [loc, pageZone, pageReguli, pageSurse] = await Promise.all([
        api.entities.Localitate.get(id),
        api.entities.Zona.filter({ localitate_id: id }, { limit: 200 }),
        api.entities.TaxaAcces.filter({ localitate_id: id }, { sort: '-updated_date', limit: 300 }),
        api.entities.SursaAct.filter({ localitate_id: id }, { sort: '-data_verificare', limit: 200 }),
      ]);
      setLocalitate(loc);
      setZone(pageZone.items || []);
      setReguli(pageReguli.items || []);
      setSurse(pageSurse.items || []);
    } catch (e) {
      setEroare(e.message || 'Localitatea nu a putut fi încărcată.');
    } finally {
      setSeIncarca(false);
    }
  }, [id]);

  useEffect(() => {
    incarca();
  }, [incarca]);

  const istoric = useMemo(() => {
    const evenimente = [];
    if (localitate?.ultima_verificare) {
      evenimente.push({ id: 'localitate', tip: 'Localitate', nume: localitate.nume, data: localitate.ultima_verificare, responsabil: localitate.responsabil });
    }
    reguli.forEach((r) => {
      if (r.data_verificare) evenimente.push({ id: r.id, tip: 'Regulă', nume: r.denumire_regula, data: r.data_verificare, detalii: r.incredere });
    });
    surse.forEach((s) => {
      if (s.data_verificare) evenimente.push({ id: s.id, tip: 'Document', nume: s.titlu_document, data: s.data_verificare, detalii: s.status_act, responsabil: s.responsabil_verificare });
    });
    zone.forEach((z) => {
      if (z.data_verificare_geometrie) evenimente.push({ id: z.id, tip: 'Geometrie zonă', nume: z.nume_zona, data: z.data_verificare_geometrie, detalii: z.status_geometrie });
    });
    return evenimente.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }, [localitate, reguli, surse, zone]);

  if (seIncarca) return <StareIncarcare mesaj="Se încarcă localitatea…" />;
  if (eroare) return <StareEroare mesaj={eroare} onReincearca={incarca} />;
  if (!localitate) {
    return <EmptyState titlu="Localitatea nu a fost găsită" descriere="Înregistrarea poate fi arhivată sau eliminată." />;
  }

  const zoneCuGeometrie = zone.filter((z) => valideazaGeoJSON(z.geometrie_geojson).ok).length;
  const centru =
    typeof localitate.latitudine === 'number' && typeof localitate.longitudine === 'number'
      ? [localitate.latitudine, localitate.longitudine]
      : [44.45, 26.1];

  return (
    <div>
      <PageHeader
        titlu={localitate.nume}
        descriere={localitate.descriere || 'Detalii, reguli, zone și surse pentru această localitate.'}
        parinte={{ nume: 'Localități', cale: '/localitati' }}
        actiuni={
          <>
            <Button asChild variant="outline">
              <Link to={`/cauta-taxe?q=${encodeURIComponent(localitate.nume)}`}>
                <Search className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Caută taxe
              </Link>
            </Button>
            {esteAdmin ? (
              <>
                <Button variant="outline" onClick={() => setDialog({ tip: 'localitate', item: localitate })}>
                  <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Editează
                </Button>
                <Button variant="outline" onClick={() => setDialog({ tip: 'zona' })}>
                  <MapPin className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Adaugă zonă
                </Button>
                <Button onClick={() => setDialog({ tip: 'regula' })}>
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Adaugă regulă
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge valoare={localitate.prioritate} />
        <StatusBadge valoare={localitate.status_acoperire} />
        <StatusBadge valoare={localitate.status_reglementare} />
        <StatusBadge valoare={localitate.tip_localitate} />
        {localitate.este_demo ? <StatusBadge valoare="DEMO — DATE FICTIVE" /> : null}
        {localitate.archived ? <StatusBadge valoare="Arhivată" /> : null}
      </div>

      <Tabs defaultValue="prezentare">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start gap-1 bg-slate-100 p-1">
          <TabsTrigger value="prezentare">Prezentare generală</TabsTrigger>
          <TabsTrigger value="reguli">Taxe și restricții</TabsTrigger>
          <TabsTrigger value="zone">Zone pe hartă</TabsTrigger>
          <TabsTrigger value="surse">Acte și surse</TabsTrigger>
          <TabsTrigger value="istoric">Istoric verificări</TabsTrigger>
        </TabsList>

        <TabsContent value="prezentare" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { eticheta: 'Reguli de acces', valoare: numarRo(reguli.length, 0) },
              { eticheta: 'Zone definite', valoare: numarRo(zone.length, 0) },
              { eticheta: 'Zone cu geometrie validă', valoare: numarRo(zoneCuGeometrie, 0) },
              { eticheta: 'Documente-sursă', valoare: numarRo(surse.length, 0) },
            ].map((k) => (
              <div key={k.eticheta} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">{k.eticheta}</p>
                <p className="mt-1 font-heading text-xl font-semibold tabular-nums text-slate-900">{k.valoare}</p>
              </div>
            ))}
          </div>

          <dl className="rounded-lg border border-slate-200 bg-white px-4 py-1">
            {[
              { eticheta: 'Județ', valoare: localitate.judet || '—' },
              { eticheta: 'Coordonate', valoare: typeof localitate.latitudine === 'number' && typeof localitate.longitudine === 'number' ? `${numarRo(localitate.latitudine, 4)}, ${numarRo(localitate.longitudine, 4)}` : 'Nedefinite' },
              { eticheta: 'Ultima verificare', valoare: localitate.ultima_verificare ? dataRo(localitate.ultima_verificare) : 'Neverificată' },
              { eticheta: 'Următoarea verificare', valoare: localitate.urmatoarea_verificare ? dataRo(localitate.urmatoarea_verificare) : 'Neprogramată' },
              { eticheta: 'Responsabil', valoare: localitate.responsabil || 'Necompletat' },
            ].map((rand) => (
              <div key={rand.eticheta} className="flex flex-col gap-0.5 border-b border-slate-100 py-2 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4">
                <dt className="w-full shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500 sm:w-56">{rand.eticheta}</dt>
                <dd className="text-sm text-slate-800">{rand.valoare}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-slate-500">
            Regimul de taxare și regimul restricțiilor sunt gestionate independent: un status „Fără taxă confirmată” nu înseamnă
            automat că accesul este permis.
          </p>
        </TabsContent>

        <TabsContent value="reguli">
          {reguli.length === 0 ? (
            <EmptyState
              titlu="Nu există reguli pentru această localitate"
              descriere="Adaugă o regulă de acces pe baza documentelor oficiale disponibile."
              actiune={
                esteAdmin ? <Button onClick={() => setDialog({ tip: 'regula' })}>Adaugă o regulă</Button> : null
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-3 py-2 font-medium">Regulă</th>
                    <th scope="col" className="px-3 py-2 font-medium">Zonă</th>
                    <th scope="col" className="px-3 py-2 font-medium">Masă</th>
                    <th scope="col" className="px-3 py-2 font-medium">Valoare</th>
                    <th scope="col" className="px-3 py-2 font-medium">Încredere</th>
                    <th scope="col" className="px-3 py-2 font-medium">Status</th>
                    <th scope="col" className="px-3 py-2 font-medium">Verificare</th>
                    <th scope="col" className="px-3 py-2 font-medium">Acțiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {reguli.map((r) => {
                    return (
                      <tr key={r.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-3 py-2">
                          <span className="font-medium text-slate-800">{r.denumire_regula}</span>
                          <span className="block text-xs text-slate-500">{r.categorie_regula}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{zone.find((z) => z.id === r.zona_id)?.nume_zona || 'Întreaga localitate'}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {r.masa_min_t || r.masa_max_t ? `${masaRo(r.masa_min_t)} – ${masaRo(r.masa_max_t)}` : 'Nedocumentată'}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {r.valoare === null || r.valoare === undefined ? 'Nedocumentată' : sumaRo(r.valoare, r.moneda)}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge valoare={r.incredere} />
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge valoare={r.status} />
                        </td>
                        <td className="px-3 py-2 text-slate-600">{r.data_verificare ? dataRo(r.data_verificare) : 'Neverificată'}</td>
                        <td className="px-3 py-2">
                          <Button size="sm" variant="ghost" onClick={() => setRegulaDetaliata(r)}>
                            Vezi detalii
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="zone" className="space-y-4">
          {zone.length === 0 ? (
            <EmptyState
              titlu="Nu există zone definite"
              descriere="Zonele se adaugă împreună cu geometria GeoJSON furnizată de autoritate."
              actiune={esteAdmin ? <Button onClick={() => setDialog({ tip: 'zona' })}>Adaugă o zonă</Button> : null}
            />
          ) : (
            <>
              <HartaLeaflet localitati={[localitate]} zone={zone} centru={centru} zoom={12} />
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                {zone.map((z) => (
                  <li key={z.id} className="space-y-2 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-800">{z.nume_zona}</span>
                        <span className="text-xs text-slate-500">
                          {z.tip_zona} · geometrie: {valideazaGeoJSON(z.geometrie_geojson).ok ? 'disponibilă' : 'indisponibilă'} · verificată la{' '}
                          {dataRo(z.data_verificare_geometrie)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <StatusBadge valoare={z.status_geometrie} />
                        {esteAdmin ? (
                          <Button size="sm" variant="ghost" onClick={() => setDialog({ tip: 'zona', item: z })}>
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        ) : null}
                      </span>
                    </div>
                    <ZonaDescriere zona={z} compact />
                  </li>
                ))}
              </ul>
            </>
          )}
        </TabsContent>

        <TabsContent value="surse" className="space-y-4">
          {esteAdmin ? (
            <Button variant="outline" onClick={() => setDialog({ tip: 'sursa' })}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Adaugă document
            </Button>
          ) : null}
          {surse.length === 0 ? (
            <EmptyState
              icon={FileText}
              titlu="Nu există documente-sursă"
              descriere="Fără un document oficial asociat, regulile nu pot fi marcate „Confirmat”."
            />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {surse.map((s) => (
                <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800">
                      {s.tip_act} {s.numar_act ? `nr. ${s.numar_act}` : ''} · {s.titlu_document}
                    </span>
                    <span className="block text-xs text-slate-500">
                      Data actului: {dataRo(s.data_act)} · În vigoare: {dataRo(s.data_intrare_vigoare)} · Verificat:{' '}
                      {dataRo(s.data_verificare) || 'Neverificat'}
                    </span>
                    {s.note_verificare ? <span className="mt-1 block text-xs text-slate-600">{s.note_verificare}</span> : null}
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge valoare={s.status_act} />
                    {s.document_url ? (
                      <a
                        href={s.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 underline underline-offset-2"
                      >
                        {/\.pdf($|\?)/i.test(s.document_url) ? 'Vezi PDF' : 'Deschide documentul'}
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="text-xs text-amber-800">Link lipsă</span>
                    )}
                    {esteAdmin ? (
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ tip: 'sursa', item: s })}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="istoric">
          {istoric.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              titlu="Nu există verificări înregistrate"
              descriere="Datele de verificare se completează în formularele localității, regulilor, zonelor și documentelor."
            />
          ) : (
            <ol className="space-y-2">
              {istoric.map((e) => (
                <li key={`${e.tip}-${e.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800">{e.nume}</span>
                    <span className="text-xs text-slate-500">
                      {e.tip}
                      {e.detalii ? ` · ${e.detalii}` : ''}
                      {e.responsabil ? ` · responsabil: ${e.responsabil}` : ''}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">{dataRo(e.data)}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Istoricul se construiește din datele de verificare înregistrate pe localitate, reguli, zone și documente.{' '}
            <Link to="/alerte" className="text-blue-700 underline underline-offset-2">
              Vezi alertele de verificare
            </Link>
            .
          </p>
        </TabsContent>
      </Tabs>

      <LocalitateFormDialog
        open={dialog.tip === 'localitate'}
        onOpenChange={(o) => !o && setDialog({ tip: null })}
        localitate={dialog.item}
        onSalvat={incarca}
      />
      <ZonaFormDialog
        open={dialog.tip === 'zona'}
        onOpenChange={(o) => !o && setDialog({ tip: null })}
        zona={dialog.item}
        localitateId={id}
        localitati={[localitate]}
        onSalvat={incarca}
      />
      <TaxaFormDialog
        open={dialog.tip === 'regula'}
        onOpenChange={(o) => !o && setDialog({ tip: null })}
        localitateId={id}
        localitati={[localitate]}
        zone={zone}
        surse={surse}
        onSalvat={incarca}
      />
      <SursaFormDialog
        open={dialog.tip === 'sursa'}
        onOpenChange={(o) => !o && setDialog({ tip: null })}
        sursa={dialog.item}
        localitateId={id}
        localitati={[localitate]}
        onSalvat={incarca}
      />
      <RegulaDetaliiDialog
        open={!!regulaDetaliata}
        onOpenChange={(o) => !o && setRegulaDetaliata(null)}
        regula={regulaDetaliata}
        localitate={localitate}
        zona={zone.find((z) => z.id === regulaDetaliata?.zona_id)}
        sursa={surse.find((s) => s.id === regulaDetaliata?.act_normativ_id)}
      />
    </div>
  );
}