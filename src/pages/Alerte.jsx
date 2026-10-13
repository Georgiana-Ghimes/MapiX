import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, RefreshCw } from 'lucide-react';
import { api } from '@/api/client';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import StareIncarcare from '@/components/StareIncarcare';
import StareEroare from '@/components/StareEroare';
import AlertaCard from '@/components/AlertaCard';
import ListaJudetExpand from '@/components/ListaJudetExpand';
import LocalitateSelect from '@/components/LocalitateSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { azi, dataOraRo } from '@/lib/format';
import { gruparePeJudet } from '@/lib/grupareJudet';
import { PANEL, PANEL_FILTERS } from '@/lib/uiPanel';
import { cn } from '@/lib/utils';
import { construiesteAlerte } from '@/lib/reguliTaxe';
import { SEVERITATI, STATUSURI_ALERTA } from '@/lib/enum';

const FILTRE_GOL = { severitate: 'toate', localitate: 'toate', status: 'toate', responsabil: '', termen: 'toate' };

function pesteZile(zile) {
  const d = new Date();
  d.setDate(d.getDate() + zile);
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const inBucati = (lista, dimensiune) => {
  const bucati = [];
  for (let i = 0; i < lista.length; i += dimensiune) bucati.push(lista.slice(i, i + dimensiune));
  return bucati;
};

async function stergeAlerteDeschise() {
  const page = await api.entities.Alerta.filter(
    { status: { $in: ['Nouă', 'În lucru'] } },
    { limit: 2000, fields: ['id'] }
  );
  const ids = (page.items || []).map((a) => a.id).filter(Boolean);
  for (const bucata of inBucati(ids, 40)) {
    await Promise.all(bucata.map((id) => api.entities.Alerta.delete(id)));
  }
  return ids.length;
}

export default function Alerte() {
  const { toast } = useToast();
  const [alerte, setAlerte] = useState([]);
  const [localitati, setLocalitati] = useState([]);
  const [seIncarcaInitial, setSeIncarcaInitial] = useState(true);
  const [seFiltreaza, setSeFiltreaza] = useState(false);
  const [eroare, setEroare] = useState(null);
  const [filtre, setFiltre] = useState(FILTRE_GOL);
  const [responsabilDebounced, setResponsabilDebounced] = useState('');
  const [seGenereaza, setSeGenereaza] = useState(false);
  const [ultimaGenerare, setUltimaGenerare] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setResponsabilDebounced(filtre.responsabil.trim()), 250);
    return () => clearTimeout(t);
  }, [filtre.responsabil]);

  const filtreEfective = useMemo(
    () => ({ ...filtre, responsabil: responsabilDebounced }),
    [filtre.severitate, filtre.localitate, filtre.status, filtre.termen, responsabilDebounced]
  );

  const construiesteQuery = useCallback((f) => {
    const conditii = [];
    if (f.status !== 'toate') conditii.push({ status: f.status });
    if (f.severitate !== 'toate') conditii.push({ severitate: f.severitate });
    if (f.localitate !== 'toate') conditii.push({ localitate_id: f.localitate });
    if (f.responsabil) conditii.push({ responsabil: { $regex: f.responsabil, $options: 'i' } });
    if (f.termen === 'depasit') conditii.push({ data_scadenta: { $lt: azi() } });
    if (f.termen === 'curand') conditii.push({ data_scadenta: { $gte: azi(), $lte: pesteZile(30) } });
    if (conditii.length === 0) return {};
    if (conditii.length === 1) return conditii[0];
    return { $and: conditii };
  }, []);

  const incarca = useCallback(
    async ({ initial = false } = {}) => {
      if (initial) {
        setSeIncarcaInitial(true);
        setEroare(null);
      } else setSeFiltreaza(true);
      try {
        const [pageAlerte, pageLocalitati] = await Promise.all([
          api.entities.Alerta.filter(construiesteQuery(filtreEfective), { sort: '-data_generare', limit: 300 }),
          api.entities.Localitate.filter(
            { archived: { $ne: true } },
            { sort: 'nume', limit: 500, fields: ['nume', 'judet', 'prioritate'] }
          ),
        ]);
        setAlerte(pageAlerte.items || []);
        setLocalitati(pageLocalitati.items || []);
        setEroare(null);
      } catch (e) {
        setEroare(e.message || 'Nu am putut încărca alertele.');
      } finally {
        setSeIncarcaInitial(false);
        setSeFiltreaza(false);
      }
    },
    [construiesteQuery, filtreEfective]
  );

  const genereaza = useCallback(async () => {
    setSeGenereaza(true);
    try {
      const sterse = await stergeAlerteDeschise();

      const [pageLocalitati, pageReguli, pageZone, pageSurse] = await Promise.all([
        api.entities.Localitate.filter({}, { limit: 500 }),
        api.entities.TaxaAcces.filter({}, { limit: 2000 }),
        api.entities.Zona.filter({}, { limit: 500 }),
        api.entities.SursaAct.filter({}, { limit: 500 }),
      ]);

      const candidate = construiesteAlerte({
        localitati: pageLocalitati.items || [],
        reguli: pageReguli.items || [],
        zone: pageZone.items || [],
        surse: pageSurse.items || [],
        existente: [],
      });

      if (candidate.length) {
        for (const bucata of inBucati(candidate, 200)) {
          await api.entities.Alerta.bulkCreate(bucata);
        }
      }
      setUltimaGenerare(new Date().toISOString());
      toast({
        title: `${candidate.length} alerte regenerate`,
        description:
          sterse > 0
            ? `Am înlocuit ${sterse} alerte deschise cu un set agregat (fără o alertă per regulă „De confirmat”).`
            : 'Alertele acoperă expirări, P1 incomplet și agregate pe localitate pentru coada de verificare.',
      });
      await incarca();
    } catch (e) {
      toast({ title: 'Generarea alertelor nu a reușit', description: e.message, variant: 'destructive' });
    } finally {
      setSeGenereaza(false);
    }
  }, [incarca, toast]);

  useEffect(() => {
    incarca({ initial: seIncarcaInitial && alerte.length === 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtreEfective]);

  const metaLocalitate = (id) => localitati.find((l) => l.id === id);
  const numeLocalitate = (id) => metaLocalitate(id)?.nume;

  const alertePeJudet = useMemo(
    () =>
      gruparePeJudet(alerte, {
        getJudet: (a) => metaLocalitate(a.localitate_id)?.judet,
        getLocId: (a) => a.localitate_id,
        getLocNume: (a) => numeLocalitate(a.localitate_id) || 'Fără localitate',
        getPrioritate: (a) => metaLocalitate(a.localitate_id)?.prioritate,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alerte, localitati]
  );

  if (seIncarcaInitial) return <StareIncarcare mesaj="Se încarcă alertele…" />;
  if (eroare && alerte.length === 0) return <StareEroare mesaj={eroare} onReincearca={() => incarca({ initial: true })} />;

  return (
    <div>
      <PageHeader
        titlu="Alerte și verificări"
        descriere="Listă operațională: expirări, localități P1 incomplete, geometrii P1 și agregate pe localitate pentru regulile de confirmat."
        actiuni={
          <Button onClick={genereaza} disabled={seGenereaza}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${seGenereaza ? 'animate-spin' : ''}`} aria-hidden="true" />
            {seGenereaza ? 'Se regenerează…' : 'Regenerează alertele'}
          </Button>
        }
      />

      <p className="mb-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        Regenerarea înlocuiește alertele deschise (Nouă / În lucru) cu un set controlat — fără sute de duplicate pe
        „De confirmat”. Coada detaliată rămâne pe Prezentare. Aplicația nu monitorizează site-urile primăriilor.
        {ultimaGenerare ? ` Ultima regenerare: ${dataOraRo(ultimaGenerare)}.` : ''}
      </p>

      <div className={cn(PANEL_FILTERS, 'sm:grid-cols-2 lg:grid-cols-5')}>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Severitate</Label>
          <Select value={filtre.severitate} onValueChange={(v) => setFiltre((f) => ({ ...f, severitate: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Toate</SelectItem>
              {SEVERITATI.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Localitate</Label>
          <LocalitateSelect localitati={localitati} value={filtre.localitate} onChange={(v) => setFiltre((f) => ({ ...f, localitate: v }))} toateEticheta="Toate localitățile" />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Status</Label>
          <Select value={filtre.status} onValueChange={(v) => setFiltre((f) => ({ ...f, status: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Toate statusurile</SelectItem>
              {STATUSURI_ALERTA.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Termen</Label>
          <Select value={filtre.termen} onValueChange={(v) => setFiltre((f) => ({ ...f, termen: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Oricând</SelectItem>
              <SelectItem value="depasit">Termen depășit</SelectItem>
              <SelectItem value="curand">În următoarele 30 de zile</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Responsabil</Label>
          <Input value={filtre.responsabil} onChange={(e) => setFiltre((f) => ({ ...f, responsabil: e.target.value }))} placeholder="Caută responsabil" />
        </div>
        <div className="flex items-end lg:col-span-5">
          <Button variant="outline" size="sm" onClick={() => setFiltre(FILTRE_GOL)}>
            Resetează filtrele
          </Button>
        </div>
      </div>

      <div className={seFiltreaza ? 'opacity-60 transition-opacity' : undefined} aria-busy={seFiltreaza || undefined}>
      {alerte.length === 0 ? (
        <EmptyState
          icon={BellRing}
          titlu="Nu există alerte pentru filtrele selectate"
          descriere="Generează alerte din datele curente (set agregat) sau schimbă filtrele. Expirările și P1 incomplete apar aici; coada pe regulă e pe Prezentare."
          actiune={
            <Button variant="outline" onClick={genereaza} disabled={seGenereaza}>
              Regenerează alertele
            </Button>
          }
        />
      ) : (
        <ListaJudetExpand
          judete={alertePeJudet}
          etichetaItems="alerte"
          itemClassName=""
          renderItem={(alerta) => (
            <AlertaCard
              alerta={alerta}
              numeLocalitate={numeLocalitate(alerta.localitate_id)}
              onActualizat={() => incarca()}
            />
          )}
        />
      )}
      </div>

      <div className={cn(PANEL, 'mt-6 p-4')}>
        <h2 className="font-heading text-sm font-semibold text-slate-700">Ce generează acum</h2>
        <ul className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
          <li>· Taxă / act expirat sau aproape de expirare</li>
          <li>· Agregat pe localitate pentru reguli „De confirmat”</li>
          <li>· Lipsuri pe reguli Confirmate (sursă / dată verificare)</li>
          <li>· Geometrie agregată doar pentru localități P1</li>
          <li>· Reguli Confirmate suprapuse</li>
          <li>· Localitate P1 cu acoperire incompletă</li>
        </ul>
      </div>
    </div>
  );
}
