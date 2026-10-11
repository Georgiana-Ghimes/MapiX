// Motor determinist pentru potrivirea regulilor, calculul costurilor și generarea alertelor.
// Reguli de business respectate: necunoscut ≠ zero, valabilitate obligatorie, surse trasabile,
// nivel de încredere explicit, restricțiile sunt distincte de taxe, monedele nu se amestecă.
import { azi, dataRo, esteGol, luniDeLa, rotunjeste, zilePanaLa } from './format';

export const PRAG_EXPIRARE_ZILE = 30;
export const PRAG_REVERIFICARE_LUNI = 12;

export function regulaValabilitate(regula, dataDeplasare) {
  const start = regula.perioada_valabilitate_start;
  const end = regula.perioada_valabilitate_end;
  const data = dataDeplasare || azi();
  if (!start && !end) {
    return {
      aplicabila: true,
      necunoscuta: true,
      motiv: 'Perioada de valabilitate nu este documentată — verificare manuală necesară.',
    };
  }
  if (end && end < data) {
    return {
      aplicabila: false,
      expirata: true,
      motiv: `Regula nu era valabilă la data deplasării (expirată la ${dataRo(end)}).`,
    };
  }
  if (start && start > data) {
    return {
      aplicabila: false,
      motiv: `Regula intră în vigoare la ${dataRo(start)}, după data deplasării.`,
    };
  }
  return { aplicabila: true };
}

export function potrivireMasa(regula, masa, tipMasa) {
  const tipRegula = regula.tip_masa || 'Necunoscut';
  const min = typeof regula.masa_min_t === 'number' ? regula.masa_min_t : null;
  const max = typeof regula.masa_max_t === 'number' ? regula.masa_max_t : null;

  if (tipRegula === 'Necunoscut') {
    return {
      potrivit: null,
      motiv: 'Definiția masei (MTMA / masă totală) nu este documentată pentru această regulă.',
    };
  }
  if (tipMasa && tipMasa !== tipRegula) {
    return {
      potrivit: null,
      motiv: `Regula se aplică pentru „${tipRegula}”, iar calculul folosește „${tipMasa}”.`,
    };
  }
  if (esteGol(masa)) {
    return { potrivit: null, motiv: 'Masa vehiculului nu a fost introdusă.' };
  }
  const m = Number(masa);
  if (min !== null && m < min) {
    return { potrivit: false, motiv: `Masa de ${m} t este sub pragul minim de ${min} t.` };
  }
  if (max !== null && m > max) {
    return { potrivit: false, motiv: `Masa de ${m} t depășește pragul maxim de ${max} t.` };
  }
  if (min === null && max === null) {
    return { potrivit: null, motiv: 'Intervalul de masă nu este documentat pentru această regulă.' };
  }
  return { potrivit: true };
}

export function potrivireOrar(regula, ora) {
  if (!regula.ora_start || !regula.ora_end || !ora) return { potrivit: null };
  if (ora < regula.ora_start || ora > regula.ora_end) {
    return {
      potrivit: false,
      motiv: `Regula se aplică doar în intervalul orar ${regula.ora_start}–${regula.ora_end}.`,
    };
  }
  return { potrivit: true };
}

export function cantitateTarifara(regula, context) {
  const unitate = regula.unitate_tarifare || regula.tip_taxa;
  const zile = esteGol(context.durataZile) ? null : Number(context.durataZile);
  const perZi = unitate === 'Per zi' || regula.tip_taxa === 'Pe zi';
  const perLuna = unitate === 'Per lună' || regula.tip_taxa === 'Pe lună';
  const perAn = unitate === 'Per an' || regula.tip_taxa === 'Pe an';

  if (perZi || perLuna || perAn) {
    if (!zile || zile <= 0) {
      return {
        cantitate: null,
        motiv: 'Durata accesului nu este specificată, deci baza de calcul nu este cunoscută.',
      };
    }
    if (perZi) return { cantitate: zile };
    if (perLuna) return { cantitate: Math.max(1, Math.ceil(zile / 30)) };
    return { cantitate: Math.max(1, Math.ceil(zile / 365)) };
  }
  return { cantitate: 1 };
}

function calculeazaValoare(regula, context) {
  if (regula.tip_taxa === 'Gratuit') {
    return { cost: 0, moneda: 'Fără valoare monetară', cantitate: 1, motiv: 'Acces declarat gratuit în sursa indicată.' };
  }
  if (regula.tip_taxa === 'Interzis') {
    return { cost: null, motiv: 'Accesul este declarat interzis de sursă.' };
  }
  if (esteGol(regula.valoare)) {
    return { cost: null, motiv: 'Valoarea taxei nu este documentată.' };
  }
  const cant = cantitateTarifara(regula, context);
  if (cant.cantitate === null) return { cost: null, motiv: cant.motiv };
  return {
    cost: rotunjeste(Number(regula.valoare) * cant.cantitate),
    cantitate: cant.cantitate,
    moneda: regula.moneda || 'RON',
  };
}

