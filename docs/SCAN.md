# Scan – Visitenkarten-Scanner (`/scan`)

Ersetzt die eigenständige App „Elev8 Scan“ (Repo `GHL_BC_Scanner`, eigener Railway-Dienst mit eigenem
Benutzer-Login). Der Scanner ist jetzt ein Orbit-Modul: Anmeldung über Entra, Rechte über App Roles,
GHL und Claude über die Variablen, die Orbit ohnehin hat.

## Ablauf

1. Karte fotografieren (Kamera oder Datei), optional die Rückseite dazu. Bilder werden im Browser auf
   1600 px verkleinert und als JPEG geschickt.
2. Claude liest beide Seiten in einem Aufruf aus (`src/lib/scan/extract.ts`). Erkennt auch Fotos oder
   Screenshots eines LinkedIn-Profils. Prompt und Modell liegen auf dem Server; der Browser schickt nur Bilder.
   **Handschrift:** Ganz oder teilweise handgeschriebene Karten werden erkannt (Badge „Handschrift“). Bei
   verwechselbaren Zeichen (0/o, 1/l, rn/m) wählt Claude die plausibelste Lesung; bleibt ein Feld unsicher,
   wird es gelb markiert, bis die Person es bearbeitet. Das Kartenfoto steht im Prüfschritt zum Vergleich daneben.
   Handnotizen auf gedruckten Karten („Demo im März“, „12 Units“) landen als „Handnotiz:“ in den Notizen,
   nicht in den Kontaktfeldern. Units und PMS aus solchen Notizen werden zusätzlich erkannt (siehe unten).
3. Die Person prüft die Felder, wählt Tags (bestehende aus GHL oder neue) und optional eine **Messe** aus `/messen`.
4. **Senden:** Dublettenprüfung über E-Mail/Telefon (bei Treffer Rückfrage), dann Upsert in GHL mit
   - Quelle `Visitenkarte – <Name>` oder `Messe: <Messename>`
   - `assignedTo` = der GHL-User mit derselben E-Mail wie die Orbit-Anmeldung (keine manuelle Zuordnung mehr)
   - Tags: gewählte Tags + `visitenkarte` + Rollen-Tags (`rolle-manager` …) + bei Messe `messe-lead`, `messe-<slug>` und die Messe-Tags
   - Position, Mobil, LinkedIn, Branche, Sprache in Kontaktfelder (werden nach Namen gesucht, fehlende als Textfeld angelegt; Dropdowns nur bei passender Option, sonst in die Notiz)
   - die **GHL-Felder** aus dem Abschnitt „Für GHL“ (Units, PMS, Objektart … – siehe unten)
   - Notiz mit Scanner, Zeit, Rolle, Units, PMS und Freitext; zweite Notiz mit den Kartenfotos aus der GHL-Mediathek
5. Eintrag in `scan_history` (Team-Verlauf unter `/scan/verlauf`).

**Offline:** Ohne Netz landen Scans in einer IndexedDB-Warteschlange im Browser und werden automatisch gesendet,
sobald die Verbindung zurück ist (auch das Auslesen wird dann nachgeholt). Die Warteschlange ist pro Gerät.

## GHL-Felder aus der Karte (Units, PMS, Objektart …)

Claude sucht auf der Karte und in Handnotizen nach der **Anzahl Units** („40 Villas“, „120+ units“, „12 Units“) und dem
**PMS** (Logo, „powered by Guesty“, Partner-Badge, Notiz „nutzt Smoobu“ / „nur Excel“). Nichts wird geschätzt: Steht
nichts da, bleibt das Feld leer. Mitarbeitende eines Software-Anbieters bekommen dessen Produkt nicht als PMS.

Daraus füllt Orbit alle passenden GHL-Felder auf einmal, im Prüfschritt unter **„Für GHL“** sichtbar und änderbar:

