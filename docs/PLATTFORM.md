# Orbit Plattform

Sechs Bausteine machen Orbit vom Kachel-Portal zur Arbeitsplattform. Alle laufen ohne Einrichtung
weiter wie bisher. Was fehlt, zeigt die Administration unter *Übersicht → Einrichtung*.

| Baustein | Wo | Braucht |
|---|---|---|
| Mein Tag | Startseite | nichts Zusätzliches (nutzt GHL, Offerten, Assistent) |
| Suche und Noah | ⌘K / Strg+K, Kopfzeile, Tab-Leiste | `ANTHROPIC_API_KEY` für Noah |
| Orbit als App (PWA) | Menü → „Als App installieren“ | nichts |
| Statusseite und Alarme | Administration → Status | `RAILWAY_API_TOKEN`, `ORBIT_ALERT_TO` |
| Administration | Menü → Administration (nur `Orbit.Admin`) | optional Rollenvergabe über Graph |
| Kunden-360 | Kachel „Kunden“ (`/kunden`) | GHL wie Sales |
| E-Mail-Assistent | Kachel „E-Mail-Assistent“ (`/assistent`) | Entra-Einrichtung, `ASSISTENT_ENABLED=true` |

Neue Tabellen legt Migration `008_platform.sql` beim Start automatisch an.

## Umgebungsvariablen (alle optional)

| Variable | Zweck |
|---|---|
| `RAILWAY_API_TOKEN` | Account- oder Workspace-Token (railway.com → Account → Tokens). Erkennt abgestürzte Dienste und Crons. |
| `ORBIT_ALERT_TO` | E-Mail-Empfänger für Störungen, kommagetrennt (sonst `ORBIT_ACCESS_REQUEST_TO`) |
| `ORBIT_ALERT_WEBHOOK` | Webhook für Störungen (Slack, Teams, Lark), erhält `{"text": "..."}` |
| `ORBIT_STATUS_INTERVAL_MIN` | Prüfintervall, Standard 5 |
| `ORBIT_STATUS_FAILS` | Fehlschläge in Folge bis zum Alarm, Standard 2 |
| `ORBIT_STATUS_SLOW_MS` | ab wann „langsam“, Standard 4000 |
| `ORBIT_BACKGROUND=false` | schaltet alle Hintergrundaufgaben aus |
| `ORBIT_MY_DAY=false` | blendet „Mein Tag“ aus |
| `ORBIT_ROLE_MANAGEMENT=graph` | Rollen direkt aus Orbit vergeben (siehe unten) |
| `ORBIT_ENCRYPTION_KEY` | Schlüssel für gespeicherte Tokens (sonst aus `AUTH_SECRET`). Nicht ändern, sonst müssen alle Postfächer neu verbunden werden. |
| `NOAH_MODEL` | Modell für Noah (sonst `ANTHROPIC_MODEL`) |
| `KUNDEN_ROLES` | wer Kunden-360 nutzen darf (Standard: `App.Kunden` und die Sales- und Offerten-Rollen) |
| `ASSISTENT_ENABLED=true` | schaltet den E-Mail-Assistenten ein |
| `ASSISTENT_ROLES` | wer ihn nutzen darf (Standard `App.Assistent,Orbit.Staff`) |
| `ASSISTENT_INTERVAL_MIN` | Prüfintervall, Standard 15 |
| `ASSISTENT_BATCH` | höchstens so viele Mails pro Person und Lauf an Claude, Standard 10 |
| `ASSISTENT_LOOKBACK_HOURS` | wie weit zurück, Standard 48 |
| `ASSISTENT_MODEL` | Modell für den Assistenten (sonst `ANTHROPIC_MODEL`) |

## Statusseite

Überwacht werden die Dienste aus `config/services.yaml`: per Adresse (`http`) und, mit `RAILWAY_API_TOKEN`,
über die letzte Bereitstellung auf Railway (`CRASHED` oder `FAILED` = gestört). Nach zwei Fehlschlägen in
Folge wird eine Störung eröffnet und gemeldet, nach der Erholung geschlossen und entwarnt.
Neue Dienste trägst du in `services.yaml` ein (Projekt-, Service- und Environment-ID aus Railway).

## Rollen direkt aus Orbit vergeben

1. Entra Admin Center → App-Registrierung **Orbit** → *API permissions* → *Add a permission* → Microsoft Graph →
   *Application permissions*: `Application.Read.All` und `AppRoleAssignment.ReadWrite.All` → *Grant admin consent*.
2. Railway: `ORBIT_ROLE_MANAGEMENT=graph`.

Danach weist „Bewilligen und zuweisen“ bei Zugriffsanfragen die Rolle direkt zu, und unter *Benutzer* lassen
sich Rollen hinzufügen und entfernen. Alles landet im Protokoll. Die eigene Admin-Rolle lässt sich nicht entfernen.

## E-Mail-Assistent (Moneypenny für alle)

Jede Person verbindet ihr eigenes Postfach. Alle 15 Minuten holt Orbit neue Mails, sortiert Automatisches per
Regel aus, lässt Claude den Rest einordnen und legt bei Bedarf einen Allen-antworten-Entwurf in Outlook an.
Gesendet wird nie etwas. Das Refresh-Token wird verschlüsselt gespeichert und bei jeder Erneuerung ersetzt.

Einrichtung:
1. App-Registrierung **Orbit** → *Authentication* → Web-Redirect-URI `https://myorbit.elev8-suite.com/api/assistent/callback` ergänzen.
2. *API permissions* → Microsoft Graph → *Delegated permissions*: `Mail.ReadWrite`, `User.Read`, `offline_access`
   → *Grant admin consent* (sonst fragt Microsoft jede Person einzeln).
3. Railway: `ASSISTENT_ENABLED=true`.
4. In `config/apps.yaml` bei `assistent` die Zeile `enabled: false` entfernen.

Miss Moneypenny (separater Dienst) läuft unabhängig weiter. Wer den Orbit-Assistenten nutzt, kann Moneypenny abschalten.

## Kunden-360

Daten kommen live aus GHL (Kontakt, Opportunities, Tasks, Termine, Notizen, Nachrichten), dazu Calls und
Offerten aus Orbit und alles, was andere Apps über die Kunden-Schnittstelle liefern (docs/INTEGRATION.md).
Das Briefing von Noah wird 12 Stunden zwischengespeichert.
