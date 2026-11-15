/**
 * Start-Inhalt der Vorlagen-Bibliothek (aus Prozesshandbuch Posteingang und Elev8 Software, Stand 12.11.2026,
 * korrigiert nach dem Prüfbericht vom 15.11.2026). Enthält bewusst keine Passwörter und keine Türcodes.
 * Platzhalter {{k:schluessel}} werden mit den Regeln (gro_constants) des Mandanten ersetzt.
 * Offene Punkte (E1 bis E14) stehen als Entscheide im Modul, nichts davon ist entschieden.
 */
export type SeedProcess = {
  key: string;
  grp: string;
  title: string;
  region: "CH" | "Bali" | "alle";
  trigger: string;
  goal: string;
  steps: string[];
  rules?: string[];
  escalation?: string;
  open?: string[];
  origin?: "handbuch" | "entwurf";
};

export const SEED_CONSTANTS = [
  { key: "grundgaeste", label: "Grundpreis gilt für", value: "2", num: 2, unit: "Gäste", note: "Unabhängig von der Wohnungsgrösse" },
  { key: "zusatzgebuehr", label: "Zusatzgebühr", value: "CHF 25.00", num: 25, unit: "pro Person und Nacht", note: "Quelle nennt Tag und Nacht gemischt (E3)" },
  { key: "citytax", label: "Citytax Zusatzperson", value: "CHF 2.50", num: 2.5, unit: "pro Person und Nacht", note: "Quelle: gilt überall. Vermutlich nur in Citytax-Gemeinden (E3, E8)" },
  { key: "zusatz_total", label: "Total Zusatzperson", value: "CHF 27.50", num: 27.5, unit: "pro Person und Nacht", note: "Zusatzgebühr plus Citytax" },
  { key: "kartengebuehr", label: "Kartengebühr (Standard im Payment Request)", value: "3", num: 3, unit: "%", note: "Rechtlich zu prüfen (E7)" },
  { key: "zahlungsfrist", label: "Zahlungsfrist Direktbuchung", value: "24", num: 24, unit: "Std.", note: "Danach wird die Unterkunft wieder frei" },
  { key: "pruefzeit_ch", label: "Prüfzeit Unverifizierte Schweiz", value: "14:00", num: null, unit: "", note: "Zeitzone und Zuständigkeit offen (E11)" },
  { key: "pruefzeit_bali", label: "Prüfzeit Unverifizierte Bali", value: "09:00", num: null, unit: "", note: "Zeitzone und Zuständigkeit offen (E11)" }
];