| Erkannt | GHL-Felder | Regel |
|---|---|---|
| Units, z. B. 12 | Number of Properties, VRM26 Units Managed, Lead Units | Auswahlfelder bekommen den Bereich (`6 - 20`, `11 to 50`), Textfelder die Zahl |
| PMS, z. B. „Little Hotelier“ | Current PMS / Software, … DE, VRM26 Current PMS, Lead Current Tools | passende Option (`Littlehotelier (Siteminder)`), sonst `Other` / `Anderes System`; „keins/Excel“ → `None / Manual` / `Keins / Manuell` |
| PMS vorhanden ja/nein | „Are you currently using a Channel Manager or PMS?“, „Nutzen Sie aktuell …?“ | `Yes`/`Ja` bzw. `No`/`Nein` |
| direkt von Claude gewählt | Property Type, Role, Interested In, Listing / Website URL | nur Optionen, die es in GHL gibt; nur wenn die Karte es klar hergibt |

Korrigiert man im Prüfschritt die Units oder das PMS, rechnen sich die abhängigen Felder sofort neu. Typen und Optionen
kommen live aus GHL; vor dem Schreiben prüft der Server jeden Wert erneut gegen die Felddefinition.

**Andere Felder:** über `SCAN_CRM_FIELDS` (GHL-Feldschlüssel ohne `contact.`, kommagetrennt, optional mit Art
`units`, `pms`, `usesPms` oder `ai`), z. B.
`SCAN_CRM_FIELDS=number_of_properties:units,current_pms__software:pms,property_type,lead_region`.
Ohne Art wählt Claude den Wert. Die Liste ersetzt die Standardauswahl (`DEFAULT_CRM_FIELDS` in `src/lib/scan/crm.ts`).

## Gewinnspiel: Teilnahmekarten scannen

Teilnahmekarten vom Stand (Papier) und handgeschriebene Zettel kommen in denselben Lostopf wie Online-Teilnahmen
(`messe_leads` der Messe in `/messen`).

**Erkennung:** Claude erkennt die gedruckte Teilnahmekarte (Quiz „Was ist die Elev8-Suite?“, Units-Kästchen,
Einwilligungen) und Zettel, die klar als Teilnahme gemeint sind („für die Verlosung“, „raffle“, eine Losnummer).
Gelesen werden Quizantwort, Units-Bereich, Werbe-Einwilligung, Teilnahmebedingungen, bevorzugter Kanal und eine
aufgedruckte Losnummer. Eine gewöhnliche Visitenkarte ohne solchen Hinweis nimmt nicht teil.

**Zuordnung:** Offen ist ein Gewinnspiel, wenn die Messe aktiv ist und die Ziehung noch nicht vorbei ist.

| Offene Gewinnspiele | Verhalten |
|---|---|
| eines | Karte kommt automatisch hinein („… (automatisch)“) |
| mehrere | Der Scanner fragt; die in den Einstellungen gewählte Messe ist vorausgewählt. Ohne Auswahl wird nicht gesendet |
| keines | Hinweis, die Karte wird als normaler Kontakt gespeichert |

Im Prüfschritt lässt sich die Teilnahme ein- und ausschalten und jede Angabe korrigieren. Für Visitenkarten aus einer
Box am Stand gibt es in den Einstellungen die **Visitenkarten-Box**: Jede gescannte Karte nimmt dann teil.

**Beim Senden:**
- Prüfung vor dem Schreiben: Gewinnspiel offen, Mobilnummer oder E-Mail vorhanden.
- **Kein doppeltes Los:** Ist die Person (gleiche E-Mail oder WhatsApp-Nummer) schon im Lostopf, z. B. online, bleibt es
  bei ihrem Los; der Scanner zeigt es an.
- Losnummer: die von der Karte, wenn frei; sonst eine neue (`E8-123 456`).
- Lead mit Quelle `paper_card`, Einstufung wie online (Units-Bereich → hot/warm/cold), danach wie jede Teilnahme:
  GHL-Tags und Notiz (`syncLeadToGhl`), Bestätigung mit Losnummer über Make (`lead.created`, `lead.completed`),
  Losnummer im GHL-Feld „Messe Losnummer“.
- Der Erfolgsscreen zeigt das Los gross an, damit es auf die Karte geschrieben werden kann.

