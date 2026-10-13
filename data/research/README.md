# Research — taxe acces camioane (RO)

## `Taxe_acces_camioane_Romania.xlsx`

Investigație structurată (CTO / research, ~10.10.2026): București, Ilfov, reședințe de județ + strat național.

Foi utile: **Rezumat**, **Localități**, **Tarife**, **Național**, **De sunat**, **Întrebări telefon**, **Abordare**, **Resurse**.

### Ce importă app-ul

| Comandă | Ce intră în Postgres |
| --- | --- |
| `npm run db:import-safe` | Localități cu status „Sume găsite, **confirmate din act**” + tarife cu încredere „confirmat din actul oficial” |
| `npm run db:import-queue` | Restul localităților (negăsit / de confirmat / proiect…) + tarife nesigure — coada „Verificări necesare” |

Override path: `MAPIX_XLSX=/cale/custom.xlsx npm run db:import-safe`.

### Acoperire „sigură” so far (confirmate din act)

București; Ilfov: Afumați, Buftea, Chiajna, **Bragadiru** (HCL 41/28.02.2025); reședințe: Arad, Oradea, Botoșani, Brașov, Brăila, Sfântu Gheorghe, Miercurea Ciuc, Târgu Mureș, Satu Mare, Focșani.

### Acte scanate în app

| Localitate | Fișier | Import |
| --- | --- | --- |
| Bragadiru | `acts/bragadiru/HCL-41-28.02.2025-regulament-tonaj.pdf` (+ `public/docs/bragadiru/…` pentru UI) | `npm run db:import-bragadiru` |

Restul din foaie rămâne pe coadă până la confirmare HCL / apel primărie. Nu există încă sync DB partajat — acest fișier e sursa de seed pentru fiecare mediu local.
