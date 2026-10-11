/** Entity name → table + writable columns. */
export const ENTITY_MAP = {
  User: {
    table: 'users',
    ownerScoped: false,
    adminListOnly: true,
    jsonFields: [],
    writable: [
      'role', 'full_name', 'nume_organizatie', 'cui', 'adresa_organizatie',
      'telefon_organizatie', 'email_organizatie', 'moneda_implicita', 'criteriu_masa_implicit', 'is_active',
    ],
    publicFields: [
      'id', 'email', 'role', 'full_name', 'nume_organizatie', 'cui', 'adresa_organizatie',
      'telefon_organizatie', 'email_organizatie', 'moneda_implicita', 'criteriu_masa_implicit',
      'is_active', 'created_at', 'updated_at',
    ],
  },
  Localitate: {
    table: 'localitati',
    ownerScoped: false,
    jsonFields: [],
    writable: [
      'nume', 'slug', 'judet', 'tip_localitate', 'prioritate', 'status_acoperire',
      'status_reglementare', 'descriere', 'latitudine', 'longitudine', 'ultima_verificare',
      'urmatoarea_verificare', 'responsabil', 'este_demo', 'archived',
    ],
  },
  Zona: {
    table: 'zone',
    ownerScoped: false,
    jsonFields: [],
    writable: [
      'localitate_id', 'nume_zona', 'cod_zona', 'descriere', 'tip_zona', 'geometrie_geojson',
      'centru_latitudine', 'centru_longitudine', 'valabil_de', 'valabil_pana', 'status_geometrie',
      'sursa_geometrie_url', 'data_verificare_geometrie', 'este_demo', 'archived',
    ],
  },
  SursaAct: {
    table: 'surse_act',
    ownerScoped: false,
    jsonFields: [],
    writable: [
      'localitate_id', 'an_fiscal', 'tip_act', 'numar_act', 'data_act', 'titlu_document',
      'document_url', 'pagina_relevanta', 'data_publicare', 'data_intrare_vigoare', 'data_expirare',
      'data_verificare', 'status_act', 'note_verificare', 'responsabil_verificare', 'este_demo',
    ],
  },
  TaxaAcces: {
    table: 'taxe_acces',
    ownerScoped: false,
    jsonFields: ['zile_aplicare'],
    writable: [
      'localitate_id', 'zona_id', 'denumire_regula', 'categorie_regula', 'masa_min_t', 'masa_max_t',
      'tip_masa', 'tip_vehicul', 'tip_taxa', 'valoare', 'moneda', 'unitate_tarifare',
      'perioada_valabilitate_start', 'perioada_valabilitate_end', 'zile_aplicare', 'ora_start',
      'ora_end', 'orar_restrictie', 'conditii_vehicul', 'exceptii', 'cum_se_obtine',
      'url_autorizatie', 'act_normativ_id', 'sursa_url', 'data_sursa', 'data_verificare',
      'incredere', 'status', 'observatii', 'este_demo',
    ],
  },
  Vehicul: {
    table: 'vehicule',
    ownerScoped: true,
    jsonFields: [],
    writable: [
      'nume_intern', 'numar_inmatriculare', 'tara_inmatriculare', 'categorie_vehicul',
      'masa_maxima_autorizata_t', 'masa_totala_t', 'masa_maxima_tehnic_admisibila_t',
      'numar_axe', 'norma_euro', 'combustibil', 'dimensiuni', 'status', 'observatii',
    ],
  },
  Cursa: {
    table: 'curse',
    ownerScoped: true,
    jsonFields: ['localitati_traseu', 'surse_snapshot'],
    writable: [
      'nume_cursa', 'vehicul_id', 'origine', 'destinatie', 'localitati_traseu', 'data_calcul',
      'data_deplasare', 'masa_utilizata_t', 'tip_masa_utilizata', 'durata_estimata', 'distanta_km',
      'total_taxare_confirmata', 'total_costuri_neconfirmate', 'total_estimare', 'moneda_rezultat',
      'status_calcul', 'surse_snapshot', 'observatii',
    ],
  },
  CursaTaxa: {
    table: 'curse_taxe',
    ownerScoped: true,
    jsonFields: [],
    writable: [
      'cursa_id', 'taxa_id', 'localitate_id', 'zona_id', 'denumire_regula_snapshot',
      'categorie_snapshot', 'valoare_snapshot', 'moneda_snapshot', 'unitate_tarifare_snapshot',
      'status_incredere_snapshot', 'cantitate_aplicata', 'cost_calculat', 'status_calcul',
      'motiv_status', 'sursa_url_snapshot', 'data_verificare_snapshot',
    ],
  },
  Alerta: {
    table: 'alerte',
    ownerScoped: false,
    jsonFields: [],
    writable: [
      'localitate_id', 'taxa_id', 'sursa_act_id', 'tip_alerta', 'titlu', 'descriere',
      'severitate', 'data_generare', 'data_scadenta', 'status', 'responsabil', 'observatii', 'este_demo',
    ],
  },
};

