import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { PRIORITATI, STATUSURI_ACOPERIRE, STATUSURI_REGLEMENTARE, TIP_LOCALITATE } from '@/lib/enum';
import { laNumar, slugDin } from '@/lib/format';
import { JUDETE_RO, esteJudetRo } from '@/lib/judeteRo';

const GOL = {
  nume: '',
  judet: '',
  tip_localitate: 'Comună',
  prioritate: 'P2',
  status_acoperire: 'Neîncepută',
  status_reglementare: 'De verificat',
  latitudine: '',
  longitudine: '',
  ultima_verificare: '',
  urmatoarea_verificare: '',
  responsabil: '',
  descriere: '',
};

export default function LocalitateFormDialog({ open, onOpenChange, localitate, onSalvat }) {
  const { toast } = useToast();
  const [form, setForm] = useState(GOL);
  const [eroare, setEroare] = useState('');
  const [seSalveaza, setSeSalveaza] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEroare('');
    setForm(
      localitate
        ? Object.fromEntries(
            Object.keys(GOL).map((k) => [k, localitate[k] === null || localitate[k] === undefined ? '' : localitate[k]])
          )
        : GOL
    );
  }, [open, localitate]);

  const seteaza = (camp, valoare) => setForm((f) => ({ ...f, [camp]: valoare }));

  const salveaza = async () => {
    if (!form.nume.trim()) {
      setEroare('Denumirea localității este obligatorie.');
      return;
    }
    if (!esteJudetRo(form.judet)) {
      setEroare('Selectează un județ valid din România (inclusiv București).');
      return;
    }
    const payload = {
      nume: form.nume.trim(),
      slug: slugDin(form.nume),
      judet: form.judet.trim(),
      tip_localitate: form.tip_localitate,
      prioritate: form.prioritate,
      status_acoperire: form.status_acoperire,
      status_reglementare: form.status_reglementare,
      latitudine: laNumar(form.latitudine),
      longitudine: laNumar(form.longitudine),
      ultima_verificare: form.ultima_verificare || null,
      urmatoarea_verificare: form.urmatoarea_verificare || null,
      responsabil: form.responsabil || null,
      descriere: form.descriere || null,
    };
    setSeSalveaza(true);
    try {
      if (localitate?.id) await api.entities.Localitate.update(localitate.id, payload);
      else await api.entities.Localitate.create({ ...payload, este_demo: false, archived: false });
      toast({ title: localitate ? 'Localitatea a fost actualizată' : 'Localitatea a fost adăugată', description: payload.nume });
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
          <DialogTitle>{localitate ? 'Editează localitatea' : 'Adaugă o localitate'}</DialogTitle>
          <DialogDescription>
            Statusul reglementării se stabilește doar pe baza verificării surselor oficiale, nu prin presupuneri.
          </DialogDescription>
        </DialogHeader>

        {eroare ? (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {eroare}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Denumire *</Label>
            <Input value={form.nume} onChange={(e) => seteaza('nume', e.target.value)} placeholder="Ex.: Otopeni" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-800">Județ *</Label>
            <Select
              value={esteJudetRo(form.judet) ? form.judet : undefined}
              onValueChange={(v) => seteaza('judet', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selectează județul" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {JUDETE_RO.map((j) => (
                  <SelectItem key={j} value={j}>
                    {j}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Tip localitate</Label>
            <Select value={form.tip_localitate} onValueChange={(v) => seteaza('tip_localitate', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIP_LOCALITATE.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Prioritate</Label>
            <Select value={form.prioritate} onValueChange={(v) => seteaza('prioritate', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITATI.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Status acoperire</Label>
            <Select value={form.status_acoperire} onValueChange={(v) => seteaza('status_acoperire', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSURI_ACOPERIRE.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Status reglementare</Label>
            <Select value={form.status_reglementare} onValueChange={(v) => seteaza('status_reglementare', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSURI_REGLEMENTARE.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Latitudine</Label>
            <Input value={form.latitudine} onChange={(e) => seteaza('latitudine', e.target.value)} placeholder="44.5500" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Longitudine</Label>
            <Input value={form.longitudine} onChange={(e) => seteaza('longitudine', e.target.value)} placeholder="26.0667" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Ultima verificare</Label>
            <Input type="date" value={form.ultima_verificare} onChange={(e) => seteaza('ultima_verificare', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Următoarea verificare</Label>
            <Input type="date" value={form.urmatoarea_verificare} onChange={(e) => seteaza('urmatoarea_verificare', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Responsabil</Label>
            <Input value={form.responsabil} onChange={(e) => seteaza('responsabil', e.target.value)} placeholder="Nume sau e-mail" />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Descriere</Label>
            <Textarea value={form.descriere} onChange={(e) => seteaza('descriere', e.target.value)} rows={3} />
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