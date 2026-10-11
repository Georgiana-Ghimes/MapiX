# MapiX

Aplicație pentru evidența taxelor de acces pe localități, cu backend Express + PostgreSQL.

## Prerequisites

1. Node.js 20+
2. PostgreSQL (aceeași instanță ca Transitix merge: `postgres` / `password` pe `localhost:5432`)

## Setup

```bash
# Frontend
npm install

# Backend
npm install --prefix server
```

Creează baza (o singură dată):

```bash
psql postgresql://postgres:password@localhost:5432/postgres -c "CREATE DATABASE mapix;"
```

Credențialele API sunt în `server/.env` (vezi `server/.env.example`).

## Run locally

În două terminale:

```bash
npm run dev:server   # API pe http://127.0.0.1:3003
npm run dev          # Vite pe http://127.0.0.1:5173 (proxy /api → 3003)
```

Sau ambele într-un singur terminal:

```bash
npm run dev:all
```

Seed admin (opțional):

```bash
npm run db:seed
```

Implicit: `admin@mapix.local` / `admin12345`

Import date research (xlsx în `data/research/` — până avem DB partajat):

```bash
npm run db:import-safe    # doar confirmate din act
npm run db:import-queue   # restul → coada „Verificări necesare”
```

Detalii: [`data/research/README.md`](./data/research/README.md).

La înregistrare, codul OTP este afișat în consola serverului.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Frontend Vite |
| `npm run dev:server` | API + migrări |
| `npm run db:create` | Creează baza `mapix` dacă lipsește |
| `npm run db:migrate` | Doar migrări |
| `npm run db:seed` | Cont admin |
| `npm run build` | Build producție frontend |
| `npm run lint` | ESLint |

## Date

Schema și datele stau în PostgreSQL (`mapix` pe `localhost:5432`, user `postgres` / parola ca în Transitix).

Dacă ai date încă pe platforma Base44 (cloud), exportă-le separat (CSV din Setări sau din dashboard) și importă-le în MapiX — local Base44 ținea datele doar în memorie.