export const SEED_PROCESSES: SeedProcess[] = [
  {
    key: "P-1.0", grp: "zugang", title: "Zugangscode prüfen und ersetzen", region: "CH",
    trigger: "Gast meldet, dass der Türcode nicht funktioniert.",
    goal: "Gast kommt in die Wohnung, die Lösung ist intern festgehalten.",
    steps: [
      "In der Buchung den Reiter Smart Lock öffnen: Schlosstyp, Akku und Online-Status prüfen. Ein Objekt kann mehrere Schlösser haben (Haustür, Wohnung, Garage): prüfen, welche Türen der Gast braucht.",
      "Aktuellen Code ablesen (steht in der Buchung und im Gästeführer).",
      "Nuki online: Codes verwalten, Neuen Zugangscode generieren und an den Gast senden.",
      "Nuki offline oder Akku schwach: Es kann kein Code ankommen. Intern an Engineering melden und für den Gast P-1.3 anwenden.",
      "Igloohome: Status offline ist normal, die Codes funktionieren trotzdem. Startzeit und 24-Std.-Fenster prüfen, als Soforthilfe einen Einmalcode senden. Nach Datenänderung neuen Code erzeugen.",
      "Manuelles Schloss: fester Code (z. B. Garage, Hintertür), nur ablesen.",
      "Alle passenden Codes an den Gast senden.",
      "Lösung im internen Raum des Objekts festhalten."
    ],
    rules: [
      "Nuki ist ein Online-System. Wird ein Code gesendet, während das Schloss offline ist, kommt er nie an und Elev8 meldet keinen Fehler. Dasselbe gilt fürs Löschen beim Check-out: Der alte Code bleibt aktiv.",
      "Igloohome rechnet Codes offline (algoPIN, Erstellung über Elev8, Seam, igloohome). Codes sind nicht aus der Ferne löschbar und nicht änderbar: Ein Code bleibt bis zum Ende gültig, auch bei Storno.",
      "Igloohome: Der Code muss in den ersten 24 Std. ab Start einmal genutzt werden. Maximal 3 Codes pro Startstunde bzw. pro Tag, keine Reserve-Codes. Zugriffe sieht man erst nach Bluetooth-Sync.",
      "Igloohome-Code-Arten: Einmalcode (einmal nutzbar, innerhalb 24 Std. ab Start), Stunden-Code (1 Std. bis 28 Tage, Standard), Tages-Code (29 bis 367 Tage, Langzeit), eigener PIN (4 bis 6 Stellen, nur per Bluetooth am Schloss).",
      "Batterie leer: algoPIN hilft nicht. Das Schloss hat einen 9V-Notkontakt, an Engineering eskalieren.",
      "Nuki-Mastercode: öffnet alle Einheiten im Gebäude, ohne Zeitlimit. Nur im echten Notfall, nie routinemässig, erst wenn nachweislich nichts anderes geht. Bei mehreren Wohnungen den Gast genau zur richtigen Tür lotsen. Danach im Raum des Objekts festhalten."
    ],
    escalation: "Schloss offline, Akku schwach oder Batterie leer: Engineering. Storno nach Codeversand (Igloohome-Code bleibt gültig): Listing Manager.",
    open: ["E1: Notfall-Ablauf und Mastercode-Regel", "E2: Wo liegen Codes und Logins künftig?", "Schlosstyp pro Objekt in Elev8 pflegen (Feld zeigt fast überall Not Integrated)", "Bali: Zugang nicht beschrieben"]
  },
  {
    key: "P-1.1", grp: "zugang", title: "Notfall-Zugang Basel Dornacherstrasse (Margaretha, Otilia, Chrischona)", region: "CH",
    trigger: "Gast in Margaretha, Otilia oder Chrischona meldet, der Türcode funktioniere nicht. Gilt nur für diese 3 Wohnungen.",
    goal: "Gast kommt in die Wohnung.",
    steps: [
      "Code im Gästeführer der Buchung prüfen und ggf. ändern (P-1.0).",
      "Hilft das nicht: Gast zur Igloohome-Schlüsselbox leiten. Standort: Dornacherstrasse 185, aussen im Erdgeschoss beim Handlauf zum Keller, beschriftet Otilia / Margaretha / Chrischona. Je Wohnung ein Fach (Margaretha Nr. 1, Otilia Nr. 2, Chrischona Nr. 3).",
      "Box-Code der Wohnung durchgeben (geschütztes Feld im Objekt).",
      "Lösung im Raum des Objekts festhalten."
    ],
    escalation: "Der Super-Admin-Code (Option A, SOP Reto Wyss) ist im Entwurf nur Stufe 2 nach Freigabe.",
    open: ["E1: Option A (Super-Admin-Code zuerst) oder Option B (direkt zur Box, Empfehlung Ursula)? Wer gibt frei?", "Otilia hat in Elev8 die Adresse Bruderholzstrasse 67 (E9)"]
  },
  {
    key: "P-1.2", grp: "zugang", title: "Tür abschliessen erklären", region: "CH",
    trigger: "Gast fragt, wie er die Tür abschliesst. Das Schloss steht in der Buchung unter Smart Lock.",
    goal: "Gast schliesst die Tür korrekt ab.",
    steps: [
      "Nuki: Tür fest zuziehen. Zurück-Taste auf dem Tastenfeld drücken. Das Schloss dreht und sperrt ab. Standard ist manuelles Abschliessen, Auto-Lock kann in der Nuki-App aktiviert werden.",
      "Loxone: schliesst vollautomatisch, die Tür muss nur fest zugezogen sein. In der Regel nach 5 Sekunden, sofern das automatische Schliessen nicht ausgeschaltet wurde."
    ],
    open: ["Igloohome und manuelle Schlösser sind nicht beschrieben"]
  },
  {
    key: "P-1.3", grp: "zugang", title: "Notfall-Zugang und Mastercode (intern)", region: "CH",
    trigger: "Der normale Code funktioniert nicht und P-1.0 hat nicht geholfen.",
    goal: "Gast kommt hinein, ohne dass ein Mastercode zur Routine wird.",
    steps: [
      "Notfallzugang des Objekts im Objektverzeichnis öffnen (Code nur für berechtigte Personen sichtbar, jeder Abruf wird protokolliert).",
      "Gast genau zur richtigen Tür oder Box lotsen.",
      "Einsatz im Raum des Objekts festhalten."
    ],
    rules: ["Mastercode nur bei Notfall, nie routinemässig.", "Vorschlag (nicht aus den Quellen): Nach jedem Mastercode-Einsatz den Code ändern. Ein Code pro Objekt, keine Wiederholungen."],
    open: ["E2: Codes und Logins: Wer darf sie sehen?", "Mehrere Objekte teilen heute denselben Code, einzelne Codes sind trivial"]
  },
  {
    key: "P-2.1", grp: "checkin", title: "Unverifizierte Check-ins anschreiben", region: "alle",
    trigger: "Buchung mit Status Unverifiziert, 1 Tag vor Anreise oder am Anreisetag. Prüfzeit: Schweiz {{k:pruefzeit_ch}}, Bali {{k:pruefzeit_bali}}.",
    goal: "Der Gast schliesst den Online-Check-in ab, die Buchung wird Verifiziert.",
    steps: [
      "Unter Reservierungen die Filter Heute einchecken und Bevorstehend setzen (oder die Liste unter Heute in diesem Modul verwenden).",
      "Buchungen mit Status Unverifiziert öffnen.",
      "Gästeführer-Link genau dieser Buchung kopieren (nie einen anderen).",
      "Passende Vorlage (V-1 bis V-3) einfügen, Platzhalter ersetzen, im Posteingang an den Gast senden. Kanal prüfen (Symbol).",
      "Später prüfen, ob der Status Verifiziert ist. Sonst nachfassen."
    ],
    rules: ["Die Verifizierung ist eine rechtliche Anforderung. Ohne Status Verifiziert ist P-3.1 (Citytax) nicht möglich."],
    open: ["E5: Türcode vor oder nach Verifizierung?", "E11: Prüfzeit in welcher Zeitzone, wer prüft Bali?", "E12: Dynamic Templates statt Handarbeit", "Ist der Status Verifiziert automatisch oder per Klick?", "Nachfass-Intervall fehlt"]
  },
  {
    key: "P-3.1", grp: "citytax", title: "Citytax erfassen", region: "CH",
    trigger: "Täglich im Daily Business, für Gäste in Geroldswil, Schaffhausen und Neuhausen am Rheinfall.",
    goal: "Alle verifizierten Gäste sind im Portal der Gemeinde gemeldet und die Citytax ist erfasst.",
    steps: [
      "Reservierungen filtern: Heute einchecken und Bevorstehend.",
      "Nur Buchungen mit Status Verifiziert weiter bearbeiten. Nicht verifiziert: zuerst P-2.1.",
      "Prüfen, ob schon registriert (Schaffhausen: Citytax-Konto, Geroldswil: Rapport).",
      "Portal der Gemeinde öffnen und einloggen (Zugang aus dem Passwortmanager, nie aus diesem Dokument).",
      "Gäste und Aufenthalt erfassen.",
      "Erfassung kontrollieren und abschliessen."
    ],
    rules: ["Welches Portal gilt, steht pro Objekt im Objektverzeichnis (Feld Citytax-Portal)."],
    open: ["Gäste mit Status Check-in fallen durch den Filter", "E8: Welche weiteren Gemeinden verlangen Meldung oder Abgabe?", "Munot: Adresse in Elev8 prüfen (E9)"]
  },
  {
    key: "P-4.1", grp: "gaeste", title: "Zusatzperson erfassen", region: "CH",
    trigger: "Gast meldet eine zusätzliche Person in einem Schweizer Apartment.",
    goal: "Gästezahl im System stimmt, Gebühr ist berechnet und eingezogen.",
    steps: [
      "Maximale Gästezahl des Objekts prüfen (Objektverzeichnis, live aus Elev8). Bei Objekten mit max. 2 Gästen ist eine Zusatzperson nicht möglich (E4).",
      "Gästezahl in Elev8 erfassen. Bei OTA-Buchungen ist die Zahl dort nicht änderbar, der OTA-Betrag bleibt gleich.",
      "Gebühr berechnen: Anzahl Zusatzpersonen × Nächte × {{k:zusatz_total}} (Zusatzgebühr plus Citytax). Der Rechner unten hilft.",
      "Ausnahme: Wurde die Buchung für 1 Person gemacht und kommt 1 Gast dazu (2 insgesamt), entfällt die Zusatzgebühr, es bleibt nur die Citytax pro Nacht.",
      "Payment Request mit dem Betrag senden (P-5.1).",
      "Zahlungseingang prüfen (P-5.2).",
      "In Citytax-Gebieten Daten der Gastperson für die Meldung einholen (P-3.1)."
    ],
    rules: ["Immer berechnen, auch wenn die Wohnung genug Platz hat.", "Grundpreis: {{k:grundgaeste}}, unabhängig von der Wohnungsgrösse."],
    open: ["E3: Gebührenregel (Tag oder Nacht, Citytax überall oder nur in Citytax-Gemeinden, Bali)", "E4: Objekte mit max. 2 Gästen", "E7: Kartenaufschlag auf dem Betrag"]
  },
  {
    key: "P-4.2", grp: "gaeste", title: "Gästezahl ändern: OTA oder direkt", region: "CH",
    trigger: "Gast fragt, ob er die Gästezahl ändern kann.",
    goal: "Gästezahl und Gebühr stimmen, Citytax-Meldung ist möglich.",
    steps: [
      "Kanal der Buchung prüfen.",
      "OTA (Airbnb, Booking.com, Agoda u. a.): Wir können die Gästezahl nicht selbst ändern. Der Gast ändert die Buchung bei der OTA, oder wir senden einen Payment Request für die Differenz.",
      "Direkt (Website oder direkt): mehr Spielraum, Zusatzgebühr per Payment Request senden.",
      "In Citytax-Gebieten Gästedaten für die Meldung einholen.",
      "Zahlung nachverfolgen: Manche Gäste erwähnen Zusatzgäste und zahlen den Link nicht."
    ]
  },
  {
    key: "P-5.1", grp: "zahlung", title: "Zahlung anfordern (Payment Request)", region: "alle",
    trigger: "Der Gast muss etwas bezahlen (Zusatzperson, Reinigung, Late Check-out u. a.).",
    goal: "Die Zahlungsanfrage ist erstellt und an den Gast geschickt.",
    steps: [
      "Unter Payment Requests oben rechts Anfrage erstellen klicken.",
      "Gast suchen und Unterkunft auswählen.",
      "Zahlungstitel eingeben, kurz und klar (z. B. Zusatzperson 3 Nächte).",
      "E-Mail für die Rechnung, Betrag (ohne Gebühr) und Währung eingeben. Die Beschreibung ist nur für interne Notizen.",
      "Gebührenmodus wählen: Karte (+{{k:kartengebuehr}}, Standard, der Gast zahlt den Gesamtbetrag), Manuell (Gebühr selbst festlegen) oder Keine Gebühr.",
      "Erstellen & Teilen klicken und den Link an den Gast senden."
    ],
    open: ["E7: Kartenaufschlag rechtlich geprüft?", "Late Check-out: Payment Request oder Bestellung? (siehe N-2)"]
  },
  {
    key: "P-5.2", grp: "zahlung", title: "Offene Zahlung nachfassen", region: "alle",
    trigger: "Gast hat den Zahlungslink nicht erhalten oder nicht bezahlt.",
    goal: "Zahlung ist eingegangen.",
    steps: ["Links im Menü Payment Requests öffnen.", "Status Unbezahlt filtern.", "Hinten bei den drei Punkten den Link manuell erneut an den Gast senden."],
    rules: ["Bei offenen Zahlungen den Link immer selbst erneut senden."],
    open: ["Wie lange wird gewartet und wer eskaliert?"]
  },
  {
    key: "P-6.1", grp: "gaeste", title: "Bettwäsche für zusätzliche Personen", region: "CH",
    trigger: "Gast fragt nach Bettwäsche oder meldet Personen, die nicht in der Buchung stehen.",
    goal: "Bettwäsche ist für alle Gäste vorbereitet.",
    steps: [
      "Prüfen, ob alle Personen in der Buchung stehen.",
      "Alle in der Buchung: keine Absprache nötig.",
      "Zusätzliche Personen: im Posteingang intern den Raum Housekeeping des Objekts anschreiben.",
      "Rückmeldung von Housekeeping abwarten, dann dem Gast antworten.",
      "Zusatzgebühr nach P-4.1 berechnen."
    ],
    rules: ["Bali: Apartments bestellen Wäsche über den Gästeführer, Abgabe und Abholung an der Rezeption. Villen: Sammelpunkt nur nach Freigabe von Suma."],
    open: ["E14: Wer oder was ist Suma, und welche Wäsche-Regel gilt für Schweizer Apartments?"]
  },
  {
    key: "P-6.2", grp: "gaeste", title: "Zusatzleistung oder Mangel", region: "alle",
    trigger: "Gast möchte zusätzliche Reinigung oder frische Bettwäsche, oder meldet einen Mangel.",
    goal: "Leistung ist gebucht bzw. der Mangel ist bei Housekeeping.",
    steps: [
      "Standard: Gast auf den Gästeführer hinweisen und dort buchen lassen.",
      "Ist das nicht möglich: Anfrage per Forward to room intern an Housekeeping.",
      "Mangel (fehlt oder kaputt): sofort intern an Housekeeping weiterleiten.",
      "Rückmeldung abwarten und dem Gast antworten."
    ]
  },
  {
    key: "P-7.1", grp: "buchung", title: "Buchung ändern oder stornieren", region: "alle",
    trigger: "Gast möchte Datum, Gästezahl oder Unterkunft ändern oder stornieren.",
    goal: "Die Änderung ist über den richtigen Kanal erledigt und in Elev8 sichtbar.",
    steps: [
      "Kanal der Buchung in Elev8 prüfen (Symbol).",
      "Bei neuen Daten: Verfügbarkeit im Cockpit prüfen.",
      "Booking.com: Gast ändert selbst unter Buchungen & Reisen, Ändern. Oder wir senden im Extranet eine Datumsänderung, der Gast bestätigt per E-Mail. Stornieren kann nur der Gast.",
      "Airbnb: Gast stellt die Änderungsanfrage. Wir können eine Änderung vorschlagen, der Gast muss jede Änderung bestätigen.",
      "Direkt: Änderung abstimmen, Differenz per Payment Request, Zahlung nachverfolgen.",
      "Prüfen, ob die Änderung in Elev8 angekommen ist."
    ],
    rules: ["Bei OTA-Buchungen läuft jede Änderung über die Plattform. Der Gast muss die Änderung dort bestätigen."],
    open: ["Stornobedingungen, Rückerstattung und Kulanz bei Direktbuchungen", "Unterkunftswechsel hat keine Schritte"]
  },
  {
    key: "P-8.0", grp: "buchung", title: "Regeln für Anfragen und Verfügbarkeit", region: "alle",
    trigger: "Gast fragt nach Verfügbarkeit, Preisen, Langzeit oder Besichtigung.",
    goal: "Anfrage wird nach Regel beantwortet.",
    steps: [
      "Bei jeder Anfrage immer nach dem gewünschten Zeitraum fragen.",
      "Unbestätigte Anfragen: Infos strikt begrenzen, keine konkreten Preise nennen.",
      "Frühere oder aktuelle Gäste: Infos frei im Chat teilen (Villen, Apartments, alternative Daten).",
      "Langzeit und Bestpreis (Monats- und Jahresmiete): an Sales (nur Bali).",
      "Besichtigungen: Bali mit Villa-Manager und Sales koordinieren. Schweiz intern mit dem GRO-Team und dem Management besprechen."
    ],
    open: ["Schweiz: Kein Ansprechpartner für Langzeit und Bestpreis", "Wie kommt ein Interessent zur Direktbuchung, wenn Preise und Links erst bei bestätigter Buchung erlaubt sind? (E6)"]
  },
  {
    key: "P-8.1", grp: "buchung", title: "Aufenthalt verlängern", region: "alle",
    trigger: "Gast möchte länger bleiben.",
    goal: "Die Verlängerung ist gebucht, bezahlt und in Elev8 sichtbar.",
    steps: [
      "Verfügbarkeit im Cockpit prüfen (Verfügbarkeit finden).",
      "Unter Reservierungen die Buchung des Gastes anwählen.",
      "Oben rechts Ändern klicken.",
      "Im Menü unten Reservierung verlängern wählen.",
      "Im Bereich Basis das neue Check-out-Datum wählen.",
      "Unter Zimmer & Preis den Preis für die zusätzlichen Nächte eintragen (ohne Preis geht es nicht). Reinigungsgebühr je nach Fall entfernen.",
      "Aufenthalt verlängern klicken. Zusätzlich Gäste sowie Status und Quelle kurz prüfen.",
      "Zahlungslink senden wie bei neuer Buchung ({{k:zahlungsfrist}})."
    ],
    open: ["E6: Bei OTA-Buchungen vermutlich über die Plattform verlängern, nicht über den Zahlungslink", "Kriterien für die Reinigungsgebühr fehlen"]
  },
  {
    key: "P-8.2", grp: "buchung", title: "Neue Buchung für einen Gast (Direktbuchung)", region: "alle",
    trigger: "Ein Gast möchte direkt bei uns buchen.",
    goal: "Die Buchung ist in Elev8 angelegt.",
    steps: [
      "Bevorzugt: Link zur Website senden, der Gast bucht selbst (keine OTA-Kommission). Bei Airbnb-Gästen vor dem Senden unten das Kanal-Symbol antippen und E-Mail statt Airbnb wählen.",
      "Alternative: Im Cockpit die Verfügbarkeit beim Objekt prüfen (Tipp: Inserat suchen oben links).",
      "Mit gedrückter Maustaste von Anreise bis Abreise über die Tage ziehen, bis sich das Buchungsfeld öffnet.",
      "Von und Bis mit Uhrzeit prüfen (darunter steht die Anzahl Nächte).",
      "Gelben Knopf Neue Reservierung klicken. Nicht verwechseln mit Manuelle Sperre und Einstellungen überschreiben, sie legen keine Buchung an.",
      "Basis: Objekt prüfen, geschätzte Ankunftszeit eintragen. Status und Quelle prüfen, Kontaktdaten ausfüllen.",
      "Zimmer & Preis: Zimmer hinzufügen, Tarif unbedingt Default Rates (sonst wird kein Preis angezeigt), Gäste und Preis pro Nacht eintragen, Reinigungsgebühr immer mitberechnen.",
      "Reservierung erstellen und Zahlungslink senden."
    ],
    rules: [
      "Links zur eigenen Website nie über den Airbnb-Chat senden, immer per E-Mail, und nur bei bestätigten Buchungen.",
      "Zahlung innerhalb {{k:zahlungsfrist}}, sonst wird die Unterkunft wieder frei. Satz an den Gast: Bitte schliessen Sie die Zahlung innerhalb von 24 Stunden ab, sonst wird die Wohnung wieder freigegeben."
    ],
    open: ["Satz an den Gast ist in Sie-Form und nennt Wohnung, für die Schweiz auf Du anpassen"]
  },
  {
    key: "N-1", grp: "neu", title: "Anruf bearbeiten (3CX, Anruferprotokolle)", region: "alle", origin: "entwurf",
    trigger: "Eingehender oder verpasster Anruf.",
    goal: "Anruf ist dem Gast zugeordnet und beantwortet.",
    steps: [
      "Unter Anruferprotokolle den Anruf öffnen. Ist die Nummer in der Buchung hinterlegt, erkennt Elev8 Buchung und Gast selbst.",
      "Sonst manuell zuordnen: Bearbeiten, nach Gast oder PMS-ID suchen. Das gilt dann für alle Anrufe dieser Nummer.",
      "Verpasst: zurückrufen oder im Posteingang antworten. KI-Zusammenfassung und Aufgaben prüfen, bei Bedarf eine Aufgabe erstellen."
    ],
    open: ["Rückruf-Frist", "Hinweis an Anrufer zur Gesprächsaufzeichnung und Datenschutz"]
  },
  {
    key: "N-2", grp: "neu", title: "Late Check-out und Early Check-in", region: "alle", origin: "entwurf",
    trigger: "Gast möchte später aus- oder früher einchecken.",
    goal: "Leistung ist freigegeben und bezahlt oder abgelehnt.",
    steps: [
      "Standardweg: Der Gast bestellt die Leistung im Gästeführer (Bestellung, Status Angefragt). Das GRO prüft Folgebuchung und Reinigung und gibt frei oder lehnt ab (auch in Elev8 Go möglich).",
      "Ist der Weg nicht möglich: Payment Request (P-5.1) mit dem Zahlungstitel Late Check-out bzw. Early Check-in.",
      "Status der Bestellung auf erledigt setzen, sobald die Leistung erbracht ist."
    ],
    open: ["Preise, Zeitfenster und wer entscheidet"]
  },
  {
    key: "N-3", grp: "neu", title: "Check-in kontrollieren (ID und Angaben)", region: "alle", origin: "entwurf",
    trigger: "Täglich laut Daily Business.",
    goal: "Angaben und Ausweis sind geprüft, der Status stimmt.",
    steps: [
      "Angaben der Gäste im Online-Check-in und Ausweis (ID) prüfen.",
      "Stimmt alles: Status Verifiziert. Fehlt etwas: Gast anschreiben (P-2.1).",
      "Wenn die Gäste angereist sind: Status Check-in setzen."
    ],
    open: ["Wer setzt welchen Status?", "Speicherort und Weitergabe von Ausweisdaten klären"]
  },
  {
    key: "N-4", grp: "neu", title: "Storno, Beschwerde, Notfall im Objekt (zu schreiben)", region: "alle", origin: "entwurf",
    trigger: "Gast storniert, beschwert sich oder meldet einen Notfall (Heizung, Wasser, Schaden).",
    goal: "Fall ist nach klarer Regel erledigt.",
    steps: ["Noch nicht beschrieben. Pro Fall braucht es Auslöser, Entscheidungsbefugnis, Kulanzgrenzen und Eskalationsweg."],
    open: ["Gemeinsam mit dem Team schreiben"]
  }
];

