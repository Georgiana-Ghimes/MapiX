import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { masaRo } from '@/lib/format';

export default function VehiculSelect({ vehicule = [], value, onChange, placeholder = 'Selectează vehiculul', className }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {vehicule.map((v) => (
          <SelectItem key={v.id} value={v.id}>
            {v.numar_inmatriculare} · {v.nume_intern}
            {v.masa_maxima_autorizata_t ? ` · ${masaRo(v.masa_maxima_autorizata_t)}` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}