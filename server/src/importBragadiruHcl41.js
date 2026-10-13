/**
 * Import Bragadiru HCL 41/28.02.2025 (regulament tonaj) — Confirmat din act scanat.
 *
 * PDF UI: /docs/bragadiru/HCL-41-28.02.2025-regulament-tonaj.pdf
 * Arhivă: data/research/acts/bragadiru/
 *
 * Usage: node src/importBragadiruHcl41.js
 */
import './loadEnv.js';
import { pool, withTransaction } from './db.js';

const DOC_URL = '/docs/bragadiru/HCL-41-28.02.2025-regulament-tonaj.pdf';
const DATA_VERIFICARE = '2026-10-12';
const DATA_ACT = '2025-02-28';
const START = '2025-02-28';

const CONDITII =
  'Autovehicule și utilaje destinate transportului de materiale de construcții și utilaje speciale aferente (ex. pompe de beton), pe raza orașului Bragadiru.';

const CUM_SE_OBTINE =
  'Plată anticipat (sau în max. 48 h de la transport) la Serviciul Taxe și Impozite Locale — Primăria orașului Bragadiru, Șos. Alexandriei nr. 249. Cont: RO96TREZ42121180250XXXXX · CUI 4992998 · beneficiar PRIMARIA ORAS BRAGADIRU. La plată: MTMA (F1), nr. înmatriculare, data intrării.';

const EXCEPTII =
  'Scutite (art. 4): ambulanțe/ISU/MAPN/MAI/SIE/SRI/SPP în misiune; intervenții rețele utilități; școli de șoferi; intervenții gaze; mărfuri periculoase conform legii; tractări; instituții publice; deszăpezire; animale vii / perisabile; rezidenți și operatori cu sediu pe străzi adiacente / în zona de restricție.';

/** Benzi de masă: „peste X” → min exclusiv față de pragul anterior (motorul folosește m < min / m > max). */
const ZILE = [
  { zile: 1, label: 'zi', tip: 'Pe zi', unitate: 'Per zi' },
  { zile: 7, label: '7 zile', tip: 'Altul', unitate: 'Altul' },
  { zile: 15, label: '15 zile', tip: 'Altul', unitate: 'Altul' },
  { zile: 30, label: '30 zile', tip: 'Altul', unitate: 'Altul' },
  { zile: 90, label: '90 zile', tip: 'Altul', unitate: 'Altul' },
];

const BANDE = [
  {
    key: 'a',
    masaLabel: 'până la 3,5 t inclusiv',
    masa_min_t: 0,
    masa_max_t: 3.5,
    peZi: 0,
    pachete: null, // gratuit
  },
  {
    key: 'b',
    masaLabel: 'peste 3,5 t până la 7,5 t inclusiv',
    masa_min_t: 3.51,
    masa_max_t: 7.5,
    peZi: 80,
    pachete: { 7: 200, 15: 250, 30: 350, 90: 600 },
  },
  {
    key: 'c',
    masaLabel: 'peste 7,5 t până la 16 t inclusiv',
    masa_min_t: 7.51,
    masa_max_t: 16,
    peZi: 100,
    pachete: { 7: 300, 15: 450, 30: 600, 90: 1100 },
  },
  {
    key: 'd',
    masaLabel: 'peste 16 t până la 40 t inclusiv',
    masa_min_t: 16.01,
    masa_max_t: 40,
    peZi: 150,
    pachete: { 7: 500, 15: 800, 30: 1100, 90: 2200 },
  },
  {
    key: 'e',
    masaLabel: 'peste 40 t',
    masa_min_t: 40.01,
    masa_max_t: null,
    peZi: 200,
    pachete: { 7: 700, 15: 1100, 30: 1600, 90: 2100 },
  },
];

function buildReguli() {
  const out = [];
  for (const b of BANDE) {
    for (const z of ZILE) {
      if (z.zile === 1) {
        const gratuit = b.peZi === 0;
        out.push({
          denumire: `Raza orașului · ${b.masaLabel} · ${z.label}`,
          masa_min_t: b.masa_min_t,
          masa_max_t: b.masa_max_t,
          tip_taxa: gratuit ? 'Gratuit' : z.tip,
          unitate: gratuit ? 'Altul' : z.unitate,
          valoare: gratuit ? null : b.peZi,
          observatii: `HCL 41/28.02.2025 art. 2 lit. ${b.key}. Amenzi art. 5. ${EXCEPTII}`,
        });
      } else if (b.pachete) {
        out.push({
          denumire: `Raza orașului · ${b.masaLabel} · ${z.label}`,
          masa_min_t: b.masa_min_t,
          masa_max_t: b.masa_max_t,
          tip_taxa: z.tip,
          unitate: z.unitate,
          valoare: b.pachete[z.zile],
          observatii: `HCL 41/28.02.2025 art. 3 — plată anticipată ${z.label}. Art. 2 lit. ${b.key}.`,
        });
      }
    }
  }
  return out;
}

