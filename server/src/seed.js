import './loadEnv.js';
import bcrypt from 'bcryptjs';
import { pool, query } from './db.js';

async function seed() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@mapix.local').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'admin12345';
  const existing = await query(`SELECT id FROM users WHERE LOWER(email) = $1`, [email]);
  if (existing.rows[0]) {
    console.log(`Admin already exists: ${email}`);
    return;
  }
  const password_hash = await bcrypt.hash(password, 10);
  await query(
    `INSERT INTO users (email, password_hash, role, full_name, email_verified_at, nume_organizatie)
     VALUES ($1, $2, 'admin', 'Administrator MapiX', NOW(), 'MapiX')`,
    [email, password_hash]
  );
  console.log(`Seeded admin ${email} / ${password}`);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
