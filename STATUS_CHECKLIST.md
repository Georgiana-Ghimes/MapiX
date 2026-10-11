# MapiX — checklist status (post-handover CTO)

**Repo canonic:** https://github.com/Georgiana-Ghimes/MapiX  
**Clone local:** `/Users/florin/MapiX-cto`  
**Handover:** [`DOCS/MapiX-MVP-Handover.pdf`](./DOCS/MapiX-MVP-Handover.pdf) (11.10.2026, folder gitignored)  
**Feedback Geo (WhatsApp):** MVP = SPA API internă, nu produs B2B API de vânzare; domeniul/datele sunt valoarea.  
**Research paralel (Adi xlsx + probe):** `/Users/florin/Mapix` — nu e app-ul de produs; e inventar date.

---

## Verdict scurt

| Întrebare | Răspuns |
| --- | --- |
| MVP local funcțional? | **Da** — React/Vite + Express + Postgres, fără Base44 |
| Gata de vânzat ca API B2B? | **Nu** (Geo) — lipsește contract public, multi-tenant real, calc pe backend, deploy |
| Unde e valoarea acum? | Modelul + ecranele + motorul `reguliTaxe` + posibilitatea de a umple DB cu date reale (xlsx research) |
| Pe ce ne concentrăm? | Acest repo CTO; research-ul din `/Users/florin/Mapix` alimentează §11.1 |

---

## A. Ce e deja în picioare (din handover + cod)

| Zonă | Stare | Unde / cum |
| --- | --- | --- |
| Stack propriu (fără Base44) | Done | `src/` + `server/` |
| Auth email/parolă + JWT | Done (dev) | `server/src/routes/auth.js` · OTP/reset în **consolă server** |
| Roluri `admin` / `user` | Done | Admin scrie catalog; user: căutare/curse/vehicule |
| Model: localitate → zonă → sursă/act → taxă | Done | `server/src/migrate.js` |
| Vehicul / cursă + snapshot taxe | Done | tabele `vehicule`, `curse`, `curse_taxe` |
| API entități list/filter/CRUD | Done (intern) | `/api/entities/:Entity` — formă tip Base44, nu contract public |
| Motor reguli / cost / alerte | Done **în frontend** | `src/lib/reguliTaxe.js` (~555 linii) — **nu** e endpoint |
| UI: dashboard, caută taxe, hartă, cost cursă, registre, setări | Done | `src/pages/*` |
| Import/export CSV | Done (UI) | Setări + `src/lib/csv.js` + `ImportCsv.jsx` |
| Seed admin | Done | `npm run db:seed` → `admin@mapix.local` / `admin12345` |
| Seed localități/taxe reale | **Lipsă** | `seed.js` creează doar admin |
| Email real (Resend etc.) | **Lipsă** | doar `console.log` OTP/reset/invite |
| Google login | Stub | buton UI; `loginWithProvider` aruncă eroare; `GOOGLE_CLIENT_ID` în `.env.example` |
| Docker / deploy docs | **Lipsă** | nici Docker, nici CI în repo |
| Teste API | **Lipsă** | zero suite test |
| Multi-tenant / org + flotă privată | **Parțial / fals** | câmpuri `nume_organizatie` pe **user**; catalog localități/taxe **global partajat** |
| Sync automată surse oficiale | **Lipsă** | date manual / CSV |
| Curs BNR RON↔EUR | **Lipsă** | monede tratate separat în UI |

---

## B. Feedback Geo — ce înseamnă pentru noi

| Punct Geo | Implicație | Status acum |
| --- | --- | --- |
| Nu e gata ca produs API B2B | Nu vindem `/api/entities` ca integrare TMS | Notat — viitor (Loki) |
| Domeniul + datele merită bani | Prioritate: catalog HCL-backed complet + încredere | §11.1 = critical path |
| Backend = API de SPA | Entități generice + JWT browser; fără versionare publică, API keys, SLA | OK pentru MVP intern |
| Modelul e bun | Păstrăm ierarhia; nu redesenăm de la zero | Done |
| `reguliTaxe` în FE dovedește că poate merge pe BE | Mutare ulterior: `POST /v1/lookup` / `POST /v1/trip-cost` | Nu început |
| Lipsește multi-tenant / org | Org reală + flotă izolată + (opțional) catalog shared vs private | Doar profil pe user |

*Mesajul WhatsApp e tăiat la „Read more” după multi-tenant — restul punctelor Geo (dacă există) se completează când avem textul full.*

---

## C. §11 — Ce poate prelua colegul (status detaliat)

### 1. Completare bază localități / reguli / surse reale (sau import CSV)

| | |
| --- | --- |
| **Status** | **Parțial done (12.10.2026)** — Geo nu pusese date; importate **14 localități + 189 reguli Confirmate din act** |
| **Unde** | UI: `/localitati`, `/baza-taxe`, `/surse`. Script: `npm run db:import-safe` (`server/src/importSafeXlsx.js`) |
| **Cum** | Citește xlsx research; filtrează status „Sume găsite, confirmate din act” + încredere tarif „confirmat din actul oficial”; `--force` reimportă |
| **Resursă research** | `data/research/Taxe_acces_camioane_Romania.xlsx` (în repo; seed via `db:import-safe` / `db:import-queue`) |
| **În DB acum** | București (26), Buftea (21), Satu Mare (21), Arad (20), Brașov (19), Brăila (18), … total 189 taxe / 34 zone / 14 surse |
| **Neimportat (intenționat)** | „de confirmat”, sursă secundară (ex. București 2027), negăsit, proiecte HCL |
| **Definition of done** | ≥14 localități confirmate din act folosibile în Caută taxe / Cost cursă — **atins pentru lotul sigur**; urmează lotul „de confirmat” + apeluri |

