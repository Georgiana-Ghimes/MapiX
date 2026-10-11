import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { CATEGORII_VEHICUL } from '@/lib/enum';
import { laNumar } from '@/lib/format';

const GOL = {
  nume_intern: '',
  numar_inmatriculare: '',
  tara_inmatriculare: 'România',
  categorie_vehicul: 'Camion',
  masa_maxima_autorizata_t: '',
  masa_totala_t: '',
  masa_maxima_tehnic_admisibila_t: '',
  numar_axe: '',
  norma_euro: '',
  combustibil: '',
  dimensiuni: '',
  status: 'Activ',
  observatii: '',
};

export default function VehiculFormDialog({ open, onOpenChange, vehicul, onSalvat }) {
  const { toast } = useToast();
  const [form, setForm] = useState(GOL);
  const [eroare, setEroare] = useState('');
  const [seSalveaza, setSeSalveaza] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEroare('');
    if (vehicul) {
      setForm(
        Object.fromEntries(
          Object.keys(GOL).map((k) => [k, vehicul[k] === null || vehicul[k] === undefined ? '' : vehicul[k]])
        )
      );
    } else {
      setForm(GOL);
    }
  }, [open, vehicul]);

  const seteaza = (camp, valoare) => setForm((f) => ({ ...f, [camp]: valoare }));

  const salveaza = async () => {
    if (!form.nume_intern.trim() || !form.numar_inmatriculare.trim()) {
      setEroare('Denumirea internă și numărul de înmatriculare sunt obligatorii.');
      return;
    }
    const mase = [form.masa_maxima_autorizata_t, form.masa_totala_t, form.masa_maxima_tehnic_admisibila_t]
      .map(laNumar)
      .filter((v) => v !== null);
    if (mase.some((v) => v <= 0)) {
      setEroare('Valorile de masă trebuie să fie numere pozitive.');
      return;
    }
    if (mase.length === 0) {
      setEroare('Completează cel puțin masa maximă autorizată sau masa totală.');
      return;
    }

    const numar = form.numar_inmatriculare.trim().toUpperCase();
    try {
      const existente = await api.entities.Vehicul.filter(
        { numar_inmatriculare: numar, status: 'Activ' },
        { limit: 5, fields: ['numar_inmatriculare'] }
      );
      const dublura = existente.items.some((v) => v.id !== vehicul?.id);
      if (dublura) {
        setEroare(`Există deja un vehicul activ cu numărul ${numar} în organizația ta.`);
        return;
      }
    } catch {
      // Dacă verificarea nu poate rula, salvarea continuă; RLS protejează datele organizației.
    }

    const payload = {
      nume_intern: form.nume_intern.trim(),
      numar_inmatriculare: numar,
      tara_inmatriculare: form.tara_inmatriculare || null,
      categorie_vehicul: form.categorie_vehicul,
      masa_maxima_autorizata_t: laNumar(form.masa_maxima_autorizata_t),
      masa_totala_t: laNumar(form.masa_totala_t),
      masa_maxima_tehnic_admisibila_t: laNumar(form.masa_maxima_tehnic_admisibila_t),
      numar_axe: laNumar(form.numar_axe),
      norma_euro: form.norma_euro || null,
      combustibil: form.combustibil || null,
      dimensiuni: form.dimensiuni || null,
      status: form.status,
      observatii: form.observatii || null,
    };

    setSeSalveaza(true);
    try {
      if (vehicul?.id) await api.entities.Vehicul.update(vehicul.id, payload);
      else await api.entities.Vehicul.create(payload);
      toast({ title: vehicul ? 'Vehiculul a fost actualizat' : 'Vehiculul a fost adăugat', description: `${payload.numar_inmatriculare} · ${payload.nume_intern}` });
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
          <DialogTitle>{vehicul ? 'Editează vehiculul' : 'Adaugă un vehicul'}</DialogTitle>
          <DialogDescription>
            Masa maximă autorizată (MTMA) și masa totală sunt criterii diferite — nu le trata ca interschimbabile.
          </DialogDescription>
        </DialogHeader>

        {eroare ? (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {eroare}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Denumire internă *</Label>
            <Input value={form.nume_intern} onChange={(e) => seteaza('nume_intern', e.target.value)} placeholder="Ex.: Camion 3" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Număr înmatriculare *</Label>
            <Input value={form.numar_inmatriculare} onChange={(e) => seteaza('numar_inmatriculare', e.target.value)} placeholder="B 123 ABC" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Țară înmatriculare</Label>
            <Input value={form.tara_inmatriculare} onChange={(e) => seteaza('tara_inmatriculare', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Categorie vehicul</Label>
            <Select value={form.categorie_vehicul} onValueChange={(v) => seteaza('categorie_vehicul', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORII_VEHICUL.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">MTMA (t)</Label>
            <Input type="number" step="0.01" value={form.masa_maxima_autorizata_t} onChange={(e) => seteaza('masa_maxima_autorizata_t', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Masă totală (t)</Label>
            <Input type="number" step="0.01" value={form.masa_totala_t} onChange={(e) => seteaza('masa_totala_t', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Masă maximă tehnic admisibilă (t)</Label>
            <Input type="number" step="0.01" value={form.masa_maxima_tehnic_admisibila_t} onChange={(e) => seteaza('masa_maxima_tehnic_admisibila_t', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Număr axe</Label>
            <Input type="number" value={form.numar_axe} onChange={(e) => seteaza('numar_axe', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Normă Euro</Label>
            <Input value={form.norma_euro} onChange={(e) => seteaza('norma_euro', e.target.value)} placeholder="Euro 6" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Combustibil</Label>
            <Input value={form.combustibil} onChange={(e) => seteaza('combustibil', e.target.value)} placeholder="Motorină" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Dimensiuni</Label>
            <Input value={form.dimensiuni} onChange={(e) => seteaza('dimensiuni', e.target.value)} placeholder="13,6 × 2,55 × 4,0 m" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Status</Label>
            <Select value={form.status} onValueChange={(v) => seteaza('status', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Activ">Activ</SelectItem>
                <SelectItem value="Inactiv">Inactiv</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Observații</Label>
            <Textarea value={form.observatii} onChange={(e) => seteaza('observatii', e.target.value)} rows={2} />
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