import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ExternalLink, Link2, Search } from 'lucide-react';
import { api } from '@/api/client';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import StareIncarcare from '@/components/StareIncarcare';
import StareEroare from '@/components/StareEroare';
import LocalitateSelect from '@/components/LocalitateSelect';
import VehiculSelect from '@/components/VehiculSelect';
import RegulaDetaliiDialog from '@/components/RegulaDetaliiDialog';
import ZonaDescriere from '@/components/ZonaDescriere';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { azi, contineFaraDiacritice, dataRo, faraDiacritice, masaRo, sumaRo } from '@/lib/format';
import { evalueazaRegula, grupeazaRezultate, marcheazaTarifeAlternative, regulaPotrivesteZona } from '@/lib/reguliTaxe';
import { CATEGORII_VEHICUL, TIPURI_MASA } from '@/lib/enum';

const STORAGE_KEY = 'mapix.cauta-taxe.v1';
const DURATE_RAPIDE = ['1', '7', '15', '30', '90'];
const FORM_DEFAULT = {
  localitate_id: '',
  zona_id: 'toate',
  masa: '',
  tip_masa: 'MTMA',
  data: azi(),
  tip_vehicul: 'Nespecificat',
  vehicul_id: '',
  durataZile: '1',
};

function citesteFormularSalvat() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

const GRUPE = [
  { cheie: 'interdictii', titlu: 'Interdicții confirmate', mesaj: 'Interdicție confirmată' },
  { cheie: 'restrictii', titlu: 'Restricții de acces', mesaj: 'Restricție identificată' },
  { cheie: 'taxe', titlu: 'Taxe de acces', mesaj: 'Taxă identificată' },
  { cheie: 'autorizatii', titlu: 'Autorizații necesare', mesaj: 'Autorizație necesară' },
  { cheie: 'exceptari', titlu: 'Exceptări documentate', mesaj: 'Exceptare identificată' },
  { cheie: 'neclare', titlu: 'Informații insuficiente', mesaj: 'Date insuficiente pentru o concluzie' },
];

