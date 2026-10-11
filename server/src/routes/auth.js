import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { authRequired, signAccessToken } from '../middleware/auth.js';
import { serializeRow } from '../entities.js';

const router = Router();

function hashToken(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function otpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function publicUser(row) {
  return serializeRow(row, 'User');
}

function signupEnabled() {
  return String(process.env.ALLOW_SIGNUP ?? 'true').trim().toLowerCase() !== 'false';
}

async function findByEmail(email) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) return null;
  const res = await query(`SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1`, [clean]);
  return res.rows[0] || null;
}

router.get('/public-settings', (_req, res) => {
  res.json({
    id: 'mapix',
    public_settings: {
      app_name: 'MapiX',
      auth_required: true,
      allow_signup: signupEnabled(),
    },
  });
});

router.get('/me', authRequired, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM users WHERE id = $1`, [req.user.id]);
    if (!result.rows[0] || !result.rows[0].is_active) {
      return res.status(401).json({ message: 'Utilizator invalid.' });
    }
    res.json(publicUser(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Nu am putut încărca profilul.' });
  }
});

router.patch('/me', authRequired, async (req, res) => {
  try {
    const allowed = [
      'full_name', 'nume_organizatie', 'cui', 'adresa_organizatie',
      'telefon_organizatie', 'email_organizatie', 'moneda_implicita', 'criteriu_masa_implicit',
    ];
    const sets = [];
    const params = [];
    let i = 1;
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
        sets.push(`${key} = $${i++}`);
        params.push(req.body[key] === '' ? null : req.body[key]);
      }
    }
    if (sets.length === 0) {
      const current = await query(`SELECT * FROM users WHERE id = $1`, [req.user.id]);
      return res.json(publicUser(current.rows[0]));
    }
    sets.push('updated_at = NOW()');
    params.push(req.user.id);
    const result = await query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    );
    res.json(publicUser(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Nu am putut salva profilul.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const user = await findByEmail(email);
    if (!user?.password_hash || !user.is_active) {
      return res.status(401).json({ message: 'Email sau parolă invalidă.' });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Email sau parolă invalidă.' });
    if (!user.email_verified_at) {
      return res.status(403).json({ message: 'Confirmă adresa de email înainte de autentificare.' });
    }
    const access_token = signAccessToken(user);
    res.json({ access_token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Autentificarea a eșuat.' });
  }
});

router.post('/register', async (req, res) => {
  try {
    if (!signupEnabled()) {
      return res.status(403).json({ message: 'Înregistrarea este dezactivată.' });
    }
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ message: 'Email valid și parolă de minim 8 caractere.' });
    }
    const existing = await findByEmail(email);
    if (existing?.email_verified_at) {
      return res.status(409).json({ message: 'Există deja un cont cu acest email.' });
    }
    const code = otpCode();
    const password_hash = await bcrypt.hash(password, 10);
    const otp_code_hash = hashToken(code);
    if (existing) {
      await query(
        `UPDATE users
         SET password_hash = $1, otp_code_hash = $2, otp_expires_at = NOW() + INTERVAL '30 minutes',
             updated_at = NOW()
         WHERE id = $3`,
        [password_hash, otp_code_hash, existing.id]
      );
    } else {
      const count = await query(`SELECT COUNT(*)::int AS c FROM users`);
      const role = count.rows[0].c === 0 ? 'admin' : 'user';
      await query(
        `INSERT INTO users (email, password_hash, role, otp_code_hash, otp_expires_at)
         VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 minutes')`,
        [email, password_hash, role, otp_code_hash]
      );
    }
    console.log(`[mapix] OTP for ${email}: ${code}`);
    res.json({ ok: true, message: 'Codul de verificare a fost generat.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Înregistrarea a eșuat.' });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otpCodeValue = String(req.body?.otpCode || req.body?.otp_code || '').trim();
    const user = await findByEmail(email);
    if (!user?.otp_code_hash || !user.otp_expires_at) {
      return res.status(400).json({ message: 'Nu există un cod activ pentru acest email.' });
    }
    if (new Date(user.otp_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ message: 'Codul a expirat. Cere unul nou.' });
    }
    if (user.otp_code_hash !== hashToken(otpCodeValue)) {
      return res.status(400).json({ message: 'Cod invalid.' });
    }
    const updated = await query(
      `UPDATE users
       SET email_verified_at = NOW(), otp_code_hash = NULL, otp_expires_at = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [user.id]
    );
    const access_token = signAccessToken(updated.rows[0]);
    res.json({ access_token, user: publicUser(updated.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Verificarea a eșuat.' });
  }
});

router.post('/resend-otp', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const user = await findByEmail(email);
    if (!user) return res.json({ ok: true });
    const code = otpCode();
    await query(
      `UPDATE users
       SET otp_code_hash = $1, otp_expires_at = NOW() + INTERVAL '30 minutes', updated_at = NOW()
       WHERE id = $2`,
      [hashToken(code), user.id]
    );
    console.log(`[mapix] OTP for ${email}: ${code}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Nu am putut retrimite codul.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const user = await findByEmail(email);
    if (user) {
      const token = crypto.randomBytes(24).toString('hex');
      await query(
        `UPDATE users
         SET reset_token_hash = $1, reset_expires_at = NOW() + INTERVAL '1 hour', updated_at = NOW()
         WHERE id = $2`,
        [hashToken(token), user.id]
      );
      console.log(`[mapix] Password reset for ${email}: ${token}`);
      console.log(`[mapix] Reset URL path: /reset-password?token=${token}`);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Cererea a eșuat.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const resetToken = String(req.body?.resetToken || req.body?.token || '');
    const newPassword = String(req.body?.newPassword || req.body?.password || '');
    if (!resetToken || newPassword.length < 8) {
      return res.status(400).json({ message: 'Token și parolă (min. 8) sunt obligatorii.' });
    }
    const result = await query(
      `SELECT * FROM users
       WHERE reset_token_hash = $1 AND reset_expires_at > NOW()
       LIMIT 1`,
      [hashToken(resetToken)]
    );
    const user = result.rows[0];
    if (!user) return res.status(400).json({ message: 'Link de resetare invalid sau expirat.' });
    const password_hash = await bcrypt.hash(newPassword, 10);
    await query(
      `UPDATE users
       SET password_hash = $1, reset_token_hash = NULL, reset_expires_at = NULL,
           email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW()
       WHERE id = $2`,
      [password_hash, user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Resetarea parolei a eșuat.' });
  }
});

router.post('/invite', authRequired, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Doar administratorii pot invita utilizatori.' });
    }
    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = req.body?.role === 'admin' ? 'admin' : 'user';
    if (!email) return res.status(400).json({ message: 'Email obligatoriu.' });
    const existing = await findByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'Utilizatorul există deja.' });
    }
    const tempPassword = crypto.randomBytes(9).toString('base64url');
    const password_hash = await bcrypt.hash(tempPassword, 10);
    const inserted = await query(
      `INSERT INTO users (email, password_hash, role, email_verified_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [email, password_hash, role]
    );
    console.log(`[mapix] Invite ${email} temporary password: ${tempPassword}`);
    res.status(201).json({ user: publicUser(inserted.rows[0]), temporary_password: tempPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Invitația a eșuat.' });
  }
});

router.post('/google', async (req, res) => {
  res.status(501).json({
    message: 'Autentificarea Google nu este configurată. Folosește email și parolă.',
  });
});

export default router;
