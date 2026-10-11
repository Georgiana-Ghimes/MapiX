import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Calculator, Pencil, Search } from 'lucide-react';
import { api } from '@/api/client';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import StareIncarcare from '@/components/StareIncarcare';
import StareEroare from '@/components/StareEroare';
import VehiculFormDialog from '@/components/VehiculFormDialog';
import { Button } from '@/components/ui/button';
import { numarRo, textSau } from '@/lib/format';

export default function VehiculDetail() {
  const { id } = useParams();
  const [vehicul, setVehicul] = useState(null);
  const [seIncarca, setSeIncarca] = useState(true);
  const [eroare, setEroare] = useState(null);
  const [formular, setFormular] = useState(false);

  const incarca = useCallback(async () => {
    setSeIncarca(true);
    setEroare(null);
    try {
      const v = await api.entities.Vehicul.get(id);
      setVehicul(v);
    } catch (e) {
      setEroare(e.message || 'Vehiculul nu a putut fi încărcat.');
    } finally {
      setSeIncarca(false);
    }
  }, [id]);

  useEffect(() => {
    incarca();
  }, [incarca]);

  if (seIncarca) return <StareIncarcare mesaj="Se încarcă vehiculul…" />;
  if (eroare) return <StareEroare mesaj={eroare} onReincearca={incarca} />;
  if (!vehicul) {
    return (
      <EmptyState
        titlu="Vehiculul nu a fost găsit"
        descriere="Înregistrarea poate aparține unei alte organizații sau a fost ștearsă."
        actiune={
          <Button asChild variant="outline">
            <Link to="/vehicule">Înapoi la lista vehiculelor</Link>
          </Button>
        }
      />
    );
  }

  const randuri = [
    { eticheta: 'Număr de înmatriculare', valoare: vehicul.numar_inmatriculare },
    { eticheta: 'Țară de înmatriculare', valoare: textSau(vehicul.tara_inmatriculare) },
    { eticheta: 'Categorie vehicul', valoare: vehicul.categorie_vehicul },
    { eticheta: 'Masă maximă autorizată (MTMA)', valoare: vehicul.masa_maxima_autorizata_t !== null && vehicul.masa_maxima_autorizata_t !== undefined ? `${numarRo(vehicul.masa_maxima_autorizata_t, 2)} t` : 'Necompletată' },
    { eticheta: 'Masă totală', valoare: vehicul.masa_totala_t !== null && vehicul.masa_totala_t !== undefined ? `${numarRo(vehicul.masa_totala_t, 2)} t` : 'Necompletată' },
    { eticheta: 'Masă maximă tehnic admisibilă', valoare: vehicul.masa_maxima_tehnic_admisibila_t !== null && vehicul.masa_maxima_tehnic_admisibila_t !== undefined ? `${numarRo(vehicul.masa_maxima_tehnic_admisibila_t, 2)} t` : 'Necompletată' },
    { eticheta: 'Număr de axe', valoare: vehicul.numar_axe !== null && vehicul.numar_axe !== undefined ? numarRo(vehicul.numar_axe, 0) : 'Necompletat' },
    { eticheta: 'Normă de poluare', valoare: textSau(vehicul.norma_euro) },
    { eticheta: 'Combustibil', valoare: textSau(vehicul.combustibil) },
    { eticheta: 'Dimensiuni', valoare: textSau(vehicul.dimensiuni) },
    { eticheta: 'Observații', valoare: textSau(vehicul.observatii, 'Fără observații') },
  ];

  return (
    <div>
      <PageHeader
        titlu={`${vehicul.numar_inmatriculare} · ${vehicul.nume_intern}`}
        descriere="Datele tehnice relevante pentru căutarea taxelor și calcularea curselor."
        parinte={{ nume: 'Vehicule', cale: '/vehicule' }}
        actiuni={
          <>
            <Button variant="outline" onClick={() => setFormular(true)}>
              <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Editează
            </Button>
            <Button asChild variant="outline">
              <Link to={`/cauta-taxe?vehicul=${vehicul.id}`}>
                <Search className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Caută taxe
              </Link>
            </Button>
            <Button asChild>
              <Link to={`/cost-cursa?vehicul=${vehicul.id}`}>
                <Calculator className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Calculează o cursă
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge valoare={vehicul.status} />
        <StatusBadge valoare={vehicul.categorie_vehicul} />
      </div>

      <dl className="rounded-lg border border-slate-200 bg-white px-4 py-1">
        {randuri.map((rand) => (
          <div key={rand.eticheta} className="flex flex-col gap-0.5 border-b border-slate-100 py-2 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4">
            <dt className="w-full shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500 sm:w-64">{rand.eticheta}</dt>
            <dd className="text-sm text-slate-800">{rand.valoare}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-xs text-slate-500">
        La căutarea taxelor poți selecta criteriul de masă folosit de regula locală (MTMA, masă totală sau alt criteriu). Valoarea
        completată automat este MTMA și poate fi modificată manual.
      </p>

      <VehiculFormDialog open={formular} onOpenChange={setFormular} vehicul={vehicul} onSalvat={incarca} />
    </div>
  );
}