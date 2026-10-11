import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Search, Truck } from 'lucide-react';
import { api } from '@/api/client';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import StareIncarcare from '@/components/StareIncarcare';
import StareEroare from '@/components/StareEroare';
import VehiculFormDialog from '@/components/VehiculFormDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { masaRo, numarRo } from '@/lib/format';
import { CATEGORII_VEHICUL } from '@/lib/enum';

export default function Vehicule() {
  const { toast } = useToast();
  const [lista, setLista] = useState([]);
  const [seIncarca, setSeIncarca] = useState(true);
  const [eroare, setEroare] = useState(null);
  const [cautare, setCautare] = useState('');
  const [categorie, setCategorie] = useState('toate');
  const [status, setStatus] = useState('toate');
  const [formular, setFormular] = useState({ deschis: false, item: null });

  const construiesteQuery = useCallback(() => {
    const conditii = [];
    if (categorie !== 'toate') conditii.push({ categorie_vehicul: categorie });
    if (status !== 'toate') conditii.push({ status });
    if (cautare.trim()) {
      const termen = cautare.trim();
      conditii.push({
        $or: [
          { numar_inmatriculare: { $regex: termen, $options: 'i' } },
          { nume_intern: { $regex: termen, $options: 'i' } },
        ],
      });
    }
    if (conditii.length === 0) return {};
    if (conditii.length === 1) return conditii[0];
    return { $and: conditii };
  }, [cautare, categorie, status]);

  const incarca = useCallback(async () => {
    setSeIncarca(true);
    setEroare(null);
    try {
      const page = await api.entities.Vehicul.filter(construiesteQuery(), { sort: 'numar_inmatriculare', limit: 200 });
      setLista(page.items || []);
    } catch (e) {
      setEroare(e.message || 'Nu am putut încărca vehiculele.');
    } finally {
      setSeIncarca(false);
    }
  }, [construiesteQuery]);

  useEffect(() => {
    incarca();
  }, [incarca]);

  const dezactiveaza = async (vehicul) => {
    try {
      const nouStatus = vehicul.status === 'Activ' ? 'Inactiv' : 'Activ';
      await api.entities.Vehicul.update(vehicul.id, { status: nouStatus });
      toast({ title: `Vehiculul a fost marcat „${nouStatus}”`, description: vehicul.numar_inmatriculare });
      incarca();
    } catch (e) {
      toast({ title: 'Modificarea nu a reușit', description: e.message, variant: 'destructive' });
    }
  };

  if (seIncarca) return <StareIncarcare mesaj="Se încarcă vehiculele…" />;
  if (eroare) return <StareEroare mesaj={eroare} onReincearca={incarca} />;

  return (
    <div>
      <PageHeader
        titlu="Vehicule"
        descriere="Registrul vehiculelor organizației, folosite pentru căutarea taxelor și calcularea curselor."
        actiuni={
          <Button onClick={() => setFormular({ deschis: true, item: null })}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Adaugă un vehicul
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Caută după număr sau denumire</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <Input value={cautare} onChange={(e) => setCautare(e.target.value)} placeholder="Ex.: B 123 ABC" className="pl-8" />
          </div>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Categorie</Label>
          <Select value={categorie} onValueChange={setCategorie}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Toate categoriile</SelectItem>
              {CATEGORII_VEHICUL.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Toate</SelectItem>
              <SelectItem value="Activ">Activ</SelectItem>
              <SelectItem value="Inactiv">Inactiv</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={Truck}
          titlu="Nu există vehicule"
          descriere="Adaugă primul vehicul pentru a putea completa automat masa la căutarea taxelor și la calculul curselor."
          actiune={<Button onClick={() => setFormular({ deschis: true, item: null })}>Adaugă un vehicul</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[1000px] text-sm">
            <caption className="sr-only">Registrul vehiculelor organizației</caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-3 py-2 font-medium">Număr înmatriculare</th>
                <th scope="col" className="px-3 py-2 font-medium">Denumire internă</th>
                <th scope="col" className="px-3 py-2 font-medium">Categorie</th>
                <th scope="col" className="px-3 py-2 font-medium">MTMA</th>
                <th scope="col" className="px-3 py-2 font-medium">Masă totală</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Axe</th>
                <th scope="col" className="px-3 py-2 font-medium">Normă Euro</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((v) => (
                <tr key={v.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3 py-2">
                    <Link to={`/vehicule/${v.id}`} className="font-medium text-blue-700 hover:underline">
                      {v.numar_inmatriculare}
                    </Link>
                    {v.tara_inmatriculare ? <span className="block text-xs text-slate-500">{v.tara_inmatriculare}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{v.nume_intern}</td>
                  <td className="px-3 py-2 text-slate-600">{v.categorie_vehicul}</td>
                  <td className="px-3 py-2 text-slate-700">{masaRo(v.masa_maxima_autorizata_t)}</td>
                  <td className="px-3 py-2 text-slate-700">{masaRo(v.masa_totala_t)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{numarRo(v.numar_axe, 0)}</td>
                  <td className="px-3 py-2 text-slate-600">{v.norma_euro || '—'}</td>
                  <td className="px-3 py-2">
                    <StatusBadge valoare={v.status} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/vehicule/${v.id}`}>Vezi detalii</Link>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setFormular({ deschis: true, item: v })} aria-label="Editează vehiculul">
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => dezactiveaza(v)}>
                        {v.status === 'Activ' ? 'Dezactivează' : 'Reactivează'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-500">
        Masa maximă autorizată (MTMA) și masa efectivă nu sunt interschimbabile. La căutare și la calcul alegi explicit criteriul de masă
        cerut de regula locală.
      </p>

      <VehiculFormDialog
        open={formular.deschis}
        onOpenChange={(o) => setFormular((f) => ({ ...f, deschis: o }))}
        vehicul={formular.item}
        onSalvat={incarca}
      />
    </div>
  );
}