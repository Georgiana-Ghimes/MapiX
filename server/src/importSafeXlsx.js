/**
 * Importă din research xlsx doar localitățile cu status
 * „Sume găsite, confirmate din act” + tarifele cu încredere
 * „confirmat din actul oficial”. Idempotent: --force șterge
 * datele non-demo ale acestor localități înainte de reimport.
 */
import './loadEnv.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { pool, query } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FORCE = process.argv.includes('--force');

const DEFAULT_XLSX = path.resolve(
  __dirname,
  '../../data/research/Taxe_acces_camioane_Romania.xlsx',
);
const XLSX = process.env.MAPIX_XLSX || DEFAULT_XLSX;

const SAFE_STATUS = 'Sume găsite, confirmate din act';
const SAFE_CONF = /confirmat din act/i;

const COORDS = {
  'București::București': [44.4268, 26.1025],
  'Ilfov::Afumați': [44.525, 26.252],
  'Ilfov::Buftea': [44.563, 25.949],
  'Ilfov::Chiajna': [44.459, 25.978],
  'Arad::Arad': [46.1866, 21.3123],
  'Bihor::Oradea': [47.0465, 21.9189],
  'Botoșani::Botoșani': [47.7486, 26.6623],
  'Brașov::Brașov': [45.6579, 25.6012],
  'Brăila::Brăila': [45.2692, 27.9575],
  'Covasna::Sfântu Gheorghe': [45.8636, 25.7875],
  'Harghita::Miercurea Ciuc': [46.3597, 25.8039],
  'Mureș::Târgu Mureș': [46.5386, 24.5519],
  'Satu Mare::Satu Mare': [47.799, 22.892],
  'Vrancea::Focșani': [45.6967, 27.1842],
};

const TIP_LOC = {
  București: 'Municipiu',
  Afumați: 'Comună',
  Buftea: 'Oraș',
  Chiajna: 'Comună',
};

function cell(row, c) {
  let v = row.getCell(c).value;
  if (v && typeof v === 'object') {
    if ('text' in v) v = v.text;
    else if ('richText' in v) v = v.richText.map((t) => t.text).join('');
    else if ('result' in v) v = v.result;
    else if ('hyperlink' in v) v = v.text || v.hyperlink;
  }
  if (v == null) return '';
  if (typeof v === 'number') return v;
  return String(v).trim();
}

function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function mapFeeType(raw) {
  const t = String(raw || '').toLowerCase();
  if (t === 'zi') return { tip_taxa: 'Pe zi', unitate: 'Per zi', categorie: 'Taxă de acces' };
  if (t === 'lună' || t === 'luna') return { tip_taxa: 'Pe lună', unitate: 'Per lună', categorie: 'Taxă de acces' };
  if (t === 'an') return { tip_taxa: 'Pe an', unitate: 'Per an', categorie: 'Taxă de acces' };
  if (t === 'trecere') return { tip_taxa: 'Pe tranzit', unitate: 'Per tranzit', categorie: 'Taxă de acces' };
  if (t === 'fără taxă' || t === 'fara taxa') {
    return { tip_taxa: 'Gratuit', unitate: 'Altul', categorie: 'Exceptare', moneda: 'Fără valoare monetară' };
  }
  if (t === 'interzis') {
    return { tip_taxa: 'Interzis', unitate: 'Altul', categorie: 'Interdicție', moneda: 'Fără valoare monetară' };
  }
  if (t === 'abonament') return { tip_taxa: 'Altul', unitate: 'Per an', categorie: 'Taxă de acces' };
  if (t === 'trimestru') return { tip_taxa: 'Altul', unitate: 'Altul', categorie: 'Taxă de acces' };
  if (t === 'săptămână' || t === 'saptamana') return { tip_taxa: 'Altul', unitate: 'Altul', categorie: 'Taxă de acces' };
  return null; // negăsit / unknown → skip
}

