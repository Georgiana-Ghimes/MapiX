import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, MapPin } from 'lucide-react';
import { api } from '@/api/client';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import StareIncarcare from '@/components/StareIncarcare';
import StareEroare from '@/components/StareEroare';
import EmptyState from '@/components/EmptyState';
import HartaLeaflet from '@/components/HartaLeaflet';
import LocalitateSelect from '@/components/LocalitateSelect';
import ZonaDescriere from '@/components/ZonaDescriere';
import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dataRo, masaRo, sumaRo } from '@/lib/format';
import { evalueazaRegula, valideazaGeoJSON } from '@/lib/reguliTaxe';
import { STATUS_REGLEMENTARE, TIPURI_ZONA } from '@/lib/enum';

const LEGENDA = [
  { eticheta: 'Taxă de acces identificată', culoare: '#2563eb', umplere: '#3b82f6', linie: 'solid' },
  { eticheta: 'Zonă cu restricții', culoare: '#d97706', umplere: '#f59e0b', linie: 'solid' },
  { eticheta: 'Zonă cu interdicție confirmată', culoare: '#dc2626', umplere: '#ef4444', linie: 'solid' },
  { eticheta: 'Zonă neverificată (contur întrerupt)', culoare: '#475569', umplere: '#94a3b8', linie: 'intrerupt' },
  { eticheta: 'Geometrie indisponibilă (fără poligon)', culoare: '#94a3b8', umplere: 'transparent', linie: 'punctat' },
];

