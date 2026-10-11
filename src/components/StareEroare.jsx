import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mesajEroare } from '@/lib/cereri';

export default function StareEroare({ mesaj = 'A apărut o eroare la încărcarea datelor.', onReincearca }) {
  const text = mesajEroare(mesaj, mesaj);

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {text}
      </span>
      {onReincearca ? (
        <Button variant="outline" size="sm" onClick={onReincearca} className="border-red-300 bg-white text-red-700 hover:bg-red-100">
          <RotateCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Reîncearcă
        </Button>
      ) : null}
    </div>
  );
}