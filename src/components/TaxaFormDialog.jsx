import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  CATEGORII_REGULA,
  MONEDE,
  NIVELURI_INCREDERE,
  STATUSURI_TAXA,
  TIPURI_MASA,
  TIPURI_TAXA,
  TIPURI_VEHICUL_REGULA,
  UNITATI_TARIFARE,
  ZILE_SAPTAMANA,
} from '@/lib/enum';
import { laNumar } from '@/lib/format';

const GOL = {
  localitate_id: '',
  zona_id: 'nesetat',
  denumire_regula: '',
  categorie_regula: 'Taxă de acces',
  masa_min_t: '',
  masa_max_t: '',
  tip_masa: 'Necunoscut',
  tip_vehicul: 'Nespecificat',
  tip_taxa: 'Altul',
  valoare: '',
  moneda: 'RON',
  unitate_tarifare: 'Altul',
  perioada_valabilitate_start: '',
  perioada_valabilitate_end: '',
  zile_aplicare: [],
  ora_start: '',
  ora_end: '',
  orar_restrictie: '',
  conditii_vehicul: '',
  exceptii: '',
  cum_se_obtine: '',
  url_autorizatie: '',
  act_normativ_id: 'nesetat',
  sursa_url: '',
  data_sursa: '',
  data_verificare: '',
  incredere: 'De confirmat',
  status: 'Ciornă',
  observatii: '',
};