export const SEED_SHORTCUTS: [string, string][] = [
  ["Der Türcode funktioniert nicht.", "P-1.0"],
  ["Basel Dornacherstrasse: Code geht nicht", "P-1.1"],
  ["Wie schliesse ich die Tür ab?", "P-1.2"],
  ["Online-Check-in fehlt (Unverifiziert)", "P-2.1"],
  ["Citytax erfassen (intern, täglich)", "P-3.1"],
  ["Wir kommen zu dritt.", "P-4.1"],
  ["Kann ich die Gästezahl bei Booking ändern?", "P-4.2"],
  ["Zahlung für eine Leistung anfordern", "P-5.1"],
  ["Ich habe den Zahlungslink nicht erhalten.", "P-5.2"],
  ["Wir brauchen mehr Bettwäsche (mehr Personen)", "P-6.1"],
  ["Frische Bettwäsche bitte / Etwas ist kaputt", "P-6.2"],
  ["Können wir das Datum ändern?", "P-7.1"],
  ["Habt ihr noch etwas frei?", "P-8.0"],
  ["Können wir länger bleiben?", "P-8.1"],
  ["Ich möchte direkt bei euch buchen.", "P-8.2"],
  ["Late Check-out oder Early Check-in", "N-2"],
  ["Anruf eingegangen oder verpasst", "N-1"]
];

