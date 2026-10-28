# Radar

Wertet Quellen einmal täglich mit Claude auf Relevanz für Elev8 aus und zeigt Treffer in **Mein Tag** und unter `/radar`.
Jeder Treffer hat Titel, Zusammenfassung, Empfehlung, Kategorie, Wichtigkeit und einen **Link zum Originalbeitrag**.

V1: nur für eine Person, Quelle Slack. Aufgebaut so, dass weitere Quellen und weitere Personen dazukommen, ohne etwas umzubauen.

## Ablauf

```
Scheduler (alle 10 Min.) → fällig? (lokale Uhrzeit ≥ Einstellung, heute noch kein Lauf)
  → Connectors holen neue Nachrichten  →  radar_messages (Rohdaten, dedupliziert)
  → Claude bewertet alles Unbewertete   →  relevant / Wichtigkeit / Kategorie / Empfehlung
  → Mein Tag liest nur noch aus der Datenbank
```

- Standard: **05:00 Europe/Zurich**, pro Person einstellbar (`radar_settings`).
- Ein Lauf pro Person und Tag (`radar_runs`). Schlägt er fehl, gibt es bis zu 3 Versuche im Abstand von 30 Minuten.
  „Jetzt prüfen“ in `/radar` startet jederzeit einen Lauf.
- Erster Lauf einer neuen Verbindung: die letzten 72 Stunden (`RADAR_FIRST_LOOKBACK_HOURS`).
- Pro Lauf höchstens 100 neue Nachrichten an Claude, in Stapeln zu 20.

## Einrichtung

| Was | Wo |
|---|---|
| `RADAR_ENABLED=true` (Hintergrundlauf und Karte in Mein Tag) | Railway, Dienst orbit |
| `ANTHROPIC_API_KEY` (ist für Offerten und Assistent schon gesetzt) | Railway |
| Rolle `App.Radar` (Orbit.Admin hat immer Zugriff) | Entra → App-Registrierung Orbit → App roles |
| Optional `RADAR_ROLES` (kommagetrennt, Standard `App.Radar`) | Railway |
| Optional `RADAR_FIRST_LOOKBACK_HOURS` (Standard 72) | Railway |

Die Tabellen legt Migration `020_radar.sql` beim Start an.

### Slack verbinden

1. [api.slack.com/apps](https://api.slack.com/apps) → *Create New App* → *From scratch*, im Workspace, in dem du den Channel siehst.
2. *OAuth & Permissions* → **User Token Scopes**: `channels:read`, `channels:history`, `groups:read`, `groups:history`, `users:read`.
3. *Install to Workspace* (ein Workspace-Admin muss die App unter Umständen freigeben). Das **User OAuth Token** (`xoxp-…`) kopieren.
4. In Orbit → Radar → *Quellen und Einstellungen* → *Slack verbinden*: Token und Channel-Namen oder IDs eintragen.

Mit einem User-Token liest das Radar genau das, was du selbst siehst, auch geteilte (Slack-Connect-)Channels.
Es wird nie etwas in Slack geschrieben. Das Token wird verschlüsselt gespeichert (`ORBIT_ENCRYPTION_KEY`, sonst aus `AUTH_SECRET`)
und nie wieder angezeigt. Hinweis: Das Token liest mit deinen Rechten. Nur Channels eintragen, die ausgewertet werden dürfen.

## Datenschutz

- Gespeichert werden Beiträge der gewählten Channels (Text bis 3000 Zeichen, Autor, Zeit, Permalink). Nicht Relevantes wird nach 30 Tagen gelöscht.
- Beim Entfernen einer Verbindung werden alle zugehörigen Nachrichten gelöscht.
- Die Texte gehen zur Bewertung an die Claude-API (wie bei Offerten und E-Mail-Assistent).
- Nachrichten aus Quellen gelten als fremder Text: Claude bekommt den Auftrag, Anweisungen darin zu ignorieren, und kann nur
  bewerten, nichts auslösen oder senden.

## Neue Quelle anbinden (z.B. WhatsApp)

Zwei Arten, beide landen in derselben Tabelle `radar_messages` und werden gleich bewertet:

1. **Abrufen (pull):** Connector in `src/lib/radar/connectors/` mit `collect(conn, sinceIso) → RawMessage[]`, in `connectors/index.ts`
   eintragen, Typ in `types.ts` (`SOURCE_KINDS`) und ein Verbindungsformular in `RadarHome.tsx` ergänzen. Beispiel: `slack.ts`.
2. **Zustellen (push):** Die Quelle ruft einen Webhook in Orbit auf. Der Webhook legt eine Verbindung an (oder nutzt eine vorhandene)
   und speichert mit `insertMessages()` aus `store.ts`. Der Tageslauf bewertet danach alles Unbewertete.

WhatsApp ist push-artig und offiziell nur über eine **Business-Nummer** möglich (Meta Cloud API oder GHL, wo die WhatsApp-Nummer
schon hängt). Private WhatsApp-Chats und -Gruppen lassen sich nicht offiziell auslesen. Mögliche Wege:

- **GHL-Konversationen** als Pull-Connector (GHL-Zugang gibt es in Orbit schon, `GHL_API_TOKEN`).
- **Lead Bot und Support Bot** melden ihre Gespräche per Push an das Radar.
- **Meta Cloud API** direkt per Webhook (Verifizierung und Vorlagen nötig).

## Weitere Personen

Alles ist bereits pro Person (`user_id`): Einstellungen, Verbindungen, Nachrichten, Läufe. Für alle freischalten:
`RADAR_ROLES=Orbit.Staff` und in `config/apps.yaml` bei `radar` `requestableBy: [Orbit.Staff]` ergänzen.
Jede Person verbindet dann ihre eigenen Quellen unter *Quellen und Einstellungen*. Später sinnvoll: Slack-OAuth statt Token einfügen
(wie beim E-Mail-Assistenten), damit niemand ein Token kopieren muss.

## Code

`src/lib/radar` (Speicher, Connectors, Bewertung, Lauf), `src/app/radar` (Seite), `src/app/api/radar` (API),
`src/components/radar` (Oberfläche), Karte in `src/lib/platform/today.ts`.
