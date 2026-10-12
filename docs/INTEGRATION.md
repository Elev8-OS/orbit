# Apps an Orbit anbinden: Mein Tag, Suche, Kunden-360

Eine eingebettete App kann drei Adressen anbieten. Orbit ruft sie **serverseitig** mit dem Orbit-Pass der
angemeldeten Person auf (Cookie `orbit_pass`, wie bei jedem Aufruf aus dem Tab) und zeigt das Ergebnis an.
Die App prüft den Pass und die Rolle genau wie sonst und liefert nur, was diese Person sehen darf.

```yaml
# config/apps.yaml
- id: support-bot
  ...
  integrations:
    today: https://support-bot.elev8-suite.com/orbit/today        # Karte in „Mein Tag“
    search: https://support-bot.elev8-suite.com/orbit/search      # Treffer in der Suche, Parameter ?q=
    customer: https://support-bot.elev8-suite.com/orbit/customer  # Abschnitt in Kunden-360
```

Parameter für `customer`: `contactId` (GHL), `email`, `phone`, `company`.
Zusätzlich sendet Orbit den Header `X-Orbit-Request: today | search | customer`.

## Antwort (alle drei gleich)

```json
{
  "title": "Offene Tickets",
  "count": 3,
  "items": [
    { "id": "4711", "title": "Booking.com-Sync hängt", "meta": "#4711 · hoch · seit 2 Std.", "path": "/admin/tickets/4711", "tone": "danger", "at": "2026-10-12T08:00:00Z" }
  ]
}
```

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `title` | nein | Überschrift (sonst der App-Name) |
| `count` | nein | Zahl im Badge (sonst Anzahl `items`) |
| `items[].title` | ja | Zeile |
| `items[].meta` | nein | zweite Zeile, grau |
| `items[].path` | nein | Pfad in der App; ein Klick öffnet die App als Tab genau dort |
| `items[].tone` | nein | `default`, `warning`, `danger`, `success` |
| `items[].at` | nein | Zeitpunkt (ISO), in Kunden-360 als Datum angezeigt |

Höchstens 50 Einträge. Orbit wartet 4 Sekunden (Suche 3), sonst fehlt die Karte einfach. Leere Liste = keine Karte.

## Andere Apps aus einem Tab öffnen

Aus jedem eingebetteten Tab heraus öffnet diese Nachricht eine andere App an einer bestimmten Stelle:

```js
window.top.postMessage({ type: "orbit:open", app: "kunden", path: "/kunden/<ghl-contact-id>" }, "https://myorbit.elev8-suite.com");
```
