# Orbit by Elev8

Zentrales Dashboard für alle internen und externen Tools. Login über Microsoft Entra ID (Office 365),
Kacheln je nach App Role, persönliche Anordnung per Drag & Drop, Oberfläche auf Deutsch und Englisch,
E-Mails über Resend. Gestaltet nach den Elev8-Markenrichtlinien (Schwarz/Weiss, Elev8-Gelb als Akzent, Inter).

**Stack:** Next.js 15, Auth.js 5 (Microsoft Entra ID), PostgreSQL, Resend, dnd-kit, next-intl, Railway

## Funktionen

- **Microsoft-Login** für Mitarbeitende und B2B-Gäste (Kunden, Partner)
- **Rollenbasierte Kacheln:** Jede App ist an Entra App Roles gebunden. `Orbit.Admin` sieht alles.
- **Drag & Drop** am Griff jeder Kachel, auch per Tastatur (Leertaste, Pfeiltasten) und Touch.
  Die Anordnung wird pro User gespeichert und gilt geräteübergreifend.
- **Neu freigeschaltete Apps** erscheinen hinten und sind beim ersten Besuch als „Neu“ markiert.
- **Suche** (Taste `/`) und **Kategorie-Filter**
- **Deutsch/Englisch:** Umschalter oben rechts, Wahl wird pro User gespeichert. Ohne Wahl gilt die Browsersprache.
- **Begrüssung nach dem Login:** Der Planet geht auf, die Apps des Users rasten auf der Umlaufbahn ein,
  dann fliegen die Kacheln ins Dashboard. Einmal pro Login, überspringbar (Klick oder Escape), entfällt bei
  „Bewegung reduzieren“.
- **Zugriff anfragen:** User fordern Apps an, die sie noch nicht sehen. Die Administration bekommt eine
  E-Mail mit allen Angaben und kann direkt antworten, der User eine Bestätigung.
- **Willkommensmail** beim allerersten Login mit der Liste der freigeschalteten Apps
- **Hell/Dunkel** automatisch nach Systemeinstellung

## Projektstruktur

```
config/apps.yaml          ← App-Registry: hier werden Kacheln gepflegt
db/migrations/            ← SQL-Migrationen (laufen beim Start automatisch)
src/lib/mail/             ← Resend-Versand und E-Mail-Vorlagen
messages/de.json, en.json ← Oberflächentexte
proxy/                    ← Auth-Proxy für Tools ohne Microsoft-Login
src/auth.ts               ← Entra-Login und Rollen
src/lib/apps.ts           ← Sichtbarkeit und Reihenfolge der Kacheln
src/components/           ← Dashboard, Kacheln, Header, Login, Begrüssung
```

## 1. Microsoft Entra einrichten

