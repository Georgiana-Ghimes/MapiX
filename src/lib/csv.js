// Utilitare pentru importul și exportul de date în format CSV (separator „;”, format românesc).
import { esteGol, faraDiacritice, laNumar } from './format';
import {
  CATEGORII_REGULA,
  MONEDE,
  NIVELURI_INCREDERE,
  PRIORITATI,
  STATUSURI_ACOPERIRE,
  STATUSURI_ACT,
  STATUSURI_GEOMETRIE,
  STATUSURI_REGLEMENTARE,
  STATUSURI_TAXA,
  TIPURI_ACT,
  TIPURI_MASA,
  TIPURI_TAXA,
  TIPURI_ZONA,
  TIP_LOCALITATE,
  UNITATI_TARIFARE,
} from './enum';
import { valideazaGeoJSON } from './reguliTaxe';

export const TIPURI_IMPORT = [
  {
    id: 'localitati',
    nume: 'Localități',
    entitate: 'Localitate',
    coloane: [
      'nume',
      'judet',
      'tip_localitate',
      'prioritate',
      'status_acoperire',
      'status_reglementare',
      'latitudine',
      'longitudine',
      'descriere',
    ],
    obligatorii: ['nume'],
  },
  {
    id: 'taxe',
    nume: 'Reguli de taxare',
    entitate: 'TaxaAcces',
    coloane: [
      'localitate',
      'zona',
      'denumire_regula',
      'categorie_regula',
      'masa_min_t',
      'masa_max_t',
      'tip_masa',
      'tip_vehicul',
      'tip_taxa',
      'valoare',
      'moneda',
      'unitate_tarifare',
      'perioada_start',
      'perioada_end',
      'ora_start',
      'ora_end',
      'conditii_vehicul',
      'exceptii',
      'cum_se_obtine',
      'sursa_url',
      'data_sursa',
      'data_verificare',
      'incredere',
      'status',
      'observatii',
    ],
    obligatorii: ['localitate', 'denumire_regula', 'categorie_regula'],
  },
  {
    id: 'surse',
    nume: 'Surse și acte normative',
    entitate: 'SursaAct',
    coloane: [
      'localitate',
      'an_fiscal',
      'tip_act',
      'numar_act',
      'data_act',
      'titlu_document',
      'document_url',
      'data_publicare',
      'data_intrare_vigoare',
      'data_expirare',
      'data_verificare',
      'status_act',
      'note_verificare',
    ],
    obligatorii: ['localitate', 'titlu_document'],
  },
  {
    id: 'zone',
    nume: 'Zone',
    entitate: 'Zona',
    coloane: [
      'localitate',
      'nume_zona',
      'cod_zona',
      'tip_zona',
      'status_geometrie',
      'centru_latitudine',
      'centru_longitudine',
      'valabil_de',
      'valabil_pana',
      'sursa_geometrie_url',
      'geometrie_geojson',
    ],
    obligatorii: ['localitate', 'nume_zona'],
  },
];

export function parseCsv(text) {
  const curatat = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!curatat) return { headers: [], rows: [] };
  const primaLinie = curatat.split('\n')[0];
  const nrPunctVirgula = (primaLinie.match(/;/g) || []).length;
  const nrVirgula = (primaLinie.match(/,/g) || []).length;
  const delimitator = nrPunctVirgula >= nrVirgula ? ';' : ',';

  const linii = [];
  let curent = [];
  let camp = '';
  let inGhilimele = false;
  for (let i = 0; i < curatat.length; i += 1) {
    const ch = curatat[i];
    if (inGhilimele) {
      if (ch === '"') {
        if (curatat[i + 1] === '"') {
          camp += '"';
          i += 1;
        } else {
          inGhilimele = false;
        }
      } else {
        camp += ch;
      }
    } else if (ch === '"') {
      inGhilimele = true;
    } else if (ch === delimitator) {
      curent.push(camp);
      camp = '';
    } else if (ch === '\n') {
      curent.push(camp);
      linii.push(curent);
      curent = [];
      camp = '';
    } else {
      camp += ch;
    }
  }
  curent.push(camp);
  linii.push(curent);

  const headers = linii[0].map((h) => h.trim());
  const rows = linii
    .slice(1)
    .filter((linie) => linie.some((c) => String(c).trim() !== ''))
    .map((linie) => {
      const obiect = {};
      headers.forEach((h, i) => {
        obiect[h] = String(linie[i] === undefined ? '' : linie[i]).trim();
      });
      return obiect;
    });
  return { headers, rows };
}