function CardRegula({ evaluare, localitate, zone, surse, onDetalii }) {
  const { regula } = evaluare;
  const zona = zone.find((z) => z.id === regula.zona_id);
  const sursa = surse.find((s) => s.id === regula.act_normativ_id);
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading text-sm font-semibold text-slate-900">{regula.denumire_regula}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {localitate?.nume || 'Localitate necunoscută'}
            {zona ? ` · ${zona.nume_zona}` : ' · fără zonă definită'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge valoare={regula.categorie_regula} />
          <StatusBadge valoare={regula.incredere} />
          <StatusBadge valoare={evaluare.status} />
        </div>
      </div>

      <ZonaDescriere zona={zona} compact className="mt-3" />

      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-3 border-b border-slate-100 py-1">
          <dt className="text-xs text-slate-500">Criteriu de masă</dt>
          <dd className="text-right text-slate-800">
            {regula.tip_masa || 'Necunoscut'}
            {regula.masa_min_t || regula.masa_max_t
              ? ` · ${masaRo(regula.masa_min_t)} – ${masaRo(regula.masa_max_t)}`
              : ''}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-slate-100 py-1">
          <dt className="text-xs text-slate-500">Valoare</dt>
          <dd className="text-right text-slate-800">
            {regula.tip_taxa === 'Interzis'
              ? 'Interzis'
              : regula.tip_taxa === 'Gratuit' || evaluare.cost === 0
                ? 'Gratuit'
                : evaluare.cost != null
                  ? sumaRo(evaluare.cost, evaluare.moneda || regula.moneda)
                  : regula.valoare === null || regula.valoare === undefined
                    ? 'Nedocumentată'
                    : sumaRo(regula.valoare, regula.moneda)}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-slate-100 py-1">
          <dt className="text-xs text-slate-500">Unitate de tarifare</dt>
          <dd className="text-right text-slate-800">{regula.unitate_tarifare || '—'}</dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-slate-100 py-1">
          <dt className="text-xs text-slate-500">Interval orar</dt>
          <dd className="text-right text-slate-800">
            {regula.ora_start && regula.ora_end ? `${regula.ora_start}–${regula.ora_end}` : regula.orar_restrictie || 'Fără restricție orară'}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-slate-100 py-1">
          <dt className="text-xs text-slate-500">Valabilitate</dt>
          <dd className="text-right text-slate-800">
            {regula.perioada_valabilitate_start || regula.perioada_valabilitate_end
              ? `${dataRo(regula.perioada_valabilitate_start)} – ${dataRo(regula.perioada_valabilitate_end)}`
              : 'Nedocumentată'}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-slate-100 py-1">
          <dt className="text-xs text-slate-500">Ultima verificare</dt>
          <dd className="text-right text-slate-800">{regula.data_verificare ? dataRo(regula.data_verificare) : 'Nu a fost verificată'}</dd>
        </div>
      </dl>

      {evaluare.avertismente.length ? (
        <ul className="mt-2 space-y-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {evaluare.avertismente.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      ) : null}
      {evaluare.motiv ? <p className="mt-2 text-xs text-slate-500">{evaluare.motiv}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={onDetalii}>
          Vezi detalii
        </Button>
        {regula.sursa_url ? (
          <a
            href={regula.sursa_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
          >
            {/\.pdf($|\?)/i.test(regula.sursa_url) ? 'Vezi PDF' : 'Sursa oficială'}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : (
          <span className="text-xs text-amber-800">Link de sursă lipsă</span>
        )}
        {sursa ? <span className="text-xs text-slate-500">Act: {sursa.titlu_document}</span> : null}
      </div>
    </article>
  );
}

export default function CautaTaxe() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [localitati, setLocalitati] = useState([]);
  const [vehicule, setVehicule] = useState([]);
  const [zoneDisponibile, setZoneDisponibile] = useState([]);
  const [seIncarca, setSeIncarca] = useState(true);
  const [aIncarcatReferinte, setAIncarcatReferinte] = useState(false);
  const aIncarcatReferinteRef = useRef(false);
  const [eroare, setEroare] = useState(null);
  const [seCauta, setSeCauta] = useState(false);
  const [rezultate, setRezultate] = useState(null);
  const [regulaDetaliata, setRegulaDetaliata] = useState(null);
  const autoCautatRef = useRef('');

  const [form, setForm] = useState(() => {
    const salvat = citesteFormularSalvat();
    return {
      ...FORM_DEFAULT,
      data: azi(),
      ...(salvat
        ? {
            localitate_id: salvat.localitate_id || '',
            zona_id: salvat.zona_id || 'toate',
            masa: salvat.masa || '',
            tip_masa: salvat.tip_masa || 'MTMA',
            tip_vehicul: salvat.tip_vehicul || 'Nespecificat',
            durataZile: salvat.durataZile || '1',
          }
        : null),
    };
  });

  const incarca = useCallback(async () => {
    // Nu demonta formularul la reîncărcare — doar la primul load.
    if (!aIncarcatReferinteRef.current) setSeIncarca(true);
    setEroare(null);
    try {
      const [pageLocalitati, pageVehicule] = await Promise.all([
        api.entities.Localitate.filter(
          { archived: { $ne: true } },
          { sort: 'nume', limit: 500, fields: ['nume', 'judet', 'status_acoperire', 'status_reglementare'] }
        ),
        api.entities.Vehicul.filter({ status: 'Activ' }, { sort: 'numar_inmatriculare', limit: 200 }),
      ]);
      setLocalitati(pageLocalitati.items || []);
      setVehicule(pageVehicule.items || []);
      aIncarcatReferinteRef.current = true;
      setAIncarcatReferinte(true);
    } catch (e) {
      setEroare(e.message || 'Nu am putut încărca datele de referință.');
    } finally {
      setSeIncarca(false);
    }
  }, []);

  useEffect(() => {
    incarca();
  }, [incarca]);

  const rezolvaLocalitateDinUrl = useCallback(() => {
    const idParam = (searchParams.get('localitate') || '').trim();
    if (idParam && localitati.some((l) => l.id === idParam)) {
      return localitati.find((l) => l.id === idParam) || null;
    }
    const q = (searchParams.get('q') || '').trim();
    if (!q || !localitati.length) return null;
    const qNorm = faraDiacritice(q);
    // Doar potrivire exactă (fără diacritice) — partial match dă București greșit / haos.
    return localitati.find((l) => faraDiacritice(l.nume) === qNorm) || null;
  }, [localitati, searchParams]);

  // Prefill din query (?localitate=, ?q=, ?masa=, ?durata=, ?vehicul=)
  useEffect(() => {
    if (!localitati.length) return;
    const masaQ = searchParams.get('masa');
    const durataQ = searchParams.get('durata');
    const idVehicul = searchParams.get('vehicul');
    const gasita = rezolvaLocalitateDinUrl();
    const areUrlLocalitate = !!(searchParams.get('localitate') || searchParams.get('q'));

    setForm((f) => {
      let next = { ...f };
      let schimbat = false;
      if (gasita && gasita.id !== f.localitate_id) {
        next.localitate_id = gasita.id;
        next.zona_id = 'toate';
        schimbat = true;
      } else if (areUrlLocalitate && !gasita && f.localitate_id) {
        // q invalid (ex. „test”) — nu lăsa localitatea veche din session să pară rezultatul căutării
        next.localitate_id = '';
        next.zona_id = 'toate';
        schimbat = true;
      }
      if (masaQ != null && masaQ !== '') {
        next.masa = String(masaQ).replace('.', ',');
        schimbat = true;
      }
      if (durataQ != null && durataQ !== '') {
        next.durataZile = String(durataQ);
        schimbat = true;
      }
      if (idVehicul) {
        const vehicul = vehicule.find((v) => v.id === idVehicul);
        if (vehicul) {
          next.vehicul_id = vehicul.id;
          next.tip_masa = 'MTMA';
          if (vehicul.masa_maxima_autorizata_t != null) next.masa = String(vehicul.masa_maxima_autorizata_t);
          schimbat = true;
        }
      }
      return schimbat ? next : f;
    });
  }, [localitati, vehicule, searchParams, rezolvaLocalitateDinUrl]);

  // Zone la schimbarea localității (înainte de căutare)
  useEffect(() => {
    if (!form.localitate_id) {
      setZoneDisponibile([]);
      return;
    }
    let anulat = false;
    api.entities.Zona.filter({ localitate_id: form.localitate_id, archived: { $ne: true } }, { limit: 200 })
      .then((page) => {
        if (!anulat) setZoneDisponibile(page.items || []);
      })
      .catch(() => {
        if (!anulat) setZoneDisponibile([]);
      });
    return () => {
      anulat = true;
    };
  }, [form.localitate_id]);

  // Persistă formularul în sesiune
  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          localitate_id: form.localitate_id,
          zona_id: form.zona_id,
          masa: form.masa,
          tip_masa: form.tip_masa,
          tip_vehicul: form.tip_vehicul,
          durataZile: form.durataZile,
        })
      );
    } catch {
      /* ignore */
    }
  }, [form.localitate_id, form.zona_id, form.masa, form.tip_masa, form.tip_vehicul, form.durataZile]);

  const seteaza = (camp, valoare) => setForm((f) => ({ ...f, [camp]: valoare }));

  const localitateSelectata = useMemo(
    () => localitati.find((l) => l.id === form.localitate_id) || null,
    [localitati, form.localitate_id]
  );

  const zonePentruSelect = zoneDisponibile.length ? zoneDisponibile : rezultate?.zone || [];

  const cauta = useCallback(
    async (e, optiuni = {}) => {
      e?.preventDefault();
      const localitateId = optiuni.localitateId || form.localitate_id;
      if (!localitateId) {
        setRezultate({ eroare: 'Selectează mai întâi o localitate.' });
        return;
      }
      const masa = optiuni.masa !== undefined ? optiuni.masa : form.masa;
      const tipMasa = optiuni.tipMasa || form.tip_masa;
      const data = optiuni.data || form.data || azi();
      const durataZile = optiuni.durataZile !== undefined ? optiuni.durataZile : form.durataZile;
      const zonaId = optiuni.zonaId || form.zona_id;

      setSeCauta(true);
      setRezultate(null);
      try {
        const [pageReguli, pageZone, pageSurse] = await Promise.all([
          api.entities.TaxaAcces.filter({ localitate_id: localitateId, status: { $ne: 'Arhivat' } }, { limit: 300 }),
          api.entities.Zona.filter({ localitate_id: localitateId, archived: { $ne: true } }, { limit: 200 }),
          api.entities.SursaAct.filter({ localitate_id: localitateId }, { limit: 200 }),
        ]);
        const reguli = pageReguli.items || [];
        const zone = pageZone.items || [];
        setZoneDisponibile(zone);
        const reguliFiltrate = reguli.filter((r) => regulaPotrivesteZona(r, zonaId, zone));
        const context = {
          masa: masa === '' || masa == null ? null : Number(String(masa).replace(',', '.')),
          tipMasa,
          data,
          durataZile: durataZile === '' || durataZile == null ? null : Number(durataZile),
        };
        const evaluari = marcheazaTarifeAlternative(
          reguliFiltrate.map((r) => evalueazaRegula(r, context)),
          context.durataZile
        );
        setRezultate({
          evaluari,
          grupe: grupeazaRezultate(evaluari.filter((r) => r.status !== 'Exclus' && !(r.status === 'Neaplicabil' && !r.faraCost))),
          excluse: evaluari.filter((r) => r.status === 'Exclus' || (r.status === 'Neaplicabil' && !r.faraCost)),
          zone,
          surse: pageSurse.items || [],
          context,
          numarReguli: reguli.length,
        });

        const loc = localitati.find((l) => l.id === localitateId);
        const next = new URLSearchParams();
        next.set('localitate', localitateId);
        if (loc?.nume) next.set('q', loc.nume);
        if (masa) next.set('masa', String(masa).replace(',', '.'));
        if (durataZile) next.set('durata', String(durataZile));
        const cheie = `auto:${localitateId}|${masa}|${durataZile}`;
        autoCautatRef.current = cheie;
        setSearchParams(next, { replace: true });
      } catch (err) {
        setRezultate({ eroare: err.message || 'Căutarea nu a putut fi efectuată.' });
      } finally {
        setSeCauta(false);
      }
    },
    [form, localitati, setSearchParams]
  );

  // Auto-căutare după navigare header (?localitate= / ?q= exact) — abia când form-ul e aliniat.
  useEffect(() => {
    if (seIncarca || !localitati.length) return;
    const gasita = rezolvaLocalitateDinUrl();
    if (!gasita) {
      const qOrfana = (searchParams.get('q') || searchParams.get('localitate') || '').trim();
      if (qOrfana) {
        setRezultate((prev) =>
          prev?.eroare === 'Localitatea din căutare nu a fost găsită în catalog.'
            ? prev
            : { eroare: 'Localitatea din căutare nu a fost găsită în catalog.' }
        );
      }
      return;
    }
    if (form.localitate_id !== gasita.id) return;
    const masaQ = searchParams.get('masa');
    const durataQ = searchParams.get('durata');
    const masa = masaQ != null && masaQ !== '' ? String(masaQ).replace('.', ',') : form.masa;
    const durataZile = durataQ != null && durataQ !== '' ? String(durataQ) : form.durataZile;
    const cheie = `auto:${gasita.id}|${masa}|${durataZile}`;
    if (autoCautatRef.current === cheie) return;
    autoCautatRef.current = cheie;
    cauta(null, { localitateId: gasita.id, masa, durataZile, zonaId: 'toate' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, form.localitate_id, localitati, seIncarca, rezolvaLocalitateDinUrl]);

  const reseteaza = () => {
    setForm({ ...FORM_DEFAULT, data: azi() });
    setRezultate(null);
    setZoneDisponibile([]);
    setSearchParams({}, { replace: true });
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const copiazaLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copiat', description: 'Poți partaja căutarea curentă.' });
    } catch {
      toast({ title: 'Nu am putut copia linkul', variant: 'destructive' });
    }
  };

  const aplicaVehicul = (id) => {
    const v = vehicule.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      vehicul_id: id,
      masa: v && v.masa_maxima_autorizata_t !== undefined && v.masa_maxima_autorizata_t !== null ? String(v.masa_maxima_autorizata_t) : f.masa,
      tip_masa: 'MTMA',
    }));
  };

  if (seIncarca && !aIncarcatReferinte) return <StareIncarcare mesaj="Se încarcă datele de referință…" />;
  if (eroare && !localitati.length) return <StareEroare mesaj={eroare} onReincearca={incarca} />;

  const mesajRezumat = (rezultate) => {
    if (!rezultate) return null;
    const { grupe } = rezultate;
    if (grupe.interdictii.length) return { text: 'Interdicție confirmată', ton: 'rosu' };
    if (grupe.taxe.length || grupe.autorizatii.length) return { text: 'Reguli identificate pentru condițiile introduse', ton: 'albastru' };
    if (grupe.neclare.length) return { text: 'Date insuficiente pentru o concluzie', ton: 'chihlimbar' };
    return { text: 'Nu au fost găsite reguli confirmate în baza de date', ton: 'chihlimbar' };
  };

  return (
    <div>
      <PageHeader
        titlu="Caută taxe și restricții"
        descriere="Verifică ce reguli de acces se aplică unui vehicul, pentru o localitate și o dată de deplasare."
      />

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <form onSubmit={cauta} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 lg:sticky lg:top-20 lg:self-start">
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Localitate *</Label>
            <LocalitateSelect localitati={localitati} value={form.localitate_id} onChange={(v) => setForm((f) => ({ ...f, localitate_id: v, zona_id: 'toate' }))} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Zonă (opțional)</Label>
            <Select value={form.zona_id} onValueChange={(v) => seteaza('zona_id', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toate">Toate zonele localității</SelectItem>
                {zonePentruSelect.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.nume_zona}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ZonaDescriere
              zona={zonePentruSelect.find((z) => z.id === form.zona_id)}
              compact
              className="mt-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-slate-600">Masă relevantă (t)</Label>
              <Input inputMode="decimal" value={form.masa} onChange={(e) => seteaza('masa', e.target.value)} placeholder="7,5" />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-slate-600">Tip masă</Label>
              <Select value={form.tip_masa} onValueChange={(v) => seteaza('tip_masa', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPURI_MASA.filter((t) => t !== 'Necunoscut').map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-slate-600">Data deplasării</Label>
              <Input type="date" value={form.data} onChange={(e) => seteaza('data', e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-slate-600">Durată acces (zile)</Label>
              <Input inputMode="numeric" value={form.durataZile} onChange={(e) => seteaza('durataZile', e.target.value)} placeholder="1" />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {DURATE_RAPIDE.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => seteaza('durataZile', d)}
                    className={`rounded border px-1.5 py-0.5 text-[11px] ${
                      form.durataZile === d
                        ? 'border-blue-500 bg-blue-50 text-blue-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {d === '1' ? '1 zi' : `${d} zile`}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Implicit 1 zi — necesar pentru tarifele „per zi”.</p>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Tip vehicul (opțional)</Label>
            <Select value={form.tip_vehicul} onValueChange={(v) => seteaza('tip_vehicul', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Nespecificat">Nespecificat</SelectItem>
                {CATEGORII_VEHICUL.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {vehicule.length ? (
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-slate-600">Completează din vehiculele organizației</Label>
              <VehiculSelect vehicule={vehicule} value={form.vehicul_id} onChange={aplicaVehicul} />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" disabled={seCauta}>
              <Search className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {seCauta ? 'Se verifică…' : 'Verifică accesul'}
            </Button>
            <Button type="button" variant="outline" onClick={reseteaza}>
              Resetează
            </Button>
          </div>
        </form>

        <div className="space-y-4">
          {seCauta ? <StareIncarcare mesaj="Se caută regulile aplicabile…" /> : null}

          {rezultate?.eroare ? <StareEroare mesaj={rezultate.eroare} /> : null}

          {rezultate && !rezultate.eroare ? (
            <>
              {(() => {
                const rezumat = mesajRezumat(rezultate);
                return (
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge valoare={rezumat.text} />
                      <Button type="button" size="sm" variant="outline" onClick={copiazaLink}>
                        <Link2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        Copiază link
                      </Button>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Condiții verificate: masa {rezultate.context.masa === null ? 'neintrodusă' : `${rezultate.context.masa} t`} (
                      {rezultate.context.tipMasa}), data deplasării {dataRo(rezultate.context.data)}
                      {rezultate.context.durataZile ? `, durată ${rezultate.context.durataZile} zile` : ''}.
                    </p>
                    {localitateSelectata?.status_reglementare ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Regim documentat pentru localitate:{' '}
                        <span className="font-medium text-slate-700">{localitateSelectata.status_reglementare}</span>
                        {localitateSelectata.status_acoperire
                          ? ` · acoperire ${localitateSelectata.status_acoperire}`
                          : ''}
                      </p>
                    ) : null}
                    {localitateSelectata && localitateSelectata.status_acoperire !== 'Verificată' ? (
                      <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Regimul de acces pentru {localitateSelectata.nume} nu a fost încă verificat complet (status acoperire:{' '}
                        {localitateSelectata.status_acoperire}). Rezultatul se bazează doar pe regulile existente în baza de date.
                      </p>
                    ) : null}
                    {rezultate.numarReguli === 0 ? (
                      <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Nu există nicio regulă înregistrată pentru localitatea selectată. Absența unei înregistrări nu înseamnă că
                        nu există obligații legale.
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">
                      Verifică informația la sursa oficială înainte de deplasare. Rezultatul nu reprezintă o autorizare de acces.
                    </p>
                  </div>
                );
              })()}

              {GRUPE.map(({ cheie, titlu }) => {
                const lista = rezultate.grupe[cheie] || [];
                if (!lista.length) return null;
                return (
                  <section key={cheie} aria-labelledby={`grupa-${cheie}`}>
                    <h2 id={`grupa-${cheie}`} className="mb-2 font-heading text-sm font-semibold text-slate-700">
                      {titlu} <span className="text-slate-400">({lista.length})</span>
                    </h2>
                    <div className="space-y-3">
                      {lista.map((evaluare) => (
                        <CardRegula
                          key={evaluare.regula.id}
                          evaluare={evaluare}
                          localitate={localitateSelectata}
                          zone={rezultate.zone}
                          surse={rezultate.surse}
                          onDetalii={() => setRegulaDetaliata(evaluare.regula)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}

              {rezultate.excluse.length ? (
                <details className="rounded-lg border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer text-sm font-medium text-slate-700">
                    Reguli care nu se aplică acestei deplasări ({rezultate.excluse.length})
                  </summary>
                  <ul className="mt-3 space-y-2">
                    {rezultate.excluse.map((evaluare) => (
                      <li key={evaluare.regula.id} className="border-b border-slate-100 pb-2 text-sm last:border-b-0">
                        <span className="font-medium text-slate-800">{evaluare.regula.denumire_regula}</span>
                        <span className="ml-2 text-xs text-slate-500">{evaluare.motiv}</span>
                        <StatusBadge valoare={evaluare.status} className="ml-2" />
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              {!Object.values(rezultate.grupe).some((l) => l.length) && !rezultate.excluse.length ? (
                <EmptyState
                  titlu="Nu există rezultate"
                  descriere="Nu am găsit nicio regulă pentru condițiile introduse. Verifică masa, zona și data deplasării."
                />
              ) : null}
            </>
          ) : null}

          {!rezultate && !seCauta ? (
            <EmptyState
              icon={Search}
              titlu="Începe o verificare"
              descriere="Selectează localitatea, masa vehiculului și data deplasării, apoi apasă „Verifică accesul”. Rezultatele arată separat taxele, autorizațiile, restricțiile și informațiile lipsă."
              actiune={
                <Button asChild variant="outline">
                  <Link to="/baza-taxe">Vezi baza de taxe</Link>
                </Button>
              }
            />
          ) : null}
        </div>
      </div>

      <RegulaDetaliiDialog
        open={!!regulaDetaliata}
        onOpenChange={(o) => !o && setRegulaDetaliata(null)}
        regula={regulaDetaliata}
        localitate={localitateSelectata}
        zona={(rezultate?.zone || []).find((z) => z.id === regulaDetaliata?.zona_id)}
        sursa={(rezultate?.surse || []).find((s) => s.id === regulaDetaliata?.act_normativ_id)}
      />
    </div>
  );
}