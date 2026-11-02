# SM Manager (`/sm-manager`)

Beiträge für Instagram, Facebook und TikTok der R Villas Bali prüfen, freigeben und terminieren.
Orbit zeigt nur an und gibt frei. Planung, Rendering und Datenbank liegen im Dienst **SM_engine**
(Repo `Elev8-OS/SM_engine`, Railway-Dienst `render-service`).

## Ablauf

1. Ein Make-Szenario („SM engine: Daily post draft“) ruft morgens den Planer auf. Er wählt Format, Säule, Objekt und Fotos
   nach dem Wochenraster, Claude schreibt die Texte, der Dienst rendert Reel, Karussell oder Einzelbild.
2. Der Beitrag liegt unter *Zur Freigabe* mit Vorschau, Text, Hashtags und Hinweisen der Prüfung
   (nicht erlaubte Wörter, Gästezahlen, die nicht in den Fakten stehen).
3. *Freigeben* terminiert den GHL-Entwurf zum gewählten Zeitpunkt. *Ablehnen* speichert die Anmerkung.
4. Unter *Objekte* steuerst du, welche Villen in der Rotation sind. Ein Objekt braucht mindestens 5 gute Fotos.

Ohne verbundene GHL-Konten wird ein Beitrag nur als „freigegeben“ markiert und nicht terminiert.

## Einrichtung

| Was | Wo |
|---|---|
| App Role `App.SMManager` anlegen und zuweisen | Entra → App-Registrierung Orbit → App roles |
| `SM_ENGINE_URL` (z. B. `https://render-service-production-9bb7.up.railway.app`) | Railway, Orbit |
| `SM_ENGINE_API_KEY` (gleicher Wert wie `API_KEY` bei SM_engine) | Railway, Orbit |
| Optional `SM_MANAGER_ROLES` (kommagetrennt, Standard `App.SMManager`) | Railway, Orbit |

Der Schlüssel bleibt auf dem Server, der Browser spricht nur mit Orbit.

## Code

`src/lib/sm-manager` (Zugriff, Dienst-Client, Texte), `src/app/sm-manager` (Seite), `src/app/api/sm-manager` (API),
`src/components/sm-manager` (Oberfläche).
