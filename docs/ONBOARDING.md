# Onboarding

Direkt in Orbit gebaut (`/onboarding`). Aus einem Fireflies-Call mit Startwunsch entsteht ein **Entwurf**; ein Mitarbeiter prüft ihn und drückt auf **Senden**. Erst dann entsteht in Orbit 4 (Partnerportal, `orbit.elev8-suite.com`) das Kundenkonto, und der Kunde bekommt seine Einladung. Es wird **nie automatisch gesendet**.

## Ablauf

1. Fireflies meldet einen fertigen Call an `/api/offerten/webhooks/fireflies`. Der Webhook startet Offerten und Onboarding **getrennt**; ein Fehler in der einen Strecke stoppt die andere nicht.
2. `processOnboardingMeeting` (`src/lib/onboarding/service.ts`) liest das Transkript und lässt Claude prüfen, ob der Interessent ausdrücklich starten will (`analysis.ts`). Interesse, Preisfragen oder der Wunsch nach einer Offerte allein reichen nicht.
   - Startwunsch mit Sicherheit hoch oder mittel: Entwurf wird angelegt, der Organisator bekommt eine E-Mail mit Link.
   - Unsicher (niedrig): kein Entwurf, der Call erscheint mit Begründung unter „Zuletzt geprüfte Calls“.
3. Empfänger, Sprache und Owner kommen aus dem GHL-Kontakt (Suche über die E-Mail der externen Teilnehmer). Der Owner wird in Orbit 4 der zuständige Partner, wenn er dort ein Partner-Konto mit derselben E-Mail hat.
4. Auf der Prüfseite können Angaben geändert werden. **Senden** ruft Orbit 4 auf (`POST /api/integrations/onboarding`): Konto anlegen, GHL-Kontakt verknüpfen, Einladung per E-Mail (7 Tage gültig). Danach steht eine Notiz im GHL-Kontakt.
5. Senden geht pro Entwurf nur einmal. Bei einem Fehler kehrt der Entwurf mit der Meldung zurück.

Entwürfe lassen sich auch von Hand anlegen (E-Mail genügt, der Rest wird aus GHL vorbefüllt).

## Einrichten

| Was | Wo | Wert |
| --- | --- | --- |
| App Roles `App.Onboarding`, `App.Onboarding.Admin` | Entra | anlegen und zuweisen (wie bei den anderen Apps) |
| `ONBOARDING_SERVICE_SECRET` | myorbit **und** Orbit 4 | derselbe zufällige Wert, mindestens 32 Zeichen |
| `ONBOARDING_ORBIT_URL` | myorbit | optional, Standard `https://orbit.elev8-suite.com` |
| `ONBOARDING_ROLE`, `ONBOARDING_ADMIN_ROLE` | myorbit | optional, überschreiben die Rollennamen |

Voraussetzungen, die schon für die Offerten gelten: `ANTHROPIC_API_KEY`, `FIREFLIES_*`, `GHL_API_TOKEN`, `GHL_LOCATION_ID`, Mailversand. Die Migration `020_onboarding.sql` läuft beim Start.

Orbit 4 braucht den passenden Zweig mit `/api/integrations/onboarding` (Repo `Elev8-onboarding`). Ohne das Geheimnis zeigt die Prüfseite eine Warnung und Senden bleibt gesperrt.

## Was (noch) nicht dabei ist

- Der Vertrag vorab wird nicht automatisch zugestellt. Der Wunsch wird beim Kunden vorgemerkt, den Vertrag stellt der CSM von Hand zu.
- Keine GHL-Opportunity-Stufe beim Senden und keine Pipeline über alle Tenants.
- Keine Anbindung an Kunden-360 und „Mein Tag“ (`integrations` in der Registry).
