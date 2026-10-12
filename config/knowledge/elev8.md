# Elev8 Produktwissen für Noah

Grundlage für Noahs Antworten in Orbit. Bei Produktänderungen hier nachführen (Quelle: Elev8 Product Knowledge).

Elev8 ist eine Plattform für Ferienwohnungs- und Hotelverwaltung (Short-Term Rental, STR) für Property Manager und Hosts, mit Schwerpunkt Bali. Sie vereint Reservationen, Channel Manager, Housekeeping, Analytics, Gästekommunikation und Abrechnung. Elev8 ist B2B: Kunden ("Tenants") sind Verwaltungsfirmen und Hosts, nicht Reisende.

## Platform Architecture

- **Elev8 OS:** die Basis (Anmeldung, Mandantenfähigkeit, Datentrennung, Abrechnungs-Engine, API).
- **Elev8 Platform:** die Produktebene, mit der Tenants arbeiten (Module, Dashboards, Mobile App, Integrationen).
- Jeder Tenant hat eigene, isolierte Daten, einen eigenen Tarif, eigene Benutzer und Rollen sowie eigene Properties und Listings.

## Core Entity Hierarchy

```
Tenant
└── Property (z.B. "Villa Canggu")
    └── Room (z.B. "Room 1 - Pool View")
        └── Listing (verbunden mit Airbnb, Booking.com usw.)
```

- Früher galt 1 Listing = 1 Property, heute kann eine Property mehrere Rooms haben.
- Rooms lassen sich zwischen Properties verschieben (Move Room: Rooms wählen, Ziel-Property wählen, bestätigen; auch mehrere auf einmal). Preise, Tags und Kanaleinstellungen bleiben erhalten.
- Benutzer werden auf Property-Ebene zugewiesen, Rooms erben das.
- Listings kommen über den Channel Manager von den OTAs.

## User Roles

Management-Rollen:
- **Admin:** alle Listings, voller Zugriff.
- **General Manager:** wie Admin, aber nur eigene Listings.
- **Listing Manager:** eigene Listings, voller Betrieb, ohne Benutzerverwaltung und Attendance.
- **Guest Experience Manager:** gästebezogene Funktionen, ohne Activity, Integrationen, Benutzerverwaltung.
- **Quality Manager:** meist nur lesen, verwaltet Tasks und Inventar.
- **Back Office:** Listing-Inhalte, Tasks, Reinigung, Zahlungen; ohne Cockpit und Templates.
- **Finance/HR:** Zahlungen, Attendance, Activity-Reports; Inbox nur bei Erwähnung.
- **Housekeeping Manager:** Reinigungsbetrieb und -plan, ohne Finanzen und Integrationen.

Operative Rollen (vor allem Elev8 Go): Housekeeping (nur App, Inventarverbrauch), Gardener, Pool, Engineering, Electrician, IT Team, Laundry (Inbox nur bei Erwähnung).

Spezialrolle **Owner:** liest Dashboard und Cockpit, bekommt Meldungen zu neuen Reservationen, nur eigene Attendance.

## Core Modules

### Dashboard
- Anstehende Check-ins, Check-outs, laufende Buchungen.
- Umsatz- und Auslastungsgrafiken (6/12 Monate, Vorjahresvergleich).
- Umsatz und Upsells pro Kalendermonat, Auslastung für die nächsten 30 Tage ab heute.

### Cockpit
- Kalender mit allen Reservationen über alle Listings, mit Preisen pro Datum.
- Übersteuern von Preis, Restriktionen und Verfügbarkeit pro Listing und Datum.
- Auch in Elev8 Go (einzelnes und mehrere Listings).

### Listings / Properties
- Hierarchie Property → Room → Listing, Move-Room-Ablauf, Massenverschiebung.

### Reservations
- Quellen: Airbnb, Booking.com, manuell. Statusfeld beim Erstellen und Bearbeiten.
- Buchungsbestätigung wird ausgelöst, wenn ein Listing aktiviert oder ein dynamisches Template erstellt wird.

### Smart Lock
- Partner **Seam**. Mehrere Schlösser pro Property/Listing (z.B. Haustür, Wohnungstür, Garage).
- Manuelles Schloss für Properties ohne Smart Lock. Verwaltung pro Reservation.

### Guest Guide
- Digitaler Gastführer per Link (vor oder beim Check-in) mit allen Reservationsinfos.
- Abschnitte: Good to Know (Infos, Hausregeln, Tipps), Check-in/Check-out-Schritte, Upsells.
- Versand z.B. über Dynamic Templates vor dem Check-in. Branding (Farben, Logo, Favicon) gilt hier.

### Hostbuddy
- KI-gestützte Gästekommunikation, auf Reservationsebene integriert, pro Reservation ein- und ausschaltbar.

### Upsell
- Tenants erstellen eigene Zusatzleistungen ("Create Upsell").
- Kategorien: Motorrad, Flughafentransfer, Privatkoch, Spa, Aktivität, Late Check-out, Early Check-in, Zwischenreinigung, Büroausstattung, Baby, Sonstiges.

### Analytics / Reports
- Umsatz pro Listing und Property, Auslastung (30 Tage rollierend, monatlich, 12 Monate), ADR.
- Exporte (mit Task-Filter), Attendance-Export mit Eintrittsdatum.

## Extras

### Operations
**Cleanings:** Reinigungsplan (wer reinigt welches Listing), Verlauf pro Listing, Zeit pro Reinigung, Reinigungsrichtlinien und Checklisten mit geschätzter Zeit pro Aufgabe, Timer, Qualitätsbewertung pro Listing.
**Tasks:** Aufgaben erstellen und anderen Rollen zuweisen, Verlauf, Status To Do / In Progress / Done; im Web und in Elev8 Go.

