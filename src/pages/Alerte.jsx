import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, RefreshCw } from 'lucide-react';
import { api } from '@/api/client';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import StareIncarcare from '@/components/StareIncarcare';
import StareEroare from '@/components/StareEroare';
import AlertaCard from '@/components/AlertaCard';
import LocalitateSelect from '@/components/LocalitateSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { azi, dataOraRo } from '@/lib/format';
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

export default function Alerte() {
  const { toast } = useToast();
  const [alerte, setAlerte] = useState([]);
  const [localitati, setLocalitati] = useState([]);
  const [seIncarca, setSeIncarca] = useState(true);
  const [eroare, setEroare] = useState(null);
  const [filtre, setFiltre] = useState(FILTRE_GOL);
  const [seGenereaza, setSeGenereaza] = useState(false);
  const [ultimaGenerare, setUltimaGenerare] = useState(null);
  const generatOdata = useRef(false);

  const construiesteQuery = useCallback(() => {
    const conditii = [];
    if (filtre.status !== 'toate') conditii.push({ status: filtre.status });
    if (filtre.severitate !== 'toate') conditii.push({ severitate: filtre.severitate });
    if (filtre.localitate !== 'toate') conditii.push({ localitate_id: filtre.localitate });
    if (filtre.responsabil.trim()) conditii.push({ responsabil: { $regex: filtre.responsabil.trim(), $options: 'i' } });
    if (filtre.termen === 'depasit') conditii.push({ data_scadenta: { $lt: azi() } });
    if (filtre.termen === 'curand') conditii.push({ data_scadenta: { $gte: azi(), $lte: pesteZile(30) } });
    if (conditii.length === 0) return {};
    if (conditii.length === 1) return conditii[0];
    return { $and: conditii };
  }, [filtre]);

  const incarca = useCallback(async () => {
    setSeIncarca(true);
    setEroare(null);
    try {
      const [pageAlerte, pageLocalitati] = await Promise.all([
        api.entities.Alerta.filter(construiesteQuery(), { sort: '-data_generare', limit: 300 }),
        api.entities.Localitate.filter({ archived: { $ne: true } }, { sort: 'nume', limit: 500, fields: ['nume'] }),
      ]);
      setAlerte(pageAlerte.items || []);
      setLocalitati(pageLocalitati.items || []);
    } catch (e) {
      setEroare(e.message || 'Nu am putut încărca alertele.');
    } finally {
      setSeIncarca(false);
    }
  }, [construiesteQuery]);

  const genereaza = useCallback(
    async (silentios = false) => {
      setSeGenereaza(true);
      try {
        const [pageLocalitati, pageReguli, pageZone, pageSurse, pageAlerte] = await Promise.all([
          api.entities.Localitate.filter({}, { limit: 500 }),
          api.entities.TaxaAcces.filter({}, { limit: 1000 }),
          api.entities.Zona.filter({}, { limit: 500 }),
          api.entities.SursaAct.filter({}, { limit: 500 }),
          api.entities.Alerta.filter({}, { limit: 1000, fields: ['tip_alerta', 'taxa_id', 'sursa_act_id', 'localitate_id', 'titlu', 'status'] }),
        ]);

        const candidate = construiesteAlerte({
          localitati: pageLocalitati.items || [],
          reguli: pageReguli.items || [],
          zone: pageZone.items || [],
          surse: pageSurse.items || [],
          existente: pageAlerte.items || [],
        });

        if (candidate.length) {
          for (const bucata of inBucati(candidate, 200)) {
            await api.entities.Alerta.bulkCreate(bucata);
          }
        }
        setUltimaGenerare(new Date().toISOString());
        if (!silentios) {
          toast({
            title: candidate.length ? `${candidate.length} alerte noi generate` : 'Nu au apărut alerte noi',
            description: 'Alertele provin din datele existente: expirări, verificări lipsă, geometrii și surse neactualizate.',
          });
        }
        if (!silentios || candidate.length) await incarca();
      } catch (e) {
        if (!silentios) toast({ title: 'Generarea alertelor nu a reușit', description: e.message, variant: 'destructive' });
      } finally {
        setSeGenereaza(false);
      }
    },
    [incarca, toast]
  );

  useEffect(() => {
    incarca();
     
  }, [filtre]);

  useEffect(() => {
    if (generatOdata.current) return;
    generatOdata.current = true;
    genereaza(true);
     
  }, []);

  const numeLocalitate = (id) => localitati.find((l) => l.id === id)?.nume;

  if (seIncarca) return <StareIncarcare mesaj="Se încarcă alertele…" />;
  if (eroare) return <StareEroare mesaj={eroare} onReincearca={incarca} />;

  return (
    <div>
      <PageHeader
        titlu="Alerte și verificări"
        descriere="Listă operațională pentru întreținerea datelor: expirări, verificări lipsă, geometrii de reverificat și reguli contradictorii."
        actiuni={
          <Button onClick={() => genereaza(false)} disabled={seGenereaza}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${seGenereaza ? 'animate-spin' : ''}`} aria-hidden="true" />
            {seGenereaza ? 'Se generează…' : 'Generează alerte din datele curente'}
          </Button>
        }
      />

      <p className="mb-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        Alertele sunt calculate din datele existente în aplicație, la deschiderea paginii și la cerere. Aplicația nu monitorizează
        site-urile primăriilor și nu detectează automat toate modificările legislative.
        {ultimaGenerare ? ` Ultima generare: ${dataOraRo(ultimaGenerare)}.` : ''}
      </p>

      <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
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

      {alerte.length === 0 ? (
        <EmptyState
          icon={BellRing}
          titlu="Nu există alerte pentru filtrele selectate"
          descriere="Alertele apar când există expirări, verificări lipsă, geometrii de reverificat sau reguli suprapuse. Poți genera din nou alertele din datele curente."
          actiune={
            <Button variant="outline" onClick={() => genereaza(false)} disabled={seGenereaza}>
              Generează alerte
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {alerte.map((alerta) => (
            <AlertaCard key={alerta.id} alerta={alerta} numeLocalitate={numeLocalitate(alerta.localitate_id)} onActualizat={incarca} />
          ))}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-heading text-sm font-semibold text-slate-700">Tipuri de alerte generate</h2>
        <ul className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
          <li>· Taxă care se apropie de expirare sau este expirată</li>
          <li>· Sursă care necesită reverificare</li>
          <li>· Sursă oficială lipsă sau link de document lipsă</li>
          <li>· Geometrie lipsă, neverificată sau învechită</li>
          <li>· Reguli suprapuse sau contradictorii</li>
          <li>· Localitate prioritară cu acoperire incompletă</li>
        </ul>
      </div>
    </div>
  );
}