import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, Database, FileText, Map as MapIcon, MapPin, Search } from 'lucide-react';
import { api } from '@/api/client';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import StareIncarcare from '@/components/StareIncarcare';
import StareEroare from '@/components/StareEroare';
import LocalitateFormDialog from '@/components/LocalitateFormDialog';
import { NUME_APLICATIE, SUBTITLU_APLICATIE } from '@/components/MarcaAplicatie';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { dataOraRo, dataRo, numarRo } from '@/lib/format';
import { cuReincercare, mesajEroare } from '@/lib/cereri';

const ACCES_RAPID = [
  { cale: '/cauta-taxe', nume: 'Caută taxe', descriere: 'Verifică regulile pentru o localitate și o masă.', Icon: Search },
  { cale: '/harta', nume: 'Hartă taxe și restricții', descriere: 'Vezi zonele și geometriile disponibile.', Icon: MapIcon },
  { cale: '/cost-cursa', nume: 'Cost pe cursă', descriere: 'Estimează taxele pentru un itinerar.', Icon: Calculator },
  { cale: '/surse', nume: 'Surse și acte normative', descriere: 'Administrează documentele oficiale.', Icon: FileText },
];

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
          api.entities.Alerta.count({ este_demo: { $ne: true }, status: { $in: ['Nouă', 'În lucru'] } }),
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
            limit: 40,
            fields: ['denumire_regula', 'localitate_id', 'incredere', 'data_verificare', 'status'],
          }),
          api.entities.Localitate.filter(filtruLocalitatiIncomplete, {
            sort: 'prioritate',
            limit: 40,
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

      const dinReguli = (pageReguliNesigure.items || []).map((r) => ({
        id: `regula-${r.id}`,
        tip: 'Regulă',
        titlu: r.denumire_regula,
        localitate_id: r.localitate_id,
        localitateNume: null,
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
      }));

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
          status: l.status_acoperire,
          incredere: l.status_reglementare,
          data_verificare: l.ultima_verificare,
          motiv:
            l.status_acoperire !== 'Verificată'
              ? `Acoperire: ${l.status_acoperire || 'necompletat'}`
              : `Reglementare: ${l.status_reglementare}`,
          href: `/localitati/${l.id}`,
        }));

      // Prioritizează regulile nesigure, apoi localitățile fără acoperire verificată
      const coada = [...dinReguli, ...dinLocalitati].slice(0, 12);

      const catalogLocalitati = listaLocalitati.items || [];
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
  const indicatori = [
    { eticheta: 'Localități în bază', valoare: kpi.localitati, Icon: MapPin, ajutor: 'Fără înregistrările demonstrative' },
    { eticheta: 'Localități verificate', valoare: kpi.verificate, Icon: MapPin, ajutor: 'Status acoperire „Verificată”' },
    { eticheta: 'Reguli active', valoare: kpi.reguliActive, Icon: Database, ajutor: 'Reguli de acces cu status „Activ”' },
    { eticheta: 'Reguli de verificat', valoare: kpi.deVerificat, Icon: FileText, ajutor: 'Nesigure sau fără dată verificare — nu cele Confirmate' },
    { eticheta: 'Alerte nerezolvate', valoare: kpi.alerte, Icon: Calculator, ajutor: 'Status „Nouă” sau „În lucru”' },
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
        {indicatori.map(({ eticheta, valoare, ajutor, Icon }) => (
          <div key={eticheta} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{eticheta}</span>
              <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>
            <p className="mt-2 font-heading text-2xl font-semibold tabular-nums text-slate-900">{numarRo(valoare, 0)}</p>
            <p className="mt-1 text-[11px] text-slate-400">{ajutor}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-labelledby="titlu-verificari">
          <h2 id="titlu-verificari" className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-slate-500">
            Verificări necesare
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Doar ce lipsește sau e nesigur (încredere ≠ Confirmat, fără dată de verificare, sau localitate încă neverificată).
            Zonele deja confirmate din act nu apar aici.
          </p>
          {verificari.length === 0 ? (
            <EmptyState
              titlu="Nimic de verificat în coadă"
              descriere="Catalogul importat e marcat Confirmat. Când adaugi localități incomplete sau reguli „De confirmat”, apar aici."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[720px] text-sm">
                <caption className="sr-only">Elemente care necesită verificare</caption>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-3 py-2 font-medium">Ce</th>
                    <th scope="col" className="px-3 py-2 font-medium">Detaliu</th>
                    <th scope="col" className="px-3 py-2 font-medium">Localitate</th>
                    <th scope="col" className="px-3 py-2 font-medium">Motiv</th>
                    <th scope="col" className="px-3 py-2 font-medium">Status</th>
                    <th scope="col" className="px-3 py-2 font-medium">Acțiune</th>
                  </tr>
                </thead>
                <tbody>
                  {verificari.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        {r.tip}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-800">{r.titlu}</td>
                      <td className="px-3 py-2 text-slate-600">{r.localitateNume || numeLocalitate(r.localitate_id)}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{r.motiv}</td>
                      <td className="px-3 py-2">
                        <StatusBadge valoare={r.incredere || r.status} />
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          to={r.href}
                          className="text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
                        >
                          Deschide
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="titlu-prioritare">
          <h2 id="titlu-prioritare" className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-slate-500">
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
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <StatusBadge valoare={l.status_acoperire} />
                        <StatusBadge valoare={l.status_reglementare} />
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">{l.judet || '—'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2" aria-labelledby="titlu-activitate">
          <h2 id="titlu-activitate" className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-slate-500">
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
                    <span className="text-xs text-slate-500">
                      {a.tip} · {numeLocalitate(a.localitate_id)}
                    </span>
                  </span>
                  <span className="text-xs text-slate-400">{dataOraRo(a.data)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="titlu-acces-rapid">
          <h2 id="titlu-acces-rapid" className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-slate-500">
            Acces rapid
          </h2>
          <div className="space-y-2">
            {ACCES_RAPID.map(({ cale, nume, descriere, Icon }) => (
              <Link
                key={cale}
                to={cale}
                className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-colors hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-medium text-slate-800">{nume}</span>
                  <span className="block text-xs text-slate-500">{descriere}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <LocalitateFormDialog open={dialogLocalitate} onOpenChange={setDialogLocalitate} onSalvat={incarca} />
    </div>
  );
}