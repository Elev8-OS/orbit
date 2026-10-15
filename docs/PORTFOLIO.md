# Portfolio Monitoring Schweiz (`/portfolio`)

Wirtschaftlichkeit, Empfehlungen und Kosten aller Schweizer Wohnungen von Elevate: Ranking, Netto pro Wohnung und Monat,
Kosten pro Wohnung, Exit-Simulator, Break-even, Prognose, Bewährungs-Tracker, Neubeurteilung durch Claude, PDF- und Excel-Export.
Entstanden als Claude-Dashboard und 1:1 nach Orbit übernommen.

## Zugriff

| Rolle | Darf |
|---|---|
| `App.PortfolioCH` | ansehen, PDF/Excel exportieren |
| `App.PortfolioCH.Edit` | zusätzlich Kosten, Gemeinkosten, Ziele pflegen und Neubeurteilung anstossen |
| `Orbit.Admin` | alles |

Rollen in Entra anlegen und zuweisen. Überschreibbar mit `PORTFOLIO_ROLES` / `PORTFOLIO_EDIT_ROLES`.

## Datenquellen (alle serverseitig, Zugänge nur in Railway)

| Quelle | Variablen | Inhalt |
|---|---|---|
| Elev8 Suite MCP | `ELEV8_MCP_URL` (Standard `https://mcp.elev8-suite.com`), `ELEV8_MCP_TOKEN` | Reservierungen (Tag `Swiss`, Anreise 2024-10 bis 2027-12) und Kanal-Kennzahlen Aug/Sep 2026 (Kommissionssätze) |
| MyDataValue über `mydatavalue-mcp` | `MDV_MCP_URL`, `MDV_MCP_TOKEN` (= `MCP_SERVICE_TOKEN` dort) | aktuelle Booking-Bewertungen |
| Claude | `ANTHROPIC_API_KEY` | Neubeurteilung |

Optional: `PORTFOLIO_CACHE_MINUTES` (Standard 60), `PORTFOLIO_LISTING_TAG` (Standard `Swiss`), `PORTFOLIO_RES_FROM` / `PORTFOLIO_RES_TO`.

- Live-Daten werden in `portfolio_cache` zwischengespeichert. „Daten neu laden“ im Modul holt sie sofort neu.
- MyDataValue nie direkt mit einem eigenen Refresh-Token anbinden: der Token rotiert, doppelte Nutzung sperrt die Integration.
- Gästenamen und Reservierungs-IDs werden nicht gespeichert.
- Stammdaten (Empfehlungen, Märkte, Vorfälle, PriceLabs-Vergleich) liegen in `src/lib/portfolio/data/*.json` (Stand 15.10.2026).
  Neubeurteilungen aus dem Modul überschreiben Empfehlung, Fazit, Ursachen und Massnahmen (`portfolio_docs`, collection `neubeurteilung`).

## Aufbau

- `src/app/portfolio` – Seite, prüft Rolle; `src/components/portfolio/PortfolioApp.tsx` lädt das Modul aus `public/portfolio-app`
- `public/portfolio-app/app.html`, `app.css`, `theme.css` – Markup und Design (Elevate: Tan `#cca67d`, Schwarz `#0e0e0e`)
- `public/portfolio-app/app-a.min.js`, `app-b.min.js` – gebündeltes Dashboard inkl. Laufzeit (`dash`, `claude.use`) auf den Orbit-APIs
- `src/app/api/portfolio/data` – alle Datensätze; `docs/[collection]/[id]` – Kosten, Gemeinkosten, Ziele, Einstellungen; `reassess` – Neubeurteilung
- `src/lib/portfolio` – Rollen, MCP-Client, Quellen und Cache, Dokumente
- `db/migrations/011_portfolio.sql`, `012_portfolio_seed.sql` – Tabellen und Übernahme der Kosten aus dem Claude-Dashboard
- d3 7.9.0 wird mit Integritätsprüfung von jsDelivr geladen.

## Rechenlogik (Kurzfassung)

Umsatz anteilig pro Aufenthaltsnacht (USD × 0.80). Kommission je Kanal (Booking/Airbnb aus Elev8, Direkt 0 %, übrige OTAs einstellbar).
Reinigung pro Abreise im Monat der Abreise, Wäsche pro Person im Monat der Anreise. Fixkosten pro Wohnung inkl. Möbelmiete bis Vertragsende.
Mandate: Honorar in % der Netto-Mieteinnahmen, Reinigung/Wäsche an Eigentümer. Wohnungen mit negativem Netto werden nie zum Exit empfohlen,
sondern als „Im Minus – Potenzial heben“ mit Hebeln analysiert. Details im Modul unter „Methodik & Quellen“.
