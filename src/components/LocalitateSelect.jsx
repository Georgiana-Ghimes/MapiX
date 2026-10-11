import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function LocalitateSelect({
  localitati = [],
  value,
  onChange,
  placeholder = 'Selectează localitatea',
  className,
  toateEticheta,
  disabled,
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {toateEticheta ? <SelectItem value="toate">{toateEticheta}</SelectItem> : null}
        {localitati.map((l) => (
          <SelectItem key={l.id} value={l.id}>
            {l.nume}
            {l.judet ? ` · ${l.judet}` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}