function parseActTitle(act) {
  const s = String(act || '');
  let tip_act = 'Alt document oficial';
  if (/HCGMB/i.test(s)) tip_act = 'HCGMB';
  else if (/HCL/i.test(s)) tip_act = 'HCL';
  else if (/regulament/i.test(s)) tip_act = 'Regulament';
  else if (/hotărâre|hotarare/i.test(s)) tip_act = 'Hotărâre';
  const m = s.match(/(?:nr\.?\s*)?(\d+)\s*\/\s*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}|\d{4})/i);
  return {
    tip_act,
    numar_act: m ? `${m[1]}/${m[2]}` : null,
    titlu: s.slice(0, 240) || 'Act normativ',
  };
}

function firstUrl(s) {
  const m = String(s || '').match(/https?:\/\/[^\s;]+/i);
  return m ? m[0].replace(/[.,;)]+$/, '') : null;
}

function parseDateLoose(s) {
  const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const m2 = String(s || '').match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (m2) {
    const d = m2[1].padStart(2, '0');
    const mo = m2[2].padStart(2, '0');
    return `${m2[3]}-${mo}-${d}`;
  }
  return null;
}

function slugify(judet, nume) {
  return `${judet}-${nume}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function adminId() {
  const r = await query(`SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`);
  return r.rows[0]?.id || null;
}

async function main() {
  console.log(`Reading ${XLSX}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const locSheet = wb.getWorksheet('Localități');
  const tarSheet = wb.getWorksheet('Tarife');
  if (!locSheet || !tarSheet) throw new Error('Lipsesc foile Localități / Tarife');

  const localities = [];
  for (let r = 2; r <= locSheet.rowCount; r++) {
    const row = locSheet.getRow(r);
    const judet = String(cell(row, 1) || '');
    const nume = String(cell(row, 2) || '');
    const status = String(cell(row, 3) || '');
    if (!nume || status !== SAFE_STATUS) continue;
    localities.push({
      judet,
      nume,
      status,
      incredere: String(cell(row, 4) || ''),
      exemplu: String(cell(row, 5) || ''),
      act: String(cell(row, 7) || ''),
      obtine: String(cell(row, 8) || ''),
      contact: String(cell(row, 9) || ''),
      lipsa: String(cell(row, 10) || ''),
      sursa: String(cell(row, 11) || ''),
    });
  }

  const safeKeys = new Set(localities.map((l) => `${l.judet}::${l.nume}`));
  console.log(`Safe localities: ${localities.length}`);

  const tariffs = [];
  for (let r = 2; r <= tarSheet.rowCount; r++) {
    const row = tarSheet.getRow(r);
    const judet = String(cell(row, 1) || '');
    const nume = String(cell(row, 2) || '');
    if (!safeKeys.has(`${judet}::${nume}`)) continue;
    const incredere = String(cell(row, 16) || '');
    if (!SAFE_CONF.test(incredere)) continue;
    const feeRaw = String(cell(row, 7) || '');
    const mapped = mapFeeType(feeRaw);
    if (!mapped) continue;
    tariffs.push({
      judet,
      nume,
      zone: String(cell(row, 3) || '') || null,
      massCategory: String(cell(row, 4) || '') || null,
      massMin: numOrNull(cell(row, 5)),
      massMax: numOrNull(cell(row, 6)),
      feeRaw,
      mapped,
      value: numOrNull(cell(row, 8)),
      currency: String(cell(row, 9) || 'RON') || 'RON',
      timeRestriction: String(cell(row, 10) || '') || null,
      otherConditions: String(cell(row, 11) || '') || null,
      howToObtain: String(cell(row, 12) || '') || null,
      legalAct: String(cell(row, 14) || '') || null,
      sourceDate: String(cell(row, 15) || '') || null,
      sourceUrl: firstUrl(cell(row, 17)) || null,
      observations: String(cell(row, 18) || '') || null,
      zoneLimits: String(cell(row, 19) || '') || null,
    });
  }
  console.log(`Safe tariff rows: ${tariffs.length}`);

  const createdBy = await adminId();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (FORCE) {
      for (const l of localities) {
        const existing = await client.query(
          `SELECT id FROM localitati WHERE judet = $1 AND nume = $2 AND este_demo = FALSE`,
          [l.judet, l.nume],
        );
        for (const row of existing.rows) {
          await client.query(`DELETE FROM taxe_acces WHERE localitate_id = $1`, [row.id]);
          await client.query(`DELETE FROM surse_act WHERE localitate_id = $1`, [row.id]);
          await client.query(`DELETE FROM zone WHERE localitate_id = $1`, [row.id]);
          await client.query(`DELETE FROM localitati WHERE id = $1`, [row.id]);
        }
      }
      console.log('Force: cleared previous non-demo rows for safe localities');
    }

    const locIds = new Map();
    const zoneIds = new Map();
    const sourceIds = new Map();
    let nLoc = 0;
    let nZone = 0;
    let nSrc = 0;
    let nTax = 0;
    let skippedExisting = 0;

    for (const l of localities) {
      const key = `${l.judet}::${l.nume}`;
      const existing = await client.query(
        `SELECT id FROM localitati WHERE judet = $1 AND nume = $2 LIMIT 1`,
        [l.judet, l.nume],
      );
      if (existing.rows[0] && !FORCE) {
        locIds.set(key, existing.rows[0].id);
        skippedExisting++;
        continue;
      }

      const [lat, lng] = COORDS[key] || [null, null];
      const tip = TIP_LOC[l.nume] || 'Municipiu';
      const prioritate = l.nume === 'București' || l.judet === 'Ilfov' ? 'P1' : 'P2';
      const descriere = [
        l.exemplu ? `Exemplu: ${l.exemplu}` : null,
        l.obtine ? `Obținere: ${l.obtine}` : null,
        l.contact ? `Contact: ${l.contact}` : null,
        l.lipsa ? `Note: ${l.lipsa}` : null,
        'Import research 10.10.2026 — doar confirmat din act.',
      ]
        .filter(Boolean)
        .join('\n')
        .slice(0, 4000);

      const ins = await client.query(
        `INSERT INTO localitati (
          nume, slug, judet, tip_localitate, prioritate, status_acoperire, status_reglementare,
          descriere, latitudine, longitudine, ultima_verificare, responsabil, este_demo, created_by_id
        ) VALUES ($1,$2,$3,$4,$5,'Verificată','Taxă confirmată',$6,$7,$8,'2026-10-10','Research xlsx',FALSE,$9)
        RETURNING id`,
        [
          l.nume,
          slugify(l.judet, l.nume),
          l.judet,
          tip,
          prioritate,
          descriere,
          lat,
          lng,
          createdBy,
        ],
      );
      locIds.set(key, ins.rows[0].id);
      nLoc++;

      const actMeta = parseActTitle(l.act);
      const docUrl = firstUrl(l.sursa);
      const src = await client.query(
        `INSERT INTO surse_act (
          localitate_id, an_fiscal, tip_act, numar_act, titlu_document, document_url,
          data_verificare, status_act, note_verificare, este_demo, created_by_id
        ) VALUES ($1, 2026, $2, $3, $4, $5, '2026-10-10', 'Actual', $6, FALSE, $7)
        RETURNING id`,
        [
          ins.rows[0].id,
          actMeta.tip_act,
          actMeta.numar_act,
          actMeta.titlu,
          docUrl,
          'Importat din foaia Localități (confirmat din act).',
          createdBy,
        ],
      );
      sourceIds.set(key, src.rows[0].id);
      nSrc++;
    }

    // Ensure source ids for skipped (already present) localities
    for (const l of localities) {
      const key = `${l.judet}::${l.nume}`;
      if (sourceIds.has(key)) continue;
      const locId = locIds.get(key);
      if (!locId) continue;
      const s = await client.query(
        `SELECT id FROM surse_act WHERE localitate_id = $1 ORDER BY created_at ASC LIMIT 1`,
        [locId],
      );
      if (s.rows[0]) sourceIds.set(key, s.rows[0].id);
    }

    // Zones from tariffs
    const zoneKeys = new Set();
    for (const t of tariffs) {
      if (!t.zone) continue;
      zoneKeys.add(`${t.judet}::${t.nume}::${t.zone}`);
    }
    for (const zk of zoneKeys) {
      const [judet, nume, zoneName] = zk.split('::');
      const key = `${judet}::${nume}`;
      const locId = locIds.get(key);
      if (!locId) continue;

      const existing = await client.query(
        `SELECT id FROM zone WHERE localitate_id = $1 AND nume_zona = $2 LIMIT 1`,
        [locId, zoneName],
      );
      if (existing.rows[0]) {
        zoneIds.set(zk, existing.rows[0].id);
        continue;
      }

      let tip_zona = 'Reglementată';
      if (/interzis|tranzit/i.test(zoneName)) tip_zona = 'Interzisă';
      else if (/zonă|zona/i.test(zoneName)) tip_zona = 'Taxată';

      const sample = tariffs.find((t) => t.judet === judet && t.nume === nume && t.zone === zoneName);
      const ins = await client.query(
        `INSERT INTO zone (
          localitate_id, nume_zona, tip_zona, descriere, status_geometrie,
          sursa_geometrie_url, este_demo, created_by_id
        ) VALUES ($1,$2,$3,$4,'Neverificată',$5,FALSE,$6)
        RETURNING id`,
        [
          locId,
          zoneName,
          tip_zona,
          sample?.zoneLimits ? String(sample.zoneLimits).slice(0, 2000) : null,
          sample?.sourceUrl || null,
          createdBy,
        ],
      );
      zoneIds.set(zk, ins.rows[0].id);
      nZone++;
    }

    // Tariffs — skip if locality was already present and not force (avoid dupes)
    if (skippedExisting && !FORCE) {
      console.log(
        `Skip tariff insert: ${skippedExisting} localities already in DB (re-run with --force to replace).`,
      );
    } else {
      for (const t of tariffs) {
        const key = `${t.judet}::${t.nume}`;
        const locId = locIds.get(key);
        if (!locId) continue;
        const zonaId = t.zone ? zoneIds.get(`${t.judet}::${t.nume}::${t.zone}`) : null;
        const actId = sourceIds.get(key) || null;
        const sursaUrl = t.sourceUrl || firstUrl(
          localities.find((l) => l.judet === t.judet && l.nume === t.nume)?.sursa,
        );
        if (!sursaUrl) {
          console.warn(`Skip (no URL): ${key} ${t.massCategory} ${t.feeRaw}`);
          continue;
        }

        const denumire = [t.zone, t.massCategory || 'MTMA', t.feeRaw]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 200);

        const moneda = t.mapped.moneda || (t.currency === 'RON' || t.currency === 'EUR' ? t.currency : 'RON');
        let valoare = t.value;
        if (t.mapped.tip_taxa === 'Gratuit' || t.mapped.tip_taxa === 'Interzis') valoare = null;

        // Validity: prefer 2026 calendar year for confirmed 2026 regimes
        const start = '2026-01-01';
        const end = /2027/.test(t.zone || '') ? null : '2026-12-31';

        await client.query(
          `INSERT INTO taxe_acces (
            localitate_id, zona_id, denumire_regula, categorie_regula,
            masa_min_t, masa_max_t, tip_masa, tip_taxa, valoare, moneda, unitate_tarifare,
            perioada_valabilitate_start, perioada_valabilitate_end,
            orar_restrictie, conditii_vehicul, cum_se_obtine,
            act_normativ_id, sursa_url, data_sursa, data_verificare,
            incredere, status, observatii, este_demo, created_by_id
          ) VALUES (
            $1,$2,$3,$4,$5,$6,'MTMA',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'2026-10-10',
            'Confirmat','Activ',$19,FALSE,$20
          )`,
          [
            locId,
            zonaId,
            denumire,
            t.mapped.categorie,
            t.massMin,
            t.massMax,
            t.mapped.tip_taxa,
            valoare,
            moneda,
            t.mapped.unitate,
            start,
            end,
            t.timeRestriction,
            t.otherConditions,
            t.howToObtain || localities.find((l) => l.judet === t.judet && l.nume === t.nume)?.obtine || null,
            actId,
            sursaUrl,
            parseDateLoose(t.sourceDate),
            [t.observations, t.feeRaw === 'abonament' ? `Tip sursă: ${t.feeRaw}` : null]
              .filter(Boolean)
              .join(' | ')
              .slice(0, 2000) || null,
            createdBy,
          ],
        );
        nTax++;
      }
    }

    await client.query('COMMIT');
    console.log(
      JSON.stringify(
        {
          localitiesInserted: nLoc,
          localitiesAlreadyPresent: skippedExisting,
          sourcesInserted: nSrc,
          zonesInserted: nZone,
          tariffsInserted: nTax,
        },
        null,
        2,
      ),
    );
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
