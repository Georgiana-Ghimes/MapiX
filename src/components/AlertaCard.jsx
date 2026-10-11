import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCircle2, Clock, EyeOff, UserPlus } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import StatusBadge from '@/components/StatusBadge';
import { dataOraRo, dataRo } from '@/lib/format';
import { STATUSURI_ALERTA } from '@/lib/enum';

export default function AlertaCard({ alerta, numeLocalitate, onActualizat }) {
  const { toast } = useToast();
  const [responsabil, setResponsabil] = useState(alerta.responsabil || '');
  const [observatii, setObservatii] = useState(alerta.observatii || '');
  const [seLucreaza, setSeLucreaza] = useState(false);
  const [detaliata, setDetaliata] = useState(false);

  const actualizeaza = async (date) => {
    setSeLucreaza(true);
    try {
      await api.entities.Alerta.update(alerta.id, date);
      toast({ title: 'Alerta a fost actualizată' });
      onActualizat?.();
    } catch (e) {
      toast({ title: 'Actualizarea nu a reușit', description: e.message, variant: 'destructive' });
    } finally {
      setSeLucreaza(false);
    }
  };

  const linkInregistrare = alerta.taxa_id
    ? '/baza-taxe?regula=' + alerta.taxa_id
    : alerta.localitate_id
      ? '/localitati/' + alerta.localitate_id
      : null;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge valoare={alerta.severitate} />
            <StatusBadge valoare={alerta.tip_alerta} />
            <StatusBadge valoare={alerta.status} />
          </div>
          <h3 className="font-heading text-sm font-semibold text-slate-900">{alerta.titlu}</h3>
          {alerta.descriere ? <p className="mt-1 text-sm text-slate-600">{alerta.descriere}</p> : null}
          <p className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            {numeLocalitate ? <span>Localitate: {numeLocalitate}</span> : null}
            <span>Generată: {dataOraRo(alerta.data_generare)}</span>
            {alerta.data_scadenta ? <span>Termen: {dataRo(alerta.data_scadenta)}</span> : null}
            {alerta.responsabil ? <span>Responsabil: {alerta.responsabil}</span> : null}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setDetaliata((d) => !d)} className="text-slate-600">
          <Bell className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {detaliata ? 'Ascunde acțiunile' : 'Gestionează'}
        </Button>
      </div>

      {detaliata ? (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap gap-2">
            {STATUSURI_ALERTA.filter((s) => s !== alerta.status).map((stare) => (
              <Button
                key={stare}
                size="sm"
                variant="outline"
                disabled={seLucreaza}
                onClick={() => actualizeaza({ status: stare, observatii, responsabil })}
              >
                {stare === 'În lucru' ? <Clock className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> : null}
                {stare === 'Rezolvată' ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> : null}
                {stare === 'Ignorată' ? <EyeOff className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> : null}
                Marchează „{stare}”
              </Button>
            ))}
            {linkInregistrare ? (
              <Button asChild size="sm" variant="outline">
                <Link to={linkInregistrare}>Deschide înregistrarea afectată</Link>
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor={`responsabil-${alerta.id}`}>
                Responsabil
              </label>
              <Input
                id={`responsabil-${alerta.id}`}
                value={responsabil}
                onChange={(e) => setResponsabil(e.target.value)}
                placeholder="Nume sau e-mail"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor={`observatii-${alerta.id}`}>
                Observații de verificare
              </label>
              <Textarea
                id={`observatii-${alerta.id}`}
                value={observatii}
                onChange={(e) => setObservatii(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <Button size="sm" disabled={seLucreaza} onClick={() => actualizeaza({ responsabil, observatii })}>
            <UserPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Salvează responsabilul și observațiile
          </Button>
        </div>
      ) : null}
    </article>
  );
}