export function laCsv(headers, rows) {
  const escapa = (valoare) => {
    const s = valoare === null || valoare === undefined ? '' : String(valoare);
    if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const linii = [headers.map(escapa).join(';')];
  rows.forEach((row) => {
    linii.push(headers.map((h) => escapa(row[h])).join(';'));
  });
  return linii.join('\n');
}

export function descarcaCsv(numeFisier, continut) {
  const blob = new Blob([`\uFEFF${continut}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = numeFisier;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function valideazaEnum(valoare, lista, eticheta, erori, linie) {
  if (esteGol(valoare)) return null;
  if (!lista.includes(valoare)) {
    erori.push({ linie, mesaj: `${eticheta}: valoarea „${valoare}” nu este acceptată.` });
    return null;
  }
  return valoare;
}

function normalizeazaData(valoare, eticheta, erori, linie) {
  if (esteGol(valoare)) return null;
  const v = String(valoare).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (m) {
    const zi = m[1].padStart(2, '0');
    const luna = m[2].padStart(2, '0');
    return `${m[3]}-${luna}-${zi}`;
  }
  erori.push({ linie, mesaj: `${eticheta}: data „${valoare}” nu are un format valid (ZZ.LL.AAAA).` });
  return null;
}

export function valideazaImport(tipId, randuri, { localitati = [], zone = [] } = {}) {
  const definitie = TIPURI_IMPORT.find((t) => t.id === tipId);
  const erori = [];
  const avertismente = [];
  const pregatite = [];
  if (!definitie) return { erori, avertismente, pregatite };

  const gasesteLocalitate = (nume) => {
    const tinta = faraDiacritice(nume).trim();
    return localitati.find((l) => faraDiacritice(l.nume) === tinta);
  };
  const gasesteZona = (nume, localitateId) => {
    const tinta = faraDiacritice(nume).trim();
    return zone.find((z) => faraDiacritice(z.nume_zona) === tinta && z.localitate_id === localitateId);
  };

  randuri.forEach((row, index) => {
    const linie = index + 2;
    const inainte = erori.length;
    const inaintePregatite = pregatite.length;
    definitie.obligatorii.forEach((coloana) => {
      if (esteGol(row[coloana])) {
        erori.push({ linie, mesaj: `Câmpul obligatoriu „${coloana}” lipsește.` });
      }
    });

    let localitate = null;
    if (row.localitate !== undefined) {
      if (esteGol(row.localitate)) {
        erori.push({ linie, mesaj: 'Câmpul obligatoriu „localitate” lipsește.' });
      } else {
        localitate = gasesteLocalitate(row.localitate);
        if (!localitate) {
          erori.push({ linie, mesaj: `Localitatea „${row.localitate}” nu există în baza de date. Importă mai întâi localitățile.` });
        }
      }
    }

    if (tipId === 'localitati') {
      pregatite.push({
        nume: row.nume,
        judet: row.judet || null,
        tip_localitate: valideazaEnum(row.tip_localitate, TIP_LOCALITATE, 'tip_localitate', erori, linie),
        prioritate: valideazaEnum(row.prioritate, PRIORITATI, 'prioritate', erori, linie) || 'P3',
        status_acoperire: valideazaEnum(row.status_acoperire, STATUSURI_ACOPERIRE, 'status_acoperire', erori, linie) || 'Neîncepută',
        status_reglementare: valideazaEnum(row.status_reglementare, STATUSURI_REGLEMENTARE, 'status_reglementare', erori, linie) || 'De verificat',
        latitudine: laNumar(row.latitudine),
        longitudine: laNumar(row.longitudine),
        descriere: row.descriere || null,
        este_demo: false,
        archived: false,
      });
    }

    if (tipId === 'taxe' && localitate) {
      let zona = null;
      if (!esteGol(row.zona)) {
        zona = gasesteZona(row.zona, localitate.id);
        if (!zona) {
          avertismente.push({ linie, mesaj: `Zona „${row.zona}” nu a fost găsită pentru ${localitate.nume}; regula va fi salvată fără zonă.` });
        }
      }
      const incredere = valideazaEnum(row.incredere, NIVELURI_INCREDERE, 'incredere', erori, linie) || 'De confirmat';
      if (esteGol(row.incredere)) {
        avertismente.push({ linie, mesaj: 'Nivelul de încredere lipsește; înregistrarea va fi importată ca „De confirmat”.' });
      }
      if (incredere === 'Confirmat' && esteGol(row.sursa_url)) {
        erori.push({ linie, mesaj: 'O regulă „Confirmat” trebuie să aibă un URL de sursă identificabil.' });
      }
      pregatite.push({
        localitate_id: localitate.id,
        zona_id: zona ? zona.id : null,
        denumire_regula: row.denumire_regula,
        categorie_regula: valideazaEnum(row.categorie_regula, CATEGORII_REGULA, 'categorie_regula', erori, linie),
        masa_min_t: laNumar(row.masa_min_t),
        masa_max_t: laNumar(row.masa_max_t),
        tip_masa: valideazaEnum(row.tip_masa, TIPURI_MASA, 'tip_masa', erori, linie) || 'Necunoscut',
        tip_vehicul: row.tip_vehicul || null,
        tip_taxa: valideazaEnum(row.tip_taxa, TIPURI_TAXA, 'tip_taxa', erori, linie) || 'Altul',
        valoare: laNumar(row.valoare),
        moneda: valideazaEnum(row.moneda, MONEDE, 'moneda', erori, linie) || 'RON',
        unitate_tarifare: valideazaEnum(row.unitate_tarifare, UNITATI_TARIFARE, 'unitate_tarifare', erori, linie) || 'Altul',
        perioada_valabilitate_start: normalizeazaData(row.perioada_start, 'perioada_start', erori, linie),
        perioada_valabilitate_end: normalizeazaData(row.perioada_end, 'perioada_end', erori, linie),
        ora_start: row.ora_start || null,
        ora_end: row.ora_end || null,
        conditii_vehicul: row.conditii_vehicul || null,
        exceptii: row.exceptii || null,
        cum_se_obtine: row.cum_se_obtine || null,
        sursa_url: row.sursa_url || null,
        data_sursa: normalizeazaData(row.data_sursa, 'data_sursa', erori, linie),
        data_verificare: normalizeazaData(row.data_verificare, 'data_verificare', erori, linie),
        incredere,
        status: valideazaEnum(row.status, STATUSURI_TAXA, 'status', erori, linie) || 'Ciornă',
        observatii: row.observatii || null,
        este_demo: false,
      });
    }

    if (tipId === 'surse' && localitate) {
      pregatite.push({
        localitate_id: localitate.id,
        an_fiscal: laNumar(row.an_fiscal),
        tip_act: valideazaEnum(row.tip_act, TIPURI_ACT, 'tip_act', erori, linie) || 'Alt document oficial',
        numar_act: row.numar_act || null,
        data_act: normalizeazaData(row.data_act, 'data_act', erori, linie),
        titlu_document: row.titlu_document,
        document_url: row.document_url || null,
        data_publicare: normalizeazaData(row.data_publicare, 'data_publicare', erori, linie),
        data_intrare_vigoare: normalizeazaData(row.data_intrare_vigoare, 'data_intrare_vigoare', erori, linie),
        data_expirare: normalizeazaData(row.data_expirare, 'data_expirare', erori, linie),
        data_verificare: normalizeazaData(row.data_verificare, 'data_verificare', erori, linie),
        status_act: valideazaEnum(row.status_act, STATUSURI_ACT, 'status_act', erori, linie) || 'Necunoscut',
        note_verificare: row.note_verificare || null,
        este_demo: false,
      });
    }

    if (tipId === 'zone' && localitate) {
      let geometrie = null;
      if (!esteGol(row.geometrie_geojson)) {
        const validare = valideazaGeoJSON(row.geometrie_geojson);
        if (!validare.ok) {
          erori.push({ linie, mesaj: `Geometrie invalidă: ${validare.motiv}` });
        } else {
          geometrie = row.geometrie_geojson;
        }
      } else {
        avertismente.push({ linie, mesaj: 'Zona nu are geometrie GeoJSON; va fi marcată ca „Neverificată”.' });
      }
      pregatite.push({
        localitate_id: localitate.id,
        nume_zona: row.nume_zona,
        cod_zona: row.cod_zona || null,
        tip_zona: valideazaEnum(row.tip_zona, TIPURI_ZONA, 'tip_zona', erori, linie) || 'Reglementată',
        status_geometrie: valideazaEnum(row.status_geometrie, STATUSURI_GEOMETRIE, 'status_geometrie', erori, linie) || 'Neverificată',
        centru_latitudine: laNumar(row.centru_latitudine),
        centru_longitudine: laNumar(row.centru_longitudine),
        valabil_de: normalizeazaData(row.valabil_de, 'valabil_de', erori, linie),
        valabil_pana: normalizeazaData(row.valabil_pana, 'valabil_pana', erori, linie),
        sursa_geometrie_url: row.sursa_geometrie_url || null,
        geometrie_geojson: geometrie,
        este_demo: false,
        archived: false,
      });
    }

    if (erori.length > inainte) {
      while (pregatite.length > inaintePregatite) pregatite.pop();
    }
  });

  return { erori, avertismente, pregatite, definitie };
}