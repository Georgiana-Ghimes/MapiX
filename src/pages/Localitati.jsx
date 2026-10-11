import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, FileText, MapPin, Pencil, Plus, Search } from 'lucide-react';
import { api } from '@/api/client';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import StareIncarcare from '@/components/StareIncarcare';
import StareEroare from '@/components/StareEroare';
import LocalitateFormDialog from '@/components/LocalitateFormDialog';
import ZonaFormDialog from '@/components/ZonaFormDialog';
import TaxaFormDialog from '@/components/TaxaFormDialog';
import SursaFormDialog from '@/components/SursaFormDialog';
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
import { dataRo, numarRo } from '@/lib/format';
import { PRIORITATI, STATUSURI_ACOPERIRE, STATUS_REGLEMENTARE } from '@/lib/enum';

const FILTRE_GOL = { cautare: '', prioritate: 'toate', judet: 'toate', status_reglementare: 'toate', status_acoperire: 'toate', arhivate: false };

export default function Localitati() {
  const { toast } = useToast();
  const { user } = useAuth();
  const esteAdmin = user?.role === 'admin';
  const [lista, setLista] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [areMaiMulte, setAreMaiMulte] = useState(false);
  const [seIncarca, setSeIncarca] = useState(true);
  const [seIncarcaMaiMulte, setSeIncarcaMaiMulte] = useState(false);
  const [eroare, setEroare] = useState(null);
  const [filtre, setFiltre] = useState(FILTRE_GOL);
  const [numarReguli, setNumarReguli] = useState({});
  const [numarZone, setNumarZone] = useState({});
  const [dialog, setDialog] = useState({ tip: null, item: null, localitateId: null });
  const [deArhivat, setDeArhivat] = useState(null);

  const construiesteQuery = useCallback(() => {
    const conditii = [];
    if (!filtre.arhivate) conditii.push({ archived: { $ne: true } });
    if (filtre.prioritate !== 'toate') conditii.push({ prioritate: filtre.prioritate });
    if (filtre.judet !== 'toate') conditii.push({ judet: filtre.judet });
    if (filtre.status_reglementare !== 'toate') conditii.push({ status_reglementare: filtre.status_reglementare });
    if (filtre.status_acoperire !== 'toate') conditii.push({ status_acoperire: filtre.status_acoperire });
    if (filtre.cautare.trim()) conditii.push({ nume: { $regex: filtre.cautare.trim(), $options: 'i' } });
    if (conditii.length === 0) return {};
    if (conditii.length === 1) return conditii[0];
    return { $and: conditii };
  }, [filtre]);

  const incarca = useCallback(
    async (reset = true) => {
      if (reset) {
        setSeIncarca(true);
        setEroare(null);
      } else {
        setSeIncarcaMaiMulte(true);
      }
      try {
        const page = await api.entities.Localitate.filter(construiesteQuery(), {
          sort: 'prioritate',
          limit: 25,
          cursor: reset ? undefined : cursor,
        });
        setLista((prev) => (reset ? page.items || [] : [...prev, ...(page.items || [])]));
        setCursor(page.next_cursor || null);
        setAreMaiMulte(!!page.has_more);
      } catch (e) {
        setEroare(e.message || 'Nu am putut încărca localitățile.');
      } finally {
        setSeIncarca(false);
        setSeIncarcaMaiMulte(false);
      }
    },
    [construiesteQuery, cursor]
  );

  const incarcaNumaratori = useCallback(async () => {
    try {
      const [reguli, zone] = await Promise.all([
        api.entities.TaxaAcces.aggregate({ query: { status: { $ne: 'Arhivat' } }, groupBy: 'localitate_id', limit: 1000 }),
        api.entities.Zona.aggregate({ query: { archived: { $ne: true } }, groupBy: 'localitate_id', limit: 1000 }),
      ]);
      const laHarta = (randuri) =>
        (randuri || []).reduce((acc, r) => {
          const id = r.localitate_id !== undefined ? r.localitate_id : r._id;
          if (id) acc[id] = r.count || 0;
          return acc;
        }, {});
      setNumarReguli(laHarta(reguli.rows));
      setNumarZone(laHarta(zone.rows));
    } catch {
      setNumarReguli({});
      setNumarZone({});
    }
  }, []);

  useEffect(() => {
    incarca(true);
     
  }, [filtre]);

  useEffect(() => {
    incarcaNumaratori();
  }, [incarcaNumaratori]);

  const judete = useMemo(() => {
    const set = new Set(lista.map((l) => l.judet).filter(Boolean));
    return Array.from(set).sort();
  }, [lista]);

  const arhiveaza = async () => {
    if (!deArhivat) return;
    try {
      await api.entities.Localitate.update(deArhivat.id, { archived: true });
      toast({ title: 'Localitatea a fost arhivată', description: `${deArhivat.nume} rămâne în baza de date, cu istoricul intact.` });
      setDeArhivat(null);
      incarca(true);
      incarcaNumaratori();
    } catch (e) {
      toast({ title: 'Arhivarea nu a reușit', description: e.message, variant: 'destructive' });
    }
  };

  const seteazaFiltru = (camp, valoare) => setFiltre((f) => ({ ...f, [camp]: valoare }));

  if (seIncarca) return <StareIncarcare mesaj="Se încarcă localitățile…" />;
  if (eroare) return <StareEroare mesaj={eroare} onReincearca={() => incarca(true)} />;

  return (
    <div>
      <PageHeader
        titlu="Localități"
        descriere="Registrul localităților acoperite, cu statusul de acoperire, reglementare și datele de verificare."
        actiuni={
          esteAdmin ? (
            <Button onClick={() => setDialog({ tip: 'localitate', item: null })}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Adaugă o localitate
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="xl:col-span-2">
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Caută după denumire</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <Input value={filtre.cautare} onChange={(e) => seteazaFiltru('cautare', e.target.value)} placeholder="Ex.: Otopeni" className="pl-8" />
          </div>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Prioritate</Label>
          <Select value={filtre.prioritate} onValueChange={(v) => seteazaFiltru('prioritate', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Toate</SelectItem>
              {PRIORITATI.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Județ</Label>
          <Select value={filtre.judet} onValueChange={(v) => seteazaFiltru('judet', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Toate</SelectItem>
              {judete.map((j) => (
                <SelectItem key={j} value={j}>
                  {j}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Status reglementare</Label>
          <Select value={filtre.status_reglementare} onValueChange={(v) => seteazaFiltru('status_reglementare', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Toate</SelectItem>
              {STATUS_REGLEMENTARE.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Grad de acoperire</Label>
          <Select value={filtre.status_acoperire} onValueChange={(v) => seteazaFiltru('status_acoperire', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Toate</SelectItem>
              {STATUSURI_ACOPERIRE.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-3 xl:col-span-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox checked={filtre.arhivate} onCheckedChange={(bifat) => seteazaFiltru('arhivate', !!bifat)} />
            Arată și localitățile arhivate
          </label>
          <Button variant="outline" size="sm" onClick={() => setFiltre(FILTRE_GOL)}>
            Resetează filtrele
          </Button>
        </div>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={MapPin}
          titlu="Nicio localitate găsită"
          descriere={
            filtre.cautare || filtre.prioritate !== 'toate'
              ? 'Niciun rezultat pentru filtrele selectate. Încearcă să le lărgești.'
              : 'Adaugă prima localitate sau importă lista dintr-un fișier CSV.'
          }
          actiune={
            esteAdmin ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setDialog({ tip: 'localitate', item: null })}>Adaugă o localitate</Button>
                <Button asChild variant="outline">
                  <Link to="/setari">Importă din CSV</Link>
                </Button>
              </div>
            ) : null
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[1080px] text-sm">
              <caption className="sr-only">Lista localităților acoperite</caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-3 py-2 font-medium">Localitate</th>
                  <th scope="col" className="px-3 py-2 font-medium">Județ</th>
                  <th scope="col" className="px-3 py-2 font-medium">Prioritate</th>
                  <th scope="col" className="px-3 py-2 font-medium">Reglementare</th>
                  <th scope="col" className="px-3 py-2 font-medium">Acoperire</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Reguli</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Zone</th>
                  <th scope="col" className="px-3 py-2 font-medium">Ultima verificare</th>
                  <th scope="col" className="px-3 py-2 font-medium">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 last:border-b-0 align-top">
                    <td className="px-3 py-2">
                      <Link to={`/localitati/${l.id}`} className="font-medium text-blue-700 hover:underline">
                        {l.nume}
                      </Link>
                      {l.este_demo ? <StatusBadge valoare="DEMO" className="ml-2" /> : null}
                      {l.archived ? <StatusBadge valoare="Arhivată" className="ml-2" /> : null}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{l.judet || '—'}</td>
                    <td className="px-3 py-2">
                      <StatusBadge valoare={l.prioritate} />
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge valoare={l.status_reglementare} />
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge valoare={l.status_acoperire} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{numarRo(numarReguli[l.id] || 0, 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{numarRo(numarZone[l.id] || 0, 0)}</td>
                    <td className="px-3 py-2 text-slate-600">{l.ultima_verificare ? dataRo(l.ultima_verificare) : 'Neverificată'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/localitati/${l.id}`}>Vezi detalii</Link>
                        </Button>
                        {esteAdmin ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setDialog({ tip: 'localitate', item: l })} aria-label={`Editează ${l.nume}`}>
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDialog({ tip: 'zona', localitateId: l.id })} aria-label={`Adaugă zonă pentru ${l.nume}`}>
                              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDialog({ tip: 'regula', localitateId: l.id })} aria-label={`Adaugă regulă pentru ${l.nume}`}>
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDialog({ tip: 'sursa', localitateId: l.id })} aria-label={`Adaugă document pentru ${l.nume}`}>
                              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                            {!l.archived ? (
                              <Button size="sm" variant="ghost" onClick={() => setDeArhivat(l)} aria-label={`Arhivează ${l.nume}`}>
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
        </>
      )}

      <LocalitateFormDialog
        open={dialog.tip === 'localitate'}
        onOpenChange={(o) => !o && setDialog({ tip: null })}
        localitate={dialog.item}
        onSalvat={() => {
          incarca(true);
          incarcaNumaratori();
        }}
      />
      <ZonaFormDialog
        open={dialog.tip === 'zona'}
        onOpenChange={(o) => !o && setDialog({ tip: null })}
        localitateId={dialog.localitateId}
        localitati={lista}
        onSalvat={() => {
          incarca(true);
          incarcaNumaratori();
        }}
      />
      <TaxaFormDialog
        open={dialog.tip === 'regula'}
        onOpenChange={(o) => !o && setDialog({ tip: null })}
        localitateId={dialog.localitateId}
        localitati={lista}
        zone={[]}
        surse={[]}
        onSalvat={() => {
          incarca(true);
          incarcaNumaratori();
        }}
      />
      <SursaFormDialog
        open={dialog.tip === 'sursa'}
        onOpenChange={(o) => !o && setDialog({ tip: null })}
        localitateId={dialog.localitateId}
        localitati={lista}
        onSalvat={() => incarca(true)}
      />

      <AlertDialog open={!!deArhivat} onOpenChange={(o) => !o && setDeArhivat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arhivezi localitatea {deArhivat?.nume}?</AlertDialogTitle>
            <AlertDialogDescription>
              Localitatea are {numarReguli[deArhivat?.id] || 0} reguli și {numarZone[deArhivat?.id] || 0} zone asociate. Arhivarea
              păstrează toate înregistrările și istoricul curselor; localitatea nu mai apare în listele operaționale.
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