### Smart Flow
**Dynamic Templates:** automatische Nachrichten an Gäste zu einem festgelegten Zeitpunkt (z.B. 2 Tage vor Check-in den Link zum Guest Guide).
**IoT Automations:** Regeln nach dem Muster Wenn [Auslöser] Dann [Aktion]; setzt Elev8 Bridge voraus.
**Elev8 Bridge:** IoT-Gateway-Hardware (Partner **Shelly**) für Bewegungsmelder, Türsensoren und Heizkörperthermostate (TRV).
**Attendances:** Ein- und Ausstempeln pro Mitarbeiter, exportierbar (mit Eintrittsdatum).

### Branding
**Brand Setting:** Logo, Favicon (Dashboard, Guest Guide, Rechnung), Marken-, Hintergrund- und Textfarbe. Farben gelten nur für den Guest Guide, nicht fürs Dashboard.
**Websites:** Tenants können aus ihren Listing- und Property-Daten automatisch eine Website erzeugen.

### Elev8 Go (Mobile App)
Flutter-App für alle Mitarbeitenden: Attendance (Ein-/Ausstempeln), Cockpit, Cleaning/Housekeeping (Reinigungen ansehen, starten, zuweisen), Tasks, Guest Inbox (Gäste über die OTA anschreiben, rollenabhängig), Internal Inbox (Team-Chat pro Listing-Gruppe), Activity (Aktivitäten mit Zeiterfassung).

## Billing & Pricing Engine

### Per Booking (Prepaid Quota)
- Tenant kauft ein Buchungskontingent im Voraus; keine Monatsrechnung, kein Ablauf.
- Automatisches Nachladen bei 10 % Restkontingent (gleiches Paket, sofort belastet).
- E-Mail-Hinweise bei 15 % (Warnung) und 10 % (Abbuchung).
- Pakete: Starter (50), Growth (250), Enterprise (1'000).

### Per Unit (Abo)
- Abrechnung pro aktiver Unit (Unit = Room bzw. buchbare Einheit) und Monat, 1 Jahr Vertragslaufzeit.
- Mindestabrechnung: immer mindestens das untere Ende des Pakets.
- Pakete: Starter (1–4 Units), Growth (5–19), Pro (20–49), Enterprise (50+).
- Zahlung monatlich oder jährlich ("11 zahlen, 12 erhalten").
- Kontingent wird beim Aktivieren einer Unit abgezogen (nicht pro Buchung).
- Rechnung erst 24 Stunden nach Aktivierung einer Unit.

### Modellwechsel
- Per Booking → Per Unit: Wechsel ist vorgemerkt, Restkontingent wird zuerst aufgebraucht, dann startet Per Unit automatisch.
- Per Unit → Per Booking: sofort (Vertragsstrafen möglich).
- Upgrade-Paywall, wenn eine Aktivierung das Paketmaximum überschreiten würde.

## Integrations

- **Channel Manager (Channex):** OTA-Kanäle (Airbnb, Booking.com u.a.) direkt aus Elev8 verbinden und verwalten: Listing-Sync, Kalender, Preise, Verfügbarkeit. "Mit CM" / "ohne CM" im Tarif bezeichnet, ob der Channel Manager enthalten ist (gegenüber Kunden ohne Partnernamen).
- **Stripe:** Zahlungen, Abo-Abrechnung und Kontingentkäufe.
- **Mekari Jurnal (geplant):** automatische Verkaufsrechnung bei bestätigter Buchung, Zahlungssync, Kontakte, Kostenstellen pro Property.
- **MCP-Server:** `mcp.elev8-suite.com`, Anmeldung pro Tenant mit JWT; Housekeeping-Rollen und Gäste haben keinen Zugriff.

## Brand & Design

- Primärfarbe Gelb `#F6BB12` / `#EFB100`, Schrift Inter, helle, ruhige Flächen.
- Desktop-Basis 1440 px, voll responsiv; Mobile über Elev8 Go.

## Key Terminology Glossary

| Begriff | Bedeutung |
|---|---|
| Tenant | Verwaltungsfirma oder Host, die Elev8 nutzt |
| Property | oberste Gruppierung von Rooms (z.B. Villenanlage) |
| Room | einzelne buchbare Einheit in einer Property |
| Listing | OTA-verbundene Version eines Rooms (z.B. auf Airbnb) |
| Quota | gekauftes Buchungskontingent (Per Booking) |
| Unit | buchbare Einheit (= Room), Abrechnungseinheit bei Per Unit |
| Package floor | Mindestanzahl abgerechneter Units im Paket |
| Proration | anteilige Abrechnung bei Aktivierung oder Upgrade mitten im Zyklus |
| Hostbuddy | KI-Gästekommunikation von Elev8 |
| IoT Automations | Wenn-Dann-Regeln mit IoT-Geräten über Elev8 Bridge |
| Bridge | IoT-Gateway-Hardware (Shelly) |
| Elev8 Go | Mobile App für alle Mitarbeitenden |
| Cockpit | Kalender mit allen Reservationen und Preisübersteuerung |
| CM | Channel Manager (Channex) |
| Extrasauber | Feld für Reinigungsnotizen an der Reservation |
| Dynamic Templates | automatische Gästenachrichten zu festen Zeitpunkten |
| Smart Lock | Schlossintegration über Seam |
| Guest Guide | digitaler Gastführer mit Infos, Check-in-Schritten und Upsells |
| Websites | automatisch erzeugte Tenant-Website |
| Upsell | Zusatzleistung für Gäste |
| ADR | Average Daily Rate (durchschnittlicher Tagespreis) |
| OTA | Online Travel Agency (Airbnb, Booking.com usw.) |