export default function Harta() {
  const [localitati, setLocalitati] = useState([]);
  const [zone, setZone] = useState([]);
  const [seIncarca, setSeIncarca] = useState(true);
  const [eroare, setEroare] = useState(null);
  const [localitateSelectata, setLocalitateSelectata] = useState('toate');
  const [zonaSelectata, setZonaSelectata] = useState(null);
  const [reguliZona, setReguliZona] = useState([]);
  const [filtre, setFiltre] = useState({ tip_zona: 'toate', status_reglementare: 'toate', doarConfirmate: false, data: '' });

  const incarca = useCallback(async () => {
    setSeIncarca(true);
    setEroare(null);
    try {
      const [pageLocalitati, pageZone] = await Promise.all([
        api.entities.Localitate.filter(
          { archived: { $ne: true } },
          { sort: 'nume', limit: 500, fields: ['nume', 'judet', 'prioritate', 'status_reglementare', 'status_acoperire', 'latitudine', 'longitudine'] }
        ),
        api.entities.Zona.filter({ archived: { $ne: true } }, { sort: 'nume_zona', limit: 500 }),
      ]);
      setLocalitati(pageLocalitati.items || []);
      setZone(pageZone.items || []);
    } catch (e) {
      setEroare(e.message || 'Nu am putut încărca datele hărții.');
    } finally {
      setSeIncarca(false);
    }
  }, []);

  useEffect(() => {
    incarca();
  }, [incarca]);

  useEffect(() => {
    if (!zonaSelectata) {
      setReguliZona([]);
      return;
    }
    api.entities.TaxaAcces.filter({ zona_id: zonaSelectata.id, status: { $ne: 'Arhivat' } }, { limit: 100 })
      .then((page) => setReguliZona(page.items || []))
      .catch(() => setReguliZona([]));
  }, [zonaSelectata]);

  const localitateCurenta = useMemo(
    () => localitati.find((l) => l.id === localitateSelectata) || null,
    [localitati, localitateSelectata]
  );

  const localitatiFiltrate = useMemo(() => {
    if (filtre.status_reglementare === 'toate') return localitati;
    return localitati.filter((l) => l.status_reglementare === filtre.status_reglementare);
  }, [localitati, filtre.status_reglementare]);

  const zoneFiltrate = useMemo(() => {
    const idLocalitati = new Set(localitatiFiltrate.map((l) => l.id));
    return zone.filter((z) => {
      if (!idLocalitati.has(z.localitate_id)) return false;
      if (localitateSelectata && localitateSelectata !== 'toate' && z.localitate_id !== localitateSelectata) return false;
      if (filtre.tip_zona !== 'toate' && z.tip_zona !== filtre.tip_zona) return false;
      if (filtre.doarConfirmate && z.status_geometrie !== 'Confirmată') return false;
      return true;
    });
  }, [zone, localitatiFiltrate, localitateSelectata, filtre.tip_zona, filtre.doarConfirmate]);

  const zoneFaraGeometrie = useMemo(
    () => zoneFiltrate.filter((z) => !valideazaGeoJSON(z.geometrie_geojson).ok),
    [zoneFiltrate]
  );

  const centru = localitateCurenta && typeof localitateCurenta.latitudine === 'number'
    ? [localitateCurenta.latitudine, localitateCurenta.longitudine]
    : zoneFiltrate.length && typeof zoneFiltrate[0].centru_latitudine === 'number'
      ? [zoneFiltrate[0].centru_latitudine, zoneFiltrate[0].centru_longitudine]
      : [44.45, 26.1];

  const regulileZonei = useMemo(() => {
    if (!zonaSelectata) return [];
    return reguliZona.map((r) => evalueazaRegula(r, { data: filtre.data || undefined, masa: null, tipMasa: null }));
  }, [reguliZona, zonaSelectata, filtre.data]);

  if (seIncarca) return <StareIncarcare mesaj="Se încarcă harta…" />;
  if (eroare) return <StareEroare mesaj={eroare} onReincearca={incarca} />;

  const localitatiCuCoordonate = localitatiFiltrate.filter(
    (l) => typeof l.latitudine === 'number' && typeof l.longitudine === 'number'
  );

  return (
    <div>
      <PageHeader
        titlu="Hartă taxe și restricții"
        descriere="Localitățile cu coordonate cunoscute și zonele cu geometrie GeoJSON încărcată. Poligoanele nu sunt generate automat — se afișează doar geometria documentată."
      />

      <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Localitate</Label>
          <LocalitateSelect
            localitati={localitati}
            value={localitateSelectata}
            onChange={(v) => {
              setLocalitateSelectata(v);
              setZonaSelectata(null);
            }}
            toateEticheta="Toate localitățile"
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Tip zonă</Label>
          <Select value={filtre.tip_zona} onValueChange={(v) => setFiltre((f) => ({ ...f, tip_zona: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Toate tipurile</SelectItem>
              {TIPURI_ZONA.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Status reglementare</Label>
          <Select value={filtre.status_reglementare} onValueChange={(v) => setFiltre((f) => ({ ...f, status_reglementare: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Toate statusurile</SelectItem>
              {STATUS_REGLEMENTARE.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Data aplicării</Label>
            <Input type="date" value={filtre.data} onChange={(e) => setFiltre((f) => ({ ...f, data: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox
              checked={filtre.doarConfirmate}
              onCheckedChange={(bifat) => setFiltre((f) => ({ ...f, doarConfirmate: !!bifat }))}
            />
            Doar geometrii confirmate
          </label>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <HartaLeaflet
            localitati={localitatiFiltrate}
            zone={zoneFiltrate}
            centru={centru}
            onSelectZona={(z) => setZonaSelectata(z)}
            onSelectLocalitate={(l) => setLocalitateSelectata(l.id)}
          />
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 font-heading text-sm font-semibold text-slate-700">Legendă</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {LEGENDA.map((item) => (
                <li key={item.eticheta} className="flex items-center gap-2 text-xs text-slate-600">
                  <span
                    className="h-3.5 w-5 shrink-0 rounded-sm border-2"
                    style={{
                      borderColor: item.culoare,
                      backgroundColor: item.umplere === 'transparent' ? 'transparent' : item.umplere,
                      borderStyle: item.linie === 'intrerupt' ? 'dashed' : item.linie === 'punctat' ? 'dotted' : 'solid',
                    }}
                    aria-hidden="true"
                  />
                  {item.eticheta}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Sunt afișate {localitatiCuCoordonate.length} localități cu coordonate și {zoneFiltrate.length - zoneFaraGeometrie.length} zone cu
              geometrie validă. Harta folosește OpenStreetMap și este orientativă.
            </p>
          </div>
        </div>

        <aside className="space-y-4">
          {zonaSelectata ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="font-heading text-sm font-semibold text-slate-900">{zonaSelectata.nume_zona}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge valoare={zonaSelectata.tip_zona} />
                <StatusBadge valoare={zonaSelectata.status_geometrie} />
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-xs text-slate-500">Localitate</dt>
                  <dd className="text-slate-800">{localitati.find((l) => l.id === zonaSelectata.localitate_id)?.nume || '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-xs text-slate-500">Cod zonă</dt>
                  <dd className="text-slate-800">{zonaSelectata.cod_zona || '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-xs text-slate-500">Geometrie verificată la</dt>
                  <dd className="text-slate-800">{dataRo(zonaSelectata.data_verificare_geometrie)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-xs text-slate-500">Valabilitate</dt>
                  <dd className="text-slate-800">
                    {zonaSelectata.valabil_de || zonaSelectata.valabil_pana
                      ? `${dataRo(zonaSelectata.valabil_de)} – ${dataRo(zonaSelectata.valabil_pana)}`
                      : 'Nedocumentată'}
                  </dd>
                </div>
              </dl>
              <ZonaDescriere zona={zonaSelectata} className="mt-3" />
              {zonaSelectata.sursa_geometrie_url ? (
                <a
                  href={zonaSelectata.sursa_geometrie_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 underline underline-offset-2"
                >
                  Sursa geometriei
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              ) : null}

              <h3 className="mt-4 font-heading text-xs font-semibold uppercase tracking-wide text-slate-500">Reguli asociate</h3>
              {regulileZonei.length === 0 ? (
                <p className="mt-1 text-sm text-amber-800">Nu există reguli asociate acestei zone în baza de date.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {regulileZonei.map((evaluare) => (
                    <li key={evaluare.regula.id} className="rounded-md border border-slate-200 px-3 py-2">
                      <p className="text-sm font-medium text-slate-800">{evaluare.regula.denumire_regula}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {evaluare.regula.categorie_regula} · {masaRo(evaluare.regula.masa_min_t)} – {masaRo(evaluare.regula.masa_max_t)} ·{' '}
                        {evaluare.regula.valoare === null || evaluare.regula.valoare === undefined
                          ? 'valoare nedocumentată'
                          : sumaRo(evaluare.regula.valoare, evaluare.regula.moneda)}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <StatusBadge valoare={evaluare.regula.incredere} />
                        <StatusBadge valoare={evaluare.status} />
                      </div>
                      {evaluare.motiv ? <p className="mt-1 text-xs text-slate-500">{evaluare.motiv}</p> : null}
                    </li>
                  ))}
                </ul>
              )}

              <Button asChild size="sm" variant="outline" className="mt-3 w-full">
                <Link to={`/localitati/${zonaSelectata.localitate_id}`}>Deschide pagina localității</Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-600">
                Selectează un poligon de pe hartă pentru a vedea zona, regulile asociate și sursele. Selectează un punct pentru a
                deschide localitatea.
              </p>
            </div>
          )}

          {zoneFaraGeometrie.length ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
              <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-amber-900">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                Geometrie indisponibilă ({zoneFaraGeometrie.length})
              </h2>
              <ul className="mt-2 space-y-1 text-xs text-amber-900">
                {zoneFaraGeometrie.slice(0, 8).map((z) => (
                  <li key={z.id}>
                    {z.nume_zona} · {localitati.find((l) => l.id === z.localitate_id)?.nume || '—'}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-900">
                Aceste zone nu pot fi afișate pe hartă până când nu se încarcă geometria GeoJSON oficială.
              </p>
            </div>
          ) : null}

          {zone.length === 0 ? (
            <EmptyState
              titlu="Nu există zone definite"
              descriere="Adaugă zone din pagina unei localități, împreună cu geometria GeoJSON furnizată de autoritate."
              actiune={
                <Button asChild variant="outline">
                  <Link to="/localitati">Deschide localitățile</Link>
                </Button>
              }
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}