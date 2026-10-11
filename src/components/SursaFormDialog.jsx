import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { STATUSURI_ACT, TIPURI_ACT } from '@/lib/enum';
import { laNumar } from '@/lib/format';

const GOL = {
  localitate_id: '',
  an_fiscal: '',
  tip_act: 'Alt document oficial',
  numar_act: '',
  data_act: '',
  titlu_document: '',
  document_url: '',
  pagina_relevanta: '',
  data_publicare: '',
  data_intrare_vigoare: '',
  data_expirare: '',
  data_verificare: '',
  status_act: 'Necunoscut',
  note_verificare: '',
  responsabil_verificare: '',
};

export default function SursaFormDialog({ open, onOpenChange, sursa, localitateId, localitati = [], onSalvat }) {
  const { toast } = useToast();
  const [form, setForm] = useState(GOL);
  const [eroare, setEroare] = useState('');
  const [seSalveaza, setSeSalveaza] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEroare('');
    if (sursa) {
      setForm(
        Object.fromEntries(
          Object.keys(GOL).map((k) => [k, sursa[k] === null || sursa[k] === undefined ? '' : sursa[k]])
        )
      );
    } else {
      setForm({ ...GOL, localitate_id: localitateId || '' });
    }
  }, [open, sursa, localitateId]);

  const seteaza = (camp, valoare) => setForm((f) => ({ ...f, [camp]: valoare }));

  const salveaza = async () => {
    if (!form.titlu_document.trim() || !form.localitate_id) {
      setEroare('Localitatea și titlul documentului sunt obligatorii.');
      return;
    }
    if (form.status_act === 'Actual' && !form.document_url.trim()) {
      setEroare('Un act marcat „Actual” trebuie să aibă un link către documentul oficial.');
      return;
    }
    const payload = {
      localitate_id: form.localitate_id,
      an_fiscal: laNumar(form.an_fiscal),
      tip_act: form.tip_act,
      numar_act: form.numar_act || null,
      data_act: form.data_act || null,
      titlu_document: form.titlu_document.trim(),
      document_url: form.document_url || null,
      pagina_relevanta: form.pagina_relevanta || null,
      data_publicare: form.data_publicare || null,
      data_intrare_vigoare: form.data_intrare_vigoare || null,
      data_expirare: form.data_expirare || null,
      data_verificare: form.data_verificare || null,
      status_act: form.status_act,
      note_verificare: form.note_verificare || null,
      responsabil_verificare: form.responsabil_verificare || null,
    };
    setSeSalveaza(true);
    try {
      if (sursa?.id) await api.entities.SursaAct.update(sursa.id, payload);
      else await api.entities.SursaAct.create({ ...payload, este_demo: false });
      toast({ title: sursa ? 'Documentul a fost actualizat' : 'Documentul a fost adăugat', description: payload.titlu_document });
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
          <DialogTitle>{sursa ? 'Editează documentul-sursă' : 'Adaugă un document-sursă'}</DialogTitle>
          <DialogDescription>
            Un URL nu confirmă singur o regulă: fără sursă consultată efectiv, regula rămâne neverificată.
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
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Tip act</Label>
            <Select value={form.tip_act} onValueChange={(v) => seteaza('tip_act', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPURI_ACT.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Titlu document *</Label>
            <Input value={form.titlu_document} onChange={(e) => seteaza('titlu_document', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Număr act</Label>
            <Input value={form.numar_act} onChange={(e) => seteaza('numar_act', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">An fiscal</Label>
            <Input type="number" value={form.an_fiscal} onChange={(e) => seteaza('an_fiscal', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Data actului</Label>
            <Input type="date" value={form.data_act} onChange={(e) => seteaza('data_act', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Data publicării</Label>
            <Input type="date" value={form.data_publicare} onChange={(e) => seteaza('data_publicare', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Intrare în vigoare</Label>
            <Input type="date" value={form.data_intrare_vigoare} onChange={(e) => seteaza('data_intrare_vigoare', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Data expirării</Label>
            <Input type="date" value={form.data_expirare} onChange={(e) => seteaza('data_expirare', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Data verificării</Label>
            <Input type="date" value={form.data_verificare} onChange={(e) => seteaza('data_verificare', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Status act</Label>
            <Select value={form.status_act} onValueChange={(v) => seteaza('status_act', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSURI_ACT.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">URL document</Label>
            <Input value={form.document_url} onChange={(e) => seteaza('document_url', e.target.value)} placeholder="https://…" />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Pagina relevantă</Label>
            <Input value={form.pagina_relevanta} onChange={(e) => seteaza('pagina_relevanta', e.target.value)} placeholder="Ex.: art. 12, p. 3" />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Responsabil verificare</Label>
            <Input value={form.responsabil_verificare} onChange={(e) => seteaza('responsabil_verificare', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Note de verificare</Label>
            <Textarea value={form.note_verificare} onChange={(e) => seteaza('note_verificare', e.target.value)} rows={3} />
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