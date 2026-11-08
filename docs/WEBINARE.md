# Webinare (`/webinare`) und Webinar-Portal

Orbit pflegt die Inhalte für **webinar.elev8-suite.com**. Das Portal selbst ist ein eigener Railway-Service
(Repo `Elev8-OS/webinar-portal`) und nutzt **dieselbe Datenbank** wie Orbit. Orbit legt die Tabellen an
(Migration `023_webinare.sql`), das Portal liest und schreibt nur.

## Rollen (Entra App Roles der Orbit-App)

| Rolle | Darf |
|---|---|
| `Orbit.Admin` | alles |
| `App.Webinar` | Webinare, Teilnahme, Aufzeichnungen, KI-Inhalte, Abstimmungen |
| `App.Webinar.Moderation` | Vorab-Fragen und Themenvorschläge |

## Ablauf pro Webinar

1. **Anlegen** unter *Webinare → Neues Webinar*. Die GHL-Tag-Basis entsteht aus Datum und Kurzthema,
   z. B. `webinar-2026-11-02-journey`.
2. **Teams verbinden:** Teams-Webinar-ID eintragen, *Mit Teams verbinden* übernimmt den Teilnahmelink.
   Referenten treten genau über diesen Link bei, sonst fehlt die Teilnahme im Bericht.
3. **Veröffentlichen:** *Im Kalender zeigen*. Das Portal meldet Personen an, legt sie in GHL an und setzt
   `<basis>-angemeldet` (startet den GHL-Workflow für Bestätigung und Erinnerungen).
4. **Nach dem Webinar:** *Teilnahme aus Teams holen* oder Anwesenheitsbericht (CSV) importieren. Orbit warnt,
   wenn der Bericht unglaubwürdig ist (Sitzung unter 5 Minuten, kaum Anwesende). Status prüfen, dann
   *Teilnahme abschliessen*: `<basis>-angemeldet` wird durch `<basis>-anwesend` oder `<basis>-verpasst`
   ersetzt, Anwesende erhalten den Archiv-Schlüssel.
5. **Aufzeichnung:** Video in Bunny Stream hochladen, Video-ID eintragen. Transkript aus Fireflies wählen
   oder das Teams-Transkript (.docx/.vtt) hochladen. *Kapitel und Zusammenfassung erzeugen*,
   *Transkript übersetzen*, *Englische Tonspur erstellen* (ElevenLabs, später *prüfen* klicken).
   Inhalte prüfen, dann *Aufzeichnung veröffentlichen*.
6. **Fragen:** beantwortete Fragen mit Minute markieren; im Portal springt man direkt an die Stelle.

## Zugangsmodell im Portal

| Situation | Aufzeichnung |
|---|---|
| live dabei | sofort, und alle vergangenen (Archiv-Schlüssel) |
| angemeldet, verpasst | 30 Tage nach dem Webinar |
| Elev8-Kunde (GHL-Kundentag), nicht angemeldet | 30 Tage nach dem Webinar |
| alle anderen | nur Vorschau |

## GHL-Workflows (in GHL einrichten)

| Tag | Workflow |
|---|---|
| `<basis>-angemeldet` | Bestätigung sofort, Erinnerung 24 h und 1 h vor Beginn |
| `<basis>-anwesend` | «Danke fürs Dabeisein» mit Link zur Aufzeichnung |
| `<basis>-verpasst` | «Du hast was verpasst» sofort, nach 30 Tagen «Jetzt freigeschaltet» |

Kontaktfelder, die das Portal schreibt (legt sie bei Bedarf an): PMS, Anzahl Einheiten,
Newsletter-Einwilligung, Sprache, Webinar-Titel, Webinar-Datum, Webinar-Uhrzeit, Webinar-Link.
Der Webinar-Link ist der persönliche Teilnahmelink. Die Sprache (`de`/`en`) steuert die Mailvariante.

## Einrichtung

| Was | Wo |
|---|---|
| App Roles `App.Webinar`, `App.Webinar.Moderation` | Entra → App-Registrierung Orbit → App roles |
| Anwendungsberechtigungen `VirtualEvent.Read.All`, `VirtualEventRegistration-Anon.ReadWrite.All` mit Admin-Zustimmung | Entra → Orbit → API permissions |
| `WEBINAR_PORTAL_URL` (Standard `https://webinar.elev8-suite.com`) | Railway (Orbit) |
| `BUNNY_LIBRARY_ID`, `BUNNY_API_KEY`, `BUNNY_CDN_HOST`; in Bunny „MP4 Fallback“ aktivieren | Railway (Orbit) |
| `ELEVENLABS_API_KEY` | Railway (Orbit) |
| Fireflies, Claude, GHL: bestehende Variablen | wie Offerten |

Code: `src/lib/webinare`, `src/app/webinare`.

## Nachlieferungen

Auf der Webinar-Seite (Schritt „Nachlieferungen“) sucht Claude im Transkript alles, was das Team den Teilnehmenden
nachzuliefern versprochen hat (Folien, Vorlagen, Links, offene Antworten), mit Zitat und Zeitstempel. Punkte lassen sich
auch von Hand ergänzen, als „entfällt“ markieren oder löschen. Pro Punkt eine Datei (bis 25 MB, Railway-Bucket unter
`webinare/<webinar>/<punkt>/…`) oder ein https-Link. Tabelle: `webinar_deliverables` (Migration 024).

Im Portal erscheinen erledigte Punkte auf der Aufzeichnungsseite unter „Unterlagen zum Webinar“, mit demselben Zugang wie
das Video (`/api/unterlagen/<id>`). Ohne Zugang sieht man nur die Titel mit Schloss. Das Portal braucht dafür die
S3-Variablen von Orbit (`S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`).

## Logins

Unter *Webinare → Logins* (nur Rolle `App.Webinar`) steht, wer sich wann im Portal eingeloggt hat: als Liste aller Logins
oder zusammengefasst pro Person (Anzahl, erster und letzter Login, Archiv-Schlüssel, Kunde). Das Portal schreibt bei
jedem erfolgreichen Login per E-Mail-Code einen Eintrag in `webinar_logins` (Migration 025): E-Mail, Zeitpunkt und grob
das Gerät (z. B. „iPhone · Safari“), keine IP-Adresse. Logins vor der Einführung sind aus den benutzten Login-Codes
nachgetragen. Einträge älter als 12 Monate löscht Orbit beim Anzeigen. Ein Login gilt 30 Tage; wer eingeloggt bleibt,
erscheint in dieser Zeit nicht erneut.
