# Portfolio Monitoring Schweiz und Bali (`/portfolio`)

Wirtschaftlichkeit, Empfehlungen und Kosten aller Schweizer Wohnungen von Elevate: Ranking, Netto pro Wohnung und Monat,
Kosten pro Wohnung, Exit-Simulator, Break-even, Prognose, Bewährungs-Tracker, Neubeurteilung durch Claude, PDF- und Excel-Export.
Entstanden als Claude-Dashboard und 1:1 nach Orbit übernommen.

## Regionen

Umschalter oben im Modul: **Alle / Schweiz / Bali** (Standard Schweiz, die Wahl wird pro Browser gespeichert).
Alle Tabs, PDF und Excel rechnen für die gewählte Region. Bali: 10 Villen, Villa Merapi (5 Zimmer) und die 11 Apartments
Pererenan als 3 Typen (Plunge Pool APT 1–3, Studio 4–7, Mezzanine 8–11) – Elev8 führt die Einheiten eines Typs unter
einem Listing, die Auslastung wird deshalb über `units` pro Einheit gerechnet. Alle Bali-Objekte laufen auf eigenes Risiko
(Pacht); solange Kosten fehlen, stehen sie in der Gruppe „Neu – Beurteilung ausstehend“.

- Elev8-Tags: `PORTFOLIO_LISTING_TAGS` (Standard `Swiss,indonesia`)
- Wechselkurs: Bali-Beträge in IDR (Elev8, AirROI, PriceLabs) werden mit `PORTFOLIO_FX_IDR` (IDR pro CHF, Standard 21000) umgerechnet; USD × `PORTFOLIO_FX_USD` (Standard 0.80)
- Gemeinkosten haben eine Region (Schweiz, Bali, Beide) und werden nur auf die aktiven Wohnungen dieser Region verteilt, unabhängig vom Umschalter
- Vergleichsmärkte AirROI: Pererenan, Canggu, Sanur (Denpasar Selatan)
- Abschnitte zu Schaffhausen und zum PriceLabs-Monatsverlauf gelten nur für die Schweiz und sind in der Bali-Ansicht ausgeblendet

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
| myDataValue (offizieller Server) | – (Anmeldung im Modul: „myDataValue verbinden“), optional `MDV_OFFICIAL_MCP_URL` | Verlauf der Booking-Bewertungen über `run_sql`, wie im Claude-Dashboard |
| Rückfall: MyDataValue über `mydatavalue-mcp` | `MDV_MCP_URL`, `MDV_MCP_TOKEN` (= `MCP_SERVICE_TOKEN` dort) | aktuelle Booking-Bewertungen, nur wenn Orbit nicht selbst verbunden ist |
| AirROI | `AIRROI_API_KEY` (gleicher Key wie im Dienst airroi-mcp) | Marktkennzahlen ganze Wohnungen der 6 Vergleichsorte, RevPAR-Verlauf Schaffhausen 24 Monate |
| PriceLabs Customer API | `PRICELABS_API_KEY` (PriceLabs → Account Settings → API Details) | RevPAR pro Wohnung vs. Markt (90 Tage), Monatswerte des Portfolios (jeden Monat gespeichert in `pricelabs_monat`) |
| HostBuddy MCP | `HOSTBUDDY_API_KEY`, optional `HOSTBUDDY_MCP_URL` (Standard `https://api.hostbuddy.ai/mcp`), `HOSTBUDDY_TOOL` (Standard `listActionItems`) | Action Items aus der Gästekommunikation |
| Elev8-Kalendernotizen | – (aus den Reservierungen) | Direkt-Einträge ohne Betrag, deren Gastname eine Notiz ist (z. B. „Ozongerät“) |
| Claude | `ANTHROPIC_API_KEY` | Neubeurteilung; Einordnung neuer Vorfälle (Kategorie, deutscher Kurztext), gespeichert in `vorfall_klass` |

Optional: `PORTFOLIO_CACHE_MINUTES` (Standard 60), `PORTFOLIO_LISTING_TAG` (Standard `Swiss`), `PORTFOLIO_RES_FROM` / `PORTFOLIO_RES_TO`.