const MOTIVE_CATEGORIE = {
  Interdicție: 'Interdicție de acces confirmată — accesul nu este permis.',
  Restricție: 'Restricție de acces — verifică condițiile și programul.',
  Exceptare: 'Exceptare documentată de la obligația de acces.',
};

export function evalueazaRegula(regula, context = {}) {
  const rezultat = {
    regula,
    categorie: regula.categorie_regula || 'Taxă de acces',
    status: 'Neaplicabil',
    motiv: '',
    cost: null,
    moneda: regula.moneda || null,
    cantitate: null,
    avertismente: [],
    necesitaVerificare: false,
    faraCost: false,
  };

  if (regula.status && regula.status !== 'Activ') {
    rezultat.status = 'Exclus';
    rezultat.motiv = `Regula are statusul „${regula.status}” și nu se aplică deplasării.`;
    return rezultat;
  }

  const valabilitate = regulaValabilitate(regula, context.data);
  if (!valabilitate.aplicabila) {
    rezultat.status = 'Exclus';
    rezultat.motiv = valabilitate.motiv;
    return rezultat;
  }
  if (valabilitate.necunoscuta) {
    rezultat.avertismente.push(valabilitate.motiv);
    rezultat.necesitaVerificare = true;
  }

  const orar = potrivireOrar(regula, context.ora);
  if (orar.potrivit === false) {
    rezultat.status = 'Neaplicabil';
    rezultat.motiv = orar.motiv;
    return rezultat;
  }

  const masa = potrivireMasa(regula, context.masa, context.tipMasa);
  if (masa.potrivit === false) {
    rezultat.status = 'Neaplicabil';
    rezultat.motiv = masa.motiv;
    return rezultat;
  }
  if (masa.potrivit === null) {
    rezultat.avertismente.push(masa.motiv);
    rezultat.necesitaVerificare = true;
  }

  if (!regula.sursa_url && !regula.act_normativ_id) {
    rezultat.avertismente.push('Nu există o sursă oficială sau un act normativ asociat.');
    rezultat.necesitaVerificare = true;
  }
  if (!regula.data_verificare) {
    rezultat.avertismente.push('Data ultimei verificări lipsește.');
    rezultat.necesitaVerificare = true;
  }
  if (regula.incredere && regula.incredere !== 'Confirmat') {
    rezultat.avertismente.push(`Nivel de încredere: „${regula.incredere}”.`);
    rezultat.necesitaVerificare = true;
  }

  if (MOTIVE_CATEGORIE[rezultat.categorie]) {
    rezultat.faraCost = true;
    rezultat.motiv = MOTIVE_CATEGORIE[rezultat.categorie];
    return rezultat;
  }

  const valoare = calculeazaValoare(regula, context);
  if (valoare.cost === null) {
    rezultat.status = 'Necunoscut';
    rezultat.motiv = valoare.motiv;
    rezultat.necesitaVerificare = true;
    return rezultat;
  }

  rezultat.cost = valoare.cost;
  rezultat.cantitate = valoare.cantitate === undefined ? 1 : valoare.cantitate;
  rezultat.moneda = valoare.moneda;
  rezultat.motiv = valoare.motiv || '';
  rezultat.status = rezultat.necesitaVerificare ? 'De verificat' : 'Calculat';
  return rezultat;
}

export function grupeazaRezultate(randuri = []) {
  return {
    interdictii: randuri.filter((r) => r.categorie === 'Interdicție'),
    restrictii: randuri.filter((r) => r.categorie === 'Restricție'),
    taxe: randuri.filter((r) => r.categorie === 'Taxă de acces' && r.status !== 'Neaplicabil'),
    autorizatii: randuri.filter((r) => r.categorie === 'Autorizație'),
    exceptari: randuri.filter((r) => r.categorie === 'Exceptare'),
    neclare: randuri.filter(
      (r) => r.status === 'Necunoscut' || (r.status === 'De verificat' && r.cost === null)
    ),
    excluse: randuri.filter((r) => r.status === 'Exclus'),
    neaplicabile: randuri.filter((r) => r.status === 'Neaplicabil' && !r.faraCost && !r.motiv),
  };
}

