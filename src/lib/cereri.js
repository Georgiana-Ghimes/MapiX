/**
 * Ajutoare pentru cererile către server: recunoașterea erorilor temporare
 * (limită de cereri, rețea) și reîncercarea automată cu pauză crescătoare.
 */

const LIMITA = /rate limit|too many requests|limit exceeded|\b429\b/i;
const RETEA = /network|failed to fetch|timeout|timed out|fetch failed/i;

export function esteEroareTemporara(eroare) {
  const mesaj = `${eroare?.message || eroare || ''}`;
  return LIMITA.test(mesaj) || RETEA.test(mesaj);
}

/** Traduce erorile tehnice într-un mesaj clar, în limba română. */
export function mesajEroare(eroare, implicit = 'A apărut o eroare neașteptată.') {
  const mesaj = `${eroare?.message || eroare || ''}`;
  if (LIMITA.test(mesaj)) {
    return 'Serverul a limitat temporar cererile (prea multe într-un interval scurt). Așteaptă câteva secunde și apasă „Reîncearcă”.';
  }
  if (RETEA.test(mesaj)) {
    return 'Conexiunea la server a fost întreruptă. Verifică accesul la internet și încearcă din nou.';
  }
  return mesaj || implicit;
}

/** Reia cererea dacă serverul a răspuns temporar cu o limită sau o eroare de rețea. */
export async function cuReincercare(cerere, incercari = 3, pauzaMs = 700) {
  let ultimaEroare;
  for (let incercare = 1; incercare <= incercari; incercare += 1) {
    try {
      return await cerere();
    } catch (eroare) {
      ultimaEroare = eroare;
      if (incercare === incercari || !esteEroareTemporara(eroare)) throw eroare;
      await new Promise((rezolva) => setTimeout(rezolva, pauzaMs * incercare));
    }
  }
  throw ultimaEroare;
}