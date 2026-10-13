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

/** Litere de zonă din nume: „Zona A (…)” → ['A']; „Zonele A și B (…)” → ['A','B']. */
function litereZonaDinNume(nume) {
  const faraParanteze = String(nume || '').replace(/\([^)]*\)/g, ' ');
  return faraParanteze.match(/\b([A-ZĂÂÎȘȚ])\b/g) || [];
}

function sufixZonaDinNume(nume) {
  const m = String(nume || '').match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim().toLowerCase() : '';
}

/**
 * Zone combinate („Zonele A și B”) acoperă componentele („Zona A”, „Zona B”) cu același sufix,
 * și invers — ca exceptarea ≤5 t de pe zona combinată să apară și la filtrul pe Zona A.
 */
export function zoneCompatibile(zonaFiltru, zonaCandidata) {
  if (!zonaFiltru || !zonaCandidata) return false;
  if (zonaFiltru.id === zonaCandidata.id) return true;
  const litF = litereZonaDinNume(zonaFiltru.nume_zona);
  const litC = litereZonaDinNume(zonaCandidata.nume_zona);
  if (!litF.length || !litC.length) return false;
  const sufF = sufixZonaDinNume(zonaFiltru.nume_zona);
  const sufC = sufixZonaDinNume(zonaCandidata.nume_zona);
  if (sufF && sufC && sufF !== sufC) return false;
  const fAcoperaC = litC.every((l) => litF.includes(l));
  const cAcoperaF = litF.every((l) => litC.includes(l));
  return fAcoperaC || cAcoperaF;
}

/** true dacă regula trebuie evaluată pentru filtrul de zonă selectat. */
export function regulaPotrivesteZona(regula, zonaId, zone = []) {
  if (!zonaId || zonaId === 'toate') return true;
  if (!regula.zona_id) return true;
  if (regula.zona_id === zonaId) return true;
  const filtru = zone.find((z) => z.id === zonaId);
  const aRegulii = zone.find((z) => z.id === regula.zona_id);
  if (!filtru || !aRegulii) return false;
  return zoneCompatibile(filtru, aRegulii);
}

function tipUnitateTarifara(regula) {
  const u = `${regula.unitate_tarifare || ''} ${regula.tip_taxa || ''}`.toLowerCase();
  if (u.includes('zi')) return 'zi';
  if (u.includes('lun')) return 'luna';
  if (u.includes('an')) return 'an';
  return 'alt';
}

function preferintaUnitatePentruDurata(durataZile) {
  const zile = Number(durataZile);
  if (!zile || zile <= 0) return null;
  if (zile < 28) return 'zi';
  if (zile < 360) return 'luna';
  return 'an';
}

/**
 * Pentru aceeași zonă + bandă de masă, păstrează tariful potrivit duratei (zi/lună/an)
 * și marchează celelalte ca neaplicabile (nu se cumulează).
 */