export function sintetizeazaCalcul(randuri = []) {
  const cuCost = randuri.filter((r) => r.cost_calculat !== null && r.cost_calculat !== undefined);
  const esteConfirmat = (r) => r.status_calcul === 'Calculat' && r.status_incredere_snapshot === 'Confirmat';
  const confirmate = cuCost.filter(esteConfirmat);
  const neconfirmate = cuCost.filter((r) => !esteConfirmat(r));

  const sume = (lista) =>
    lista.reduce((acc, r) => {
      const moneda = r.moneda_snapshot && r.moneda_snapshot !== 'Fără valoare monetară' ? r.moneda_snapshot : null;
      if (!moneda) return acc;
      acc[moneda] = rotunjeste((acc[moneda] || 0) + Number(r.cost_calculat || 0));
      return acc;
    }, {});

  const subtotaleConfirmate = sume(confirmate);
  const subtotaleNeconfirmate = sume(neconfirmate);
  const monede = Array.from(
    new Set([...Object.keys(subtotaleConfirmate), ...Object.keys(subtotaleNeconfirmate)])
  );
  const monedaRezultat = monede.length === 0 ? 'Necalculabil' : monede.length === 1 ? monede[0] : 'Mixt';
  const total = (harta) =>
    monede.length === 1 ? rotunjeste(harta[monede[0]] || 0) : null;

  const necesitaVerificare = randuri.filter(
    (r) => r.status_calcul === 'Necunoscut' || r.status_calcul === 'De verificat'
  ).length;

  return {
    totalConfirmat: total(subtotaleConfirmate),
    totalNeconfirmat: total(subtotaleNeconfirmate),
    totalEstimare: monede.length === 1 ? rotunjeste((total(subtotaleConfirmate) || 0) + (total(subtotaleNeconfirmate) || 0)) : null,
    subtotaleConfirmate,
    subtotaleNeconfirmate,
    monede,
    monedaRezultat,
    necesitaVerificare,
    numarLinii: randuri.length,
  };
}

export function determinaStatusCalcul({ randuri = [], localitatiNeacoperite = [] }) {
  const aplicabile = randuri.filter((r) =>
    ['Calculat', 'De verificat', 'Necunoscut'].includes(r.status_calcul)
  );
  if (!aplicabile.length) return 'Neconcludent';
  if (aplicabile.every((r) => r.status_calcul === 'Necunoscut')) return 'Necesită verificare';
  const neclare = aplicabile.filter((r) => r.status_calcul !== 'Calculat');
  const neconfirmate = aplicabile.filter((r) => r.status_incredere_snapshot !== 'Confirmat');
  if (neclare.length || neconfirmate.length || localitatiNeacoperite.length) return 'Parțial';
  return 'Complet';
}

export function detecteazaSuprapuneri(reguli = []) {
  const avertismente = [];
  const grupuri = {};
  reguli
    .filter((r) => r.status === 'Activ')
    .forEach((r) => {
      const cheie = `${r.localitate_id}|${r.zona_id || ''}|${r.categorie_regula}|${r.tip_masa || ''}`;
      if (!grupuri[cheie]) grupuri[cheie] = [];
      grupuri[cheie].push(r);
    });

  Object.values(grupuri).forEach((lista) => {
    for (let i = 0; i < lista.length; i += 1) {
      for (let j = i + 1; j < lista.length; j += 1) {
        const a = lista[i];
        const b = lista[j];
        const aMin = typeof a.masa_min_t === 'number' ? a.masa_min_t : 0;
        const aMax = typeof a.masa_max_t === 'number' ? a.masa_max_t : Infinity;
        const bMin = typeof b.masa_min_t === 'number' ? b.masa_min_t : 0;
        const bMax = typeof b.masa_max_t === 'number' ? b.masa_max_t : Infinity;
        if (aMin <= bMax && bMin <= aMax) {
          avertismente.push({
            tip: 'Suprapunere',
            reguli: [a.id, b.id],
            mesaj: `Regulile „${a.denumire_regula}” și „${b.denumire_regula}” se suprapun în intervalul de masă și pot duce la taxare dublă.`,
          });
        }
      }
    }
  });
  return avertismente;
}

export function valideazaGeoJSON(text) {
  if (esteGol(text)) return { ok: false, gol: true, motiv: 'Geometria nu este definită.' };
  let geo;
  try {
    geo = JSON.parse(text);
  } catch (e) {
    return { ok: false, motiv: `GeoJSON invalid: ${e.message}` };
  }
  const acceptate = ['Polygon', 'MultiPolygon', 'Feature', 'FeatureCollection'];
  if (!geo || !acceptate.includes(geo.type)) {
    return { ok: false, motiv: 'Tipul geometriei nu este acceptat (Polygon, MultiPolygon sau Feature).' };
  }
  return { ok: true, geo };
}

