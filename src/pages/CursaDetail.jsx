import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { api } from '@/api/client';
import PageHeader from '@/components/PageHeader';
import CursaRezumat from '@/components/CursaRezumat';
import StareIncarcare from '@/components/StareIncarcare';
import StareEroare from '@/components/StareEroare';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { dataOraRo, numarRo } from '@/lib/format';

export default function CursaDetail() {
  const { id } = useParams();
  const [cursa, setCursa] = useState(null);
  const [randuri, setRanduri] = useState([]);
  const [seIncarca, setSeIncarca] = useState(true);
  const [eroare, setEroare] = useState(null);

  const incarca = useCallback(async () => {
    setSeIncarca(true);
    setEroare(null);
    try {
      const [cursaGasita, pageRanduri, pageLocalitati] = await Promise.all([
        api.entities.Cursa.get(id),
        api.entities.CursaTaxa.filter({ cursa_id: id }, { limit: 500 }),
        api.entities.Localitate.list({ limit: 500, fields: ['nume'] }),
      ]);
      const numeDupaId = new Map((pageLocalitati.items || []).map((l) => [l.id, l.nume]));
      setCursa(cursaGasita);
      setRanduri(
        (pageRanduri.items || []).map((r) => ({
          ...r,
          localitate_nume: numeDupaId.get(r.localitate_id) || 'Localitate necunoscută',
        }))
      );
    } catch (e) {
      setEroare(e.message || 'Calculul nu a putut fi încărcat.');
    } finally {
      setSeIncarca(false);
    }
  }, [id]);

  useEffect(() => {
    incarca();
  }, [incarca]);

  if (seIncarca) return <StareIncarcare mesaj="Se încarcă calculul salvat…" />;
  if (eroare) return <StareEroare mesaj={eroare} onReincearca={incarca} />;
  if (!cursa) {
    return (
      <EmptyState
        titlu="Calculul nu a fost găsit"
        descriere="Este posibil ca înregistrarea să fi fost ștearsă sau să aparțină unei alte organizații."
        actiune={
          <Button asChild variant="outline">
            <Link to="/cost-cursa">Înapoi la calculator</Link>
          </Button>
        }
      />
    );
  }

  const localitatiTraseu = Array.isArray(cursa.localitati_traseu) ? cursa.localitati_traseu : [];

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          titlu={cursa.nume_cursa}
          descriere={`${cursa.origine || '—'} – ${cursa.destinatie || '—'} · calcul din ${dataOraRo(cursa.data_calcul)}`}
          parinte={{ nume: 'Cost pe cursă', cale: '/cost-cursa' }}
          actiuni={
            <>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Imprimă
              </Button>
              <Button asChild variant="outline">
                <Link to="/cost-cursa">
                  <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Înapoi
                </Link>
              </Button>
            </>
          }
        />
      </div>

      <div className="hidden print:block">
        <h1 className="font-heading text-xl font-semibold">{cursa.nume_cursa}</h1>
        <p className="text-sm text-slate-600">
          MapiX — instrument pentru taxe de acces (modul Transitix) · {cursa.origine || '—'} – {cursa.destinatie || '—'} · Calcul: {dataOraRo(cursa.data_calcul)}
        </p>
      </div>

      <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Data deplasării</p>
          <p className="text-sm text-slate-800">{cursa.data_deplasare || 'Nespecificată'}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Masa utilizată</p>
          <p className="text-sm text-slate-800">
            {cursa.masa_utilizata_t === null || cursa.masa_utilizata_t === undefined
              ? 'Nespecificată'
              : `${numarRo(cursa.masa_utilizata_t, 2)} t (${cursa.tip_masa_utilizata || 'criteriu nespecificat'})`}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Distanță / durată</p>
          <p className="text-sm text-slate-800">
            {cursa.distanta_km ? `${numarRo(cursa.distanta_km, 1)} km` : '—'} · {cursa.durata_estimata || '—'}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Itinerar</p>
          <p className="text-sm text-slate-800">{localitatiTraseu.map((t) => t.nume).join(' → ') || '—'}</p>
        </div>
      </div>

      <CursaRezumat cursa={cursa} randuri={randuri} />

      {cursa.observatii ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-heading text-sm font-semibold text-slate-700">Observații</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{cursa.observatii}</p>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-slate-500">
        Valorile și sursele din acest calcul sunt cele folosite la momentul salvării. Modificarea ulterioară a unei reguli nu
        schimbă calculul salvat. Verifică informația la sursa oficială înainte de deplasare.
      </p>
    </div>
  );
}