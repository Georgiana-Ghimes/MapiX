/**
 * Importă din research xlsx localitățile care NU sunt „confirmate din act”
 * (+ tarifele lor cu încredere nesigură), ca să populeze coada
 * „Verificări necesare”. Nu atinge localitățile deja Confirmate.
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

function firstUrl(s) {
  const m = String(s || '').match(/https?:\/\/[^\s;]+/i);
  return m ? m[0].replace(/[.,;)]+$/, '') : null;
}

function slugify(judet, nume) {
  return `${judet}-${nume}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function mapStatusLocal(statusXlsx) {
  const s = String(statusXlsx || '');
  if (/confirmate din act/i.test(s)) {
    return { acoperire: 'Verificată', reglementare: 'Taxă confirmată' };
  }
  if (/de confirmat/i.test(s)) {
    return { acoperire: 'În cercetare', reglementare: 'De verificat' };
  }
  if (/proiect/i.test(s)) {
    return { acoperire: 'În cercetare', reglementare: 'Proiect' };
  }
  if (/Taxa există.*negăsite|sume negăsite/i.test(s)) {
    return { acoperire: 'Parțial acoperită', reglementare: 'Autorizație fără taxă confirmată' };
  }
  if (/Doar restricții/i.test(s)) {
    return { acoperire: 'Parțial acoperită', reglementare: 'Interdicție confirmată' };
  }
  if (/Negăsit/i.test(s)) {
    return { acoperire: 'Neîncepută', reglementare: 'Date indisponibile' };
  }
  return { acoperire: 'În cercetare', reglementare: 'De verificat' };
}

function mapIncredereTarif(raw) {
  const s = String(raw || '').toLowerCase();
  if (/confirmat din act/.test(s)) return 'Confirmat'; // nu ar trebui să ajungă aici pentru queue
  if (/proiect/.test(s)) return 'Proiect';
  if (/secundar|neconfirmat|presă|agregator/.test(s)) return 'De confirmat';
  if (/negăsit/.test(s)) return 'Negăsit';
  return 'De confirmat';
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
  if (t === 'abonament' || t === 'trimestru' || t === 'săptămână') {
    return { tip_taxa: 'Altul', unitate: 'Altul', categorie: 'Taxă de acces' };
  }
  if (t === 'negăsit') return { tip_taxa: 'Altul', unitate: 'Altul', categorie: 'Taxă de acces', skipValue: true };
  return null;
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
    if (!nume || status === SAFE_STATUS) continue;
    localities.push({
      judet,
      nume,
      status,
      act: String(cell(row, 7) || ''),
      obtine: String(cell(row, 8) || ''),
      contact: String(cell(row, 9) || ''),
      lipsa: String(cell(row, 10) || ''),
      sursa: String(cell(row, 11) || ''),
      exemplu: String(cell(row, 5) || ''),
    });
  }

  const keys = new Set(localities.map((l) => `${l.judet}::${l.nume}`));
  console.log(`Queue localities (not act-confirmed): ${localities.length}`);

  const tariffs = [];
  for (let r = 2; r <= tarSheet.rowCount; r++) {
    const row = tarSheet.getRow(r);
    const judet = String(cell(row, 1) || '');
    const nume = String(cell(row, 2) || '');
    if (!keys.has(`${judet}::${nume}`)) continue;
    const confRaw = String(cell(row, 16) || '');
    // Skip rows already act-confirmed (shouldn't be in these locs often)
    if (/confirmat din act/i.test(confRaw)) continue;
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
      value: mapped.skipValue ? null : numOrNull(cell(row, 8)),
      currency: String(cell(row, 9) || 'RON') || 'RON',
      howToObtain: String(cell(row, 12) || '') || null,
      sourceUrl: firstUrl(cell(row, 17)),
      incredere: mapIncredereTarif(confRaw),
      observations: String(cell(row, 18) || '') || null,
    });
  }
  console.log(`Uncertain tariff rows: ${tariffs.length}`);

  const createdBy = await adminId();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locIds = new Map();
    let nLoc = 0;
    let nTax = 0;
    let skipped = 0;

    for (const l of localities) {
      const key = `${l.judet}::${l.nume}`;
      const existing = await client.query(
        `SELECT id, status_acoperire FROM localitati WHERE judet = $1 AND nume = $2 LIMIT 1`,
        [l.judet, l.nume],
      );
      if (existing.rows[0]) {
        // Nu rescriem localități deja Verificate (lotul sigur)
        if (existing.rows[0].status_acoperire === 'Verificată' && !FORCE) {
          skipped++;
          locIds.set(key, existing.rows[0].id);
          continue;
        }
        if (FORCE) {
          await client.query(`DELETE FROM taxe_acces WHERE localitate_id = $1 AND incredere IS DISTINCT FROM 'Confirmat'`, [
            existing.rows[0].id,
          ]);
        }
        locIds.set(key, existing.rows[0].id);
        skipped++;
        continue;
      }

      const mapped = mapStatusLocal(l.status);
      const tip =
        /municipiu|reședinț/i.test(l.lipsa) || l.judet !== 'Ilfov' ? 'Municipiu' : 'Comună';
      const tipFix =
        ['Afumați', 'Chiajna', 'Corbeanca', 'Brănești', 'Jilava', 'Cernica'].includes(l.nume)
          ? 'Comună'
          : ['Buftea', 'Bragadiru', 'Otopeni', 'Voluntari', 'Popești-Leordeni', 'Măgurele', 'Pantelimon', 'Chitila'].includes(
                l.nume,
              )
            ? 'Oraș'
            : tip;

      const descriere = [
        `Status research: ${l.status}`,
        l.exemplu ? `Exemplu: ${l.exemplu}` : null,
        l.lipsa ? `Lipsește: ${l.lipsa}` : null,
        l.obtine ? `Obținere: ${l.obtine}` : null,
        'Import coadă research — de confirmat / de sunat. Nu e Confirmat din act.',
      ]
        .filter(Boolean)
        .join('\n')
        .slice(0, 4000);

      const ins = await client.query(
        `INSERT INTO localitati (
          nume, slug, judet, tip_localitate, prioritate, status_acoperire, status_reglementare,
          descriere, este_demo, created_by_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,$9)
        RETURNING id`,
        [
          l.nume,
          slugify(l.judet, l.nume),
          l.judet,
          tipFix,
          l.judet === 'Ilfov' || l.nume === 'București' ? 'P1' : 'P2',
          mapped.acoperire,
          mapped.reglementare,
          descriere,
          createdBy,
        ],
      );
      locIds.set(key, ins.rows[0].id);
      nLoc++;

      const docUrl = firstUrl(l.sursa);
      if (docUrl || l.act) {
        await client.query(
          `INSERT INTO surse_act (
            localitate_id, an_fiscal, tip_act, titlu_document, document_url,
            data_verificare, status_act, note_verificare, este_demo, created_by_id
          ) VALUES ($1, 2026, 'Alt document oficial', $2, $3, NULL, 'De reverificat', $4, FALSE, $5)`,
          [
            ins.rows[0].id,
            (l.act || `Sursă research — ${l.nume}`).slice(0, 240),
            docUrl,
            'Import coadă: de confirmat cu primăria / HCL.',
            createdBy,
          ],
        );
      }
    }

    for (const t of tariffs) {
      const key = `${t.judet}::${t.nume}`;
      const locId = locIds.get(key);
      if (!locId) continue;

      // Nu insera dacă localitatea e Verificată (lot sigur) — doar pe coadă
      const loc = await client.query(`SELECT status_acoperire FROM localitati WHERE id = $1`, [locId]);
      if (loc.rows[0]?.status_acoperire === 'Verificată') continue;

      let zonaId = null;
      if (t.zone) {
        const z = await client.query(
          `SELECT id FROM zone WHERE localitate_id = $1 AND nume_zona = $2 LIMIT 1`,
          [locId, t.zone],
        );
        if (z.rows[0]) zonaId = z.rows[0].id;
        else {
          const zin = await client.query(
            `INSERT INTO zone (localitate_id, nume_zona, tip_zona, status_geometrie, este_demo, created_by_id)
             VALUES ($1,$2,'Reglementată','Neverificată',FALSE,$3) RETURNING id`,
            [locId, t.zone, createdBy],
          );
          zonaId = zin.rows[0].id;
        }
      }

      const denumire = [t.zone, t.massCategory || 'MTMA', t.feeRaw].filter(Boolean).join(' · ').slice(0, 200);
      const moneda =
        t.mapped.moneda || (t.currency === 'RON' || t.currency === 'EUR' ? t.currency : 'RON');

      await client.query(
        `INSERT INTO taxe_acces (
          localitate_id, zona_id, denumire_regula, categorie_regula,
          masa_min_t, masa_max_t, tip_masa, tip_taxa, valoare, moneda, unitate_tarifare,
          cum_se_obtine, sursa_url, data_verificare, incredere, status, observatii,
          este_demo, created_by_id
        ) VALUES (
          $1,$2,$3,$4,$5,$6,'MTMA',$7,$8,$9,$10,$11,$12,NULL,$13,'Ciornă',$14,FALSE,$15
        )`,
        [
          locId,
          zonaId,
          denumire,
          t.mapped.categorie,
          t.massMin,
          t.massMax,
          t.mapped.tip_taxa,
          t.mapped.tip_taxa === 'Gratuit' || t.mapped.tip_taxa === 'Interzis' ? null : t.value,
          moneda,
          t.mapped.unitate,
          t.howToObtain,
          t.sourceUrl,
          t.incredere,
          t.observations || `Import coadă research (${t.incredere}).`,
          createdBy,
        ],
      );
      nTax++;
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({ localitiesInserted: nLoc, localitiesSkippedExisting: skipped, uncertainTariffs: nTax }, null, 2));
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
