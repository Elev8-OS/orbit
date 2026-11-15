# GRO Service (/gro)

Arbeitswerkzeug für Guest Relations Operations. Mandantenfähig, live mit Elev8 verknüpft.

## Aufbau
- **Heute**: Unverifizierte Check-ins und Anreisen der nächsten Tage, live aus Elev8, mit Hinweisen (Citytax, Zusatzperson, Kapazität). Schnellwahl vom Gastsatz zur Prozesskarte.
- **Prozesse**: Karten mit Schritten, Regeln, Eskalation und offenen Punkten. Versioniert, Status Entwurf oder Freigegeben. Werte stehen als `{{k:schluessel}}` und kommen aus **Regeln**. P-4.1 enthält den Rechner für die Zusatzperson.
- **Objekte**: Listings live aus Elev8, dazu eigene Felder (Citytax-Portal, Hinweise, verschlüsselte Zugangscodes). Codes sehen nur Personen mit Sichtrecht, jeder Abruf wird im Audit-Log festgehalten.
- **Vorlagen**: Gästenachrichten mit Platzhaltern zum Kopieren.
- **Regeln**, **Entscheide** (Tracker der offenen Punkte E1 bis E14), **Verwaltung**.

## Mandanten
Tabelle `gro_tenants`. Jeder Kunde hat eigene Inhalte, eigenen Elev8-Zugang (Schlüssel AES-256-GCM verschlüsselt), optional einen Tag-Filter auf Listings und eigene Mitglieder. Der Mandant `vorlage` ist die Bibliothek: Neue Kunden übernehmen daraus mit „Vorlage übernehmen“ (kopiert nur Fehlendes, überschreibt nie). Orbit-Admins legen Mandanten an und aktualisieren die Bibliothek.

## Zugriff
Entra-Rollen `App.GRO` (lesen), `App.GRO.Edit`, `App.GRO.Admin` gelten für den Standard-Mandanten (`GRO_DEFAULT_TENANT`, Standard `elevate`). Für andere Mandanten trägt man Mitglieder unter Verwaltung ein.

## Live mit Elev8
Elev8 ist Request/Response. „Live“ heisst: Abruf bei jedem Seitenaufruf mit 45 Sekunden Cache (`GRO_CACHE_SECONDS`), die Seite „Heute“ lädt alle 60 Sekunden selbst nach. Fällt Elev8 aus, zeigt das Modul den letzten Stand. Es gibt keinen Push von Elev8.

## Einrichten
1. Migration `030_gro.sql` ausführen (`npm run migrate`).
2. Entra-Rollen anlegen und zuweisen.
3. In Railway `ELEV8_MCP_URL` und `ELEV8_MCP_TOKEN` setzen (Mandant elevate). Weitere Mandanten: Schlüssel unter /gro/admin.
4. Als Orbit-Admin unter /gro/admin „Bibliothek aktualisieren“, danach im Mandanten „Vorlage übernehmen“.

## Bewusst nicht enthalten
Keine Passwörter und keine Türcodes im Start-Inhalt. Sie gehören in die geschützten Objektfelder oder den Passwortmanager.