const DATE_ONLY = new Set([
  'ultima_verificare', 'urmatoarea_verificare', 'valabil_de', 'valabil_pana',
  'data_verificare_geometrie', 'data_act', 'data_publicare', 'data_intrare_vigoare',
  'data_expirare', 'data_verificare', 'perioada_valabilitate_start', 'perioada_valabilitate_end',
  'data_sursa', 'data_deplasare', 'data_verificare_snapshot', 'data_scadenta',
]);

function formatDateOnly(val) {
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  if (!(val instanceof Date) || Number.isNaN(val.getTime())) return val;
  const y = val.getFullYear();
  const m = String(val.getMonth() + 1).padStart(2, '0');
  const d = String(val.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function serializeRow(row, entityName) {
  if (!row) return row;
  const cfg = ENTITY_MAP[entityName];
  const out = { ...row };
  if (out.created_at) out.created_date = out.created_at;
  if (out.updated_at) out.updated_date = out.updated_at;
  delete out.password_hash;
  delete out.otp_code_hash;
  delete out.otp_expires_at;
  delete out.reset_token_hash;
  delete out.reset_expires_at;
  delete out.invite_token_hash;

  if (cfg?.publicFields) {
    for (const key of Object.keys(out)) {
      if (!cfg.publicFields.includes(key) && key !== 'created_date' && key !== 'updated_date') {
        delete out[key];
      }
    }
  }

  for (const key of Object.keys(out)) {
    const val = out[key];
    if (val instanceof Date) {
      out[key] = DATE_ONLY.has(key) ? formatDateOnly(val) : val.toISOString();
    } else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val) && DATE_ONLY.has(key)) {
      out[key] = formatDateOnly(val);
    } else if (typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val) &&
      (key.includes('_t') || key.includes('lat') || key.includes('long') || key.includes('valoare') ||
        key.includes('total_') || key.includes('cost_') || key.includes('masa_') || key.includes('distanta') ||
        key === 'an_fiscal' || key === 'numar_axe' || key === 'cantitate_aplicata')) {
      out[key] = Number(val);
    }
  }
  return out;
}

export function parseOrder(sort) {
  if (!sort || typeof sort !== 'string') return 'created_at DESC';
  const desc = sort.startsWith('-');
  let col = desc ? sort.slice(1) : sort;
  if (col === 'created_date') col = 'created_at';
  if (col === 'updated_date') col = 'updated_at';
  if (!/^[a-z0-9_]+$/i.test(col)) return 'created_at DESC';
  return `${col} ${desc ? 'DESC' : 'ASC'}`;
}

export function pickWritable(cfg, data) {
  const allowed = new Set(cfg.writable);
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (!allowed.has(k) || v === undefined) continue;
    if (cfg.jsonFields?.includes(k) && v && typeof v === 'object') {
      out[k] = JSON.stringify(v);
    } else {
      out[k] = v === '' ? null : v;
    }
  }
  return out;
}

/**
 * Translate Mongo-style entity filters into SQL WHERE clauses.
 * Supports: equality, null, $ne, $in, $and, nested objects of operators.
 */
export function buildFilterClauses(filters, { allowedKeys, startIndex = 1 }) {
  const clauses = [];
  const params = [];
  let i = startIndex;

  function pushClause(sql, ...values) {
    let out = sql;
    for (const value of values) {
      out = out.replace('?', `$${i++}`);
      params.push(value);
    }
    clauses.push(out);
  }

  function applyField(key, value) {
    if (!allowedKeys.has(key)) return;
    if (value === null) {
      pushClause(`${key} IS NULL`);
      return;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (Object.prototype.hasOwnProperty.call(value, '$ne')) {
        if (value.$ne === null) pushClause(`${key} IS NOT NULL`);
        else pushClause(`${key} IS DISTINCT FROM ?`, value.$ne);
        return;
      }
      if (Object.prototype.hasOwnProperty.call(value, '$in') && Array.isArray(value.$in)) {
        if (value.$in.length === 0) {
          pushClause('FALSE');
          return;
        }
        const placeholders = value.$in.map(() => '?').join(', ');
        let sql = `${key} IN (${placeholders})`;
        for (const v of value.$in) {
          sql = sql.replace('?', `$${i++}`);
          params.push(v);
        }
        clauses.push(sql);
        return;
      }
      return;
    }
    pushClause(`${key} = ?`, value);
  }

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.$and)) {
      for (const part of node.$and) walk(part);
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === '$and') continue;
      applyField(key, value);
    }
  }

  walk(filters || {});
  return { clauses, params, nextIndex: i };
}

export function decodeCursor(cursor) {
  if (!cursor) return 0;
  try {
    const raw = Buffer.from(String(cursor), 'base64url').toString('utf8');
    const n = Number(JSON.parse(raw).o);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function encodeCursor(offset) {
  return Buffer.from(JSON.stringify({ o: offset }), 'utf8').toString('base64url');
}

export function projectFields(rows, fields) {
  if (!Array.isArray(fields) || fields.length === 0) return rows;
  const keys = new Set(['id', ...fields]);
  return rows.map((row) => {
    const out = {};
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(row, key)) out[key] = row[key];
    }
    return out;
  });
}
