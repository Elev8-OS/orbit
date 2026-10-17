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

## In WordPress einbinden (empfohlen)

So läuft das Gewinnspiel auf einer normalen Seite eurer Website. Cookie-Banner, Meta-Pixel, Google-Tag und
Tag Manager der Website gelten wie auf jeder anderen Seite, die Seite taucht also im Retargeting auf.

1. In der Messe unter *Auf der Website einbinden* den Code kopieren.
2. In WordPress eine Seite anlegen, Block *Individuelles HTML* (Elementor: Widget *HTML*) einfügen und den Code
   hineinkopieren. Das Speichern von `<script>` braucht die Rolle Administrator (Recht `unfiltered_html`).
3. Die Adresse der WordPress-Seite in der Messe unter *Seite auf der Website* eintragen. Der QR-Code zeigt dann
   auf die WordPress-Seite, UTM-Parameter werden an das Gewinnspiel durchgereicht.
4. Die Pixel-Felder der Messe leer lassen; eingebettet lädt die Seite nie eigene Pixel und keinen eigenen Cookie-Hinweis.

Bei jeder Teilnahme meldet der iFrame der WordPress-Seite ein Ereignis (ohne Personendaten). Der Code löst daraus
`fbq("track", "Lead")`, `gtag("event", "generate_lead")` und `dataLayer.push({ event: "messe_lead", messe, tier, units, kanal })`
aus, aber nur, wenn die Pixel nach der Zustimmung im Cookie-Banner geladen sind. Im Google Tag Manager kann
`messe_lead` als Trigger für weitere Tags dienen (z. B. LinkedIn-Conversion).

Einbetten dürfen nur die Domains aus `MESSEN_FRAME_ANCESTORS` (Standard `https://elev8-suite.com https://www.elev8-suite.com`).
Die Variable wird beim Build gelesen; nach einer Änderung neu deployen.

## Retargeting

- Nur für die Seite direkt unter `/m/…`: Meta-Pixel, Google-Tag und LinkedIn Insight Tag pro Messe. Sie laden erst
  nach Zustimmung im Cookie-Hinweis der Seite, auf dem Stand-Tablet (`?kiosk=1`) und eingebettet nie. Beim Absenden feuern `Lead` (Meta) und
  `generate_lead` (Google).
- *Retargeting-Liste (CSV)*: nur Leads mit Werbe-Einwilligung, Spalten `email, phone, fn, ln` für
  Custom Audiences.

## Einrichtung

| Was | Wo |
|---|---|
| App Role `App.Messen` (Wert exakt so) | Entra → App-Registrierung Orbit → App roles, danach zuweisen |
| Optional eigene Domain, z. B. `messe.elev8-suite.com` | Railway → Dienst orbit → Settings → Networking |
| `MESSEN_PUBLIC_URL` (z. B. `https://messe.elev8-suite.com`) | Railway, sonst gilt `AUTH_URL` |
| Optional `MESSEN_FRAME_ANCESTORS` (Domains, die die Seite einbetten dürfen, leerzeichengetrennt) | Railway, danach neu deployen |
| Optional `MESSEN_ALLOWED_ORIGINS` (kommagetrennt), falls das Formular auf einer anderen Domain eingebettet wird | Railway |
| Optional `MESSEN_ROLE` (Standard `App.Messen`) | Railway |

Die Tabellen legen die Migrationen `014_messen.sql` und `015_messen_website.sql` beim Start an.

Der QR-Code wird über api.qrserver.com erzeugt; übergeben wird nur der öffentliche Link.

**Rechtliches:** Text der Einwilligung („… und mir passende Werbung zeigen“), Cookie-Hinweis und
Teilnahmebedingungen vor dem ersten Einsatz prüfen lassen.

## Code

`src/lib/messen` (Daten, GHL, Landingpage, Zeitzonen), `src/app/messen` (Verwaltung),
`src/app/m/[slug]/route.ts` (öffentliche Seite), `src/app/api/messen` (Formular und Export),
`src/components/messen` (Formulare).
