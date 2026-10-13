import './loadEnv.js';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import { query } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(__dirname, '../../public/docs');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is required. Copy server/.env.example to server/.env');
  process.exit(1);
}

const app = express();

function corsOriginOption() {
  const list = String(process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (list.length <= 1) return list[0] || 'http://localhost:5173';
  return (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalized = String(origin).replace(/\/$/, '');
    if (list.includes(normalized)) return callback(null, origin);
    return callback(new Error('Not allowed by CORS'));
  };
}

app.use(cors({ origin: corsOriginOption(), credentials: true }));
app.use(express.json({ limit: '2mb' }));
// Acte scanate (PDF) — aceleași fișiere ca Vite `public/docs`
app.use('/docs', express.static(docsDir, { fallthrough: true, maxAge: '7d' }));

app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, service: 'mapix-api' });
  } catch (err) {
    res.status(503).json({ ok: false, message: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/entities', entityRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

export default app;
