import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Pencil, Plus, Search } from 'lucide-react';
import { api } from '@/api/client';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import StareIncarcare from '@/components/StareIncarcare';
import StareEroare from '@/components/StareEroare';
import SursaFormDialog from '@/components/SursaFormDialog';
import LocalitateSelect from '@/components/LocalitateSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
import { dataRo, luniDeLa } from '@/lib/format';
import { STATUSURI_ACT, TIPURI_ACT } from '@/lib/enum';
import { PRAG_REVERIFICARE_LUNI } from '@/lib/reguliTaxe';

const FILTRE_GOL = { cautare: '', localitate: 'toate', tip_act: 'toate', status: 'toate', an: 'toate' };

export default function Surse() {
  const { user } = useAuth();
  const esteAdmin = user?.role === 'admin';
  const [lista, setLista] = useState([]);
  const [localitati, setLocalitati] = useState([]);
  const [seIncarcaInitial, setSeIncarcaInitial] = useState(true);
  const [seFiltreaza, setSeFiltreaza] = useState(false);
  const [eroare, setEroare] = useState(null);
  const [filtre, setFiltre] = useState(FILTRE_GOL);
  const [cautareDebounced, setCautareDebounced] = useState('');
  const [formular, setFormular] = useState({ deschis: false, item: null });

  useEffect(() => {
    const t = setTimeout(() => setCautareDebounced(filtre.cautare.trim()), 250);
    return () => clearTimeout(t);
  }, [filtre.cautare]);

  const filtreEfective = useMemo(
    () => ({ ...filtre, cautare: cautareDebounced }),
    [filtre.localitate, filtre.tip_act, filtre.status, filtre.an, cautareDebounced]
  );

  const construiesteQuery = useCallback((f, localitateIdsDinCautare = []) => {
    const conditii = [];
    if (f.localitate !== 'toate') conditii.push({ localitate_id: f.localitate });
    if (f.tip_act !== 'toate') conditii.push({ tip_act: f.tip_act });
    if (f.status !== 'toate') conditii.push({ status_act: f.status });
    if (f.an !== 'toate') conditii.push({ an_fiscal: Number(f.an) });
    if (f.cautare) {
      const or = [{ titlu_document: { $regex: f.cautare, $options: 'i' } }];
      if (localitateIdsDinCautare.length) or.push({ localitate_id: { $in: localitateIdsDinCautare } });
      conditii.push(or.length === 1 ? or[0] : { $or: or });
    }
    if (conditii.length === 0) return {};
    if (conditii.length === 1) return conditii[0];
    return { $and: conditii };
  }, []);

  const incarca = useCallback(
    async ({ initial = false } = {}) => {
      if (initial) {
        setSeIncarcaInitial(true);
        setEroare(null);
      } else {
        setSeFiltreaza(true);
      }
      try {
        let localitateIdsDinCautare = [];
        if (filtreEfective.cautare) {
          const pageLoc = await api.entities.Localitate.filter(
            { nume: { $regex: filtreEfective.cautare, $options: 'i' }, archived: { $ne: true } },
            { limit: 100, fields: ['id'] }
          );
          localitateIdsDinCautare = (pageLoc.items || []).map((l) => l.id);
        }
        const [pageSurse, pageLocalitati] = await Promise.all([
          api.entities.SursaAct.filter(construiesteQuery(filtreEfective, localitateIdsDinCautare), {
            sort: '-data_act',
            limit: 200,
          }),
          api.entities.Localitate.filter({ archived: { $ne: true } }, { sort: 'nume', limit: 500, fields: ['nume', 'judet'] }),
        ]);
        setLista(pageSurse.items || []);
        setLocalitati(pageLocalitati.items || []);
        setEroare(null);
      } catch (e) {
        setEroare(e.message || 'Nu am putut încărca documentele.');
      } finally {
        setSeIncarcaInitial(false);
        setSeFiltreaza(false);
      }
    },
    [construiesteQuery, filtreEfective]
  );

  useEffect(() => {
    incarca({ initial: seIncarcaInitial && lista.length === 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtreEfective]);

  const faraVerificareRecenta = useMemo(() => {
    return lista.filter((s) => {
      const luni = luniDeLa(s.data_verificare);
      return luni === null || luni >= PRAG_REVERIFICARE_LUNI;
    }).length;
  }, [lista]);

  const ani = useMemo(() => {
    const set = new Set(lista.map((s) => s.an_fiscal).filter(Boolean));
    return Array.from(set).sort((a, b) => b - a);
  }, [lista]);

  if (seIncarcaInitial) return <StareIncarcare mesaj="Se încarcă sursele și actele normative…" />;
  if (eroare && lista.length === 0) return <StareEroare mesaj={eroare} onReincearca={() => incarca({ initial: true })} />;

  return (
    <div>
      <PageHeader
        titlu="Surse și acte normative"
        descriere="Evidența hotărârilor și documentelor oficiale, cu datele de verificare și legătura către fiecare regulă de acces."
        actiuni={
          esteAdmin ? (
            <Button onClick={() => setFormular({ deschis: true, item: null })}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Adaugă un document
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 rounded-xl border-2 border-slate-300/80 bg-slate-100/70 p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Caută după titlu sau localitate</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <Input value={filtre.cautare} onChange={(e) => setFiltre((f) => ({ ...f, cautare: e.target.value }))} className="pl-8" />
          </div>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Localitate</Label>
          <LocalitateSelect localitati={localitati} value={filtre.localitate} onChange={(v) => setFiltre((f) => ({ ...f, localitate: v }))} toateEticheta="Toate localitățile" />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Tip act</Label>
          <Select value={filtre.tip_act} onValueChange={(v) => setFiltre((f) => ({ ...f, tip_act: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Toate tipurile</SelectItem>
              {TIPURI_ACT.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Status</Label>
          <Select value={filtre.status} onValueChange={(v) => setFiltre((f) => ({ ...f, status: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Toate statusurile</SelectItem>
              {STATUSURI_ACT.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">An fiscal</Label>
          <Select value={filtre.an} onValueChange={(v) => setFiltre((f) => ({ ...f, an: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Toți anii</SelectItem>
              {ani.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button variant="outline" size="sm" onClick={() => setFiltre(FILTRE_GOL)}>
            Resetează filtrele
          </Button>
        </div>
      </div>

      {faraVerificareRecenta ? (
        <p className="mb-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {faraVerificareRecenta} documente din lista curentă nu au fost verificate în ultimele {PRAG_REVERIFICARE_LUNI} luni. Un URL
          existent nu confirmă singur conținutul documentului.
        </p>
      ) : null}

      <div className={seFiltreaza ? 'opacity-60 transition-opacity' : undefined} aria-busy={seFiltreaza || undefined}>
      {lista.length === 0 ? (
        <EmptyState
          titlu="Niciun document găsit"
          descriere="Adaugă hotărârile și documentele oficiale care stau la baza regulilor de acces."
          actiune={esteAdmin ? <Button onClick={() => setFormular({ deschis: true, item: null })}>Adaugă un document</Button> : null}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border-2 border-slate-300/80 bg-white shadow-sm">
          <table className="w-full min-w-[1100px] text-sm">
            <caption className="sr-only">Surse și acte normative</caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-3 py-2 font-medium">Localitate</th>
                <th scope="col" className="px-3 py-2 font-medium">Tip act</th>
                <th scope="col" className="px-3 py-2 font-medium">Număr</th>
                <th scope="col" className="px-3 py-2 font-medium">An fiscal</th>
                <th scope="col" className="px-3 py-2 font-medium">Titlu</th>
                <th scope="col" className="px-3 py-2 font-medium">Data actului</th>
                <th scope="col" className="px-3 py-2 font-medium">În vigoare</th>
                <th scope="col" className="px-3 py-2 font-medium">Verificat</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Document</th>
                {esteAdmin ? <th scope="col" className="px-3 py-2 font-medium">Acțiuni</th> : null}
              </tr>
            </thead>
            <tbody>
              {lista.map((s) => {
                const luni = luniDeLa(s.data_verificare);
                const neverificat = luni === null || luni >= PRAG_REVERIFICARE_LUNI;
                return (
                  <tr key={s.id} className="border-b border-slate-100 last:border-b-0 align-top">
                    <td className="px-3 py-2 text-slate-700">{localitati.find((l) => l.id === s.localitate_id)?.nume || '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{s.tip_act}</td>
                    <td className="px-3 py-2 text-slate-600">{s.numar_act || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{s.an_fiscal || '—'}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-slate-800">{s.titlu_document}</span>
                      {s.pagina_relevanta ? <span className="block text-xs text-slate-500">Pagina: {s.pagina_relevanta}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{dataRo(s.data_act)}</td>
                    <td className="px-3 py-2 text-slate-600">{dataRo(s.data_intrare_vigoare)}</td>
                    <td className="px-3 py-2">
                      <span className={neverificat ? 'text-amber-800' : 'text-slate-600'}>
                        {s.data_verificare ? dataRo(s.data_verificare) : 'Neverificat'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge valoare={s.status_act} />
                    </td>
                    <td className="px-3 py-2">
                      {s.document_url ? (
                        <a
                          href={s.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 underline underline-offset-2"
                        >
                          Deschide
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="text-xs text-amber-800">Link lipsă</span>
                      )}
                    </td>
                    {esteAdmin ? (
                      <td className="px-3 py-2">
                        <Button size="sm" variant="ghost" onClick={() => setFormular({ deschis: true, item: s })} aria-label="Editează documentul">
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>

      <SursaFormDialog
        open={formular.deschis}
        onOpenChange={(o) => setFormular((f) => ({ ...f, deschis: o }))}
        sursa={formular.item}
        localitati={localitati}
        onSalvat={() => incarca()}
      />
    </div>
  );
}