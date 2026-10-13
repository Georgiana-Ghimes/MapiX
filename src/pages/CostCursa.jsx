import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, RotateCcw, Save, Truck } from 'lucide-react';
import { api } from '@/api/client';
import PageHeader from '@/components/PageHeader';
import StareIncarcare from '@/components/StareIncarcare';
import StareEroare from '@/components/StareEroare';
import EmptyState from '@/components/EmptyState';
import CursaRezumat from '@/components/CursaRezumat';
import LocalitateSelect from '@/components/LocalitateSelect';
import VehiculSelect from '@/components/VehiculSelect';
import StatusBadge from '@/components/StatusBadge';
import ZonaDescriere from '@/components/ZonaDescriere';
import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { acumISO, azi, dataOraRo, laNumar, sumaRo } from '@/lib/format';
import {
  determinaStatusCalcul,
  evalueazaRegula,
  marcheazaTarifeAlternative,
  sintetizeazaCalcul,
  zoneCompatibile,
} from '@/lib/reguliTaxe';
import { TIPURI_MASA } from '@/lib/enum';

const FORM_GOL = {
  nume_cursa: '',
  origine: '',
  destinatie: '',
  intermediare: [],
  vehicul_id: '',
  masa: '',
  tip_masa: 'MTMA',
  data_deplasare: azi(),
  durataZile: '',
  durata_estimata: '',
  distanta_km: '',
  moneda_afisare: 'RON',
  observatii: '',
};

