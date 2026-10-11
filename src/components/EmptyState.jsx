import React from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({ titlu = 'Nu există înregistrări', descriere, actiune, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="font-heading text-base font-semibold text-slate-800">{titlu}</h3>
      {descriere ? <p className="mt-1 max-w-xl text-sm text-slate-500">{descriere}</p> : null}
      {actiune ? <div className="mt-4">{actiune}</div> : null}
    </div>
  );
}