export function extragePoligoane(text) {
  const validare = valideazaGeoJSON(text);
  if (!validare.ok) return [];
  const lista = [];
  const adaugaGeometrie = (geometrie, proprietati) => {
    if (!geometrie) return;
    if (geometrie.type === 'Polygon') {
      lista.push({ tip: 'Polygon', coordinates: geometrie.coordinates, properties: proprietati || {} });
    } else if (geometrie.type === 'MultiPolygon') {
      geometrie.coordinates.forEach((coordonate) => {
        lista.push({ tip: 'Polygon', coordinates: coordonate, properties: proprietati || {} });
      });
    }
  };
  const geo = validare.geo;
  if (geo.type === 'Polygon' || geo.type === 'MultiPolygon') adaugaGeometrie(geo, {});
  else if (geo.type === 'Feature') adaugaGeometrie(geo.geometry, geo.properties);
  else if (geo.type === 'FeatureCollection') {
    (geo.features || []).forEach((f) => adaugaGeometrie(f.geometry, f.properties));
  }
  return lista;
}

export function masaDinVehicul(vehicul, tipMasa) {
  if (!vehicul) return null;
  if (tipMasa === 'MTMA') return vehicul.masa_maxima_autorizata_t ?? null;
  if (tipMasa === 'Masă totală') return vehicul.masa_totala_t ?? null;
  if (vehicul.masa_maxima_autorizata_t !== undefined && vehicul.masa_maxima_autorizata_t !== null) {
    return vehicul.masa_maxima_autorizata_t;
  }
  return vehicul.masa_totala_t ?? null;
}

export function cheieAlerta(alerta) {
  return [alerta.tip_alerta, alerta.taxa_id || '', alerta.sursa_act_id || '', alerta.localitate_id || '', alerta.titlu].join('|');
}

