# Messen (/messen)

Gewinnspiel-Seiten für Messen. Pro Messe eine öffentliche Seite unter `/m/<kurzadresse>` mit einem
Formular in drei Schritten (Units, Airbnb-Link, Kontakt). Jeder Lead landet in Orbit und als Kontakt in GHL.

## Ablauf

1. *Messen → Neue Messe*: Name eingeben, Orbit legt einen Entwurf an.
2. Gewinn, Ziehung (mit Zeitzone der Messe), Stand, Links und optional Pixel-IDs eintragen.
3. Über *Vorschau öffnen* durchklicken. In der Vorschau wird nichts gespeichert.
4. *Seite ist online* einschalten und speichern. Ohne Gewinn, Ziehung, Teilnahmebedingungen und
   Datenschutz lässt sich eine Messe nicht veröffentlichen.
5. QR-Code als PNG herunterladen und drucken. Für das Tablet am Stand den Tablet-Link öffnen.
6. Nach der Ziehung schliesst das Formular automatisch. *Gewinner ziehen* wählt zufällig unter allen
   Teilnehmenden, die noch nicht gezogen wurden.

## Was mit einem Lead passiert

- Gespeichert in `messe_leads`. Die Losnummer macht das Senden idempotent: Die Seite speichert Leads bei
  fehlendem Netz im Browser und sendet sie später erneut, ohne Doppel.
- Einstufung nach Units: ab 20 = hot, 5–19 = warm, sonst cold. Ein Airbnb-Link gibt einen Punkt mehr.
- GHL: Kontakt per Upsert (E-Mail oder Telefon), Quelle `Messe: <Name>`, Notiz mit allen Angaben und Tags
  `messe-lead`, `messe-<kurzadresse>`, `tier-<hot|warm|cold>`, `units-<…>`, `kanal-<whatsapp|email>`,
  `airbnb-link`, `retargeting-ok` (nur mit Einwilligung) sowie die Tags aus der Messe.
  Nutzt `GHL_API_TOKEN` und `GHL_LOCATION_ID` wie Offerten. Fehler lassen sich in der Lead-Liste erneut senden.

## Retargeting

- Meta-Pixel, Google-Tag und LinkedIn Insight Tag pro Messe. Sie laden erst nach Zustimmung im
  Cookie-Hinweis der Seite, auf dem Stand-Tablet (`?kiosk=1`) nie. Beim Absenden feuern `Lead` (Meta) und
  `generate_lead` (Google).
- *Retargeting-Liste (CSV)*: nur Leads mit Werbe-Einwilligung, Spalten `email, phone, fn, ln` für
  Custom Audiences.

## Einrichtung

| Was | Wo |
|---|---|
| App Role `App.Messen` (Wert exakt so) | Entra → App-Registrierung Orbit → App roles, danach zuweisen |
| Optional eigene Domain, z. B. `messe.elev8-suite.com` | Railway → Dienst orbit → Settings → Networking |
| `MESSEN_PUBLIC_URL` (z. B. `https://messe.elev8-suite.com`) | Railway, sonst gilt `AUTH_URL` |
| Optional `MESSEN_ALLOWED_ORIGINS` (kommagetrennt), falls das Formular auf einer anderen Domain eingebettet wird | Railway |
| Optional `MESSEN_ROLE` (Standard `App.Messen`) | Railway |

Die Tabellen legt Migration `014_messen.sql` beim Start an.

Der QR-Code wird über api.qrserver.com erzeugt; übergeben wird nur der öffentliche Link.

**Rechtliches:** Text der Einwilligung („… und mir passende Werbung zeigen“), Cookie-Hinweis und
Teilnahmebedingungen vor dem ersten Einsatz prüfen lassen.

## Code

`src/lib/messen` (Daten, GHL, Landingpage, Zeitzonen), `src/app/messen` (Verwaltung),
`src/app/m/[slug]/route.ts` (öffentliche Seite), `src/app/api/messen` (Formular und Export),
`src/components/messen` (Formulare).