function Sectiune({ titlu, children }) {
  return (
    <section className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
      <h3 className="mb-3 font-heading text-xs font-semibold uppercase tracking-wide text-slate-500">{titlu}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Camp({ eticheta, children, lat, ajutor, obligatoriu }) {
  return (
    <div className={lat ? 'sm:col-span-2' : ''}>
      <Label className="mb-1.5 block text-xs font-medium text-slate-600">
        {eticheta}
        {obligatoriu ? <span className="ml-1 text-red-600">*</span> : null}
      </Label>
      {children}
      {ajutor ? <p className="mt-1 text-[11px] leading-snug text-slate-400">{ajutor}</p> : null}
    </div>
  );
}

export default function TaxaFormDialog({ open, onOpenChange, taxa, localitateId, localitati = [], zone = [], surse = [], onSalvat }) {
  const { toast } = useToast();
  const [form, setForm] = useState(GOL);
  const [erori, setErori] = useState([]);
  const [seSalveaza, setSeSalveaza] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (taxa) {
      setForm({
        ...GOL,
        ...Object.fromEntries(
          Object.entries(taxa).map(([k, v]) => [k, v === null || v === undefined ? '' : v])
        ),
        zona_id: taxa.zona_id || 'nesetat',
        act_normativ_id: taxa.act_normativ_id || 'nesetat',
        tip_vehicul: taxa.tip_vehicul || 'Nespecificat',
        zile_aplicare: Array.isArray(taxa.zile_aplicare) ? taxa.zile_aplicare : [],
      });
    } else {
      setForm({ ...GOL, localitate_id: localitateId || '' });
    }
    setErori([]);
  }, [open, taxa, localitateId]);

  const seteaza = (camp, valoare) => setForm((f) => ({ ...f, [camp]: valoare }));

  const zoneDisponibile = zone.filter((z) => z.localitate_id === form.localitate_id);
  const faraValoare =
    ['Interdicție', 'Restricție', 'Exceptare'].includes(form.categorie_regula) ||
    ['Gratuit', 'Interzis'].includes(form.tip_taxa);

  const salveaza = async () => {
    const probleme = [];
    if (!form.denumire_regula.trim()) probleme.push('Denumirea regulii este obligatorie.');
    if (!form.localitate_id) probleme.push('Localitatea este obligatorie.');
    if (form.incredere === 'Confirmat' && !form.sursa_url.trim() && form.act_normativ_id === 'nesetat') {
      probleme.push('O regulă marcată „Confirmat” trebuie să aibă o sursă identificabilă (link sau act normativ).');
    }
    const min = laNumar(form.masa_min_t);
    const max = laNumar(form.masa_max_t);
    if (min !== null && max !== null && min > max) probleme.push('Masa minimă nu poate fi mai mare decât masa maximă.');
    if (min !== null && min < 0) probleme.push('Masa minimă trebuie să fie o valoare pozitivă.');
    if (max !== null && max < 0) probleme.push('Masa maximă trebuie să fie o valoare pozitivă.');
    if (probleme.length) {
      setErori(probleme);
      return;
    }

    const payload = {
      localitate_id: form.localitate_id,
      zona_id: form.zona_id === 'nesetat' ? null : form.zona_id,
      denumire_regula: form.denumire_regula.trim(),
      categorie_regula: form.categorie_regula,
      masa_min_t: min,
      masa_max_t: max,
      tip_masa: form.tip_masa,
      tip_vehicul: form.tip_vehicul === 'Nespecificat' ? null : form.tip_vehicul,
      tip_taxa: form.tip_taxa,
      valoare: faraValoare ? null : laNumar(form.valoare),
      moneda: faraValoare ? (form.tip_taxa === 'Gratuit' ? 'Fără valoare monetară' : form.moneda) : form.moneda,
      unitate_tarifare: faraValoare ? 'Altul' : form.unitate_tarifare,
      perioada_valabilitate_start: form.perioada_valabilitate_start || null,
      perioada_valabilitate_end: form.perioada_valabilitate_end || null,
      zile_aplicare: form.zile_aplicare,
      ora_start: form.ora_start || null,
      ora_end: form.ora_end || null,
      orar_restrictie: form.orar_restrictie || null,
      conditii_vehicul: form.conditii_vehicul || null,
      exceptii: form.exceptii || null,
      cum_se_obtine: form.cum_se_obtine || null,
      url_autorizatie: form.url_autorizatie || null,
      act_normativ_id: form.act_normativ_id === 'nesetat' ? null : form.act_normativ_id,
      sursa_url: form.sursa_url || null,
      data_sursa: form.data_sursa || null,
      data_verificare: form.data_verificare || null,
      incredere: form.incredere,
      status: form.status,
      observatii: form.observatii || null,
      este_demo: taxa ? !!taxa.este_demo : false,
    };

    setSeSalveaza(true);
    try {
      if (taxa?.id) await api.entities.TaxaAcces.update(taxa.id, payload);
      else await api.entities.TaxaAcces.create(payload);
      toast({ title: taxa ? 'Regula a fost actualizată' : 'Regula a fost adăugată', description: payload.denumire_regula });
      onSalvat?.();
      onOpenChange(false);
    } catch (e) {
      setErori([`Salvarea nu a reușit: ${e.message || 'eroare necunoscută'}`]);
    } finally {
      setSeSalveaza(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{taxa ? 'Editează regula de acces' : 'Adaugă o regulă de acces'}</DialogTitle>
          <DialogDescription>
            Completează doar informațiile confirmate de surse oficiale. O valoare necunoscută se lasă necompletată, nu se
            completează cu zero.
          </DialogDescription>
        </DialogHeader>

        {erori.length ? (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            <ul className="list-inside list-disc space-y-0.5">
              {erori.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-6">
          <Sectiune titlu="Identificare">
            <Camp eticheta="Localitate" obligatoriu>
              <Select value={form.localitate_id || undefined} onValueChange={(v) => setForm((f) => ({ ...f, localitate_id: v, zona_id: 'nesetat' }))}>
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
            </Camp>
            <Camp eticheta="Zonă (opțional)" ajutor="Lasă necompletat dacă regula se aplică întregii localități.">
              <Select value={form.zona_id} onValueChange={(v) => seteaza('zona_id', v)} disabled={!form.localitate_id}>
                <SelectTrigger>
                  <SelectValue placeholder="Fără zonă definită" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nesetat">Fără zonă definită</SelectItem>
                  {zoneDisponibile.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.nume_zona}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Camp>
            <Camp eticheta="Denumirea regulii" obligatoriu>
              <Input value={form.denumire_regula} onChange={(e) => seteaza('denumire_regula', e.target.value)} placeholder="Ex.: Taxă de acces zilnică zona centrală" />
            </Camp>
            <Camp eticheta="Categoria regulii">
              <Select value={form.categorie_regula} onValueChange={(v) => seteaza('categorie_regula', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORII_REGULA.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Camp>
          </Sectiune>

          <Sectiune titlu="Criterii de aplicare">
            <Camp eticheta="Definiția masei">
              <Select value={form.tip_masa} onValueChange={(v) => seteaza('tip_masa', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPURI_MASA.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Camp>
            <Camp eticheta="Tipul vehiculului">
              <Select value={form.tip_vehicul} onValueChange={(v) => seteaza('tip_vehicul', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPURI_VEHICUL_REGULA.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Camp>
            <Camp eticheta="Masa minimă (t)">
              <Input type="number" step="0.1" value={form.masa_min_t} onChange={(e) => seteaza('masa_min_t', e.target.value)} />
            </Camp>
            <Camp eticheta="Masa maximă (t)">
              <Input type="number" step="0.1" value={form.masa_max_t} onChange={(e) => seteaza('masa_max_t', e.target.value)} />
            </Camp>
            <Camp eticheta="Ora de început">
              <Input type="time" value={form.ora_start || ''} onChange={(e) => seteaza('ora_start', e.target.value)} />
            </Camp>
            <Camp eticheta="Ora de sfârșit">
              <Input type="time" value={form.ora_end || ''} onChange={(e) => seteaza('ora_end', e.target.value)} />
            </Camp>
            <Camp eticheta="Zile de aplicare" lat>
              <div className="flex flex-wrap gap-3">
                {ZILE_SAPTAMANA.map((zi) => (
                  <label key={zi} className="flex items-center gap-2 text-sm text-slate-700">
                    <Checkbox
                      checked={form.zile_aplicare.includes(zi)}
                      onCheckedChange={(bifat) =>
                        seteaza('zile_aplicare', bifat ? [...form.zile_aplicare, zi] : form.zile_aplicare.filter((z) => z !== zi))
                      }
                    />
                    {zi}
                  </label>
                ))}
              </div>
            </Camp>
            <Camp eticheta="Condiții de vehicul" lat>
              <Textarea value={form.conditii_vehicul || ''} onChange={(e) => seteaza('conditii_vehicul', e.target.value)} rows={2} />
            </Camp>
            <Camp eticheta="Excepții" lat>
              <Textarea value={form.exceptii || ''} onChange={(e) => seteaza('exceptii', e.target.value)} rows={2} />
            </Camp>
          </Sectiune>

          <Sectiune titlu="Tarifare">
            <Camp eticheta="Tip taxă">
              <Select value={form.tip_taxa} onValueChange={(v) => seteaza('tip_taxa', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPURI_TAXA.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Camp>
            <Camp eticheta="Unitate de tarifare">
              <Select value={form.unitate_tarifare} onValueChange={(v) => seteaza('unitate_tarifare', v)} disabled={faraValoare}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITATI_TARIFARE.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Camp>
            <Camp
              eticheta="Valoare"
              ajutor={faraValoare ? 'Categoria selectată nu presupune o valoare monetară.' : 'Lasă gol dacă valoarea nu este documentată.'}
            >
              <Input type="number" step="0.01" value={form.valoare} onChange={(e) => seteaza('valoare', e.target.value)} disabled={faraValoare} />
            </Camp>
            <Camp eticheta="Monedă">
              <Select value={form.moneda} onValueChange={(v) => seteaza('moneda', v)} disabled={faraValoare}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONEDE.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Camp>
          </Sectiune>

          <Sectiune titlu="Valabilitate">
            <Camp eticheta="Valabil de la">
              <Input type="date" value={form.perioada_valabilitate_start || ''} onChange={(e) => seteaza('perioada_valabilitate_start', e.target.value)} />
            </Camp>
            <Camp eticheta="Valabil până la">
              <Input type="date" value={form.perioada_valabilitate_end || ''} onChange={(e) => seteaza('perioada_valabilitate_end', e.target.value)} />
            </Camp>
            <Camp eticheta="Status regulă">
              <Select value={form.status} onValueChange={(v) => seteaza('status', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSURI_TAXA.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Camp>
            <Camp eticheta="Orar / restricție (text liber)">
              <Input value={form.orar_restrictie || ''} onChange={(e) => seteaza('orar_restrictie', e.target.value)} placeholder="Ex.: luni–vineri 07:00–20:00" />
            </Camp>
          </Sectiune>

          <Sectiune titlu="Autorizare">
            <Camp eticheta="Cum se obține autorizația" lat>
              <Textarea value={form.cum_se_obtine || ''} onChange={(e) => seteaza('cum_se_obtine', e.target.value)} rows={2} />
            </Camp>
            <Camp eticheta="Link către autorizație" lat>
              <Input value={form.url_autorizatie || ''} onChange={(e) => seteaza('url_autorizatie', e.target.value)} placeholder="https://…" />
            </Camp>
          </Sectiune>

          <Sectiune titlu="Sursă și verificare">
            <Camp eticheta="Act normativ asociat">
              <Select value={form.act_normativ_id} onValueChange={(v) => seteaza('act_normativ_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Fără act asociat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nesetat">Fără act asociat</SelectItem>
                  {surse
                    .filter((s) => !form.localitate_id || s.localitate_id === form.localitate_id)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.titlu_document}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Camp>
            <Camp eticheta="URL sursă">
              <Input value={form.sursa_url || ''} onChange={(e) => seteaza('sursa_url', e.target.value)} placeholder="https://…" />
            </Camp>
            <Camp eticheta="Data sursei">
              <Input type="date" value={form.data_sursa || ''} onChange={(e) => seteaza('data_sursa', e.target.value)} />
            </Camp>
            <Camp eticheta="Data ultimei verificări">
              <Input type="date" value={form.data_verificare || ''} onChange={(e) => seteaza('data_verificare', e.target.value)} />
            </Camp>
            <Camp eticheta="Nivel de încredere">
              <Select value={form.incredere} onValueChange={(v) => seteaza('incredere', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NIVELURI_INCREDERE.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Camp>
            <Camp eticheta="Observații" lat>
              <Textarea value={form.observatii || ''} onChange={(e) => seteaza('observatii', e.target.value)} rows={2} />
            </Camp>
          </Sectiune>
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