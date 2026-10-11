import React from 'react';

export default function StareIncarcare({ mesaj = 'Se încarcă…' }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" aria-hidden="true" />
      <span role="status">{mesaj}</span>
    </div>
  );
}