import React, { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { contineFaraDiacritice } from '@/lib/format';
import { cn } from '@/lib/utils';

function etichetaLocalitate(l) {
  if (!l) return '';
  return l.judet ? `${l.nume} · ${l.judet}` : l.nume;
}

/**
 * Combobox localități: căutare cu/fără diacritice (nu scroll într-un Select lung).
 */
export default function LocalitateSelect({
  localitati = [],
  value,
  onChange,
  placeholder = 'Selectează localitatea',
  className,
  toateEticheta,
  disabled,
}) {
  const [open, setOpen] = useState(false);

  const selectata = useMemo(
    () => (value && value !== 'toate' ? localitati.find((l) => l.id === value) : null),
    [localitati, value]
  );

  const etichetaAfisata =
    value === 'toate' && toateEticheta
      ? toateEticheta
      : selectata
        ? etichetaLocalitate(selectata)
        : placeholder;

  const alege = (id) => {
    onChange?.(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={placeholder}
          disabled={disabled}
          className={cn(
            'h-9 w-full justify-between px-3 font-normal shadow-sm',
            !selectata && value !== 'toate' && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate text-left">{etichetaAfisata}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[80] w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0"
        align="start"
        sideOffset={4}
      >
        <Command
          filter={(valoareItem, cautare) => (contineFaraDiacritice(valoareItem, cautare) ? 1 : 0)}
        >
          <CommandInput placeholder="Caută localitate…" />
          <CommandList>
            <CommandEmpty>Nicio localitate găsită.</CommandEmpty>
            <CommandGroup>
              {toateEticheta ? (
                <CommandItem
                  value={`__toate__ ${toateEticheta}`}
                  onSelect={() => alege('toate')}
                >
                  <Check
                    className={cn('mr-2 h-4 w-4 shrink-0', value === 'toate' ? 'opacity-100' : 'opacity-0')}
                    aria-hidden="true"
                  />
                  <span>{toateEticheta}</span>
                </CommandItem>
              ) : null}
              {localitati.map((l) => {
                const text = etichetaLocalitate(l);
                return (
                  <CommandItem key={l.id} value={text} onSelect={() => alege(l.id)}>
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        value === l.id ? 'opacity-100' : 'opacity-0'
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-slate-800">{l.nume}</span>
                      {l.judet ? <span className="text-slate-500"> · {l.judet}</span> : null}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