export const SEED_ESCALATIONS: [string, string][] = [
  ["Schloss offline, Akku schwach, Technik", "Engineering (Raum des Objekts, Person mit @ erwähnen)"],
  ["Mangel, Wäsche, zusätzliche Reinigung", "Housekeeping (Raum Housekeeping des Objekts)"],
  ["Langzeit und Bestpreis Bali", "Sales"],
  ["Besichtigung Bali", "Villa-Manager und Sales"],
  ["Besichtigung Schweiz", "GRO-Team und Management"],
  ["Notfall", "WhatsApp-Gruppe CH (Entscheid offen, siehe E10)"]
];

export const SEED_TEMPLATES: { key: string; title: string; lang: string; when: string; body: string }[] = [
  {
    key: "V-1", title: "Online-Check-in Deutschland (Sie-Form)", lang: "de", when: "1 Tag vor der Anreise oder am Anreisetag, im Posteingang",
    body: "Hallo {{vorname}}, wir freuen uns sehr, Sie bald bei uns begrüssen zu dürfen!\n\nBitte schliessen Sie Ihren Online-Check-in über Ihren digitalen Gästeguide ab:\n{{link}}\n\nSollten Sie vor oder während Ihres Aufenthalts Fragen haben, ist unser Team jederzeit gern für Sie da. Schreiben Sie uns einfach direkt hier oder über Ihren Gästeguide.\n\nVielen Dank, dass Sie sich für uns entschieden haben. Wir wünschen Ihnen eine gute Anreise und einen wunderbaren Aufenthalt!"
  },
  {
    key: "V-2a", title: "Online-Check-in Schweiz, am Anreisetag (Du-Form)", lang: "de", when: "Am Anreisetag",
    body: "Hallo {{vorname}}! Da heute dein Anreisetag ist, nimm dir bitte einen Moment Zeit, um deinen Gästeleitfaden unter {{link}} auszufüllen.\n\nWenn du diese kurze rechtliche Anforderung erfüllst, können wir deinen Aufenthalt verifizieren, und sobald dies geschehen ist, senden wir dir deinen Zugangscode und die wichtigsten Check-in-Details zu.\n\nWir freuen uns sehr, dich heute zu begrüssen!\n{{name}}\nElevate Team"
  },
  {
    key: "V-2b", title: "Online-Check-in Schweiz, 1 Tag vorher (Vorschlag)", lang: "de", when: "1 Tag vor der Anreise",
    body: "Hallo {{vorname}}! Morgen ist dein Anreisetag. Nimm dir bitte einen Moment Zeit, um deinen Gästeleitfaden unter {{link}} auszufüllen.\n\nDas ist eine kurze rechtliche Anforderung. Sobald dein Aufenthalt verifiziert ist, senden wir dir deinen Zugangscode und die wichtigsten Check-in-Details zu.\n\nWir freuen uns auf dich!\n{{name}}\nElevate Team"
  },
  {
    key: "V-3", title: "Online-Check-in Bali (Du-Form)", lang: "de", when: "1 Tag vor der Anreise oder am Anreisetag",
    body: "Hallo {{vorname}}! Könntest du dir einen Moment Zeit nehmen, um deinen Gästeleitfaden auszufüllen: {{link}}? Nach der Bestätigung erhältst du Zugriff auf wichtige Check-in-Informationen.\n\nBitte beachte, dass dies obligatorisch ist. Melde dich gerne, falls du Hilfe brauchst!\n\nViele Grüsse,\n{{name}}"
  },
  {
    key: "V-3-en", title: "Online-Check-in Bali, Englisch (Vorschlag)", lang: "en", when: "1 Tag vor der Anreise oder am Anreisetag",
    body: "Hi {{vorname}}! Could you take a moment to complete your guest guide: {{link}}? Once it is confirmed you will get access to your check-in details.\n\nPlease note this step is mandatory. Just message us if you need any help!\n\nWarm regards,\n{{name}}"
  }
];