async function main() {
  const reguli = buildReguli();
  console.log(`Prepared ${reguli.length} tariff rows for Bragadiru.`);

  await withTransaction(async (client) => {
    const loc = await client.query(
      `SELECT id FROM localitati WHERE nume = 'Bragadiru' AND judet = 'Ilfov' AND archived IS DISTINCT FROM TRUE LIMIT 1`
    );
    if (!loc.rows[0]) throw new Error('Localitatea Bragadiru (Ilfov) nu există în DB. Rulează mai întâi db:import-queue.');
    const locId = loc.rows[0].id;
    const admin = await client.query(`SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`);
    const createdBy = admin.rows[0]?.id || null;

    // Curăță stub-urile de pe coadă pentru Bragadiru
    await client.query(`DELETE FROM taxe_acces WHERE localitate_id = $1`, [locId]);
    await client.query(`DELETE FROM zone WHERE localitate_id = $1`, [locId]);
    await client.query(`DELETE FROM surse_act WHERE localitate_id = $1`, [locId]);

    await client.query(
      `UPDATE localitati SET
         status_acoperire = 'Verificată',
         status_reglementare = 'Taxă confirmată',
         prioritate = 'P1',
         descriere = $2,
         ultima_verificare = $3,
         updated_at = NOW()
       WHERE id = $1`,
      [
        locId,
        'HCL nr. 41/28.02.2025 — regulament tonaj (anexă). Obținut prin apel Primăria Bragadiru / Poliția Locală. PDF în platformă: /docs/bragadiru/HCL-41-28.02.2025-regulament-tonaj.pdf. Înlocuiește HCL 18/23.02.2023.',
        DATA_VERIFICARE,
      ]
    );

    const sursa = await client.query(
      `INSERT INTO surse_act (
         localitate_id, an_fiscal, tip_act, numar_act, data_act, titlu_document,
         document_url, data_publicare, data_intrare_vigoare, data_verificare,
         status_act, note_verificare, responsabil_verificare, este_demo, created_by_id
       ) VALUES (
         $1, 2025, 'HCL', '41', $2,
         'Regulament privind asigurarea fluenței și siguranței traficului — taxa de tonaj (anexă HCL 41/2025)',
         $3, $2, $2, $4,
         'Actual',
         'Scan oficial (Poliția Locală Bragadiru). Verificat manual din PDF; text OCR indisponibil (scan). Cont trezorerie pe ultima pagină (ultimele cifre mascate pe copie).',
         'Import HCL 41/2025',
         FALSE, $5
       ) RETURNING id`,
      [locId, DATA_ACT, DOC_URL, DATA_VERIFICARE, createdBy]
    );
    const actId = sursa.rows[0].id;

    const zona = await client.query(
      `INSERT INTO zone (
         localitate_id, nume_zona, tip_zona, descriere, status_geometrie,
         sursa_geometrie_url, este_demo, created_by_id
       ) VALUES (
         $1,
         'Raza orașului Bragadiru',
         'Taxată',
         'Întreaga rază a orașului Bragadiru (Ilfov), conform regulament anexă HCL 41/28.02.2025. Nu există listă separată de străzi în anexă — taxa se aplică pe raza localității. Excepție rezidenți/operatori cu sediu pe străzi adiacente sau în zona de restricție (art. 4 pct. 10).',
         'Neverificată',
         $2,
         FALSE, $3
       ) RETURNING id`,
      [locId, DOC_URL, createdBy]
    );
    const zonaId = zona.rows[0].id;

    let n = 0;
    for (const r of reguli) {
      await client.query(
        `INSERT INTO taxe_acces (
           localitate_id, zona_id, denumire_regula, categorie_regula,
           masa_min_t, masa_max_t, tip_masa, tip_taxa, valoare, moneda, unitate_tarifare,
           perioada_valabilitate_start, perioada_valabilitate_end,
           conditii_vehicul, exceptii, cum_se_obtine,
           act_normativ_id, sursa_url, data_sursa, data_verificare,
           incredere, status, observatii, este_demo, created_by_id
         ) VALUES (
           $1,$2,$3,'Taxă de acces',$4,$5,'MTMA',$6,$7,'RON',$8,
           $9,NULL,$10,$11,$12,$13,$14,$15,$16,
           'Confirmat','Activ',$17,FALSE,$18
         )`,
        [
          locId,
          zonaId,
          r.denumire,
          r.masa_min_t,
          r.masa_max_t,
          r.tip_taxa,
          r.valoare,
          r.unitate,
          START,
          CONDITII,
          EXCEPTII,
          CUM_SE_OBTINE,
          actId,
          DOC_URL,
          DATA_ACT,
          DATA_VERIFICARE,
          r.observatii,
          createdBy,
        ]
      );
      n += 1;
    }

    console.log(`Bragadiru updated: 1 sursă, 1 zonă, ${n} reguli Confirmate.`);
    console.log(`PDF: ${DOC_URL}`);
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
