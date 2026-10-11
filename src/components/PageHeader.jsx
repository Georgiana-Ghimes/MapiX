import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function PageHeader({ titlu, descriere, actiuni, parinte }) {
  return (
    <header className="mb-6">
      {parinte ? (
        <nav aria-label="Fir de navigare" className="mb-2 flex items-center gap-1 text-xs text-slate-500">
          <Link to={parinte.cale} className="rounded px-0.5 hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {parinte.nume}
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span className="text-slate-600">{titlu}</span>
        </nav>
      ) : null}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-slate-900">{titlu}</h1>
          {descriere ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">{descriere}</p> : null}
        </div>
        {actiuni ? <div className="flex flex-wrap items-center gap-2">{actiuni}</div> : null}
      </div>
    </header>
  );
}