# Scan – Visitenkarten-Scanner (`/scan`)

Ersetzt die eigenständige App „Elev8 Scan“ (Repo `GHL_BC_Scanner`, eigener Railway-Dienst mit eigenem
Benutzer-Login). Der Scanner ist jetzt ein Orbit-Modul: Anmeldung über Entra, Rechte über App Roles,
GHL und Claude über die Variablen, die Orbit ohnehin hat.

## Ablauf

1. Karte fotografieren (Kamera oder Datei), optional die Rückseite dazu. Bilder werden im Browser auf
   1600 px verkleinert und als JPEG geschickt.
2. Claude liest beide Seiten in einem Aufruf aus (`src/lib/scan/extract.ts`). Erkennt auch Fotos oder
   Screenshots eines LinkedIn-Profils. Prompt und Modell liegen auf dem Server; der Browser schickt nur Bilder.
3. Die Person prüft die Felder, wählt Tags (bestehende aus GHL oder neue) und optional eine **Messe** aus `/messen`.
4. **Senden:** Dublettenprüfung über E-Mail/Telefon (bei Treffer Rückfrage), dann Upsert in GHL mit
   - Quelle `Visitenkarte – <Name>` oder `Messe: <Messename>`
   - `assignedTo` = der GHL-User mit derselben E-Mail wie die Orbit-Anmeldung (keine manuelle Zuordnung mehr)
   - Tags: gewählte Tags + `visitenkarte` + Rollen-Tags (`rolle-manager` …) + bei Messe `messe-lead`, `messe-<slug>` und die Messe-Tags
   - Position, Mobil, LinkedIn, Branche, Sprache in Kontaktfelder (werden nach Namen gesucht, fehlende als Textfeld angelegt; Dropdowns nur bei passender Option, sonst in die Notiz)
   - Notiz mit Scanner, Zeit, Rolle und Freitext; zweite Notiz mit den Kartenfotos aus der GHL-Mediathek
5. Eintrag in `scan_history` (Team-Verlauf unter `/scan/verlauf`).

**Offline:** Ohne Netz landen Scans in einer IndexedDB-Warteschlange im Browser und werden automatisch gesendet,
sobald die Verbindung zurück ist (auch das Auslesen wird dann nachgeholt). Die Warteschlange ist pro Gerät.

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
| `SCAN_ROLES` (optional, kommagetrennt), `SCAN_MODEL` (optional), `PDL_API_KEY` (optional, LinkedIn-Suche über People Data Labs) | Railway |

Danach den alten Dienst `GHL_BC_Scanner` auf Railway stoppen und das Repo archivieren.

## Nicht übernommen, bei Bedarf nachrüstbar

- **Auto-Auslöser:** Die alte App löste bei stillstehender, texturierter Karte selbst aus (Bewegungs- und Kantenerkennung,
  drei Schwellwerte). Hat viel Code gekostet und war je nach Licht unzuverlässig. Kommt nur zurück, wenn der Serienmodus
  auf der nächsten Messe nicht reicht.
- **NFC / QR-Code mit vCard:** Lässt sich als dritter Button neben Kamera und Datei ergänzen (jsQR, Web NFC nur Android/Chrome).
- **Avatar aus der Karte oder dem LinkedIn-Foto als Profilbild in GHL:** GHL nimmt `profilePhoto` nicht zuverlässig an.

## Code

`src/lib/scan` (Zugriff, Extraktion, GHL, Verlauf, Typen), `src/app/scan` (Seiten), `src/app/api/scan` (API),
`src/components/scan/Scanner.tsx` (Oberfläche), `db/migrations/019_scan.sql`.
