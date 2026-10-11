import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { STATUSURI_GEOMETRIE, TIPURI_ZONA } from '@/lib/enum';
import { laNumar } from '@/lib/format';
import { valideazaGeoJSON } from '@/lib/reguliTaxe';

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

export default function ZonaFormDialog({ open, onOpenChange, zona, localitateId, localitati = [], onSalvat }) {
  const { toast } = useToast();
  const [form, setForm] = useState(GOL);
  const [eroare, setEroare] = useState('');
  const [seSalveaza, setSeSalveaza] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEroare('');
    if (zona) {
      setForm(
        Object.fromEntries(
          Object.keys(GOL).map((k) => [k, zona[k] === null || zona[k] === undefined ? '' : zona[k]])
        )
      );
    } else {
      setForm({ ...GOL, localitate_id: localitateId || '' });
    }
  }, [open, zona, localitateId]);

  const seteaza = (camp, valoare) => setForm((f) => ({ ...f, [camp]: valoare }));

  const salveaza = async () => {
    if (!form.nume_zona.trim() || !form.localitate_id) {
      setEroare('Localitatea și denumirea zonei sunt obligatorii.');
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
      nume_zona: form.nume_zona.trim(),
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
          <DialogDescription>
            Geometria se introduce în format GeoJSON (Polygon sau MultiPolygon). Nu inventa limite — folosește geometria
            oficială furnizată de autoritate.
          </DialogDescription>
        </DialogHeader>

        {eroare ? (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {eroare}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Localitate *</Label>
            <Select value={form.localitate_id || undefined} onValueChange={(v) => seteaza('localitate_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selectează localitatea" />
              </SelectTrigger>
              <SelectContent>
                {localitati.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nume}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Denumirea zonei *</Label>
            <Input value={form.nume_zona} onChange={(e) => seteaza('nume_zona', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Cod zonă</Label>
            <Input value={form.cod_zona} onChange={(e) => seteaza('cod_zona', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Tip zonă</Label>
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
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Status geometrie</Label>
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
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Data verificării geometriei</Label>
            <Input type="date" value={form.data_verificare_geometrie} onChange={(e) => seteaza('data_verificare_geometrie', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Centru — latitudine</Label>
            <Input value={form.centru_latitudine} onChange={(e) => seteaza('centru_latitudine', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Centru — longitudine</Label>
            <Input value={form.centru_longitudine} onChange={(e) => seteaza('centru_longitudine', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Valabil de la</Label>
            <Input type="date" value={form.valabil_de} onChange={(e) => seteaza('valabil_de', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Valabil până la</Label>
            <Input type="date" value={form.valabil_pana} onChange={(e) => seteaza('valabil_pana', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">URL sursă geometrie</Label>
            <Input value={form.sursa_geometrie_url} onChange={(e) => seteaza('sursa_geometrie_url', e.target.value)} placeholder="https://…" />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Geometrie GeoJSON</Label>
            <Textarea
              value={form.geometrie_geojson}
              onChange={(e) => seteaza('geometrie_geojson', e.target.value)}
              rows={5}
              className="font-mono text-xs"
              placeholder='{"type":"Polygon","coordinates":[[[26.10,44.43],[26.12,44.43],[26.12,44.45],[26.10,44.45],[26.10,44.43]]]}'
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Descriere</Label>
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