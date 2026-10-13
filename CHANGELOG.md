# Changelog

Toate schimbările notabile ale MapiX sunt documentate aici.
Format inspirat de [Keep a Changelog](https://keepachangelog.com/ro/1.1.0/); versionare [SemVer](https://semver.org/lang/ro/).

---

## [0.4.0] — 2026-10-13 · build 39

Release major de UX + motor de căutare taxe, după `0.3.0`. Concentrare pe: navigare localități, claritate vizuală (contrast WCAG), formulare zonă/județ, și rezultate corecte în **Caută taxe și restricții**.

### Rezumat pentru utilizatori

- Cauți o localitate din header și ajungi direct la verificare taxe, cu URL partajabil.
- Dashboard-ul arată KPI-uri colorate, cu link către filtrele relevante.
- Sidebar permanent expandat; badge-ul de alerte stă lângă meniul Alerte.
- Județul se alege doar din lista oficială RO (fără text liber invalid).
- Zonele pot fi „întreaga localitate” sau zone distincte (nu mai forțează numele localității ca zonă).
- Căutarea de taxe înțelege zonele combinate (ex. „Zonele A și B”), alege tariful potrivit duratei (zi vs lună) și nu mai afișează concluzii înșelătoare.

### Adăugat

- **Căutare localitate în header** (`HeaderLocalitateSearch`) — typeahead cu diacritice, Enter doar pe potrivire reală, navigare către `/cauta-taxe` cu query (`localitate`, `q`, `masa`, `durata`).
- **Select localitate îmbunătățit** (`LocalitateSelect`) — combobox cmdk, căutare fără diacritice, etichetă „Nume · Județ”.
- **Catalog județe RO** (`judeteRo.js` FE + API) — listă statică oficială (+ București); validare la creare/editare localitate (400 pe județ invalid).
- **Form zonă rethink** (`ZonaFormDialog`) — scop „Întreaga localitate” vs „Zonă distinctă”; blochează folosirea numelui localității ca nume de zonă când e nevoie de zonă distinctă.
- **Descriere zonă în UI** (`ZonaDescriere`) — străzi / delimitare vizibile în Caută taxe și carduri.
- **Grupare pe județ** (`grupareJudet`, `ListaJudetExpand`, `VerificariJudetExpand`) — registre și coada de verificări pe Prezentare, expandabile pe județ.
- **Import Bragadiru HCL 41/2025** (`importBragadiruHcl41.js` + act PDF în `data/research/acts/bragadiru/`) — benzi de masă fără overlap (min exclusiv după prag).
- **Coadă verificări** (`verificariCoada.js`) — agregare alerte / reguli de confirmat pe localitate și județ.
- **Canvas de fundal** — atmosferă subtilă pe layout (`bg-app-canvas`), nu fundal plat monoton.
- **Expand toggle / panouri UI** — componente partajate pentru liste expandabile.

### Schimbat

- **Sidebar** — mereu expandat (`w-64`); eliminat colaps / overlay / hamburger redundant; header org centrat; versiunea rămâne vizibilă (`vX.Y.Z · build N` din `package.json`).
- **Alerte** — badge numeric mutat de pe clopotul din header pe itemul de navigare „Alerte”.
- **Home / Prezentare** — eliminat „Acces rapid” redundant; KPI-uri cu panglici colorate + linkuri (filtre / hash); contrast ridicat pe texte secundare.
- **Contrast WCAG** — tokeni slate / `muted-foreground` remapați; PageHeader, EmptyState, AppVersion, Marca aliniate.
- **Localități** — încărcare până la 500, sort pe județ (nu mai „dispar” județe din cauza limit 25 + sort prioritate).
- **Caută taxe**
  - Sync URL ↔ formular; auto-căutare doar după alinierea localității din query.
  - Filtru zonă: zonele combinate („A și B”) includ regulile componentelor (și invers pentru exceptări).
  - Preferință tarif după durată: &lt;28 zile → pe zi; ≥28 → pe lună; ≥360 → pe an; celelalte rămân „tarif alternativ” (nu se cumulează).
  - Exceptări / interdicții potrivite primesc status **Calculat** (nu mai rămân „Neaplicabil”).
  - Rezumat: statusul de reglementare al localității nu mai apare ca badge de rezultat (evită confuzia „Taxă confirmată” lângă o interdicție).
  - Valoare afișată: Interzis / Gratuit / cost calculat din evaluare.
- **Cost pe cursă** — aceleași reguli de compatibilitate zonă + tarife alternative pe durată.
- **Motor `reguliTaxe`** — `regulaPotrivesteZona`, `zoneCompatibile`, `marcheazaTarifeAlternative`; grupare rezultate doar pe reguli aplicabile.
- **Versiune app** — citită din `package.json` (nu din define Vite învechit).

### Remediat (date + logică)

- București: praguri de masă aliniate (ex. banda plătită de la **5,01 t** după exceptarea ≤5 t; la fel 7,51 / 12,51 / …) — elimină overlap la limite.
- Căutare header: Enter pe text fără match nu mai „reîmprospăta” haotic pagina.
- Prefill din URL onorează `?localitate=` / `?q=` exact (fără a lăsa localitatea veche din session să pară rezultat).

### Fișiere cheie

| Zonă | Fișiere |
| --- | --- |
| Căutare / navigare | `HeaderLocalitateSearch.jsx`, `CautaTaxe.jsx`, `LocalitateSelect.jsx` |
| Motor taxe | `reguliTaxe.js`, `CostCursa.jsx` |
| Layout / a11y | `Layout.jsx`, `index.css`, `tailwind.config.js`, `Home.jsx` |
| Zone / județe | `ZonaFormDialog.jsx`, `judeteRo.js`, `entities.js` (API) |
| Date | `importBragadiruHcl41.js`, `data/research/acts/bragadiru/` |

### Showcase

- PDF + screenshot-uri: [`releases/0.4.0/MapiX-v0.4.0-showcase.pdf`](./releases/0.4.0/MapiX-v0.4.0-showcase.pdf)

### Upgrade / note ops

- Bump: `0.3.0` → **`0.4.0`**, build **`39`** (root + `server/package.json` version sync).
- După pull: `npm install` (dacă e nevoie), `npm run db:migrate`, restart `npm run dev:all`.
- Pragurile București din DB locală au fost corectate o dată; reimport / update manual pe alte medii dacă replicați datele.

---

## [0.3.0] — 2026-10-12 · build 3

Ship research xlsx seed + import pipeline și fix-uri UI ops.

---

## [0.2.0] — 2026-10-11 · build 2

Afișare versiune + build pe login și sidebar.
