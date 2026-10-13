import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Archive, Pencil, Plus, Search } from 'lucide-react';
import { api } from '@/api/client';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import StareIncarcare from '@/components/StareIncarcare';
import StareEroare from '@/components/StareEroare';
import TaxaFormDialog from '@/components/TaxaFormDialog';
import RegulaDetaliiDialog from '@/components/RegulaDetaliiDialog';
import LocalitateSelect from '@/components/LocalitateSelect';
import ListaJudetExpand from '@/components/ListaJudetExpand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { azi, dataRo, masaRo, numarRo, sumaRo } from '@/lib/format';
import { gruparePeJudet } from '@/lib/grupareJudet';
import { PANEL_FILTERS } from '@/lib/uiPanel';
import { cn } from '@/lib/utils';
import { detecteazaSuprapuneri } from '@/lib/reguliTaxe';
import { CATEGORII_REGULA, MONEDE, NIVELURI_INCREDERE, STATUSURI_TAXA } from '@/lib/enum';

const FILTRE_GOL = {
  cautare: '',
  localitate: 'toate',
  categorie: 'toate',
  incredere: 'toate',
  status: 'toate',
  moneda: 'toate',
  expirate: false,
  arhivate: false,
  sort: 'verificare',
};

export default function BazaTaxe() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const esteAdmin = user?.role === 'admin';
  const [lista, setLista] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [areMaiMulte, setAreMaiMulte] = useState(false);
  const [localitati, setLocalitati] = useState([]);
  const [zone, setZone] = useState([]);
  const [surse, setSurse] = useState([]);
  const [seIncarcaInitial, setSeIncarcaInitial] = useState(true);
  const [seFiltreaza, setSeFiltreaza] = useState(false);
  const [seIncarcaMaiMulte, setSeIncarcaMaiMulte] = useState(false);
  const [eroare, setEroare] = useState(null);
  const [filtre, setFiltre] = useState(() => {
    const status = searchParams.get('status');
    return {
      ...FILTRE_GOL,
      ...(status ? { status } : {}),
    };
  });
  const [cautareDebounced, setCautareDebounced] = useState('');
  const [formular, setFormular] = useState({ deschis: false, item: null, localitateId: null });
  const [detalii, setDetalii] = useState(null);
  const [deArhivat, setDeArhivat] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setCautareDebounced(filtre.cautare.trim()), 250);
    return () => clearTimeout(t);
  }, [filtre.cautare]);

  const filtreEfective = useMemo(
    () => ({ ...filtre, cautare: cautareDebounced }),
    [
      filtre.localitate,
      filtre.categorie,
      filtre.incredere,
      filtre.status,
      filtre.moneda,
      filtre.expirate,
      filtre.arhivate,
      filtre.sort,
      cautareDebounced,
    ]
  );

  const construiesteQuery = useCallback((f, localitateIdsDinCautare = []) => {
    const conditii = [];
    if (f.localitate !== 'toate') conditii.push({ localitate_id: f.localitate });
    if (f.categorie !== 'toate') conditii.push({ categorie_regula: f.categorie });
    if (f.incredere !== 'toate') conditii.push({ incredere: f.incredere });
    if (f.status !== 'toate') conditii.push({ status: f.status });
    else if (!f.arhivate) conditii.push({ status: { $ne: 'Arhivat' } });
    if (f.moneda !== 'toate') conditii.push({ moneda: f.moneda });
    if (f.cautare) {
      const or = [{ denumire_regula: { $regex: f.cautare, $options: 'i' } }];
      if (localitateIdsDinCautare.length) or.push({ localitate_id: { $in: localitateIdsDinCautare } });
      conditii.push(or.length === 1 ? or[0] : { $or: or });
    }
    if (f.expirate) conditii.push({ $or: [{ status: 'Expirat' }, { perioada_valabilitate_end: { $lt: azi() } }] });
    if (conditii.length === 0) return {};
    if (conditii.length === 1) return conditii[0];
    return { $and: conditii };
  }, []);

  const sortare = useMemo(() => {
    const harta = { verificare: '-data_verificare', nume: 'denumire_regula', valoare_asc: 'valoare', valoare_desc: '-valoare' };
    return harta[filtreEfective.sort] || '-data_verificare';
  }, [filtreEfective.sort]);

  const incarca = useCallback(
    async ({ reset = true, initial = false } = {}) => {
      // Expand pe județ: la reset încărcăm tot setul filtrat (nu doar 50).
      if (!reset) setSeIncarcaMaiMulte(true);
      else if (initial) {
        setSeIncarcaInitial(true);
        setEroare(null);
      } else setSeFiltreaza(true);
      try {
        let localitateIdsDinCautare = [];
        if (filtreEfective.cautare) {
          const pageLoc = await api.entities.Localitate.filter(
            { nume: { $regex: filtreEfective.cautare, $options: 'i' }, archived: { $ne: true } },
            { limit: 200, fields: ['id'] }
          );
          localitateIdsDinCautare = (pageLoc.items || []).map((l) => l.id);
        }
        const query = construiesteQuery(filtreEfective, localitateIdsDinCautare);
        const LIMIT = 200;
        const MAX = 5000;

        if (!reset) {
          const page = await api.entities.TaxaAcces.filter(query, {
            sort: sortare,
            limit: LIMIT,
            cursor: cursor || undefined,
          });
          const chunk = page.items || [];
          setLista((prev) => [...prev, ...chunk]);
          setCursor(page.next_cursor || null);
          setAreMaiMulte(!!page.has_more && chunk.length > 0);
        } else {
          const acumulate = [];
          let cursorCurent;
          let hasMore = true;
          while (hasMore && acumulate.length < MAX) {
            const page = await api.entities.TaxaAcces.filter(query, {
              sort: sortare,
              limit: LIMIT,
              cursor: cursorCurent,
            });
            const chunk = page.items || [];
            acumulate.push(...chunk);
            hasMore = !!page.has_more && chunk.length > 0;
            cursorCurent = page.next_cursor || null;
          }
          setLista(acumulate);
          setCursor(cursorCurent || null);
          setAreMaiMulte(hasMore);
        }
        setEroare(null);
      } catch (e) {
        setEroare(e.message || 'Nu am putut încărca baza de taxe.');
      } finally {
        setSeIncarcaInitial(false);
        setSeFiltreaza(false);
        setSeIncarcaMaiMulte(false);
      }
    },
    [construiesteQuery, sortare, cursor, filtreEfective]
  );

  const incarcaReferinte = useCallback(async () => {
    try {
      const [pageLocalitati, pageZone, pageSurse] = await Promise.all([
        api.entities.Localitate.filter(
          { archived: { $ne: true } },
          { sort: 'nume', limit: 500, fields: ['nume', 'judet', 'prioritate', 'tip_localitate'] }
        ),
        api.entities.Zona.filter({ archived: { $ne: true } }, { limit: 500, fields: ['nume_zona', 'localitate_id', 'descriere'] }),
        api.entities.SursaAct.filter({}, { limit: 500, fields: ['titlu_document', 'localitate_id', 'numar_act', 'tip_act'] }),
      ]);
      setLocalitati(pageLocalitati.items || []);
      setZone(pageZone.items || []);
      setSurse(pageSurse.items || []);
    } catch {
      setLocalitati([]);
      setZone([]);
      setSurse([]);
    }
  }, []);

  useEffect(() => {
    incarca({ reset: true, initial: seIncarcaInitial && lista.length === 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when effective filters change
  }, [filtreEfective]);

  useEffect(() => {
    incarcaReferinte();
  }, [incarcaReferinte]);

  useEffect(() => {
    const parametri = new URLSearchParams(window.location.search);
    const idRegula = parametri.get('regula');
    if (!idRegula) return;
    api.entities.TaxaAcces.get(idRegula)
      .then((r) => setDetalii(r))
      .catch(() => setDetalii(null));
  }, []);

  const metaLocalitate = (id) => localitati.find((l) => l.id === id);
  const numeLocalitate = (id) => metaLocalitate(id)?.nume || '—';

  const faraSursa = useMemo(() => lista.filter((r) => !r.sursa_url && !r.act_normativ_id), [lista]);
  const suprapuneri = useMemo(() => detecteazaSuprapuneri(lista).slice(0, 5), [lista]);
  const listaPeJudet = useMemo(
    () =>
      gruparePeJudet(lista, {
        getJudet: (r) => metaLocalitate(r.localitate_id)?.judet,
        getLocId: (r) => r.localitate_id,
        getLocNume: (r) => {
          const l = metaLocalitate(r.localitate_id);
          if (!l) return '—';
          return l.tip_localitate ? `${l.nume} · ${l.tip_localitate}` : l.nume;
        },
        getPrioritate: (r) => metaLocalitate(r.localitate_id)?.prioritate,
        getZonaId: (r) => r.zona_id || null,
        getZonaNume: (r) => zone.find((z) => z.id === r.zona_id)?.nume_zona || 'Întreaga localitate',
      }),
    // localitati / zone drive meta lookups
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lista, localitati, zone]
  );
  const rezumatLista = useMemo(() => {
    const nrJudete = listaPeJudet.length;
    const nrLocalitati = listaPeJudet.reduce((n, j) => n + (j.nrLocalitati || 0), 0);
    return { nrJudete, nrLocalitati, nrReguli: lista.length };
  }, [listaPeJudet, lista.length]);

  const arhiveaza = async () => {
    if (!deArhivat) return;
    try {
      await api.entities.TaxaAcces.update(deArhivat.id, { status: 'Arhivat' });
      toast({ title: 'Regula a fost arhivată', description: deArhivat.denumire_regula });
      setDeArhivat(null);
      incarca({ reset: true });
    } catch (e) {
      toast({ title: 'Arhivarea nu a reușit', description: e.message, variant: 'destructive' });
    }
  };

  const seteazaFiltru = (camp, valoare) => setFiltre((f) => ({ ...f, [camp]: valoare }));

  if (seIncarcaInitial) return <StareIncarcare mesaj="Se încarcă baza de taxe…" />;
  if (eroare && lista.length === 0) return <StareEroare mesaj={eroare} onReincearca={() => incarca({ reset: true, initial: true })} />;

  return (
    <div>
      <PageHeader
        titlu="Baza de taxe"
        descriere="Reguli pe județ → localitate (municipiu, oraș sau comună — unde există taxe/restricții în bază). Nu e limitat la orașe."
        actiuni={
          esteAdmin ? (
            <Button onClick={() => setFormular({ deschis: true, item: null, localitateId: null })}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Adaugă o regulă
            </Button>
          ) : (
            <span className="text-xs text-slate-500">
              Modificarea regulilor juridice este permisă doar administratorilor.
            </span>
          )
        }
      />

      <div className={cn(PANEL_FILTERS, 'sm:grid-cols-2 lg:grid-cols-4')}>
        <div className="lg:col-span-2">
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Caută după regulă sau localitate</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <Input
              value={filtre.cautare}
              onChange={(e) => seteazaFiltru('cautare', e.target.value)}
              placeholder="Ex.: Bucuresti, zonă centrală"
              className="pl-8"
            />
          </div>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Localitate</Label>
          <LocalitateSelect localitati={localitati} value={filtre.localitate} onChange={(v) => seteazaFiltru('localitate', v)} toateEticheta="Toate localitățile" />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Categorie</Label>
          <Select value={filtre.categorie} onValueChange={(v) => seteazaFiltru('categorie', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Toate categoriile</SelectItem>
              {CATEGORII_REGULA.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Nivel de încredere</Label>
          <Select value={filtre.incredere} onValueChange={(v) => seteazaFiltru('incredere', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Toate nivelurile</SelectItem>
              {NIVELURI_INCREDERE.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Status</Label>
          <Select value={filtre.status} onValueChange={(v) => seteazaFiltru('status', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Toate statusurile</SelectItem>
              {STATUSURI_TAXA.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Monedă</Label>
          <Select value={filtre.moneda} onValueChange={(v) => seteazaFiltru('moneda', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Toate monedele</SelectItem>
              {MONEDE.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Sortare</Label>
          <Select value={filtre.sort} onValueChange={(v) => seteazaFiltru('sort', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="verificare">După data verificării</SelectItem>
              <SelectItem value="nume">După denumire</SelectItem>
              <SelectItem value="valoare_desc">Valoare descrescătoare</SelectItem>
              <SelectItem value="valoare_asc">Valoare crescătoare</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-end gap-3 lg:col-span-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox checked={filtre.expirate} onCheckedChange={(bifat) => seteazaFiltru('expirate', !!bifat)} />
            Doar reguli expirate
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox checked={filtre.arhivate} onCheckedChange={(bifat) => seteazaFiltru('arhivate', !!bifat)} />
            Include arhivate
          </label>
          <Button variant="outline" size="sm" onClick={() => setFiltre(FILTRE_GOL)}>
            Resetează filtrele
          </Button>
        </div>
      </div>

      {faraSursa.length || suprapuneri.length ? (
        <div className="mb-4 space-y-2">
          {faraSursa.length ? (
            <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {faraSursa.length} reguli din lista curentă nu au nici link de sursă, nici act normativ asociat. O regulă nu poate fi
              marcată „Confirmat” fără o sursă identificabilă.
            </p>
          ) : null}
          {suprapuneri.map((s) => (
            <p key={s.reguli.join('-')} className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {s.mesaj}
            </p>
          ))}
        </div>
      ) : null}

      <div className={seFiltreaza ? 'opacity-60 transition-opacity' : undefined} aria-busy={seFiltreaza || undefined}>
      {lista.length === 0 ? (
        <EmptyState
          titlu="Nicio regulă găsită"
          descriere="Ajustează filtrele sau adaugă o regulă nouă pentru o localitate."
          actiune={esteAdmin ? <Button onClick={() => setFormular({ deschis: true, item: null, localitateId: null })}>Adaugă o regulă</Button> : null}
        />
      ) : (
        <>
          <p className="mb-3 text-xs text-slate-600">
            {numarRo(rezumatLista.nrJudete, 0)} {rezumatLista.nrJudete === 1 ? 'județ' : 'județe'}
            {' · '}
            {numarRo(rezumatLista.nrLocalitati, 0)}{' '}
            {rezumatLista.nrLocalitati === 1 ? 'localitate' : 'localități'}
            {' · '}
            {numarRo(rezumatLista.nrReguli, 0)} {rezumatLista.nrReguli === 1 ? 'regulă' : 'reguli'}
            {areMaiMulte ? ' (încărcare parțială — folosește „Încarcă mai multe”)' : ''}
          </p>
          <ListaJudetExpand
            judete={listaPeJudet}
            etichetaItems="reguli"
            renderItem={(r) => (
              <div className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{r.denumire_regula}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {zone.find((z) => z.id === r.zona_id)?.nume_zona || 'Întreaga localitate'}
                      {' · '}
                      {r.masa_min_t || r.masa_max_t ? `${masaRo(r.masa_min_t)} / ${masaRo(r.masa_max_t)}` : 'Masă nedocumentată'}
                      {' · '}
                      {r.valoare === null || r.valoare === undefined ? 'Valoare nedocumentată' : sumaRo(r.valoare, r.moneda)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Verificare: {r.data_verificare ? dataRo(r.data_verificare) : 'neverificată'}
                      {' · '}
                      {r.sursa_url ? (
                        <a href={r.sursa_url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2">
                          Sursă
                        </a>
                      ) : r.act_normativ_id ? (
                        'Act asociat'
                      ) : (
                        <span className="text-amber-800">Sursă lipsă</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge valoare={r.categorie_regula} />
                    <StatusBadge valoare={r.incredere} />
                    <StatusBadge valoare={r.status} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => setDetalii(r)}>
                    Vezi detalii
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/localitati/${r.localitate_id}`}>Localitate</Link>
                  </Button>
                  {esteAdmin ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setFormular({ deschis: true, item: r, localitateId: r.localitate_id })}
                        aria-label="Editează regula"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      {r.status !== 'Arhivat' ? (
                        <Button size="sm" variant="ghost" onClick={() => setDeArhivat(r)} aria-label="Arhivează regula">
                          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            )}
          />
          {areMaiMulte ? (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => incarca({ reset: false })} disabled={seIncarcaMaiMulte}>
                {seIncarcaMaiMulte ? 'Se încarcă…' : 'Încarcă mai multe'}
              </Button>
            </div>
          ) : null}
          <p className="mt-3 text-xs text-slate-500">
            Regulile expirate nu se aplică deplasărilor viitoare. Folosește filtrul „Doar reguli expirate” pentru a le verifica periodic.
          </p>
        </>
      )}
      </div>

      <TaxaFormDialog
        open={formular.deschis}
        onOpenChange={(o) => setFormular((f) => ({ ...f, deschis: o }))}
        taxa={formular.item}
        localitateId={formular.localitateId}
        localitati={localitati}
        zone={zone}
        surse={surse}
        onSalvat={() => incarca({ reset: true })}
      />
      <RegulaDetaliiDialog
        open={!!detalii}
        onOpenChange={(o) => !o && setDetalii(null)}
        regula={detalii}
        localitate={localitati.find((l) => l.id === detalii?.localitate_id)}
        zona={zone.find((z) => z.id === detalii?.zona_id)}
        sursa={surse.find((s) => s.id === detalii?.act_normativ_id)}
      />
      <AlertDialog open={!!deArhivat} onOpenChange={(o) => !o && setDeArhivat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arhivezi regula „{deArhivat?.denumire_regula}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Regula nu va mai fi folosită în căutări și calcule. Calculele salvate anterior păstrează valorile și sursele folosite
              atunci.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={arhiveaza}>Arhivează</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}