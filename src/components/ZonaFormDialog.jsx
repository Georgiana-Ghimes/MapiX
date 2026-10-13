import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/api/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { STATUSURI_GEOMETRIE, TIPURI_ZONA } from '@/lib/enum';
import { faraDiacritice, laNumar } from '@/lib/format';
import { valideazaGeoJSON } from '@/lib/reguliTaxe';
import { cn } from '@/lib/utils';

/** Nume canonic când regula/geometria acoperă tot orașul — nu se repetă numele localității. */
export const NUME_ZONA_INTREAGA = 'Întreaga localitate';

const GOL = {
  localitate_id: '',
  nume_zona: '',
  cod_zona: '',
  descriere: '',
  tip_zona: 'Reglementată',
  geometrie_geojson: '',
  centru_latitudine: '',
  centru_longitudine: '',
  valabil_de: '',
  valabil_pana: '',
  status_geometrie: 'Neverificată',
  sursa_geometrie_url: '',
  data_verificare_geometrie: '',
};

function esteNumeIntreaga(nume) {
  return faraDiacritice(nume) === faraDiacritice(NUME_ZONA_INTREAGA);
}

export default function ZonaFormDialog({ open, onOpenChange, zona, localitateId, localitati = [], onSalvat }) {
  const { toast } = useToast();
  const [form, setForm] = useState(GOL);
  /** 'intreaga' = acoperă tot orașul; 'distincta' = subzonă cu nume propriu (A, B, centru…) */
  const [scop, setScop] = useState('intreaga');
  const [eroare, setEroare] = useState('');
  const [seSalveaza, setSeSalveaza] = useState(false);

  // Din listă / fișă localitate: orașul e deja ales — nu îl re-selectezi ca pe o zonă.
  const localitateBlocata = Boolean(localitateId) || localitati.length === 1;
  const localitateSelectata = useMemo(
    () => localitati.find((l) => l.id === form.localitate_id) || null,
    [localitati, form.localitate_id]
  );

  useEffect(() => {
    if (!open) return;
    setEroare('');
    if (zona) {
      const next = Object.fromEntries(
        Object.keys(GOL).map((k) => [k, zona[k] === null || zona[k] === undefined ? '' : zona[k]])
      );
      setForm(next);
      setScop(esteNumeIntreaga(zona.nume_zona) ? 'intreaga' : 'distincta');
    } else {
      setForm({
        ...GOL,
        localitate_id: localitateId || '',
        nume_zona: NUME_ZONA_INTREAGA,
      });
      setScop('intreaga');
    }
  }, [open, zona, localitateId]);

  const seteaza = (camp, valoare) => setForm((f) => ({ ...f, [camp]: valoare }));

  const schimbaScop = (nou) => {
    setScop(nou);
    if (nou === 'intreaga') {
      seteaza('nume_zona', NUME_ZONA_INTREAGA);
    } else if (esteNumeIntreaga(form.nume_zona) || !form.nume_zona.trim()) {
      seteaza('nume_zona', '');
    }
  };

  const salveaza = async () => {
    if (!form.localitate_id) {
      setEroare('Selectează localitatea (orașul) pentru care definești zona.');
      return;
    }

    let nume = form.nume_zona.trim();
    if (scop === 'intreaga') {
      nume = NUME_ZONA_INTREAGA;
    }
    if (!nume) {
      setEroare('Pentru o zonă distinctă, completează denumirea (ex.: Zona A, Centru).');
      return;
    }

    const numeLoc = localitateSelectata?.nume || '';
    if (numeLoc && faraDiacritice(nume) === faraDiacritice(numeLoc)) {
      setEroare(
        `Denumirea zonei nu trebuie să fie același cu localitatea („${numeLoc}”). Alege „Întreaga localitate” sau un nume de subzonă (Zona A, Centru…).`
      );
      return;
    }

    if (form.geometrie_geojson && form.geometrie_geojson.trim()) {
      const validare = valideazaGeoJSON(form.geometrie_geojson);
      if (!validare.ok) {
        setEroare(`Geometrie invalidă: ${validare.motiv}`);
        return;
      }
    }

    const payload = {
      localitate_id: form.localitate_id,
      nume_zona: nume,
      cod_zona: form.cod_zona || null,
      descriere: form.descriere || null,
      tip_zona: form.tip_zona,
      geometrie_geojson: form.geometrie_geojson && form.geometrie_geojson.trim() ? form.geometrie_geojson.trim() : null,
      centru_latitudine: laNumar(form.centru_latitudine),
      centru_longitudine: laNumar(form.centru_longitudine),
      valabil_de: form.valabil_de || null,
      valabil_pana: form.valabil_pana || null,
      status_geometrie: form.status_geometrie,
      sursa_geometrie_url: form.sursa_geometrie_url || null,
      data_verificare_geometrie: form.data_verificare_geometrie || null,
    };
    setSeSalveaza(true);
    try {
      if (zona?.id) await api.entities.Zona.update(zona.id, payload);
      else await api.entities.Zona.create({ ...payload, este_demo: false, archived: false });
      toast({ title: zona ? 'Zona a fost actualizată' : 'Zona a fost adăugată', description: payload.nume_zona });
      onSalvat?.();
      onOpenChange(false);
    } catch (e) {
      setEroare(`Salvarea nu a reușit: ${e.message || 'eroare necunoscută'}`);
    } finally {
      setSeSalveaza(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{zona ? 'Editează zona' : 'Adaugă o zonă'}</DialogTitle>
          <DialogDescription className="text-slate-700">
            <span className="font-medium text-slate-800">Localitatea</span> e orașul din catalog.{' '}
            <span className="font-medium text-slate-800">Zona</span> e o porțiune din acel oraș (sau tot orașul), cu
            geometrie și reguli proprii — nu rescrie numele localității la denumirea zonei.
          </DialogDescription>
        </DialogHeader>

        {eroare ? (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {eroare}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium text-slate-800">Localitate (oraș) *</Label>
            {localitateBlocata ? (
              <Input
                value={localitateSelectata ? `${localitateSelectata.nume}${localitateSelectata.judet ? ` · ${localitateSelectata.judet}` : ''}` : '—'}
                readOnly
                className="bg-slate-100 font-medium text-slate-900"
              />
            ) : (
              <Select value={form.localitate_id || undefined} onValueChange={(v) => seteaza('localitate_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectează localitatea" />
                </SelectTrigger>
                <SelectContent>
                  {localitati.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nume}
                      {l.judet ? ` · ${l.judet}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="sm:col-span-2 rounded-lg border-2 border-slate-300 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-800">Acoperire zonă</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => schimbaScop('intreaga')}
                className={cn(
                  'flex-1 rounded-md border-2 px-3 py-2.5 text-left text-sm transition-colors',
                  scop === 'intreaga'
                    ? 'border-blue-700 bg-blue-50 text-blue-950'
                    : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
                )}
              >
                <span className="block font-semibold">Întreaga localitate</span>
                <span className="mt-0.5 block text-xs text-slate-700">
                  Taxă / geometrie pentru tot orașul
                  {localitateSelectata ? ` (${localitateSelectata.nume})` : ''}.
                </span>
              </button>
              <button
                type="button"
                onClick={() => schimbaScop('distincta')}
                className={cn(
                  'flex-1 rounded-md border-2 px-3 py-2.5 text-left text-sm transition-colors',
                  scop === 'distincta'
                    ? 'border-blue-700 bg-blue-50 text-blue-950'
                    : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
                )}
              >
                <span className="block font-semibold">Zonă distinctă</span>
                <span className="mt-0.5 block text-xs text-slate-700">
                  Subzonă cu nume propriu — ex. Zona A, Centru, Interzis greu.
                </span>
              </button>
            </div>
          </div>

          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium text-slate-800">
              {scop === 'intreaga' ? 'Denumirea zonei (automat)' : 'Denumirea zonei *'}
            </Label>
            <Input
              value={scop === 'intreaga' ? NUME_ZONA_INTREAGA : form.nume_zona}
              onChange={(e) => seteaza('nume_zona', e.target.value)}
              readOnly={scop === 'intreaga'}
              disabled={scop === 'intreaga'}
              placeholder="Ex.: Zona A, Centru istoric, Interzis tranzit greu…"
              className={cn(scop === 'intreaga' && 'bg-slate-100')}
            />
            {scop === 'distincta' && localitateSelectata ? (
              <p className="mt-1 text-[11px] text-slate-700">
                Nu folosi „{localitateSelectata.nume}” aici — asta e deja localitatea.
              </p>
            ) : null}
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-800">Cod zonă</Label>
            <Input
              value={form.cod_zona}
              onChange={(e) => seteaza('cod_zona', e.target.value)}
              placeholder="Opțional — ex. Z1, A"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-800">Tip zonă</Label>
            <Select value={form.tip_zona} onValueChange={(v) => seteaza('tip_zona', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPURI_ZONA.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-800">Status geometrie</Label>
            <Select value={form.status_geometrie} onValueChange={(v) => seteaza('status_geometrie', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSURI_GEOMETRIE.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-800">Data verificării geometriei</Label>
            <Input type="date" value={form.data_verificare_geometrie} onChange={(e) => seteaza('data_verificare_geometrie', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-800">Centru — latitudine</Label>
            <Input value={form.centru_latitudine} onChange={(e) => seteaza('centru_latitudine', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-800">Centru — longitudine</Label>
            <Input value={form.centru_longitudine} onChange={(e) => seteaza('centru_longitudine', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-800">Valabil de la</Label>
            <Input type="date" value={form.valabil_de} onChange={(e) => seteaza('valabil_de', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-800">Valabil până la</Label>
            <Input type="date" value={form.valabil_pana} onChange={(e) => seteaza('valabil_pana', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium text-slate-800">URL sursă geometrie</Label>
            <Input value={form.sursa_geometrie_url} onChange={(e) => seteaza('sursa_geometrie_url', e.target.value)} placeholder="https://…" />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium text-slate-800">Geometrie GeoJSON</Label>
            <Textarea
              value={form.geometrie_geojson}
              onChange={(e) => seteaza('geometrie_geojson', e.target.value)}
              rows={5}
              className="font-mono text-xs"
              placeholder='Polygon / MultiPolygon din actul oficial (lipește GeoJSON-ul aici)'
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium text-slate-800">Descriere</Label>
            <Textarea value={form.descriere} onChange={(e) => seteaza('descriere', e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={seSalveaza}>
            Anulează
          </Button>
          <Button onClick={salveaza} disabled={seSalveaza}>
            {seSalveaza ? 'Se salvează…' : 'Salvează'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
