import React, { useCallback, useEffect, useState } from 'react';
import { Download, Save, UserPlus } from 'lucide-react';
import { api } from '@/api/client';
import PageHeader from '@/components/PageHeader';
import StareIncarcare from '@/components/StareIncarcare';
import StareEroare from '@/components/StareEroare';
import ImportCsv from '@/components/ImportCsv';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { numarRo } from '@/lib/format';
import { descarcaCsv, laCsv } from '@/lib/csv';
import { TIPURI_MASA } from '@/lib/enum';
import { cuReincercare, mesajEroare } from '@/lib/cereri';

const PROFIL_GOL = {
  nume_organizatie: '',
  cui: '',
  adresa_organizatie: '',
  telefon_organizatie: '',
  email_organizatie: '',
  moneda_implicita: 'RON',
  criteriu_masa_implicit: 'MTMA',
};

async function toateInregistrarile(entitate, sort) {
  const acumulate = [];
  let cursor = null;
  for (let i = 0; i < 20; i += 1) {
    const page = await api.entities[entitate].filter({}, { sort, limit: 500, cursor: cursor || undefined });
    acumulate.push(...(page.items || []));
    if (!page.has_more) break;
    cursor = page.next_cursor;
  }
  return acumulate;
}

export default function Setari() {
  const { toast } = useToast();
  const { user, checkUserAuth } = useAuth();
  const esteAdmin = user?.role === 'admin';
  const [seIncarca, setSeIncarca] = useState(true);
  const [eroare, setEroare] = useState(null);
  const [profil, setProfil] = useState(PROFIL_GOL);
  const [seSalveazaProfil, setSeSalveazaProfil] = useState(false);
  const [localitati, setLocalitati] = useState([]);
  const [zone, setZone] = useState([]);
  const [utilizatori, setUtilizatori] = useState([]);
  const [invitatie, setInvitatie] = useState({ email: '', rol: 'user' });
  const [seInvita, setSeInvita] = useState(false);
  const [calitate, setCalitate] = useState(null);
  const [seCalculeazaCalitate, setSeCalculeazaCalitate] = useState(false);
  const [eroareCalitate, setEroareCalitate] = useState(null);
  const [seExporta, setSeExporta] = useState('');

  const incarca = useCallback(async () => {
    setSeIncarca(true);
    setEroare(null);
    try {
      const [pageLocalitati, pageZone, utilizatoriLista] = await Promise.all([
        api.entities.Localitate.filter({ archived: { $ne: true } }, { sort: 'nume', limit: 500, fields: ['nume', 'judet'] }),
        api.entities.Zona.filter({ archived: { $ne: true } }, { limit: 500, fields: ['nume_zona', 'localitate_id'] }),
        esteAdmin ? api.entities.User.list().catch(() => []) : Promise.resolve([]),
      ]);
      setLocalitati(pageLocalitati.items || []);
      setZone(pageZone.items || []);
      setUtilizatori(Array.isArray(utilizatoriLista) ? utilizatoriLista : []);

      if (user) {
        setProfil({
          nume_organizatie: user.nume_organizatie || '',
          cui: user.cui || '',
          adresa_organizatie: user.adresa_organizatie || '',
          telefon_organizatie: user.telefon_organizatie || '',
          email_organizatie: user.email_organizatie || '',
          moneda_implicita: user.moneda_implicita || 'RON',
          criteriu_masa_implicit: user.criteriu_masa_implicit || 'MTMA',
        });
      }

    } catch (e) {
      setEroare(mesajEroare(e, 'Nu am putut încărca setările.'));
    } finally {
      setSeIncarca(false);
    }
  }, [esteAdmin, user]);

  // Indicatorii de calitate se calculează doar când este deschisă fila corespunzătoare,
  // ca încărcarea paginii să nu trimită un val de cereri către server.
  const incarcaCalitatea = useCallback(async () => {
    setSeCalculeazaCalitate(true);
    setEroareCalitate(null);
    try {
      const [faraSursa, faraVerificare, neconfirmate, localitatiNeverificate, zoneFaraGeometrie, demoLocalitati, demoReguli, curse] =
        await cuReincercare(() =>
          Promise.all([
            api.entities.TaxaAcces.count({ $and: [{ sursa_url: null }, { act_normativ_id: null }] }),
            api.entities.TaxaAcces.count({ data_verificare: null }),
            api.entities.TaxaAcces.count({ incredere: { $ne: 'Confirmat' }, status: { $ne: 'Arhivat' } }),
            api.entities.Localitate.count({ archived: { $ne: true }, ultima_verificare: null }),
            api.entities.Zona.count({ archived: { $ne: true }, geometrie_geojson: null }),
            api.entities.Localitate.count({ este_demo: true }),
            api.entities.TaxaAcces.count({ este_demo: true }),
            api.entities.Cursa.count({}),
          ])
        );
      setCalitate({
        faraSursa: faraSursa || 0,
        faraVerificare: faraVerificare || 0,
        neconfirmate: neconfirmate || 0,
        localitatiNeverificate: localitatiNeverificate || 0,
        zoneFaraGeometrie: zoneFaraGeometrie || 0,
        demo: (demoLocalitati || 0) + (demoReguli || 0),
        curse: curse || 0,
      });
    } catch (e) {
      setEroareCalitate(mesajEroare(e, 'Indicatorii de calitate nu au putut fi calculați.'));
    } finally {
      setSeCalculeazaCalitate(false);
    }
  }, []);

  useEffect(() => {
    incarca();
  }, [incarca]);

  const salveazaProfilul = async () => {
    setSeSalveazaProfil(true);
    try {
      await api.auth.updateMe(profil);
      await checkUserAuth();
      toast({ title: 'Profilul organizației a fost salvat' });
    } catch (e) {
      toast({ title: 'Salvarea nu a reușit', description: e.message, variant: 'destructive' });
    } finally {
      setSeSalveazaProfil(false);
    }
  };

  const trimiteInvitatie = async (e) => {
    e.preventDefault();
    if (!invitatie.email.trim()) return;
    setSeInvita(true);
    try {
      await api.users.inviteUser(invitatie.email.trim(), invitatie.rol);
      toast({ title: 'Invitația a fost trimisă', description: `${invitatie.email} · rol ${invitatie.rol === 'admin' ? 'Administrator' : 'Operator / Dispecer'}` });
      setInvitatie({ email: '', rol: 'user' });
      const lista = await api.entities.User.list().catch(() => []);
      setUtilizatori(Array.isArray(lista) ? lista : []);
    } catch (err) {
      toast({ title: 'Invitația nu a putut fi trimisă', description: err.message, variant: 'destructive' });
    } finally {
      setSeInvita(false);
    }
  };

  const exporta = async (tip) => {
    setSeExporta(tip);
    try {
      const numeLocalitate = (id) => localitati.find((l) => l.id === id)?.nume || '';
      if (tip === 'localitati') {
        const date = await toateInregistrarile('Localitate', 'nume');
        descarcaCsv(
          'localitati.csv',
          laCsv(
            ['nume', 'judet', 'tip_localitate', 'prioritate', 'status_acoperire', 'status_reglementare', 'latitudine', 'longitudine', 'ultima_verificare', 'urmatoarea_verificare', 'descriere'],
            date
          )
        );
      } else if (tip === 'taxe') {
        const date = await toateInregistrarile('TaxaAcces', 'denumire_regula');
        descarcaCsv(
          'reguli-taxare.csv',
          laCsv(
            ['localitate', 'denumire_regula', 'categorie_regula', 'masa_min_t', 'masa_max_t', 'tip_masa', 'tip_taxa', 'valoare', 'moneda', 'unitate_tarifare', 'perioada_start', 'perioada_end', 'incredere', 'status', 'data_verificare', 'sursa_url'],
            date.map((r) => ({
              localitate: numeLocalitate(r.localitate_id),
              denumire_regula: r.denumire_regula,
              categorie_regula: r.categorie_regula,
              masa_min_t: r.masa_min_t,
              masa_max_t: r.masa_max_t,
              tip_masa: r.tip_masa,
              tip_taxa: r.tip_taxa,
              valoare: r.valoare,
              moneda: r.moneda,
              unitate_tarifare: r.unitate_tarifare,
              perioada_start: r.perioada_valabilitate_start,
              perioada_end: r.perioada_valabilitate_end,
              incredere: r.incredere,
              status: r.status,
              data_verificare: r.data_verificare,
              sursa_url: r.sursa_url,
            }))
          )
        );
      } else if (tip === 'surse') {
        const date = await toateInregistrarile('SursaAct', '-data_act');
        descarcaCsv(
          'surse-acte.csv',
          laCsv(
            ['localitate', 'tip_act', 'numar_act', 'an_fiscal', 'data_act', 'titlu_document', 'document_url', 'data_verificare', 'status_act'],
            date.map((s) => ({
              localitate: numeLocalitate(s.localitate_id),
              tip_act: s.tip_act,
              numar_act: s.numar_act,
              an_fiscal: s.an_fiscal,
              data_act: s.data_act,
              titlu_document: s.titlu_document,
              document_url: s.document_url,
              data_verificare: s.data_verificare,
              status_act: s.status_act,
            }))
          )
        );
      } else if (tip === 'zone') {
        const date = await toateInregistrarile('Zona', 'nume_zona');
        descarcaCsv(
          'zone.csv',
          laCsv(
            ['localitate', 'nume_zona', 'cod_zona', 'tip_zona', 'status_geometrie', 'data_verificare_geometrie', 'geometrie_geojson'],
            date.map((z) => ({
              localitate: numeLocalitate(z.localitate_id),
              nume_zona: z.nume_zona,
              cod_zona: z.cod_zona,
              tip_zona: z.tip_zona,
              status_geometrie: z.status_geometrie,
              data_verificare_geometrie: z.data_verificare_geometrie,
              geometrie_geojson: z.geometrie_geojson,
            }))
          )
        );
      }
      toast({ title: 'Export finalizat', description: 'Fișierul CSV a fost descărcat.' });
    } catch (e) {
      toast({ title: 'Exportul nu a reușit', description: e.message, variant: 'destructive' });
    } finally {
      setSeExporta('');
    }
  };

  if (seIncarca) return <StareIncarcare mesaj="Se încarcă setările…" />;
  if (eroare) return <StareEroare mesaj={eroare} onReincearca={incarca} />;

  return (
    <div>
      <PageHeader
        titlu="Setări"
        descriere="Profilul organizației, utilizatorii, importul și exportul de date, precum și situația calității datelor."
      />

      <Tabs
        defaultValue="profil"
        onValueChange={(valoare) => {
          if (valoare === 'calitate' && !calitate && !seCalculeazaCalitate) incarcaCalitatea();
        }}
      >
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start gap-1 bg-slate-100 p-1">
          <TabsTrigger value="profil">Profil organizație</TabsTrigger>
          <TabsTrigger value="utilizatori">Utilizatori și roluri</TabsTrigger>
          <TabsTrigger value="date">Import și export</TabsTrigger>
          <TabsTrigger value="calitate">Calitatea datelor</TabsTrigger>
        </TabsList>

        <TabsContent value="profil">
          <div className="max-w-2xl rounded-lg border border-slate-200 bg-white p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block text-xs font-medium text-slate-600">Denumirea organizației</Label>
                <Input value={profil.nume_organizatie} onChange={(e) => setProfil((p) => ({ ...p, nume_organizatie: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-slate-600">CUI</Label>
                <Input value={profil.cui} onChange={(e) => setProfil((p) => ({ ...p, cui: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-slate-600">Telefon</Label>
                <Input value={profil.telefon_organizatie} onChange={(e) => setProfil((p) => ({ ...p, telefon_organizatie: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-slate-600">E-mail de contact</Label>
                <Input value={profil.email_organizatie} onChange={(e) => setProfil((p) => ({ ...p, email_organizatie: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-slate-600">Monedă implicită</Label>
                <Select value={profil.moneda_implicita} onValueChange={(v) => setProfil((p) => ({ ...p, moneda_implicita: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RON">RON</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-slate-600">Criteriu implicit de masă</Label>
                <Select value={profil.criteriu_masa_implicit} onValueChange={(v) => setProfil((p) => ({ ...p, criteriu_masa_implicit: v }))}>
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
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block text-xs font-medium text-slate-600">Adresă</Label>
                <Input value={profil.adresa_organizatie} onChange={(e) => setProfil((p) => ({ ...p, adresa_organizatie: e.target.value }))} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={salveazaProfilul} disabled={seSalveazaProfil}>
                <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {seSalveazaProfil ? 'Se salvează…' : 'Salvează profilul'}
              </Button>
              <span className="text-xs text-slate-500">Format dată: ZZ.LL.AAAA · Fus orar: Europe/Bucharest · Monedă: RON</span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="utilizatori" className="space-y-4">
          {esteAdmin ? (
            <>
              <form onSubmit={trimiteInvitatie} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
                <div className="min-w-[240px] flex-1">
                  <Label className="mb-1.5 block text-xs font-medium text-slate-600">Invitație prin e-mail</Label>
                  <Input type="email" value={invitatie.email} onChange={(e) => setInvitatie((i) => ({ ...i, email: e.target.value }))} placeholder="nume@companie.ro" required />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-slate-600">Rol</Label>
                  <Select value={invitatie.rol} onValueChange={(v) => setInvitatie((i) => ({ ...i, rol: v }))}>
                    <SelectTrigger className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Operator / Dispecer</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={seInvita}>
                  <UserPlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  {seInvita ? 'Se trimite…' : 'Trimite invitația'}
                </Button>
              </form>

              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[520px] text-sm">
                  <caption className="sr-only">Utilizatorii aplicației</caption>
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th scope="col" className="px-3 py-2 font-medium">Nume</th>
                      <th scope="col" className="px-3 py-2 font-medium">E-mail</th>
                      <th scope="col" className="px-3 py-2 font-medium">Rol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {utilizatori.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-sm text-slate-500">
                          Nu există utilizatori afișabili.
                        </td>
                      </tr>
                    ) : (
                      utilizatori.map((u) => (
                        <tr key={u.id} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-3 py-2 text-slate-800">{u.full_name || '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{u.email}</td>
                          <td className="px-3 py-2">
                            <StatusBadge valoare={u.role === 'admin' ? 'Administrator' : 'Operator / Dispecer'} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">
                Administratorii pot modifica datele juridice, localitățile, zonele, sursele și alertele. Operatorii pot căuta taxe,
                consulta harta, gestiona vehiculele organizației și calcula curse.
              </p>
            </>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Gestionarea utilizatorilor și a rolurilor este disponibilă doar administratorilor. Contactează un administrator al
              organizației pentru a primi acces sau un rol suplimentar.
            </div>
          )}
        </TabsContent>

        <TabsContent value="date" className="space-y-6">
          <div>
            <h2 className="mb-2 font-heading text-sm font-semibold text-slate-700">Export CSV</h2>
            <p className="mb-3 text-xs text-slate-500">
              Exporturile folosesc separatorul „;” și codificare UTF-8, compatibile cu Excel în limba română.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { tip: 'localitati', nume: 'Localități' },
                { tip: 'taxe', nume: 'Reguli de taxare' },
                { tip: 'surse', nume: 'Surse și acte' },
                { tip: 'zone', nume: 'Zone' },
              ].map(({ tip, nume }) => (
                <Button key={tip} variant="outline" onClick={() => exporta(tip)} disabled={seExporta === tip}>
                  <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  {seExporta === tip ? 'Se exportă…' : nume}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-2 font-heading text-sm font-semibold text-slate-700">Import CSV</h2>
            <p className="mb-3 text-xs text-slate-500">
              Importul verifică mai întâi coloanele obligatorii, referințele către localități, valorile numerice, datele, monedele și
              sintaxa GeoJSON. Înregistrările valide se salvează doar după confirmare.
            </p>
            <ImportCsv localitati={localitati} zone={zone} onImportat={incarca} />
          </div>
        </TabsContent>

        <TabsContent value="calitate">
          {seCalculeazaCalitate ? <p className="mb-3 text-sm text-slate-500">Se calculează indicatorii…</p> : null}
          {eroareCalitate ? (
            <div className="mb-3">
              <StareEroare mesaj={eroareCalitate} onReincearca={incarcaCalitatea} />
            </div>
          ) : null}
          {calitate ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { eticheta: 'Reguli fără sursă asociată', valoare: calitate.faraSursa, ajutor: 'Fără link de sursă și fără act normativ' },
                { eticheta: 'Reguli fără dată de verificare', valoare: calitate.faraVerificare, ajutor: 'Nu pot fi considerate verificate' },
                { eticheta: 'Reguli sub „Confirmat”', valoare: calitate.neconfirmate, ajutor: 'De confirmat, Proiect sau Negăsit' },
                { eticheta: 'Localități neverificate', valoare: calitate.localitatiNeverificate, ajutor: 'Fără dată a ultimei verificări' },
                { eticheta: 'Zone fără geometrie', valoare: calitate.zoneFaraGeometrie, ajutor: 'Nu apar pe hartă' },
                { eticheta: 'Înregistrări demonstrative', valoare: calitate.demo, ajutor: 'Marcate DEMO, excluse din KPI' },
                { eticheta: 'Curse salvate', valoare: calitate.curse, ajutor: 'Calcule păstrate cu instantanee' },
              ].map((k) => (
                <div key={k.eticheta} className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{k.eticheta}</p>
                  <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-slate-900">
                    {k.valoare === null || k.valoare === undefined ? '—' : numarRo(k.valoare, 0)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">{k.ajutor}</p>
                </div>
              ))}
            </div>
          ) : null}
          <p className="mt-4 text-xs text-slate-500">
            Indicatorii se calculează direct din baza de date. Înregistrările marcate „DEMO — DATE FICTIVE” sunt excluse din
            totalurile de producție și servesc doar la testarea fluxurilor.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}