### 2. Email (Resend sau similar) — OTP + reset password

| | |
| --- | --- |
| **Status** | **Stub** — OTP/reset/invite logate în consolă |
| **Unde** | `server/src/routes/auth.js` (`console.log` OTP / reset URL / invite password) |
| **Cum** | Env `RESEND_API_KEY` (+ from); trimite mail la register / resend-otp / forgot-password / invite; scoate secretele din log în prod |
| **Definition of done** | Register + forgot password funcționează fără a citi consola serverului |

### 3. Google login (opțional)

| | |
| --- | --- |
| **Status** | **UI stub** — neconfigurat |
| **Unde** | FE: `Login.jsx` / `Register.jsx` → `api.auth.loginWithProvider`. Env: `GOOGLE_CLIENT_ID` în `server/.env.example` |
| **Cum** | Verificare ID token Google pe API + creare/link user; completează `loginWithProvider` |
| **Definition of done** | Login Google pe cont nou + cont existent (email verified) |

### 4. Deploy: API + frontend + Postgres (VM / Docker; ref. Transitix)

| | |
| --- | --- |
| **Status** | **Lipsă** în acest repo |
| **Unde** | De adăugat: `Dockerfile`(s), compose, env prod, reverse proxy; port API **3003** (evită Transitix 3001–3002) |
| **Cum** | Model Transitix: Postgres persistent + API Node + static Vite/nginx; `JWT_SECRET` real; `CLIENT_ORIGIN` pe domeniu |
| **Definition of done** | URL staging cu login seed + health `/api/health` |

### 5. UX hartă, validări juridice, alerte automate periodice

| | |
| --- | --- |
| **Status** | **Parțial** — hartă Leaflet + alerte construite în FE (`construiesteAlerte`); fără cron/job |
| **Unde** | `src/pages/Harta.jsx`, `src/components/HartaLeaflet.jsx`, `src/pages/Alerte.jsx`, `reguliTaxe.js` |
| **Cum** | UX: poligoane clare, filtre, click→reguli. Juridic: status act / încredere / expirare obligatorii la publish. Alerte: job periodic (sau la login admin) care regenerază `alerte` din reguli stale |
| **Definition of done** | Alerte persistate + regenerare automată; hartă utilă pe București real |

### 6. Teste API (ca în Transitix) — entități + auth

| | |
| --- | --- |
| **Status** | **Lipsă** |
| **Unde** | De creat sub `server/` (sau root) — pattern Transitix |
| **Cum** | Suite: register/login/OTP mock, CRUD Localitate/TaxaAcces ca admin, ownership Vehicul/Cursa ca user, 403 pe user non-admin |
| **Definition of done** | `npm test` (sau echivalent) verde pe CI/local |

---

## D. Gap comercial (viitor — după ce MVP-ul e „plin”)

De notat (cererea @Loki), **nu** blochează §11.1–11.6:

1. **Multi-tenant real** — tabel `organizations`, membership, flotă pe org; catalog legal shared vs override.
2. **API public versionat** — ex. `/v1/lookup`, `/v1/trip-cost`, API keys, rate limit, OpenAPI.
3. **Mutare `reguliTaxe` pe backend** — o singură sursă de adevăr pentru calc.
4. **Proveniență + freshness** — sync/monitorizare HCL (research Mapix avea probe scrape; CTO app încă nu).

---

## E. Ordine de atac recomandată

```text
1) §11.1 Date reale (xlsx → CSV/import)     ← deblocant produs
2) §11.4 Deploy staging                     ← ceilalți văd app-ul
3) §11.2 Email OTP/reset                    ← onboarding real
4) §11.6 Teste API smoke                    ← nu stricăm auth/CRUD
5) §11.5 Hartă + alerte periodice           ← UX / ops
6) §11.3 Google (doar dacă e nevoie)
── apoi ──
7) Multi-tenant + API B2B (agenda Geo)
```

---

## F. Cum pornești CTO repo (reminder)

```bash
cd /Users/florin/MapiX-cto
npm install && npm install --prefix server
cp server/.env.example server/.env   # ajustează DATABASE_URL
npm run db:create && npm run db:migrate && npm run db:seed
npm run dev:all
# UI http://127.0.0.1:5173  · API http://127.0.0.1:3003/api/health
# admin@mapix.local / admin12345
```

Schema: orice schimbare în `server/src/migrate.js`.

---

## G. Legătura cu research-ul din `/Users/florin/Mapix`

| Research (vechi workspace) | Rol față de CTO app |
| --- | --- |
| Excel Taxe_acces… + foi Abordare/Resurse | Sursă de conținut pentru §11.1 |
| Next.js MVP local (lookup DB, status) | Prototype/research — **nu** înlocuiește MapiX-cto |
| Scrape targets / competitor notes | Input pentru sync ulterior (§D.4), nu pentru MVP UI |

**Decizie:** produsul = **MapiX-cto**. Research = pipeline de date + note, până când conținutul e în Postgres-ul app-ului.
