import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, Calculator, CheckCircle2, ClipboardList, Database, MapPin, Search } from 'lucide-react';
import { api } from '@/api/client';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import StareIncarcare from '@/components/StareIncarcare';
import StareEroare from '@/components/StareEroare';
import LocalitateFormDialog from '@/components/LocalitateFormDialog';
import VerificariJudetExpand from '@/components/VerificariJudetExpand';
import { NUME_APLICATIE, SUBTITLU_APLICATIE } from '@/components/MarcaAplicatie';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';
import { dataOraRo, numarRo } from '@/lib/format';
import { cuReincercare, mesajEroare } from '@/lib/cereri';
import { PANEL } from '@/lib/uiPanel';
import { cn } from '@/lib/utils';
import { agregaVerificariPeJudet, filtreazaVerificari } from '@/lib/verificariCoada';

export default function Home() {
  const { user } = useAuth();
  const esteAdmin = user?.role === 'admin';
  const [seIncarca, setSeIncarca] = useState(true);
  const [eroare, setEroare] = useState(null);
  const [kpi, setKpi] = useState({ localitati: 0, verificate: 0, reguliActive: 0, deVerificat: 0, alerte: 0 });
  const [localitati, setLocalitati] = useState([]);
  const [verificari, setVerificari] = useState([]);
  const [activitate, setActivitate] = useState([]);
  const [dialogLocalitate, setDialogLocalitate] = useState(false);
  const [doarP1, setDoarP1] = useState(false);
  const [ascundeNegasit, setAscundeNegasit] = useState(true);

  const incarca = useCallback(async () => {
    setSeIncarca(true);
    setEroare(null);
    try {
      const filtruReguliNesigure = {
        este_demo: { $ne: true },
        status: { $ne: 'Arhivat' },
        $or: [
          { incredere: { $in: ['De confirmat', 'Proiect', 'Negăsit'] } },
          { incredere: null },
          { data_verificare: null },
        ],
      };
      const filtruLocalitatiIncomplete = {
        archived: { $ne: true },
        este_demo: { $ne: true },
        $or: [
          { status_acoperire: { $ne: 'Verificată' } },
          {
            status_reglementare: {
              $in: ['De verificat', 'Date indisponibile', 'Proiect', 'Autorizație fără taxă confirmată'],
            },
          },
        ],
      };

      const [
        nrLocalitati,
        nrVerificate,
        nrReguliActive,
        nrDeVerificat,
        nrAlerte,
        listaLocalitati,
        pageReguliNesigure,
        pageLocalitatiIncomplete,
        pageReguli,
        pageSurse,
      ] = await cuReincercare(() =>
        Promise.all([
          api.entities.Localitate.count({ archived: { $ne: true }, este_demo: { $ne: true } }),
          api.entities.Localitate.count({
            archived: { $ne: true },
            este_demo: { $ne: true },
            status_acoperire: 'Verificată',
          }),
          api.entities.TaxaAcces.count({ este_demo: { $ne: true }, status: 'Activ' }),
          api.entities.TaxaAcces.count(filtruReguliNesigure),
          api.entities.Alerta.count({
            este_demo: { $ne: true },
            status: { $in: ['Nouă', 'În lucru'] },
            severitate: { $in: ['Critică', 'Ridicată'] },
          }),
          api.entities.Localitate.filter(
            { archived: { $ne: true } },
            {
              sort: 'prioritate',
              limit: 500,
              fields: [
                'nume',
                'judet',
                'prioritate',
                'status_acoperire',
                'status_reglementare',
                'ultima_verificare',
                'este_demo',
              ],
            }
          ),
          api.entities.TaxaAcces.filter(filtruReguliNesigure, {
            sort: 'data_verificare',
            limit: 80,
            fields: ['denumire_regula', 'localitate_id', 'incredere', 'data_verificare', 'status'],
          }),
          api.entities.Localitate.filter(filtruLocalitatiIncomplete, {
            sort: 'prioritate',
            limit: 80,
            fields: [
              'nume',
              'judet',
              'prioritate',
              'status_acoperire',
              'status_reglementare',
              'ultima_verificare',
              'descriere',
            ],
          }),
          api.entities.TaxaAcces.filter(
            { este_demo: { $ne: true } },
            {
              sort: '-updated_date',
              limit: 5,
              fields: ['denumire_regula', 'localitate_id', 'updated_date', 'status'],
            }
          ),
          api.entities.SursaAct.filter(
            {},
            {
              sort: '-updated_date',
              limit: 4,
              fields: ['titlu_document', 'localitate_id', 'updated_date', 'status_act'],
            }
          ),
        ])
      );

      const catalogLocalitati = listaLocalitati.items || [];
      const metaLoc = (id) => catalogLocalitati.find((x) => x.id === id) || null;

      const dinReguli = (pageReguliNesigure.items || []).map((r) => {
        const loc = metaLoc(r.localitate_id);
        return {
          id: `regula-${r.id}`,
          tip: 'Regulă',
          titlu: r.denumire_regula,
          localitate_id: r.localitate_id,
          localitateNume: loc?.nume || null,
          judet: loc?.judet || null,
          prioritate: loc?.prioritate || null,
          status: r.status,
          incredere: r.incredere || 'Negăsit',
          data_verificare: r.data_verificare,
          motiv:
            !r.data_verificare && r.incredere && r.incredere !== 'Confirmat'
              ? 'Încredere nesigură + fără dată de verificare'
              : !r.data_verificare
                ? 'Lipsește data ultimei verificări'
                : `Încredere: ${r.incredere}`,
          href: `/baza-taxe?regula=${r.id}`,
          hrefLabel: 'Deschide regula',
          hrefLoc: r.localitate_id ? `/localitati/${r.localitate_id}` : null,
        };
      });

      const idsCuReguliNesigure = new Set(dinReguli.map((r) => r.localitate_id));
      const dinLocalitati = (pageLocalitatiIncomplete.items || [])
        // Evită dubluri: localitate deja reprezentată de o regulă nesigură
        .filter((l) => !idsCuReguliNesigure.has(l.id))
        .map((l) => ({
          id: `loc-${l.id}`,
          tip: 'Localitate',
          titlu: l.nume,
          localitate_id: l.id,
          localitateNume: l.nume,
          judet: l.judet || null,
          prioritate: l.prioritate,
          status: l.status_acoperire,
          incredere: l.status_reglementare,
          data_verificare: l.ultima_verificare,
          motiv:
            l.status_acoperire !== 'Verificată'
              ? `Acoperire: ${l.status_acoperire || 'necompletat'}`
              : `Reglementare: ${l.status_reglementare}`,
          href: `/localitati/${l.id}`,
          hrefLabel: 'Deschide localitatea',
          hrefLoc: null,
        }));

      // Prioritizează regulile nesigure, apoi localitățile fără acoperire verificată
      const coada = [...dinReguli, ...dinLocalitati];

      setKpi({
        localitati: nrLocalitati || 0,
        verificate: nrVerificate || 0,
        reguliActive: nrReguliActive || 0,
        deVerificat: nrDeVerificat || 0,
        alerte: nrAlerte || 0,
      });
      setLocalitati(catalogLocalitati);
      setVerificari(
        coada.map((row) => ({
          ...row,
          localitateNume:
            row.localitateNume ||
            catalogLocalitati.find((x) => x.id === row.localitate_id)?.nume ||
            '—',
          judet:
            row.judet ||
            catalogLocalitati.find((x) => x.id === row.localitate_id)?.judet ||
            null,
        }))
      );
      setActivitate(
        [
          ...(pageReguli.items || []).map((r) => ({
            id: r.id,
            tip: 'Regulă',
            nume: r.denumire_regula,
            data: r.updated_date,
            localitate_id: r.localitate_id,
          })),
          ...(pageSurse.items || []).map((s) => ({
            id: s.id,
            tip: 'Document',
            nume: s.titlu_document,
            data: s.updated_date,
            localitate_id: s.localitate_id,
          })),
        ]
          .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
          .slice(0, 6)
      );
    } catch (e) {
      setEroare(mesajEroare(e, 'Nu am putut încărca datele.'));
    } finally {
      setSeIncarca(false);
    }
  }, []);

  useEffect(() => {
    incarca();
  }, [incarca]);

  const numeLocalitate = (id) => {
    const l = localitati.find((x) => x.id === id);
    return l ? l.nume : '—';
  };

  const prioritare = localitati.filter((l) => l.prioritate !== 'P3').slice(0, 8);
  const agregatVerificari = useMemo(() => {
    const filtrate = filtreazaVerificari(verificari, { doarP1, ascundeNegasit });
    return agregaVerificariPeJudet(filtrate);
  }, [verificari, doarP1, ascundeNegasit]);
  const indicatori = [
    {
      eticheta: 'Localități în bază',
      valoare: kpi.localitati,
      Icon: MapPin,
      ajutor: 'Fără înregistrările demonstrative',
      cale: '/localitati',
      actiune: 'Vezi localitățile',
      tema: {
        border: 'border-slate-400',
        ribbon: 'bg-slate-800 text-white',
        corp: 'bg-slate-50',
        accent: 'text-slate-800',
      },
    },
    {
      eticheta: 'Localități verificate',
      valoare: kpi.verificate,
      Icon: CheckCircle2,
      ajutor: 'Status acoperire „Verificată”',
      cale: '/localitati?acoperire=Verificată',
      actiune: 'Vezi verificate',
      tema: {
        border: 'border-emerald-600',
        ribbon: 'bg-emerald-800 text-white',
        corp: 'bg-emerald-50',
        accent: 'text-emerald-900',
      },
    },
    {
      eticheta: 'Reguli active',
      valoare: kpi.reguliActive,
      Icon: Database,
      ajutor: 'Reguli de acces cu status „Activ”',
      cale: '/baza-taxe?status=Activ',
      actiune: 'Deschide baza de taxe',
      tema: {
        border: 'border-blue-600',
        ribbon: 'bg-blue-800 text-white',
        corp: 'bg-blue-50',
        accent: 'text-blue-900',
      },
    },
    {
      eticheta: 'Reguli de verificat',
      valoare: kpi.deVerificat,
      Icon: ClipboardList,
      ajutor: 'Nesigure sau fără dată verificare — nu cele Confirmate',
      cale: '#titlu-verificari',
      actiune: 'Vezi coada de verificări',
      tema: {
        border: 'border-amber-600',
        ribbon: 'bg-amber-800 text-white',
        corp: 'bg-amber-50',
        accent: 'text-amber-950',
      },
    },
    {
      eticheta: 'Alerte urgente',
      valoare: kpi.alerte,
      Icon: Bell,
      ajutor: 'Nouă / În lucru · Critică sau Ridicată',
      cale: '/alerte',
      actiune: 'Deschide alertele',
      tema: {
        border: 'border-red-600',
        ribbon: 'bg-red-800 text-white',
        corp: 'bg-red-50',
        accent: 'text-red-900',
      },
    },
  ];

  if (seIncarca) return <StareIncarcare mesaj="Se încarcă prezentarea generală…" />;
  if (eroare) return <StareEroare mesaj={eroare} onReincearca={incarca} />;

  return (
    <div>
      <PageHeader
        titlu={NUME_APLICATIE}
        descriere={`${SUBTITLU_APLICATIE}. Verifică obligațiile de acces pentru camioane și estimează costurile curselor.`}
        actiuni={
          <>
            <Button asChild variant="outline">
              <Link to="/cauta-taxe">
                <Search className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Caută o taxă
              </Link>
            </Button>
            <Button asChild>
              <Link to="/cost-cursa">
                <Calculator className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Calculează o cursă
              </Link>
            </Button>
            {esteAdmin ? (
              <Button variant="outline" onClick={() => setDialogLocalitate(true)}>
                <MapPin className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Adaugă o localitate
              </Button>
            ) : null}
          </>
        }
      />

      {localitati.length === 0 ? (
        <div className="mb-6">
          <EmptyState
            icon={Database}
            titlu="Baza de date este goală"
            descriere="Începe prin a adăuga prima localitate sau importă date dintr-un fișier CSV. Regulile de taxare se adaugă apoi pentru fiecare localitate."
            actiune={
              <div className="flex flex-wrap items-center justify-center gap-2">
                {esteAdmin ? <Button onClick={() => setDialogLocalitate(true)}>Adaugă prima localitate</Button> : null}
                <Button asChild variant="outline">
                  <Link to="/setari">Importă date din CSV</Link>
                </Button>
              </div>
            }
          />
        </div>
      ) : null}

      <section aria-label="Indicatori" className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {indicatori.map(({ eticheta, valoare, ajutor, Icon, cale, actiune, tema }) => (
          <Link
            key={eticheta}
            to={cale.startsWith('#') ? { pathname: '/', hash: cale.slice(1) } : cale}
            onClick={(e) => {
              if (!cale.startsWith('#')) return;
              const el = document.getElementById(cale.slice(1));
              if (!el) return;
              e.preventDefault();
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className={cn(
              'group flex flex-col overflow-hidden rounded-xl border-2 shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
              'hover:shadow-md',
              tema.border,
              tema.corp
            )}
          >
            <div className={cn('flex items-center justify-between gap-2 px-3 py-2.5', tema.ribbon)}>
              <span className="text-[11px] font-semibold uppercase tracking-wide">{eticheta}</span>
              <Icon className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2.35} aria-hidden="true" />
            </div>
            <div className="flex flex-1 flex-col p-3.5 pt-3">
              <p className={cn('font-heading text-3xl font-semibold tabular-nums tracking-tight', tema.accent)}>
                {numarRo(valoare, 0)}
              </p>
              <p className="mt-1.5 text-[11px] leading-snug text-slate-700">{ajutor}</p>
              <span
                className={cn(
                  'mt-3 inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 group-hover:underline',
                  tema.accent
                )}
              >
                {actiune}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </div>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className={cn(PANEL, 'lg:col-span-2 p-4')} aria-labelledby="titlu-verificari">
          <h2 id="titlu-verificari" className="mb-2 font-heading text-sm font-semibold uppercase tracking-wide text-slate-800">
            Verificări necesare
          </h2>
          <p className="mb-3 text-xs text-slate-700">
            Coada e grupată pe județ. Extinde un județ ca să vezi localitățile, apoi regulile sau fișele care cer verificare.
            Zonele deja confirmate din act nu apar aici.
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-4 rounded-lg border border-slate-300 bg-white px-3 py-2">
            <label className="flex items-center gap-2 text-xs text-slate-800">
              <Checkbox checked={doarP1} onCheckedChange={(v) => setDoarP1(Boolean(v))} id="filtru-p1" />
              <Label htmlFor="filtru-p1" className="cursor-pointer font-normal">
                Doar P1
              </Label>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-800">
              <Checkbox checked={ascundeNegasit} onCheckedChange={(v) => setAscundeNegasit(Boolean(v))} id="filtru-negasit" />
              <Label htmlFor="filtru-negasit" className="cursor-pointer font-normal">
                Ascunde rânduri „Negăsit”
              </Label>
            </label>
          </div>
          {agregatVerificari.nrJudete === 0 ? (
            <EmptyState
              titlu="Nimic de verificat în coadă"
              descriere={
                verificari.length === 0
                  ? 'Catalogul importat e marcat Confirmat. Când adaugi localități incomplete sau reguli „De confirmat”, apar aici.'
                  : 'Niciun rând nu trece filtrele curente (P1 / Negăsit). Dezactivează un filtru pentru a vedea restul cozii.'
              }
            />
          ) : (
            <>
              <p className="mb-2 text-xs text-slate-700">
                {agregatVerificari.nrJudete} {agregatVerificari.nrJudete === 1 ? 'județ' : 'județe'}
                {' · '}
                {agregatVerificari.nrLocalitati}{' '}
                {agregatVerificari.nrLocalitati === 1 ? 'localitate' : 'localități'}
                {' · '}
                {agregatVerificari.nrProbleme}{' '}
                {agregatVerificari.nrProbleme === 1 ? 'problemă' : 'probleme'}
              </p>
              <VerificariJudetExpand judete={agregatVerificari.judete} />
            </>
          )}
        </section>

        <section aria-labelledby="titlu-prioritare">
          <h2 id="titlu-prioritare" className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-slate-800">
            Localități prioritare
          </h2>
          {prioritare.length === 0 ? (
            <EmptyState titlu="Nu există localități prioritare" descriere="Adaugă localități cu prioritatea P1 sau P2." />
          ) : (
            <ul className="space-y-2">
              {prioritare.map((l) => (
                <li key={l.id}>
                  <Link
                    to={`/localitati/${l.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-colors hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium text-slate-800">{l.nume}</span>
                        <StatusBadge valoare={l.prioritate} />
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-700">
                        <StatusBadge valoare={l.status_acoperire} />
                        <StatusBadge valoare={l.status_reglementare} />
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-slate-700">{l.judet || '—'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-3" aria-labelledby="titlu-activitate">
          <h2 id="titlu-activitate" className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-slate-800">
            Activitate recentă
          </h2>
          {activitate.length === 0 ? (
            <EmptyState titlu="Fără activitate recentă" descriere="Regulile și documentele modificate recent apar aici." />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {activitate.map((a) => (
                <li key={`${a.tip}-${a.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800">{a.nume}</span>
                    <span className="text-xs text-slate-700">
                      {a.tip} · {numeLocalitate(a.localitate_id)}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-slate-700">{dataOraRo(a.data)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <LocalitateFormDialog open={dialogLocalitate} onOpenChange={setDialogLocalitate} onSalvat={incarca} />
    </div>
  );
}