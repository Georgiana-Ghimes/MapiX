import './loadEnv.js';
import { pool } from './db.js';

const STATEMENTS = [
  `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,
  // Diacritic-insensitive text search (Bucuresti ≈ București) for entity $regex filters
  `CREATE EXTENSION IF NOT EXISTS "unaccent"`,

  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    full_name TEXT,
    nume_organizatie TEXT,
    cui TEXT,
    adresa_organizatie TEXT,
    telefon_organizatie TEXT,
    email_organizatie TEXT,
    moneda_implicita TEXT DEFAULT 'RON',
    criteriu_masa_implicit TEXT DEFAULT 'MTMA',
    email_verified_at TIMESTAMPTZ,
    otp_code_hash TEXT,
    otp_expires_at TIMESTAMPTZ,
    reset_token_hash TEXT,
    reset_expires_at TIMESTAMPTZ,
    invite_token_hash TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS localitati (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nume TEXT NOT NULL,
    slug TEXT,
    judet TEXT,
    tip_localitate TEXT,
    prioritate TEXT DEFAULT 'P3',
    status_acoperire TEXT DEFAULT 'Neîncepută',
    status_reglementare TEXT DEFAULT 'De verificat',
    descriere TEXT,
    latitudine DOUBLE PRECISION,
    longitudine DOUBLE PRECISION,
    ultima_verificare DATE,
    urmatoarea_verificare DATE,
    responsabil TEXT,
    este_demo BOOLEAN NOT NULL DEFAULT FALSE,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS zone (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    localitate_id UUID NOT NULL REFERENCES localitati(id) ON DELETE CASCADE,
    nume_zona TEXT NOT NULL,
    cod_zona TEXT,
    descriere TEXT,
    tip_zona TEXT DEFAULT 'Reglementată',
    geometrie_geojson TEXT,
    centru_latitudine DOUBLE PRECISION,
    centru_longitudine DOUBLE PRECISION,
    valabil_de DATE,
    valabil_pana DATE,
    status_geometrie TEXT DEFAULT 'Neverificată',
    sursa_geometrie_url TEXT,
    data_verificare_geometrie DATE,
    este_demo BOOLEAN NOT NULL DEFAULT FALSE,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS surse_act (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    localitate_id UUID NOT NULL REFERENCES localitati(id) ON DELETE CASCADE,
    an_fiscal INTEGER,
    tip_act TEXT DEFAULT 'Alt document oficial',
    numar_act TEXT,
    data_act DATE,
    titlu_document TEXT NOT NULL,
    document_url TEXT,
    pagina_relevanta TEXT,
    data_publicare DATE,
    data_intrare_vigoare DATE,
    data_expirare DATE,
    data_verificare DATE,
    status_act TEXT DEFAULT 'Necunoscut',
    note_verificare TEXT,
    responsabil_verificare TEXT,
    este_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS taxe_acces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    localitate_id UUID NOT NULL REFERENCES localitati(id) ON DELETE CASCADE,
    zona_id UUID REFERENCES zone(id) ON DELETE SET NULL,
    denumire_regula TEXT NOT NULL,
    categorie_regula TEXT DEFAULT 'Taxă de acces',
    masa_min_t DOUBLE PRECISION,
    masa_max_t DOUBLE PRECISION,
    tip_masa TEXT DEFAULT 'Necunoscut',
    tip_vehicul TEXT,
    tip_taxa TEXT DEFAULT 'Altul',
    valoare DOUBLE PRECISION,
    moneda TEXT DEFAULT 'RON',
    unitate_tarifare TEXT DEFAULT 'Altul',
    perioada_valabilitate_start DATE,
    perioada_valabilitate_end DATE,
    zile_aplicare JSONB DEFAULT '[]'::jsonb,
    ora_start TEXT,
    ora_end TEXT,
    orar_restrictie TEXT,
    conditii_vehicul TEXT,
    exceptii TEXT,
    cum_se_obtine TEXT,
    url_autorizatie TEXT,
    act_normativ_id UUID REFERENCES surse_act(id) ON DELETE SET NULL,
    sursa_url TEXT,
    data_sursa DATE,
    data_verificare DATE,
    incredere TEXT DEFAULT 'De confirmat',
    status TEXT DEFAULT 'Ciornă',
    observatii TEXT,
    este_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS vehicule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nume_intern TEXT NOT NULL,
    numar_inmatriculare TEXT NOT NULL,
    tara_inmatriculare TEXT,
    categorie_vehicul TEXT DEFAULT 'Camion',
    masa_maxima_autorizata_t DOUBLE PRECISION,
    masa_totala_t DOUBLE PRECISION,
    masa_maxima_tehnic_admisibila_t DOUBLE PRECISION,
    numar_axe INTEGER,
    norma_euro TEXT,
    combustibil TEXT,
    dimensiuni TEXT,
    status TEXT DEFAULT 'Activ',
    observatii TEXT,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS curse (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nume_cursa TEXT NOT NULL,
    vehicul_id UUID REFERENCES vehicule(id) ON DELETE SET NULL,
    origine TEXT,
    destinatie TEXT,
    localitati_traseu JSONB DEFAULT '[]'::jsonb,
    data_calcul TIMESTAMPTZ,
    data_deplasare DATE,
    masa_utilizata_t DOUBLE PRECISION,
    tip_masa_utilizata TEXT DEFAULT 'MTMA',
    durata_estimata TEXT,
    distanta_km DOUBLE PRECISION,
    total_taxare_confirmata DOUBLE PRECISION,
    total_costuri_neconfirmate DOUBLE PRECISION,
    total_estimare DOUBLE PRECISION,
    moneda_rezultat TEXT DEFAULT 'Necalculabil',
    status_calcul TEXT DEFAULT 'Neconcludent',
    surse_snapshot JSONB DEFAULT '[]'::jsonb,
    observatii TEXT,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS curse_taxe (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cursa_id UUID NOT NULL REFERENCES curse(id) ON DELETE CASCADE,
    taxa_id UUID REFERENCES taxe_acces(id) ON DELETE SET NULL,
    localitate_id UUID NOT NULL REFERENCES localitati(id) ON DELETE CASCADE,
    zona_id UUID REFERENCES zone(id) ON DELETE SET NULL,
    denumire_regula_snapshot TEXT,
    categorie_snapshot TEXT,
    valoare_snapshot DOUBLE PRECISION,
    moneda_snapshot TEXT,
    unitate_tarifare_snapshot TEXT,
    status_incredere_snapshot TEXT,
    cantitate_aplicata DOUBLE PRECISION,
    cost_calculat DOUBLE PRECISION,
    status_calcul TEXT DEFAULT 'De verificat',
    motiv_status TEXT,
    sursa_url_snapshot TEXT,
    data_verificare_snapshot DATE,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS alerte (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    localitate_id UUID REFERENCES localitati(id) ON DELETE SET NULL,
    taxa_id UUID REFERENCES taxe_acces(id) ON DELETE SET NULL,
    sursa_act_id UUID REFERENCES surse_act(id) ON DELETE SET NULL,
    tip_alerta TEXT DEFAULT 'Verificare necesară',
    titlu TEXT NOT NULL,
    descriere TEXT,
    severitate TEXT DEFAULT 'Medie',
    data_generare TIMESTAMPTZ DEFAULT NOW(),
    data_scadenta DATE,
    status TEXT DEFAULT 'Nouă',
    responsabil TEXT,
    observatii TEXT,
    este_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_localitati_nume ON localitati (nume)`,
  `CREATE INDEX IF NOT EXISTS idx_zone_localitate ON zone (localitate_id)`,
  `CREATE INDEX IF NOT EXISTS idx_taxe_localitate ON taxe_acces (localitate_id)`,
  `CREATE INDEX IF NOT EXISTS idx_surse_localitate ON surse_act (localitate_id)`,
  `CREATE INDEX IF NOT EXISTS idx_alerte_status ON alerte (status)`,
  `CREATE INDEX IF NOT EXISTS idx_vehicule_owner ON vehicule (created_by_id)`,
  `CREATE INDEX IF NOT EXISTS idx_curse_owner ON curse (created_by_id)`,
];

async function migrate() {
  const client = await pool.connect();
  try {
    for (const sql of STATEMENTS) {
      await client.query(sql);
    }
    console.log('MapiX migrations applied.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
