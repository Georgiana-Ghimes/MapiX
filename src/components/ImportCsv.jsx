import React, { useState } from 'react';
import { Download, FileUp, Upload } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { TIPURI_IMPORT, descarcaCsv, laCsv, parseCsv, valideazaImport } from '@/lib/csv';

export default function ImportCsv({ localitati = [], zone = [], onImportat }) {
  const { toast } = useToast();
  const [tipImport, setTipImport] = useState(TIPURI_IMPORT[0].id);
  const [rezultat, setRezultat] = useState(null);
  const [numeFisier, setNumeFisier] = useState('');
  const [seImporta, setSeImporta] = useState(false);

  const definitie = TIPURI_IMPORT.find((t) => t.id === tipImport);

  const descarcaSablon = () => {
    descarcaCsv(`sablon-${tipImport}.csv`, laCsv(definitie.coloane, []));
    toast({ title: 'Șablonul a fost descărcat', description: `Coloane: ${definitie.coloane.join(', ')}` });
  };

  const citesteFisier = async (fisier) => {
    if (!fisier) return;
    const text = await fisier.text();
    const { headers, rows } = parseCsv(text);
    const lipsa = definitie.obligatorii.filter((c) => !headers.includes(c));
    if (lipsa.length) {
      setRezultat({ erori: [{ linie: 1, mesaj: `Coloane obligatorii lipsă: ${lipsa.join(', ')}.` }], avertismente: [], pregatite: [], randuri: rows });
      setNumeFisier(fisier.name);
      return;
    }
    const validare = valideazaImport(tipImport, rows, { localitati, zone });
    setRezultat({ ...validare, randuri: rows });
    setNumeFisier(fisier.name);
  };

  const confirmaImportul = async () => {
    if (!rezultat || !rezultat.pregatite.length) return;
    setSeImporta(true);
    try {
      await api.entities[definitie.entitate].bulkCreate(rezultat.pregatite);
      toast({
        title: 'Import finalizat',
        description: `${rezultat.pregatite.length} înregistrări adăugate. Regulile importate nu sunt marcate automat ca verificate.`,
      });
      setRezultat(null);
      setNumeFisier('');
      onImportat?.();
    } catch (e) {
      toast({ title: 'Importul nu a reușit', description: e.message, variant: 'destructive' });
    } finally {
      setSeImporta(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Ce imporți</Label>
          <Select
            value={tipImport}
            onValueChange={(v) => {
              setTipImport(v);
              setRezultat(null);
              setNumeFisier('');
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPURI_IMPORT.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nume}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-slate-600">Fișier CSV</Label>
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => citesteFisier(e.target.files?.[0])}
            className="cursor-pointer"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={descarcaSablon}>
          <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Descarcă șablonul de coloane
        </Button>
        <span className="text-xs text-slate-500">
          Coloane obligatorii: {definitie.obligatorii.join(', ')}. Separator acceptat: „;” sau „,”. Datele: ZZ.LL.AAAA.
        </span>
      </div>

      {rezultat ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-heading text-sm font-semibold text-slate-800">
              Previzualizare import {numeFisier ? `· ${numeFisier}` : ''}
            </h3>
            <p className="text-xs text-slate-500">
              {rezultat.randuri?.length || 0} rânduri citite · {rezultat.pregatite.length} valide · {rezultat.erori.length}{' '}
              erori · {rezultat.avertismente.length} avertismente
            </p>
          </div>

          {rezultat.erori.length ? (
            <div role="alert" className="max-h-40 overflow-y-auto rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <p className="mb-1 font-medium">Erori (rândurile cu erori nu se importă):</p>
              <ul className="list-inside list-disc space-y-0.5">
                {rezultat.erori.slice(0, 50).map((e, i) => (
                  <li key={`${e.linie}-${i}`}>
                    Rândul {e.linie}: {e.mesaj}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {rezultat.avertismente.length ? (
            <div className="max-h-40 overflow-y-auto rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="mb-1 font-medium">Avertismente:</p>
              <ul className="list-inside list-disc space-y-0.5">
                {rezultat.avertismente.slice(0, 50).map((a, i) => (
                  <li key={`${a.linie}-${i}`}>
                    Rândul {a.linie}: {a.mesaj}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {rezultat.randuri?.length ? (
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                    {Object.keys(rezultat.randuri[0]).slice(0, 6).map((h) => (
                      <th key={h} scope="col" className="px-2 py-1.5 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rezultat.randuri.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-b-0">
                      {Object.keys(rezultat.randuri[0]).slice(0, 6).map((h) => (
                        <td key={h} className="px-2 py-1.5 text-slate-700">
                          {row[h] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={confirmaImportul} disabled={seImporta || !rezultat.pregatite.length}>
              <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {seImporta ? 'Se importă…' : `Confirmă importul (${rezultat.pregatite.length})`}
            </Button>
            <Button variant="outline" onClick={() => setRezultat(null)} disabled={seImporta}>
              Renunță
            </Button>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
              Nimic nu se salvează până la confirmare.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}