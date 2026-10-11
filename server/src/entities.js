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
  // Coada de verificare: fără dată first, apoi cele mai vechi
  if (col === 'data_verificare' && !desc) return `${col} ASC NULLS FIRST`;
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
 * Supports: equality, null, $ne, $in, $exists, $regex(+ $options i), $lt/$lte/$gt/$gte, $and, $or.
 */
export function buildFilterClauses(filters, { allowedKeys, startIndex = 1 }) {
  const params = [];
  let i = startIndex;

  function ph(value) {
    params.push(value);
    return `$${i++}`;
  }

  function fieldClause(key, value) {
    if (!allowedKeys.has(key)) return null;
    if (value === null) return `${key} IS NULL`;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (Object.prototype.hasOwnProperty.call(value, '$ne')) {
        if (value.$ne === null) return `${key} IS NOT NULL`;
        return `${key} IS DISTINCT FROM ${ph(value.$ne)}`;
      }
      if (Object.prototype.hasOwnProperty.call(value, '$in') && Array.isArray(value.$in)) {
        if (value.$in.length === 0) return 'FALSE';
        return `${key} IN (${value.$in.map((v) => ph(v)).join(', ')})`;
      }
      if (Object.prototype.hasOwnProperty.call(value, '$exists')) {
        return value.$exists ? `${key} IS NOT NULL` : `${key} IS NULL`;
      }
      if (Object.prototype.hasOwnProperty.call(value, '$regex')) {
        const raw = String(value.$regex ?? '');
        const escaped = raw
          .replace(/\\/g, '\\\\')
          .replace(/%/g, '\\%')
          .replace(/_/g, '\\_');
        const like = `%${escaped}%`;
        const insensitive = String(value.$options || '').includes('i');
        return insensitive
          ? `${key} ILIKE ${ph(like)} ESCAPE '\\'`
          : `${key} LIKE ${ph(like)} ESCAPE '\\'`;
      }
      const parts = [];
      if (Object.prototype.hasOwnProperty.call(value, '$lt')) parts.push(`${key} < ${ph(value.$lt)}`);
      if (Object.prototype.hasOwnProperty.call(value, '$lte')) parts.push(`${key} <= ${ph(value.$lte)}`);
      if (Object.prototype.hasOwnProperty.call(value, '$gt')) parts.push(`${key} > ${ph(value.$gt)}`);
      if (Object.prototype.hasOwnProperty.call(value, '$gte')) parts.push(`${key} >= ${ph(value.$gte)}`);
      if (parts.length) return parts.join(' AND ');
      return null;
    }
    return `${key} = ${ph(value)}`;
  }

  function nodeClause(node) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return null;

    if (Array.isArray(node.$and)) {
      const parts = node.$and.map(nodeClause).filter(Boolean);
      return parts.length ? `(${parts.join(' AND ')})` : null;
    }
    if (Array.isArray(node.$or)) {
      const parts = node.$or.map(nodeClause).filter(Boolean);
      return parts.length ? `(${parts.join(' OR ')})` : null;
    }

    const parts = [];
    for (const [key, value] of Object.entries(node)) {
      if (key === '$and' || key === '$or') {
        const nested = nodeClause({ [key]: value });
        if (nested) parts.push(nested);
        continue;
      }
      const clause = fieldClause(key, value);
      if (clause) parts.push(clause);
    }
    if (!parts.length) return null;
    return parts.length === 1 ? parts[0] : `(${parts.join(' AND ')})`;
  }

  const sql = nodeClause(filters || {});
  return { clauses: sql ? [sql] : [], params, nextIndex: i };
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
