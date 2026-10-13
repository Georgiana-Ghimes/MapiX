import { JUDET_FARA } from '@/lib/verificariCoada';

function gruparePeZona(items, { getZonaId, getZonaNume }) {
  const peZona = new Map();
  for (const item of items || []) {
    const id = getZonaId?.(item) || 'fara-zona';
    if (!peZona.has(id)) {
      peZona.set(id, {
        zona_id: getZonaId?.(item) || null,
        zonaNume: getZonaNume?.(item) || 'Întreaga localitate',
        items: [],
      });
    }
    const g = peZona.get(id);
    g.items.push(item);
    if (g.zonaNume === 'Întreaga localitate' && getZonaNume?.(item)) g.zonaNume = getZonaNume(item);
  }
  return Array.from(peZona.values()).sort((a, b) => {
    // Zonele A/B întâi; combinate / „întreaga localitate” la final
    const rank = (z) => {
      const s = String(z.zonaNume || '').toLowerCase();
      if (!z.zona_id || s.includes('întreag') || s.includes('intreag')) return 3;
      if (s.includes(' și ') || s.includes(' si ')) return 2;
      return 0;
    };
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return String(a.zonaNume).localeCompare(String(b.zonaNume), 'ro');
  });
}

/**
 * Grupează iteme pe județ (și opțional pe localitate, apoi zonă).
 * @param {object[]} items
 * @param {{
 *   getJudet: (item) => string|null|undefined,
 *   getLocId?: (item) => string|null|undefined,
 *   getLocNume?: (item) => string|null|undefined,
 *   getPrioritate?: (item) => string|null|undefined,
 *   getZonaId?: (item) => string|null|undefined,
 *   getZonaNume?: (item) => string|null|undefined,
 * }} opts
 */
export function gruparePeJudet(
  items,
  { getJudet, getLocId, getLocNume, getPrioritate, getZonaId, getZonaNume } = {}
) {
  const peJudet = new Map();

  for (const item of items || []) {
    const judet = (getJudet?.(item) && String(getJudet(item)).trim()) || JUDET_FARA;
    if (!peJudet.has(judet)) peJudet.set(judet, []);
    peJudet.get(judet).push(item);
  }

  const judete = Array.from(peJudet.entries()).map(([judet, judetItems]) => {
    let localitati = null;
    if (getLocId) {
      const peLoc = new Map();
      for (const item of judetItems) {
        const id = getLocId(item) || `fara-${item.id || Math.random()}`;
        if (!peLoc.has(id)) {
          peLoc.set(id, {
            localitate_id: getLocId(item) || null,
            localitateNume: getLocNume?.(item) || '—',
            prioritate: getPrioritate?.(item) || null,
            items: [],
          });
        }
        const g = peLoc.get(id);
        g.items.push(item);
        if (!g.prioritate && getPrioritate?.(item)) g.prioritate = getPrioritate(item);
        if (g.localitateNume === '—' && getLocNume?.(item)) g.localitateNume = getLocNume(item);
      }
      localitati = Array.from(peLoc.values())
        .map((loc) => ({
          ...loc,
          zone:
            getZonaId || getZonaNume
              ? gruparePeZona(loc.items, { getZonaId, getZonaNume })
              : null,
        }))
        .sort((a, b) => String(a.localitateNume).localeCompare(String(b.localitateNume), 'ro'));
    }

    const nrP1 = localitati
      ? localitati.filter((l) => l.prioritate === 'P1').length
      : judetItems.filter((i) => getPrioritate?.(i) === 'P1').length;

    return {
      judet,
      items: judetItems,
      localitati,
      nrItems: judetItems.length,
      nrLocalitati: localitati ? localitati.length : null,
      nrP1,
    };
  });

  judete.sort((a, b) => {
    if (b.nrP1 !== a.nrP1) return b.nrP1 - a.nrP1;
    if (b.nrItems !== a.nrItems) return b.nrItems - a.nrItems;
    if (a.judet === JUDET_FARA) return 1;
    if (b.judet === JUDET_FARA) return -1;
    return a.judet.localeCompare(b.judet, 'ro');
  });

  return judete;
}