Offline gescannte Karten werden beim Nachsenden genauso zugeordnet; bei mehreren offenen Gewinnspielen nur in die
Messe aus den Einstellungen. Nach der Ziehung nimmt das Gewinnspiel keine Karten mehr an: Karten vorher scannen.

## Schnellzugriff auf der Messe

- **Eigenes Icon:** `https://myorbit.elev8-suite.com/scan?kamera=1` im Handy-Browser öffnen, anmelden und
  „Zum Home-Bildschirm“ (iPhone, Safari) bzw. „Zum Startbildschirm hinzufügen“ (Android, Chrome) wählen.
  Ein Tipp aufs Icon öffnet direkt die Kamera.
- **App-Verknüpfung:** Ist Orbit als App installiert, erscheint beim langen Drücken aufs Orbit-Icon „Scannen“
  (Android, Windows, macOS; nicht auf dem iPhone).
- Morgens anmelden: Orbit-Sessions laufen nach spätestens 8 Stunden ab. Messe und Serienmodus bleiben pro Gerät gespeichert.

## Was gegenüber der alten App wegfällt

| Alt | Neu |
|---|---|
| Eigene Benutzer (users.json, bcrypt, Admin-Passwort) | Entra-Login, Rolle `App.Scan` (oder Messen/Sales) |
| GHL-User-ID pro Benutzer von Hand pflegen | automatisch über die E-Mail |
| Session-Tags mit Ablaufdatum | Messe aus `/messen` wählen; Tags und Quelle kommen von dort |
| Prompt und Modell im Browser, `/api/extract` leitet beliebige Anfragen an Anthropic weiter | Prompt serverseitig, nur Bilder werden angenommen, Grösse begrenzt |
| Verlauf: letzte 20 in einer JSON-Datei | `scan_history` in Postgres, unbegrenzt, mit Messe-Bezug |
| Zweiter Railway-Dienst mit eigenem Volume und eigenen Secrets | keiner |
| Auto-Auslöser (Kamera erkennt Karte), NFC, QR-vCard, Avatar-Zuschnitt | nicht übernommen (siehe unten) |

## Einrichtung

| Was | Wo |
|---|---|
| App Role `App.Scan` (wer nur scannen soll; Messen- und Sales-Rollen dürfen ohnehin) | Entra → App-Registrierung Orbit → App roles |
| Scopes am GHL-Token zusätzlich: `locations/tags.readonly`, `locations/tags.write`, `medias.write`, `users.readonly`, optional `locations/customFields.write` | GHL → Private Integrations |
| `SCAN_ROLES` (optional, kommagetrennt), `SCAN_MODEL` (optional), `SCAN_CRM_FIELDS` (optional, siehe oben), `PDL_API_KEY` (optional, LinkedIn-Suche über People Data Labs) | Railway |

Danach den alten Dienst `GHL_BC_Scanner` auf Railway stoppen und das Repo archivieren.

## Nicht übernommen, bei Bedarf nachrüstbar

- **Auto-Auslöser:** Die alte App löste bei stillstehender, texturierter Karte selbst aus (Bewegungs- und Kantenerkennung,
  drei Schwellwerte). Hat viel Code gekostet und war je nach Licht unzuverlässig. Kommt nur zurück, wenn der Serienmodus
  auf der nächsten Messe nicht reicht.
- **NFC / QR-Code mit vCard:** Lässt sich als dritter Button neben Kamera und Datei ergänzen (jsQR, Web NFC nur Android/Chrome).
- **Avatar aus der Karte oder dem LinkedIn-Foto als Profilbild in GHL:** GHL nimmt `profilePhoto` nicht zuverlässig an.

## Code

`src/lib/scan` (Zugriff, Extraktion, GHL, Verlauf, Typen, `contest.ts` + `contest-server.ts` fürs Gewinnspiel), `src/app/scan` (Seiten), `src/app/api/scan` (API),
`src/components/scan/Scanner.tsx` (Oberfläche), `db/migrations/019_scan.sql`.