export function marcheazaTarifeAlternative(evaluari = [], durataZile) {
  const preferinta = preferintaUnitatePentruDurata(durataZile);
  if (!preferinta) return evaluari;

  const grupuri = new Map();
  evaluari.forEach((e, idx) => {
    if (e.categorie !== 'Taxă de acces') return;
    if (!['Calculat', 'De verificat'].includes(e.status)) return;
    if (e.cost === null || e.cost === undefined) return;
    const tip = tipUnitateTarifara(e.regula);
    if (tip === 'alt') return;
    const cheie = [
      e.regula.zona_id || '',
      e.regula.masa_min_t ?? '',
      e.regula.masa_max_t ?? '',
      e.regula.tip_masa || '',
    ].join('|');
    if (!grupuri.has(cheie)) grupuri.set(cheie, []);
    grupuri.get(cheie).push({ e, idx, tip });
  });

  const eticheta = { zi: 'zi', luna: 'lună', an: 'an' };
  for (const lista of grupuri.values()) {
    if (lista.length < 2) continue;
    if (!lista.some((x) => x.tip === preferinta)) continue;
    for (const { e, tip } of lista) {
      if (tip === preferinta) continue;
      e.status = 'Neaplicabil';
      e.faraCost = false;
      e.cost = null;
      e.cantitate = null;
      e.motiv = `Tarif alternativ (${e.regula.unitate_tarifare || e.regula.tip_taxa}); pentru durata aleasă se folosește tariful pe ${eticheta[preferinta]}.`;
    }
  }
  return evaluari;
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
    if (regula.tip_taxa === 'Gratuit') {
      rezultat.cost = 0;
      rezultat.cantitate = 1;
      rezultat.moneda = 'Fără valoare monetară';
    }
    // Potrivire reușită — nu lăsa statusul implicit „Neaplicabil”.
    rezultat.status = rezultat.necesitaVerificare ? 'De verificat' : 'Calculat';
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
  const aplicabila = (r) => r.status !== 'Neaplicabil' && r.status !== 'Exclus';
  return {
    interdictii: randuri.filter((r) => r.categorie === 'Interdicție' && aplicabila(r)),
    restrictii: randuri.filter((r) => r.categorie === 'Restricție' && aplicabila(r)),
    taxe: randuri.filter((r) => r.categorie === 'Taxă de acces' && aplicabila(r)),
    autorizatii: randuri.filter((r) => r.categorie === 'Autorizație' && aplicabila(r)),
    exceptari: randuri.filter((r) => r.categorie === 'Exceptare' && aplicabila(r)),
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

  const byId = new Map(localitati.map((l) => [l.id, l]));
  const numeLoc = (id) => byId.get(id)?.nume || 'Localitate necunoscută';
  const esteP1 = (id) => byId.get(id)?.prioritate === 'P1';

  // Reguli nesigure → o singură alertă agregată pe localitate (nu sute pe „De confirmat”).
  const nesigurePeLoc = new Map();

  reguli
    .filter((r) => !r.este_demo)
    .forEach((r) => {
      const referinta = `„${r.denumire_regula}” (${numeLoc(r.localitate_id)})`;
      const baza = { localitate_id: r.localitate_id, taxa_id: r.id, este_demo: false };
      const confirmat = r.incredere === 'Confirmat';

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

      if (!confirmat) {
        const prev = nesigurePeLoc.get(r.localitate_id) || { total: 0, faraSursa: 0 };
        prev.total += 1;
        if (!r.sursa_url && !r.act_normativ_id) prev.faraSursa += 1;
        nesigurePeLoc.set(r.localitate_id, prev);
        return;
      }

      // Doar pe reguli Confirmate: lipsuri reale de ops (nu dublăm coada de verificare).
      if (!r.data_verificare) {
        adauga({
          ...baza,
          tip_alerta: 'Verificare necesară',
          titlu: `Verificare lipsă: ${referinta}`,
          descriere: 'Regula confirmată nu are o dată a ultimei verificări.',
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

  nesigurePeLoc.forEach((info, localitateId) => {
    adauga({
      localitate_id: localitateId,
      tip_alerta: 'Verificare necesară',
      titlu: `${info.total} reguli de confirmat: ${numeLoc(localitateId)}`,
      descriere:
        'Detaliile pe regulă sunt în coada „Verificări necesare” de pe Prezentare. O alertă agregată înlocuiește zgomotul pe fiecare rând „De confirmat”.',
      severitate: esteP1(localitateId) ? 'Ridicată' : 'Medie',
      este_demo: false,
    });
  });

  detecteazaSuprapuneri(reguli.filter((r) => !r.este_demo && r.incredere === 'Confirmat')).forEach((avertisment) => {
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
      // Doar P1 fără dată de verificare — restul e în coada Prezentare.
      if (l.prioritate === 'P1' && !l.ultima_verificare) {
        adauga({
          localitate_id: l.id,
          tip_alerta: 'Verificare necesară',
          titlu: `Localitate P1 neverificată: ${l.nume}`,
          descriere: 'Nu există o dată a ultimei verificări pentru această localitate prioritară.',
          severitate: 'Medie',
          este_demo: false,
        });
      }
    });

  // Geometrii: agregat pe localitate, doar P1 (majoritatea UAT-urilor n-au încă GeoJSON).
  const geoProbleme = new Map();
  zone
    .filter((z) => !z.este_demo && !z.archived && esteP1(z.localitate_id))
    .forEach((z) => {
      let motiv = null;
      if (esteGol(z.geometrie_geojson)) motiv = 'lipsă';
      else if (z.status_geometrie !== 'Confirmată') motiv = 'neverificată';
      else {
        const luni = luniDeLa(z.data_verificare_geometrie);
        if (luni === null || luni >= PRAG_REVERIFICARE_LUNI) motiv = 'învechită';
      }
      if (!motiv) return;
      const prev = geoProbleme.get(z.localitate_id) || { total: 0, motive: new Set() };
      prev.total += 1;
      prev.motive.add(motiv);
      geoProbleme.set(z.localitate_id, prev);
    });

  geoProbleme.forEach((info, localitateId) => {
    adauga({
      localitate_id: localitateId,
      tip_alerta: 'Geometrie de reverificat',
      titlu: `${info.total} zone fără hartă utilă: ${numeLoc(localitateId)}`,
      descriere: `Probleme: ${[...info.motive].join(', ')}. Detaliile pe zonă rămân în registrul localității.`,
      severitate: 'Medie',
      este_demo: false,
    });
  });

  surse
    .filter((s) => !s.este_demo)
    .forEach((s) => {
      const referinta = `„${s.titlu_document}” (${numeLoc(s.localitate_id)})`;
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
        return;
      }
      // Reverificare periodică doar pe P1 — evită sute de alerte pe lotul „de confirmat”.
      if (!esteP1(s.localitate_id)) return;
      const luni = luniDeLa(s.data_verificare);
      if (luni === null || luni >= PRAG_REVERIFICARE_LUNI) {
        adauga({
          localitate_id: s.localitate_id,
          sursa_act_id: s.id,
          tip_alerta: 'Verificare necesară',
          titlu: `Sursă de reverificat: ${referinta}`,
          descriere: 'Documentul P1 nu a fost verificat în ultimele 12 luni.',
          severitate: 'Medie',
          este_demo: false,
        });
      }
    });

  return noi;
}