import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { azi, dataRo, masaRo, sumaRo } from '@/lib/format';
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
  const esteAdmin = user?.role === 'admin';
  const [lista, setLista] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [areMaiMulte, setAreMaiMulte] = useState(false);
  const [localitati, setLocalitati] = useState([]);
  const [zone, setZone] = useState([]);
  const [surse, setSurse] = useState([]);
  const [seIncarca, setSeIncarca] = useState(true);
  const [seIncarcaMaiMulte, setSeIncarcaMaiMulte] = useState(false);
  const [eroare, setEroare] = useState(null);
  const [filtre, setFiltre] = useState(FILTRE_GOL);
  const [formular, setFormular] = useState({ deschis: false, item: null, localitateId: null });
  const [detalii, setDetalii] = useState(null);
  const [deArhivat, setDeArhivat] = useState(null);

  const construiesteQuery = useCallback(() => {
    const conditii = [];
    if (filtre.localitate !== 'toate') conditii.push({ localitate_id: filtre.localitate });
    if (filtre.categorie !== 'toate') conditii.push({ categorie_regula: filtre.categorie });
    if (filtre.incredere !== 'toate') conditii.push({ incredere: filtre.incredere });
    if (filtre.status !== 'toate') conditii.push({ status: filtre.status });
    else if (!filtre.arhivate) conditii.push({ status: { $ne: 'Arhivat' } });
    if (filtre.moneda !== 'toate') conditii.push({ moneda: filtre.moneda });
    if (filtre.cautare.trim()) conditii.push({ denumire_regula: { $regex: filtre.cautare.trim(), $options: 'i' } });
    if (filtre.expirate) conditii.push({ $or: [{ status: 'Expirat' }, { perioada_valabilitate_end: { $lt: azi() } }] });
    if (conditii.length === 0) return {};
    if (conditii.length === 1) return conditii[0];
    return { $and: conditii };
  }, [filtre]);

  const sortare = useMemo(() => {
    const harta = { verificare: '-data_verificare', nume: 'denumire_regula', valoare_asc: 'valoare', valoare_desc: '-valoare' };
    return harta[filtre.sort] || '-data_verificare';
  }, [filtre.sort]);

  const incarca = useCallback(
    async (reset = true) => {
      if (reset) setSeIncarca(true);
      else setSeIncarcaMaiMulte(true);
      setEroare(null);
      try {
        const page = await api.entities.TaxaAcces.filter(construiesteQuery(), {
          sort: sortare,
          limit: 50,
          cursor: reset ? undefined : cursor,
        });
        setLista((prev) => (reset ? page.items || [] : [...prev, ...(page.items || [])]));
        setCursor(page.next_cursor || null);
        setAreMaiMulte(!!page.has_more);
      } catch (e) {
        setEroare(e.message || 'Nu am putut încărca baza de taxe.');
      } finally {
        setSeIncarca(false);
        setSeIncarcaMaiMulte(false);
      }
    },
    [construiesteQuery, sortare, cursor]
  );

  const incarcaReferinte = useCallback(async () => {
    try {
      const [pageLocalitati, pageZone, pageSurse] = await Promise.all([
        api.entities.Localitate.filter({ archived: { $ne: true } }, { sort: 'nume', limit: 500, fields: ['nume', 'judet'] }),
        api.entities.Zona.filter({ archived: { $ne: true } }, { limit: 500, fields: ['nume_zona', 'localitate_id'] }),
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
    incarca(true);
     
  }, [filtre]);

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

  const numeLocalitate = (id) => localitati.find((l) => l.id === id)?.nume || '—';

  const faraSursa = useMemo(() => lista.filter((r) => !r.sursa_url && !r.act_normativ_id), [lista]);
  const suprapuneri = useMemo(() => detecteazaSuprapuneri(lista).slice(0, 5), [lista]);

  const arhiveaza = async () => {
    if (!deArhivat) return;
    try {
      await api.entities.TaxaAcces.update(deArhivat.id, { status: 'Arhivat' });
      toast({ title: 'Regula a fost arhivată', description: deArhivat.denumire_regula });
      setDeArhivat(null);
      incarca(true);
    } catch (e) {
      toast({ title: 'Arhivarea nu a reușit', description: e.message, variant: 'destructive' });
    }
  };

  const seteazaFiltru = (camp, valoare) => setFiltre((f) => ({ ...f, [camp]: valoare }));

  if (seIncarca) return <StareIncarcare mesaj="Se încarcă baza de taxe…" />;
  if (eroare) return <StareEroare mesaj={eroare} onReincearca={() => incarca(true)} />;

  return (
    <div>
      <PageHeader
        titlu="Baza de taxe"
        descriere="Administrarea regulilor de acces, a intervalelor de masă, a unităților de tarifare și a surselor de verificare."
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

      <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Caută după denumirea regulii</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <Input value={filtre.cautare} onChange={(e) => seteazaFiltru('cautare', e.target.value)} placeholder="Ex.: zonă centrală" className="pl-8" />
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

      {lista.length === 0 ? (
        <EmptyState
          titlu="Nicio regulă găsită"
          descriere="Ajustează filtrele sau adaugă o regulă nouă pentru o localitate."
          actiune={esteAdmin ? <Button onClick={() => setFormular({ deschis: true, item: null, localitateId: null })}>Adaugă o regulă</Button> : null}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[1200px] text-sm">
              <caption className="sr-only">Reguli de acces din baza de date</caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-3 py-2 font-medium">Localitate</th>
                  <th scope="col" className="px-3 py-2 font-medium">Zonă</th>
                  <th scope="col" className="px-3 py-2 font-medium">Tip regulă</th>
                  <th scope="col" className="px-3 py-2 font-medium">Masă min. / max.</th>
                  <th scope="col" className="px-3 py-2 font-medium">Valoare</th>
                  <th scope="col" className="px-3 py-2 font-medium">Valabilitate</th>
                  <th scope="col" className="px-3 py-2 font-medium">Încredere</th>
                  <th scope="col" className="px-3 py-2 font-medium">Ultima verificare</th>
                  <th scope="col" className="px-3 py-2 font-medium">Sursă</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 font-medium">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-b-0 align-top">
                    <td className="px-3 py-2">
                      <Link to={`/localitati/${r.localitate_id}`} className="text-blue-700 hover:underline">
                        {numeLocalitate(r.localitate_id)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{zone.find((z) => z.id === r.zona_id)?.nume_zona || 'Întreaga localitate'}</td>
                    <td className="px-3 py-2">
                      <span className="block font-medium text-slate-800">{r.denumire_regula}</span>
                      <StatusBadge valoare={r.categorie_regula} />
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {r.masa_min_t || r.masa_max_t ? `${masaRo(r.masa_min_t)} / ${masaRo(r.masa_max_t)}` : 'Nedocumentată'}
                      <span className="block text-xs text-slate-400">{r.tip_masa || 'Necunoscut'}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {r.valoare === null || r.valoare === undefined ? 'Nedocumentată' : sumaRo(r.valoare, r.moneda)}
                      <span className="block text-xs text-slate-400">{r.unitate_tarifare || '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {r.perioada_valabilitate_start || r.perioada_valabilitate_end
                        ? `${dataRo(r.perioada_valabilitate_start)} – ${dataRo(r.perioada_valabilitate_end)}`
                        : 'Nedocumentată'}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge valoare={r.incredere} />
                    </td>
                    <td className="px-3 py-2 text-slate-600">{r.data_verificare ? dataRo(r.data_verificare) : 'Neverificată'}</td>
                    <td className="px-3 py-2">
                      {r.sursa_url ? (
                        <a href={r.sursa_url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2">
                          Deschide sursa
                        </a>
                      ) : r.act_normativ_id ? (
                        <span className="text-slate-600">Act asociat</span>
                      ) : (
                        <span className="text-amber-800">Lipsă</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge valoare={r.status} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setDetalii(r)}>
                          Vezi detalii
                        </Button>
                        {esteAdmin ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setFormular({ deschis: true, item: r, localitateId: r.localitate_id })} aria-label="Editează regula">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {areMaiMulte ? (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => incarca(false)} disabled={seIncarcaMaiMulte}>
                {seIncarcaMaiMulte ? 'Se încarcă…' : 'Încarcă mai multe'}
              </Button>
            </div>
          ) : null}
          <p className="mt-3 text-xs text-slate-500">
            Regulile expirate nu se aplică deplasărilor viitoare. Folosește filtrul „Doar reguli expirate” pentru a le verifica periodic.
          </p>
        </>
      )}

      <TaxaFormDialog
        open={formular.deschis}
        onOpenChange={(o) => setFormular((f) => ({ ...f, deschis: o }))}
        taxa={formular.item}
        localitateId={formular.localitateId}
        localitati={localitati}
        zone={zone}
        surse={surse}
        onSalvat={() => incarca(true)}
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