- Live-Daten werden in `portfolio_cache` zwischengespeichert. „Daten neu laden“ im Modul holt sie sofort neu.
- myDataValue verbinden: Im Modul (Pflegerechte) „myDataValue verbinden“ klicken, bei myDataValue anmelden, Team Elevate wählen, Zugriff bestätigen.
  Orbit registriert sich dabei selbst als Client (OAuth 2.1, PKCE, automatische Registrierung) und fragt nur lesende Scopes an.
  Tokens liegen verschlüsselt in `portfolio_oauth` (Schlüssel aus `ORBIT_ENCRYPTION_KEY` bzw. `AUTH_SECRET`; wird er geändert, neu verbinden).
  Der Refresh-Token rotiert: Erneuerung nur in einer Transaktion mit Zeilensperre, damit nie ein alter Token erneut verwendet wird.
  Trennen im Modul oder bei myDataValue unter Connections → AI assistants. Redirect-URI: `<AUTH_URL>/api/portfolio/mdv/callback`.
- Den rotierenden Refresh-Token von myDataValue nie in einem zweiten System hinterlegen: doppelte Nutzung sperrt die Integration.
- Gästenamen und Reservierungs-IDs werden nicht gespeichert.
- Ist eine Quelle nicht eingerichtet, gilt der feste Stand aus `src/lib/portfolio/data/*.json` (15.10.2026). Vorfälle: Bewertungen bleiben aus dem festen Stand, HostBuddy und Kalendernotizen kommen live (letzte 12 Monate, nur von Claude als relevant eingestufte Einträge).
- Wohnungen werden über `elev8_names` und den Wohnungsnamen zugeordnet (`matchProperty` in `src/lib/portfolio/live.ts`). Listings ohne Treffer (z. B. Bali) werden ignoriert.
- Neubeurteilungen aus dem Modul überschreiben Empfehlung, Fazit, Ursachen und Massnahmen (`portfolio_docs`, collection `neubeurteilung`).

## Aufbau

- `src/app/portfolio` – Seite, prüft Rolle; `src/components/portfolio/PortfolioApp.tsx` lädt das Modul aus `public/portfolio-app`
- `public/portfolio-app/app.html`, `app.css`, `theme.css` – Markup und Design (Elevate: Tan `#cca67d`, Schwarz `#0e0e0e`)
- `public/portfolio-app/app-a.min.js`, `app-b.min.js` – gebündeltes Dashboard inkl. Laufzeit (`dash`, `claude.use`) auf den Orbit-APIs
- `src/app/api/portfolio/mdv/connect`, `callback`, `status` – Anmeldung bei myDataValue, Stand, Trennen (`src/lib/portfolio/mdvOauth.ts`)
- `src/app/api/portfolio/data` – alle Datensätze; `docs/[collection]/[id]` – Kosten, Gemeinkosten, Ziele, Einstellungen; `reassess` – Neubeurteilung
- `src/lib/portfolio` – Rollen, MCP-Client, Quellen und Cache, Dokumente
- `db/migrations/011_portfolio.sql`, `012_portfolio_seed.sql`, `013_portfolio_oauth.sql` – Tabellen und Übernahme der Kosten aus dem Claude-Dashboard
- d3 7.9.0 wird mit Integritätsprüfung von jsDelivr geladen.

## Rechenlogik (Kurzfassung)

Umsatz anteilig pro Aufenthaltsnacht (USD × 0.80). Kommission je Kanal (Booking/Airbnb aus Elev8, Direkt 0 %, übrige OTAs einstellbar).
Reinigung pro Abreise im Monat der Abreise, Wäsche pro Person im Monat der Anreise. Fixkosten pro Wohnung inkl. Möbelmiete bis Vertragsende.
Mandate: Honorar in % der Netto-Mieteinnahmen, Reinigung/Wäsche an Eigentümer. Wohnungen mit negativem Netto werden nie zum Exit empfohlen,
sondern als „Im Minus – Potenzial heben“ mit Hebeln analysiert. Details im Modul unter „Methodik & Quellen“.
