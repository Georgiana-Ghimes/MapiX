/** Agregare coadă „Verificări necesare”: item → localitate → județ. */

export const JUDET_FARA = 'Fără județ';

export function esteRandNegasit(row) {
  const incredere = String(row.incredere || '').toLowerCase();
  const titlu = String(row.titlu || '').toLowerCase();
  return incredere === 'negăsit' || incredere === 'negasit' || /\bneg[aă]sit\b/.test(titlu);
}

export function filtreazaVerificari(items, { doarP1 = false, ascundeNegasit = false } = {}) {
  return (items || []).filter(
    (r) => (!doarP1 || r.prioritate === 'P1') && (!ascundeNegasit || !esteRandNegasit(r))
  );
}

/**
 * @returns {{
 *   judete: Array<{
 *     judet: string,
 *     nrLocalitati: number,
 *     nrProbleme: number,
 *     nrP1: number,
 *     localitati: Array<{
 *       localitate_id: string|null,
 *       localitateNume: string,
 *       prioritate: string|null,
 *       nrReguli: number,
 *       areLocalitateOnly: boolean,
 *       motivAgregat: string,
 *       items: object[],
 *     }>,
 *   }>,
 *   nrJudete: number,
 *   nrLocalitati: number,
 *   nrProbleme: number,
 * }}
 */
export function agregaVerificariPeJudet(items) {
  const peJudet = new Map();

  for (const item of items || []) {
    const judet = (item.judet && String(item.judet).trim()) || JUDET_FARA;
    const locKey = item.localitate_id || `fara-${item.id}`;
    if (!peJudet.has(judet)) peJudet.set(judet, new Map());
    const peLoc = peJudet.get(judet);
    if (!peLoc.has(locKey)) {
      peLoc.set(locKey, {
        localitate_id: item.localitate_id || null,
        localitateNume: item.localitateNume || '—',
        prioritate: item.prioritate || null,
        items: [],
      });
    }
    const grup = peLoc.get(locKey);
    grup.items.push(item);
    if (!grup.prioritate && item.prioritate) grup.prioritate = item.prioritate;
    if (grup.localitateNume === '—' && item.localitateNume) grup.localitateNume = item.localitateNume;
  }

  const judete = Array.from(peJudet.entries()).map(([judet, peLoc]) => {
    const localitati = Array.from(peLoc.values()).map((loc) => {
      const nrReguli = loc.items.filter((i) => i.tip === 'Regulă').length;
      const areLocalitateOnly = loc.items.some((i) => i.tip === 'Localitate');
      const motive = [...new Set(loc.items.map((i) => i.motiv).filter(Boolean))];
      return {
        ...loc,
        nrReguli,
        areLocalitateOnly,
        motivAgregat:
          motive.length === 0
            ? 'Necesită verificare'
            : motive.length === 1
              ? motive[0]
              : `${motive.length} tipuri de probleme`,
      };
    });

    localitati.sort((a, b) => {
      const p = (x) => (x.prioritate === 'P1' ? 0 : x.prioritate === 'P2' ? 1 : 2);
      const dp = p(a) - p(b);
      if (dp !== 0) return dp;
      return String(a.localitateNume).localeCompare(String(b.localitateNume), 'ro');
    });

    const nrProbleme = localitati.reduce((n, l) => n + l.items.length, 0);
    const nrP1 = localitati.filter((l) => l.prioritate === 'P1').length;

    return {
      judet,
      nrLocalitati: localitati.length,
      nrProbleme,
      nrP1,
      localitati,
    };
  });

  judete.sort((a, b) => {
    if (b.nrP1 !== a.nrP1) return b.nrP1 - a.nrP1;
    if (b.nrProbleme !== a.nrProbleme) return b.nrProbleme - a.nrProbleme;
    if (a.judet === JUDET_FARA) return 1;
    if (b.judet === JUDET_FARA) return -1;
    return a.judet.localeCompare(b.judet, 'ro');
  });

  return {
    judete,
    nrJudete: judete.length,
    nrLocalitati: judete.reduce((n, j) => n + j.nrLocalitati, 0),
    nrProbleme: judete.reduce((n, j) => n + j.nrProbleme, 0),
  };
}