export default function CostCursa() {
  const { toast } = useToast();
  const [localitati, setLocalitati] = useState([]);
  const [vehicule, setVehicule] = useState([]);
  const [zone, setZone] = useState([]);
  const [curse, setCurse] = useState([]);
  const [seIncarca, setSeIncarca] = useState(true);
  const [eroare, setEroare] = useState(null);
  const [seCalculeaza, setSeCalculeaza] = useState(false);
  const [seSalveaza, setSeSalveaza] = useState(false);
  const [rezultat, setRezultat] = useState(null);
  const [form, setForm] = useState(FORM_GOL);
  const [zoneSelectate, setZoneSelectate] = useState([]);

  const incarca = useCallback(async () => {
    setSeIncarca(true);
    setEroare(null);
    try {
      const [pageLocalitati, pageVehicule, pageZone, pageCurse] = await Promise.all([
        api.entities.Localitate.filter({ archived: { $ne: true } }, { sort: 'nume', limit: 500, fields: ['nume', 'judet', 'status_acoperire'] }),
        api.entities.Vehicul.filter({ status: 'Activ' }, { sort: 'numar_inmatriculare', limit: 200 }),
        api.entities.Zona.filter(
          { archived: { $ne: true } },
          { sort: 'nume_zona', limit: 500, fields: ['nume_zona', 'localitate_id', 'tip_zona', 'descriere'] }
        ),
        api.entities.Cursa.filter({}, { sort: '-data_calcul', limit: 10, fields: ['nume_cursa', 'origine', 'destinatie', 'total_estimare', 'moneda_rezultat', 'status_calcul', 'data_calcul'] }),
      ]);
      setLocalitati(pageLocalitati.items || []);
      setVehicule(pageVehicule.items || []);
      setZone(pageZone.items || []);
      setCurse(pageCurse.items || []);

      const idVehicul = new URLSearchParams(window.location.search).get('vehicul');
      const vehicul = (pageVehicule.items || []).find((v) => v.id === idVehicul);
      if (vehicul) {
        setForm((f) => ({
          ...f,
          vehicul_id: vehicul.id,
          masa:
            vehicul.masa_maxima_autorizata_t !== null && vehicul.masa_maxima_autorizata_t !== undefined
              ? String(vehicul.masa_maxima_autorizata_t)
              : f.masa,
          tip_masa: 'MTMA',
        }));
      }
    } catch (e) {
      setEroare(e.message || 'Nu am putut încărca datele.');
    } finally {
      setSeIncarca(false);
    }
  }, []);

  useEffect(() => {
    incarca();
  }, [incarca]);

  const seteaza = (camp, valoare) => setForm((f) => ({ ...f, [camp]: valoare }));

  const traseuIds = useMemo(() => {
    const ids = [];
    const adauga = (id) => {
      if (id && !ids.includes(id)) ids.push(id);
    };
    adauga(form.origine);
    form.intermediare.forEach(adauga);
    adauga(form.destinatie);
    return ids;
  }, [form.origine, form.intermediare, form.destinatie]);

  const zoneTraseu = useMemo(
    () => zone.filter((z) => traseuIds.includes(z.localitate_id)),
    [zone, traseuIds]
  );

  const aplicaVehicul = (id) => {
    const v = vehicule.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      vehicul_id: id,
      masa: v && v.masa_maxima_autorizata_t !== null && v.masa_maxima_autorizata_t !== undefined ? String(v.masa_maxima_autorizata_t) : f.masa,
      tip_masa: 'MTMA',
    }));
  };

  const adaugaOprire = (id) => {
    if (!id) return;
    setForm((f) => ({ ...f, intermediare: f.intermediare.includes(id) ? f.intermediare : [...f.intermediare, id] }));
  };

  const calculeaza = async (e) => {
    e?.preventDefault();
    if (!form.origine || !form.destinatie) {
      setRezultat({ eroare: 'Selectează localitatea de origine și localitatea de destinație.' });
      return;
    }
    setSeCalculeaza(true);
    setRezultat(null);
    try {
      const traseu = traseuIds.map((id) => {
        const rol = id === form.origine ? 'Origine' : id === form.destinatie ? 'Destinație' : 'Intermediar';
        return { localitate_id: id, nume: localitati.find((l) => l.id === id)?.nume || '—', rol };
      });

      const pagini = await Promise.all(
        traseuIds.map((id) => api.entities.TaxaAcces.filter({ localitate_id: id, status: { $ne: 'Arhivat' } }, { limit: 200 }))
      );

      const context = {
        masa: laNumar(form.masa),
        tipMasa: form.tip_masa,
        data: form.data_deplasare || azi(),
        durataZile: laNumar(form.durataZile),
      };

      const randuri = [];
      const localitatiNeacoperite = [];

      traseu.forEach((oprire, index) => {
        const localitate = localitati.find((l) => l.id === oprire.localitate_id);
        const reguli = pagini[index].items || [];
        if (!reguli.length || (localitate && localitate.status_acoperire !== 'Verificată')) {
          localitatiNeacoperite.push(oprire.nume);
        }
        const evaluariOprire = marcheazaTarifeAlternative(
          reguli.map((regula) => {
            const evaluare = evalueazaRegula(regula, context);
            if (regula.zona_id && !zoneSelectate.includes(regula.zona_id)) {
              const zona = zone.find((z) => z.id === regula.zona_id);
              const acoperitaDeSelectie = zoneSelectate.some((zid) => {
                const filtru = zone.find((z) => z.id === zid);
                return filtru && zona && zoneCompatibile(filtru, zona);
              });
              if (!acoperitaDeSelectie) {
                evaluare.status = 'De verificat';
                evaluare.cost = null;
                evaluare.motiv = `Regula se aplică zonei „${zona ? zona.nume_zona : 'nedefinită'}”. Selectează zona în traseu pentru a fi inclusă în calcul.`;
              }
            }
            return evaluare;
          }),
          context.durataZile
        );
        evaluariOprire.forEach((evaluare) => {
          const regula = evaluare.regula;
          if (evaluare.status === 'Exclus') return;
          if (evaluare.status === 'Neaplicabil' && !evaluare.faraCost) return;

          randuri.push({
            taxa_id: regula.id,
            localitate_id: regula.localitate_id,
            localitate_nume: oprire.nume,
            zona_id: regula.zona_id || null,
            denumire_regula_snapshot: regula.denumire_regula,
            categorie_snapshot: regula.categorie_regula,
            valoare_snapshot: regula.valoare === undefined ? null : regula.valoare,
            moneda_snapshot: regula.moneda || null,
            unitate_tarifare_snapshot: regula.unitate_tarifare || null,
            status_incredere_snapshot: regula.incredere || 'De confirmat',
            cantitate_aplicata: evaluare.cantitate,
            cost_calculat: evaluare.cost,
            status_calcul: evaluare.status,
            motiv_status: [evaluare.motiv, ...evaluare.avertismente].filter(Boolean).join(' '),
            sursa_url_snapshot: regula.sursa_url || null,
            data_verificare_snapshot: regula.data_verificare || null,
          });
        });
      });

      const sintetic = sintetizeazaCalcul(randuri);
      const statusCalcul = determinaStatusCalcul({ randuri, localitatiNeacoperite });
      setRezultat({
        randuri,
        traseu,
        context,
        localitatiNeacoperite,
        sintetic,
        cursa: {
          status_calcul: statusCalcul,
          moneda_rezultat: sintetic.monedaRezultat,
          data_calcul: acumISO(),
          masa_utilizata_t: context.masa,
          tip_masa_utilizata: form.tip_masa,
          data_deplasare: form.data_deplasare,
          localitati_traseu: traseu,
        },
      });
    } catch (err) {
      setRezultat({ eroare: err.message || 'Calculul nu a putut fi efectuat.' });
    } finally {
      setSeCalculeaza(false);
    }
  };

  const salveaza = async () => {
    if (!rezultat?.randuri) return;
    setSeSalveaza(true);
    try {
      const cursa = await api.entities.Cursa.create({
        nume_cursa: form.nume_cursa.trim() || `Cursă ${form.origine ? localitati.find((l) => l.id === form.origine)?.nume : ''} – ${form.destinatie ? localitati.find((l) => l.id === form.destinatie)?.nume : ''}`,
        vehicul_id: form.vehicul_id || null,
        origine: localitati.find((l) => l.id === form.origine)?.nume || null,
        destinatie: localitati.find((l) => l.id === form.destinatie)?.nume || null,
        localitati_traseu: rezultat.traseu.map((t) => ({ localitate_id: t.localitate_id, nume: t.nume, rol: t.rol })),
        data_calcul: rezultat.cursa.data_calcul,
        data_deplasare: form.data_deplasare || null,
        masa_utilizata_t: rezultat.context.masa,
        tip_masa_utilizata: form.tip_masa,
        durata_estimata: form.durata_estimata || null,
        distanta_km: laNumar(form.distanta_km),
        total_taxare_confirmata: rezultat.sintetic.totalConfirmat,
        total_costuri_neconfirmate: rezultat.sintetic.totalNeconfirmat,
        total_estimare: rezultat.sintetic.totalEstimare,
        moneda_rezultat: rezultat.sintetic.monedaRezultat,
        status_calcul: rezultat.cursa.status_calcul,
        surse_snapshot: rezultat.randuri.map((r) => ({
          taxa_id: r.taxa_id,
          denumire_regula: r.denumire_regula_snapshot,
          localitate: r.localitate_nume,
          valoare: r.valoare_snapshot,
          moneda: r.moneda_snapshot,
          incredere: r.status_incredere_snapshot,
          sursa_url: r.sursa_url_snapshot,
          data_verificare: r.data_verificare_snapshot,
        })),
        observatii: form.observatii || null,
      });

      await api.entities.CursaTaxa.bulkCreate(
        rezultat.randuri.map((r) => ({
          cursa_id: cursa.id,
          taxa_id: r.taxa_id,
          localitate_id: r.localitate_id,
          zona_id: r.zona_id,
          denumire_regula_snapshot: r.denumire_regula_snapshot,
          categorie_snapshot: r.categorie_snapshot,
          valoare_snapshot: r.valoare_snapshot,
          moneda_snapshot: r.moneda_snapshot,
          unitate_tarifare_snapshot: r.unitate_tarifare_snapshot,
          status_incredere_snapshot: r.status_incredere_snapshot,
          cantitate_aplicata: r.cantitate_aplicata,
          cost_calculat: r.cost_calculat,
          status_calcul: r.status_calcul,
          motiv_status: r.motiv_status,
          sursa_url_snapshot: r.sursa_url_snapshot,
          data_verificare_snapshot: r.data_verificare_snapshot,
        }))
      );

      toast({ title: 'Calculul a fost salvat', description: 'Valorile și sursele folosite rămân neschimbate chiar dacă regulile se modifică ulterior.' });
      await incarca();
      window.location.href = `/cursa/${cursa.id}`;
    } catch (err) {
      toast({ title: 'Salvarea nu a reușit', description: err.message, variant: 'destructive' });
    } finally {
      setSeSalveaza(false);
    }
  };

  const reseteaza = () => {
    setForm(FORM_GOL);
    setZoneSelectate([]);
    setRezultat(null);
  };

  if (seIncarca) return <StareIncarcare mesaj="Se încarcă datele pentru calcul…" />;
  if (eroare) return <StareEroare mesaj={eroare} onReincearca={incarca} />;

  return (
    <div>
      <PageHeader
        titlu="Cost pe cursă"
        descriere="Identifică taxele de acces relevante pentru traseul tău, pe baza localităților și zonelor selectate explicit."
      />

      <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <form onSubmit={calculeaza} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 lg:sticky lg:top-20 lg:self-start">
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Numele cursei (opțional)</Label>
            <Input value={form.nume_cursa} onChange={(e) => seteaza('nume_cursa', e.target.value)} placeholder="Ex.: București – Otopeni" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Localitatea de origine *</Label>
            <LocalitateSelect localitati={localitati} value={form.origine} onChange={(v) => seteaza('origine', v)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Localitatea de destinație *</Label>
            <LocalitateSelect localitati={localitati} value={form.destinatie} onChange={(v) => seteaza('destinatie', v)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Localități și puncte intermediare</Label>
            <div className="flex gap-2">
              <LocalitateSelect
                localitati={localitati.filter((l) => !traseuIds.includes(l.id))}
                value=""
                onChange={adaugaOprire}
                placeholder="Adaugă o oprire"
                className="flex-1"
              />
            </div>
            {form.intermediare.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {form.intermediare.map((id) => (
                  <li key={id} className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                    {localitati.find((l) => l.id === id)?.nume}
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, intermediare: f.intermediare.filter((x) => x !== id) }))}
                      className="text-slate-400 hover:text-red-600"
                      aria-label={`Elimină ${localitati.find((l) => l.id === id)?.nume} din traseu`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {zoneTraseu.length ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-medium text-slate-600">Zone cuprinse în traseu</p>
              <p className="mb-2 text-[11px] leading-snug text-slate-500">
                Regulile legate de o anumită zonă se aplică doar dacă marchezi zona aici. Nu presupunem că un traseu trece printr-o zonă
                doar pentru că tranzitează localitatea.
              </p>
              <ul className="space-y-2">
                {zoneTraseu.map((z) => (
                  <li key={z.id} className="space-y-1.5">
                    <label className="flex items-start gap-2 text-xs text-slate-700">
                      <Checkbox
                        className="mt-0.5"
                        checked={zoneSelectate.includes(z.id)}
                        onCheckedChange={(bifat) =>
                          setZoneSelectate((lista) => (bifat ? [...lista, z.id] : lista.filter((x) => x !== z.id)))
                        }
                      />
                      <span>
                        <span className="font-medium">
                          {z.nume_zona} · {localitati.find((l) => l.id === z.localitate_id)?.nume}
                        </span>
                        <span className="text-slate-500"> · {z.tip_zona}</span>
                      </span>
                    </label>
                    <ZonaDescriere zona={z} compact className="ml-6" />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-slate-600">Masa utilizată (t)</Label>
              <Input inputMode="decimal" value={form.masa} onChange={(e) => seteaza('masa', e.target.value)} placeholder="7,5" />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-slate-600">Tipul masei</Label>
              <Select value={form.tip_masa} onValueChange={(v) => seteaza('tip_masa', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPURI_MASA.filter((t) => t !== 'Necunoscut').map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {vehicule.length ? (
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-slate-600">Vehicul din organizație</Label>
              <VehiculSelect vehicule={vehicule} value={form.vehicul_id} onChange={aplicaVehicul} />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-slate-600">Data deplasării</Label>
              <Input type="date" value={form.data_deplasare} onChange={(e) => seteaza('data_deplasare', e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-slate-600">Durata accesului (zile)</Label>
              <Input inputMode="numeric" value={form.durataZile} onChange={(e) => seteaza('durataZile', e.target.value)} placeholder="Ex.: 1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-slate-600">Distanță estimată (km)</Label>
              <Input inputMode="decimal" value={form.distanta_km} onChange={(e) => seteaza('distanta_km', e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-slate-600">Durată estimată</Label>
              <Input value={form.durata_estimata} onChange={(e) => seteaza('durata_estimata', e.target.value)} placeholder="Ex.: 3 h" />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Monedă de afișare</Label>
            <Select value={form.moneda_afisare} onValueChange={(v) => seteaza('moneda_afisare', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RON">RON</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              Conversia între monede se face doar dacă există un curs documentat. Sumele în monede diferite se afișează separat.
            </p>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Observații</Label>
            <Textarea value={form.observatii} onChange={(e) => seteaza('observatii', e.target.value)} rows={2} />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" disabled={seCalculeaza}>
              <Calculator className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {seCalculeaza ? 'Se calculează…' : 'Calculează costul'}
            </Button>
            <Button type="button" variant="outline" onClick={reseteaza}>
              <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Resetează
            </Button>
          </div>
        </form>

        <div className="space-y-5">
          {seCalculeaza ? <StareIncarcare mesaj="Se calculează taxele aplicabile…" /> : null}
          {rezultat?.eroare ? <StareEroare mesaj={rezultat.eroare} /> : null}

          {rezultat?.randuri ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-heading text-sm font-semibold text-slate-700">Estimare pentru itinerarul selectat</h2>
                <Button onClick={salveaza} disabled={seSalveaza} size="sm">
                  <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {seSalveaza ? 'Se salvează…' : 'Salvează calculul'}
                </Button>
              </div>

              <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                Estimare bazată pe itinerarul selectat ({rezultat.traseu.map((t) => t.nume).join(' → ')}). Nu este o verificare
                exhaustivă a tuturor drumurilor de pe traseu și nu confirmă că accesul este permis.
              </p>

              {rezultat.localitatiNeacoperite.length ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Acoperire incompletă pentru: {rezultat.localitatiNeacoperite.join(', ')}. Estimarea este parțială.
                </p>
              ) : null}

              <CursaRezumat
                cursa={{ ...rezultat.cursa, localitati_traseu: rezultat.traseu, masa_utilizata_t: rezultat.context.masa }}
                randuri={rezultat.randuri}
              />
            </>
          ) : null}

          {!rezultat && !seCalculeaza ? (
            <EmptyState
              icon={Calculator}
              titlu="Calculează costul unei curse"
              descriere="Selectează originea, destinația și eventualele opriri, masa vehiculului și data deplasării. Regulile fără bază de calcul cunoscută sunt raportate separat, nu estimate."
            />
          ) : null}

          <section aria-labelledby="titlu-curse-salvate">
            <h2 id="titlu-curse-salvate" className="mb-2 font-heading text-sm font-semibold text-slate-700">
              Curse salvate recent
            </h2>
            {curse.length === 0 ? (
              <EmptyState titlu="Nu există curse salvate" descriere="Calculele salvate păstrează valorile și sursele folosite la momentul calculului." />
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                {curse.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0">
                      <Link to={`/cursa/${c.id}`} className="block truncate text-sm font-medium text-blue-700 hover:underline">
                        {c.nume_cursa}
                      </Link>
                      <span className="text-xs text-slate-500">
                        {c.origine || '—'} – {c.destinatie || '—'} · {dataOraRo(c.data_calcul)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusBadge valoare={c.status_calcul} />
                      <span className="text-sm font-medium tabular-nums text-slate-800">
                        {c.total_estimare === null || c.total_estimare === undefined
                          ? sumaRo(c.total_taxare_confirmata, c.moneda_rezultat === 'Mixt' ? null : c.moneda_rezultat)
                          : sumaRo(c.total_estimare, c.moneda_rezultat)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="flex items-start gap-2 text-xs text-slate-400">
            <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Nu se aplică automat nicio taxă pentru simpla apropiere a traseului de o localitate. Sunt necesare o regulă documentată
            pentru întreaga localitate sau o zonă desemnată explicit.
          </p>
        </div>
      </div>
    </div>
  );
}