Im [Entra Admin Center](https://entra.microsoft.com):

1. **App-Registrierung anlegen:** *Identity → Applications → App registrations → New registration*
   - Name: `Orbit`
   - Unterstützte Kontotypen: *Nur Konten in diesem Organisationsverzeichnis* (Gäste funktionieren trotzdem)
   - Redirect-URI (Web): `https://<deine-orbit-domain>/api/auth/callback/microsoft-entra-id`
   - Für lokale Entwicklung zusätzlich: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
2. **Client-Secret:** *Certificates & secrets → New client secret*. Den Wert sofort kopieren.
   Ablaufdatum im Kalender notieren – ein abgelaufenes Secret sperrt alle aus.
3. **App Roles anlegen:** *App roles → Create app role*, jeweils mit *Allowed member types: Users/Groups*:

   | Anzeigename | Wert | Zweck |
   |---|---|---|
   | Orbit Admin | `Orbit.Admin` | sieht alle Apps |
   | Orbit Staff | `Orbit.Staff` | interne Mitarbeitende, dürfen interne Apps anfragen |
   | Pricing | `App.Pricing` | Pricing Cockpit |
   | Operations | `App.Operations` | Reinigungsplaner |
   | … | `App.<Name>` | je Tool eine Rolle |

   Der *Wert* muss exakt dem Eintrag unter `roles` in `apps.yaml` entsprechen.
4. **Rollen zuweisen:** *Enterprise applications → Orbit → Users and groups → Add user/group*.
   - Gruppen einer Rolle zuzuweisen erfordert **Entra ID P1** (in Microsoft 365 Business Premium
     und E3/E5 enthalten). Ohne P1 weist du User einzeln zu.
5. **Empfohlen:** *Enterprise applications → Orbit → Properties → Assignment required = Yes*.
   Dann kann sich nur anmelden, wer mindestens eine Rolle hat. Alle anderen sehen die Meldung
   „Für dieses Konto ist Orbit nicht freigeschaltet“.

### Externe Kunden und Partner

- Externe werden als **B2B-Gäste** eingeladen: *Users → Invite external user*. Danach weist du
  ihnen Rollen zu wie internen Usern.
- Sie melden sich mit ihrem eigenen Firmen-Microsoft-Konto an. Wer kein Microsoft-Konto hat, bekommt
  einen **Einmalcode per E-Mail**, sofern unter *External Identities → All identity providers*
  „Email one-time passcode“ aktiv ist.
- **Vorsicht mit `roles: ["*"]`** in `apps.yaml`: Das bedeutet *alle angemeldeten User, inklusive Gäste*.
  Für rein interne Tools stattdessen eine Rolle wie `App.Internal` verwenden.

## 2. Lokal starten

```bash
cp .env.example .env.local      # Werte eintragen
npx auth secret                 # erzeugt AUTH_SECRET
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=orbit postgres:16
npm install
npm run db:migrate
npm run dev                     # http://localhost:3000
```

## 3. Auf Railway deployen

1. Neues Projekt → *Deploy from GitHub repo* → dieses Repository
2. Im selben Projekt *New → Database → PostgreSQL*
3. Beim Orbit-Service unter *Variables* setzen:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `AUTH_SECRET`, `AUTH_URL` (z.B. `https://orbit.example.com`), `AUTH_TRUST_HOST=true`
   - `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ISSUER`
   - `RESEND_API_KEY`, `MAIL_FROM`, `ORBIT_ACCESS_REQUEST_TO` (siehe Abschnitt 4)
   - optional `ORBIT_ADMIN_ROLE`, `ORBIT_DEFAULT_LOCALE`, `ORBIT_SUPPORT_EMAIL`, `ORBIT_WELCOME_EMAIL`
4. *Settings → Networking → Generate Domain* oder eigene Domain verbinden. Diese Domain als
   Redirect-URI in Entra eintragen (siehe oben).

`railway.json` sorgt dafür, dass beim Build `apps.yaml` geprüft wird (fehlerhafte Konfiguration bricht
das Deployment ab) und beim Start die Migrationen laufen. Health-Check: `/api/health`.

## 4. E-Mail mit Resend einrichten

1. Bei [Resend](https://resend.com) unter *Domains* eine Absender-Domain hinzufügen (empfohlen: eine
   Subdomain wie `mail.elev8-suite.com`) und die angezeigten DNS-Einträge (SPF, DKIM) setzen.
2. Unter *API Keys* einen Key mit *Sending access* erstellen.
3. Auf Railway setzen: `RESEND_API_KEY`, `MAIL_FROM` (z.B. `Orbit <orbit@mail.elev8-suite.com>`),
   `ORBIT_ACCESS_REQUEST_TO` (eine oder mehrere Adressen, kommagetrennt).

Ohne diese Variablen läuft Orbit normal weiter; Willkommensmails werden dann übersprungen und der
Button „Zugriff anfragen“ meldet, dass Anfragen noch nicht eingerichtet sind.

Die Vorlagen liegen in `src/lib/mail/templates.ts`, das gemeinsame Layout in `src/lib/mail/layout.ts`.
Neue Mails verschickst du überall serverseitig mit `sendMail()` aus `src/lib/mail/send.ts`.

## 5. Apps pflegen

Neue Kachel = neuer Eintrag in `config/apps.yaml`, dann committen. Railway deployt automatisch.

```yaml
- id: mein-tool                    # eindeutig, nur a-z, 0-9, -
  name: { de: Mein Tool, en: My tool }
  description:
    de: Was das Tool tut, in einem Satz.
    en: What the tool does, in one sentence.
  url: https://mein-tool.example.com
  icon: Rocket                     # Name aus https://lucide.dev/icons (PascalCase) oder /icons/datei.svg
  category: operations             # id aus "categories"
  roles: [App.MeinTool]            # mindestens eine der Rollen nötig
  openIn: newTab                   # oder sameTab
  enabled: true                    # false = vorübergehend ausblenden
  requestableBy: [Orbit.Staff]     # wer die App über "Zugriff anfragen" anfordern darf (optional)
```

`requestableBy` steuert, wem die App in der Anfrageliste angezeigt wird. Ohne Eintrag bleibt sie für alle,
die sie nicht nutzen, komplett unsichtbar. So sehen externe Partner keine internen Tools. Lege dafür eine
Rolle wie `Orbit.Staff` an und weise sie allen internen Mitarbeitenden zu.

Vor dem Commit prüfen: `npm run apps:check`. Eigene Icon-Dateien kommen nach `public/icons/`.

Die neue Rolle (`App.MeinTool`) zusätzlich in Entra anlegen und zuweisen. Rollenänderungen werden
beim nächsten Login wirksam; Sessions laufen nach spätestens 8 Stunden ab.

## 6. Offerten-App (`/offerten`)

Erstellt nach einem Democall automatisch einen Offert-Entwurf, wenn der Interessent ein Angebot wünscht.
Der Entwurf wird in Orbit geprüft, angepasst und als PDF und/oder Excel direkt aus Orbit versendet.
Danach wird die Offerte beim Kontakt in GoHighLevel abgelegt.

**Ablauf**

1. Fireflies meldet über einen Webhook, dass ein Call fertig transkribiert ist.
2. Claude prüft das Transkript: Wurde ein Angebot verlangt, und mit welchen Eckdaten (Units, Preismodell,
   Zahlungsweise, Channel Manager, Bedürfnisse)? Calls nur mit internen Teilnehmern werden übersprungen.
3. Der Interessent wird über seine E-Mail in GHL gefunden; Name, Firma, Adresse, Sprache und Opportunity
   werden übernommen.
4. Ein Entwurf erscheint unter *Offerten → Entwürfe*, der Organisator bekommt eine Mail. Versendet wird nie automatisch.
5. Beim Versand geht die Mail aus dem Postfach des angemeldeten Users (Microsoft Graph). In GHL wird die
   Datei abgelegt, eine Notiz angelegt und die Opportunity auf „Proposal / Contract Sent“ gesetzt; ihr Wert
   wird auf das Total im ersten Jahr gesetzt.

Unsichere Fälle und Calls ohne erkannten Wunsch stehen unter *Offerten → Calls* und lassen sich von dort
manuell in eine Offerte umwandeln. Offerten können auch ohne Call aus einem GHL-Kontakt oder leer gestartet werden.

**Einrichtung**

| Was | Wo |
|---|---|
| App Roles `App.Offerten` (bearbeiten, senden) und `App.Offerten.Admin` (zusätzlich Preise und Texte) | Entra → App-Registrierung Orbit → App roles |
| Anwendungsberechtigung **Microsoft Graph → Mail.Send** mit Admin-Zustimmung | Entra → Orbit → API permissions |
| `FIREFLIES_API_KEY`, `FIREFLIES_WEBHOOK_SECRET` | Railway |
| Webhook-URL `https://myorbit.elev8-suite.com/api/offerten/webhooks/fireflies`, gleiches Secret | Fireflies → Settings → Developer settings → Webhooks |
| `ANTHROPIC_API_KEY` | Railway |
| `GHL_API_TOKEN` (Private Integration), `GHL_LOCATION_ID` | Railway |
| Optional `GHL_QUOTE_FILE_FIELD_KEY` (Kontaktfeld vom Typ Datei) | Railway |

Alle Variablen mit Erklärung stehen in `.env.example`. Ohne Mail.Send kann `OFFERTEN_MAIL_PROVIDER=resend`
gesetzt werden; dann geht die Offerte über Resend, Antworten landen beim User.

**Mail.Send einschränken (empfohlen):** Die Anwendungsberechtigung erlaubt grundsätzlich das Senden aus
jedem Postfach. Mit einer Exchange *Application Access Policy* lässt sie sich auf eine Gruppe
(z.B. `Sales`) beschränken:

```powershell
New-ApplicationAccessPolicy -AppId <Client-ID von Orbit> -PolicyScopeGroupId sales@elev8-suite.com `
  -AccessRight RestrictAccess -Description "Orbit Offerten: nur Sales"
```

**Preise und Texte** pflegen Admins unter *Offerten → Preise & Einstellungen*. Ohne gespeicherten Stand gilt
die Elev8-Preisliste aus der Billing-Spezifikation. Änderungen wirken auf neue Offerten und auf Entwürfe,
sobald dort das Paket geändert wird; versendete Offerten bleiben unverändert.

**Code:** `src/lib/offerten` (Preislogik, Fireflies, Claude, GHL, PDF, Excel, Versand),
`src/app/offerten` (Seiten), `src/app/api/offerten` (API), `src/components/offerten` (Oberfläche).

## 7. Visitenkarten-Scanner (`/scan`)

Visitenkarte fotografieren (auch Rückseite), Claude liest die Daten aus, die Person prüft sie und der Kontakt
geht mit Tags, Notiz und Kartenfotos nach GoHighLevel – zugewiesen an den GHL-User mit derselben E-Mail wie
die Orbit-Anmeldung. Optional einer Messe aus `/messen` zuordnen: Quelle und Tags kommen dann von dort.
Ohne Netz landen Scans in einer Warteschlange im Browser und werden später gesendet.
Ersetzt den eigenständigen Dienst `GHL_BC_Scanner`. Rollen: `App.Scan` sowie Messen- und Sales-Rollen.
Details in [`docs/SCAN.md`](docs/SCAN.md).

## Sicherheit

- **Eine ausgeblendete Kachel ist kein Zugriffsschutz.** Jedes Tool muss den Login selbst
  durchsetzen: entweder nativ über Entra (mit Prüfung der Rolle) oder über den Auth-Proxy in
  [`proxy/`](proxy/README.md).
- Die API speichert nur App-IDs, die der User auch sehen darf.
- Session-Cookies sind verschlüsselt (Auth.js JWE), das Weiterleitungsziel nach dem Login ist auf
  interne Pfade beschränkt.
- Orbit setzt `X-Frame-Options: DENY` und weitere Sicherheits-Header.

## Ausbau (Phase 2)

- Zugriffsanfragen direkt in Orbit freigeben (die Tabelle `access_requests` ist bereits angelegt)
- Admin-Oberfläche: `apps.yaml` → Tabelle `apps` in Postgres. Das Schema in
  `src/lib/apps-schema.mjs` bleibt dabei gleich, nur `loadAppsConfig()` liest dann aus der Datenbank.
- Favoriten, „zuletzt verwendet“, Status-Badges pro Kachel
- Tools schrittweise nativ an Entra anbinden und die Proxys abbauen
