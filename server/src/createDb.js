import './loadEnv.js';
import pg from 'pg';

const targetUrl = process.env.DATABASE_URL;
if (!targetUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const url = new URL(targetUrl);
const dbName = url.pathname.replace(/^\//, '') || 'mapix';
url.pathname = '/postgres';

const pool = new pg.Pool({ connectionString: url.toString() });

try {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) {
    throw new Error(`Invalid database name: ${dbName}`);
  }
  const exists = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (exists.rowCount === 0) {
    await pool.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Created database ${dbName}`);
  } else {
    console.log(`Database ${dbName} already exists`);
  }
} finally {
  await pool.end();
}