export const SEED_OPEN_ITEMS: { key: string; title: string; question: string; proposal?: string }[] = [
  { key: "E1", title: "Notfall Dornacherstrasse", question: "Option A (Super-Admin-Code zuerst) oder Option B (direkt zur Schlüsselbox) als Standard? Wer gibt den Super-Admin-Code frei?", proposal: "B als Standard, A nur als Stufe 2 nach Freigabe. Das widerspricht sonst der Regel, dass ein Mastercode nur im echten Notfall gilt." },
  { key: "E2", title: "Codes und Logins", question: "Wo liegen sie künftig (Passwortmanager oder geschütztes Feld hier) und wer darf sie sehen?", proposal: "Geschützte Felder im Objekt, Sichtrecht pro Person, Abruf wird protokolliert. Portal-Passwörter und Super-Admin-Code ändern, da sie im PDF standen." },
  { key: "E3", title: "Zusatzpersonen-Gebühr", question: "CHF 25 plus 2.50 Citytax pro Person und Nacht? Citytax nur in Citytax-Gemeinden? Gilt die Regel auch für Bali?" },
  { key: "E4", title: "Objekte mit max. 2 Gästen", question: "Holzfluh, Weinsteig und die beiden Hasenberg-Suiten: Zusatzperson nicht möglich oder Ausnahme?", proposal: "Nicht möglich, Kapazität aus Elev8 ist verbindlich." },
  { key: "E5", title: "Wann kommt der Türcode?", question: "Erst nach Verifizierung freigeben? Heute sagt die Vorlage Schweiz ja, das Nuki-Kapitel sagt, Elev8 sendet den Code bei Buchungseingang." },
  { key: "E6", title: "Verlängerung bei OTA-Buchungen", question: "OTA-Buchungen über die Plattform verlängern, Direktbuchungen über Elev8 mit Zahlungslink?", proposal: "Ja, so wie bei P-7.1 beschrieben." },
  { key: "E7", title: "Kartengebühr 3 %", question: "Rechtlich geprüft (Konsumentenpreise, Plattformregeln)? Gilt sie auch auf dem Citytax-Anteil?" },
  { key: "E8", title: "Citytax ausserhalb Schaffhausen und Zürich", question: "Basel, Balsthal, Kestenholz, Obergösgen, Steffisburg, Widen: Welche Gemeinden verlangen Meldung oder Abgabe?" },
  { key: "E9", title: "Stammdaten Otilia und Munot", question: "Otilia: Bruderholzstrasse 67 (Elev8) oder Dornacherstrasse 185 (Handbuch)? Munot: Basel (Elev8) oder Schaffhausen, Unterstadt 15 (Handbuch)?" },
  { key: "E10", title: "Rolle GRO", question: "Definition der Funktion und Zuordnung zur Elev8-Rolle. Wer ist Eskalationsstufe 2? Gilt für Notfälle die WhatsApp-Gruppe oder der interne Raum?" },
  { key: "E11", title: "Prüfzeit Unverifizierte", question: "14:00 und 09:00 in welcher Zeitzone? Wer prüft Bali?" },
  { key: "E12", title: "Automatisierung", question: "Dynamic Templates für den Gästeführer-Link einführen, GRO macht nur noch das Nachfassen?" },
  { key: "E13", title: "Gastsprachen", question: "Welche Sprachen bekommen Vorlagen (mindestens Englisch für Bali)?" },
  { key: "E14", title: "Suma und Wäsche-Regel", question: "Was ist Suma (Person, Villa, Team)? Welche Wäsche-Regel gilt für Schweizer Apartments?" }
];
