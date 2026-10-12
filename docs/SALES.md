# Sales-App (`/sales`)

Tagesansicht für das Sales-Team. Zeigt pro Mitarbeiter die Termine aus dem GHL-Kalender, fällige Follow-ups,
Gespräche ohne nächsten Schritt und die eigene Pipeline. GHL bleibt die einzige Quelle: Orbit liest live und
schreibt Änderungen sofort zurück. Gespiegelt wird nichts.

## Seiten

| Seite | Inhalt |
|---|---|
| **Heute** (`/sales`) | Termine heute und morgen, fällige und überfällige Follow-ups (erledigen, verschieben), Gespräche der letzten 21 Tage ohne nächsten Schritt |
| **Pipeline** (`/sales/pipeline`) | Offene eigene Deals nach Stage, Stage wechseln, gewonnen/verloren (mit Rückgängig). Deals ohne Bewegung seit `SALES_STALE_DAYS` Tagen sind gelb markiert |
| **Kontakt** (`/sales/kontakt/<id>`) | Nächste Schritte, Fireflies-Gespräche, Notizen, Deals, Offerten. Follow-up anlegen, Offerte erstellen, in GHL öffnen |

**Gespräche ohne nächsten Schritt** stammen aus den Calls, die der Fireflies-Webhook der Offerten-App schon
verarbeitet (Tabelle `quote_meetings`). Ein Call erscheint, wenn der Mitarbeiter Organisator war, kein
Offertwunsch erkannt wurde und in GHL beim Kontakt weder ein Task nach dem Call noch ein künftiger Termin steht.
„Follow-up anlegen“ holt einen Vorschlag von Noah (Titel, Notiz, Fälligkeit) aus dem Transkript. Erst beim
Bestätigen entsteht der Task in GHL, optional mit der Call-Zusammenfassung als Notiz. „Kein Schritt nötig“
blendet den Call aus (rückgängig machbar).

## Wer sieht was

- Jeder Orbit-User wird über seine **E-Mail** einem GHL-User zugeordnet. Alle Daten werden serverseitig auf
  diesen GHL-User gefiltert: zugewiesene Tasks, Termine und Opportunities.
- Kontakte öffnen, Notizen und Follow-ups gehen nur bei eigenen Kontakten (zugewiesen, eigene Opportunity oder
  eigener Call). Aus einem eigenen Call auch bei noch nicht zugewiesenen Interessenten.
- `App.Sales.Admin` (und `Orbit.Admin`) können oben die Ansicht jedes GHL-Users öffnen. Follow-ups, die sie dort
  anlegen, werden diesem User zugewiesen.

## Einrichtung

| Was | Wo |
|---|---|
| App Roles `App.Sales` und `App.Sales.Admin` anlegen und zuweisen | Entra → App-Registrierung Orbit → App roles |
| Scopes `users.readonly`, `calendars.readonly`, `calendars/events.readonly`, `locations/tasks.readonly` zum bestehenden Token hinzufügen | GHL → Settings → Private Integrations → Token der Offerten |
| Jeder Sales-Mitarbeiter hat in GHL einen User mit derselben E-Mail wie sein Microsoft-Konto | GHL → Settings → My Staff |

Weitere Variablen (alle optional, in Railway):

| Variable | Standard | Zweck |
|---|---|---|
| `SALES_ROLE` / `SALES_ADMIN_ROLE` | `App.Sales` / `App.Sales.Admin` | Rollennamen |
| `SALES_CURRENCY` | `USD` | Währung der Deal-Werte |
| `SALES_STALE_DAYS` | `14` | Ab wie vielen Tagen ohne Bewegung ein Deal markiert wird |
| `SALES_TIMEZONE` | `Europe/Zurich` | Zeitzone, bis der Browser seine eigene gemeldet hat (danach gilt die des Browsers) |

`GHL_API_TOKEN`, `GHL_LOCATION_ID`, `ANTHROPIC_API_KEY` und `FIREFLIES_API_KEY` teilt Sales mit der Offerten-App.

## Code

`src/lib/sales` (GHL-Anbindung, Noah, Logik, Rechte), `src/app/sales` (Seiten), `src/app/api/sales` (API),
`src/components/sales` (Oberfläche), `messages/sales/` (Texte), `db/migrations/007_sales.sql`.