export function construiesteAlerte({ localitati = [], reguli = [], zone = [], surse = [], existente = [] }) {
  const astazi = azi();
  const noi = [];
  const chei = new Set(existente.map(cheieAlerta));

  const adauga = (alerta) => {
    const completa = { ...alerta, data_generare: new Date().toISOString(), status: 'Nouă', este_demo: false };
    const cheie = cheieAlerta(completa);
    if (!chei.has(cheie)) {
      chei.add(cheie);
      noi.push(completa);
    }
  };

  const numeLoc = (id) => {
    const l = localitati.find((x) => x.id === id);
    return l ? l.nume : 'Localitate necunoscută';
  };

  reguli
    .filter((r) => !r.este_demo)
    .forEach((r) => {
      const referinta = `„${r.denumire_regula}” (${numeLoc(r.localitate_id)})`;
      const baza = { localitate_id: r.localitate_id, taxa_id: r.id, este_demo: false };

      if (r.perioada_valabilitate_end) {
        const zile = zilePanaLa(r.perioada_valabilitate_end, astazi);
        if (zile !== null && zile < 0) {
          adauga({
            ...baza,
            tip_alerta: 'Taxă expirată',
            titlu: `Taxă expirată: ${referinta}`,
            descriere: `Perioada de valabilitate s-a încheiat la ${dataRo(r.perioada_valabilitate_end)}. Regula nu mai trebuie prezentată ca actuală.`,
            severitate: 'Critică',
            data_scadenta: r.perioada_valabilitate_end,
          });
        } else if (zile !== null && zile <= PRAG_EXPIRARE_ZILE) {
          adauga({
            ...baza,
            tip_alerta: 'Taxă expirată',
            titlu: `Taxă care expiră în ${zile} zile: ${referinta}`,
            descriere: `Valabilitatea se încheie la ${dataRo(r.perioada_valabilitate_end)}.`,
            severitate: 'Medie',
            data_scadenta: r.perioada_valabilitate_end,
          });
        }
      }

      if (r.status === 'Expirat') {
        adauga({
          ...baza,
          tip_alerta: 'Taxă expirată',
          titlu: `Regulă marcată expirată: ${referinta}`,
          descriere: 'Statusul regulii este „Expirat”.',
          severitate: 'Critică',
        });
      }
      if (r.incredere && r.incredere !== 'Confirmat') {
        adauga({
          ...baza,
          tip_alerta: 'Verificare necesară',
          titlu: `Nivel de încredere „${r.incredere}”: ${referinta}`,
          descriere: 'Regula nu are un statut de încredere „Confirmat”.',
          severitate: 'Medie',
        });
      }
      if (!r.data_verificare) {
        adauga({
          ...baza,
          tip_alerta: 'Verificare necesară',
          titlu: `Verificare lipsă: ${referinta}`,
          descriere: 'Regula nu are o dată a ultimei verificări.',
          severitate: 'Ridicată',
        });
      }
      if (!r.sursa_url && !r.act_normativ_id) {
        adauga({
          ...baza,
          tip_alerta: 'Informație incompletă',
          titlu: `Sursă oficială lipsă: ${referinta}`,
          descriere: 'Nu există nici un link de sursă și nici un act normativ asociat.',
          severitate: 'Ridicată',
        });
      }
    });

  detecteazaSuprapuneri(reguli.filter((r) => !r.este_demo)).forEach((avertisment) => {
    const regula = reguli.find((r) => r.id === avertisment.reguli[0]);
    if (!regula) return;
    adauga({
      localitate_id: regula.localitate_id,
      taxa_id: regula.id,
      tip_alerta: 'Verificare necesară',
      titlu: `Reguli suprapuse: ${regula.denumire_regula}`,
      descriere: avertisment.mesaj,
      severitate: 'Medie',
      este_demo: false,
    });
  });

  localitati
    .filter((l) => !l.este_demo && !l.archived)
    .forEach((l) => {
      if (l.prioritate === 'P1' && l.status_acoperire !== 'Verificată') {
        adauga({
          localitate_id: l.id,
          tip_alerta: 'Informație incompletă',
          titlu: `Acoperire incompletă: ${l.nume}`,
          descriere: `Localitate prioritară cu statusul de acoperire „${l.status_acoperire}”.`,
          severitate: 'Medie',
          este_demo: false,
        });
      }
      if (!l.ultima_verificare) {
        adauga({
          localitate_id: l.id,
          tip_alerta: 'Verificare necesară',
          titlu: `Localitate neverificată: ${l.nume}`,
          descriere: 'Nu există o dată a ultimei verificări pentru această localitate.',
          severitate: 'Medie',
          este_demo: false,
        });
      }
    });

  zone
    .filter((z) => !z.este_demo && !z.archived)
    .forEach((z) => {
      const referinta = `„${z.nume_zona}” (${numeLoc(z.localitate_id)})`;
      if (esteGol(z.geometrie_geojson)) {
        adauga({
          localitate_id: z.localitate_id,
          tip_alerta: 'Geometrie de reverificat',
          titlu: `Geometrie lipsă: ${referinta}`,
          descriere: 'Zona nu are geometrie GeoJSON, deci nu poate fi afișată pe hartă.',
          severitate: 'Medie',
          este_demo: false,
        });
      } else if (z.status_geometrie !== 'Confirmată') {
        adauga({
          localitate_id: z.localitate_id,
          tip_alerta: 'Geometrie de reverificat',
          titlu: `Geometrie de verificat: ${referinta}`,
          descriere: `Statusul geometriei este „${z.status_geometrie || 'Neverificată'}”.`,
          severitate: 'Medie',
          este_demo: false,
        });
      } else {
        const luni = luniDeLa(z.data_verificare_geometrie);
        if (luni === null || luni >= PRAG_REVERIFICARE_LUNI) {
          adauga({
            localitate_id: z.localitate_id,
            tip_alerta: 'Geometrie de reverificat',
            titlu: `Geometrie învechită: ${referinta}`,
            descriere: 'Geometria nu a fost reverificată în ultimele 12 luni.',
            severitate: 'Medie',
            este_demo: false,
          });
        }
      }
    });

  surse
    .filter((s) => !s.este_demo)
    .forEach((s) => {
      const referinta = `„${s.titlu_document}” (${numeLoc(s.localitate_id)})`;
      const luni = luniDeLa(s.data_verificare);
      if (luni === null || luni >= PRAG_REVERIFICARE_LUNI) {
        adauga({
          localitate_id: s.localitate_id,
          sursa_act_id: s.id,
          tip_alerta: 'Verificare necesară',
          titlu: `Sursă de reverificat: ${referinta}`,
          descriere: 'Documentul nu a fost verificat în ultimele 12 luni.',
          severitate: 'Medie',
          este_demo: false,
        });
      }
      const expirat = s.status_act === 'Expirat' || (s.data_expirare && s.data_expirare < astazi);
      if (expirat) {
        adauga({
          localitate_id: s.localitate_id,
          sursa_act_id: s.id,
          tip_alerta: 'Taxă expirată',
          titlu: `Act expirat: ${referinta}`,
          descriere: 'Documentul normativ este expirat sau a depășit data de expirare.',
          severitate: 'Ridicată',
          data_scadenta: s.data_expirare,
          este_demo: false,
        });
      }
    });

  return noi;
}