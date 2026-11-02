type Locale = "de" | "en";
type P = Record<string, string | number>;

const de = {
  tabAudience: "Zielgruppen",
  title: "Zielgruppen und Zeitpunkt für Anzeigen",
  intro: "Eine Empfehlung aus deinen Elev8-Daten: In welche Länder, wann und mit welchem Motiv sich Anzeigen für die Villen mit freien Nächten lohnen. Es wird nichts geschaltet und kein Geld ausgegeben.",
  unavailableTitle: "Empfehlung gerade nicht verfügbar",
  unavailable: "Die Engine konnte die Daten aus Elev8 nicht laden. Bitte später nochmal versuchen.",
  asOf: "Stand",
  basisTitle: "Grundlage (letzte 12 Monate)",
  kBookings: "Buchungen mit Herkunft",
  kLead: "Vorlauf (Median)",
  kLeadSub: (p25: number, p75: number) => `25 % buchen kürzer als ${p25} Tage, 75 % kürzer als ${p75} Tage`,
  kFamily: "Buchungen mit Kindern",
  kStay: "Aufenthalt (Median)",
  days: "Tage",
  nights: "Nächte",
  marketsTitle: "Märkte",
  marketsIntro: "Rangfolge nach Anteil an Buchungen und Nächten, gewichtet damit, ob in den nächsten Wochen Ferien in diesem Land liegen. Das Budget wird auf die fünf stärksten Märkte verteilt.",
  colMarket: "Markt",
  colShare: "Buchungen",
  colNights: "Nächte",
  colStay: "Ø Aufenthalt",
  colGroup: "Ø Gruppe",
  colWindow: "Nächste Ferien",
  colAds: "Anzeigen ab",
  colBudget: "Budgetanteil",
  noAds: "Keine Anzeigen möglich",
  noWindow: "nicht hinterlegt",
  villasTitle: "Empfehlung pro Villa",
  villasIntro: "Sortiert nach freien Nächten im Zeitraum.",
  free: (n: number, days: number, pct: number) => `${n} freie Nächte in den nächsten ${days} Tagen (${pct} %)`,
  firstFree: "Erste freie Nacht",
  priority: { high: "Hoher Bedarf", medium: "Mittlerer Bedarf", low: "Niedriger Bedarf" } as Record<string, string>,
  languages: "Anzeigensprache",
  motif: "Motiv-Idee",
  status: { now: "Jetzt bewerben", soon: "Bald starten", running: "Ferien laufen schon", later: "Später", beyond: "Später relevant" } as Record<string, string>,
  windows: {
    christmas: "Weihnachten", summer: "Sommer", easter: "Ostern", winter: "Winter", spring: "Frühling", autumn: "Herbst", feb_half: "Februar-Ferien", may_half: "Mai-Ferien",
    oct_half: "Oktober-Ferien", pentecost: "Pfingsten", thanksgiving: "Thanksgiving"
  } as Record<string, string>,
  angles: {
    long_stay: "Workation, Langzeit, Ruhe",
    group: "Gemeinsame Zeit, Platz für alle",
    short_stay: "Auszeit, schnell abschalten",
    couple: "Zweisamkeit, Privatsphäre"
  } as Record<string, string>,
  reasons: {
    share: (p: P) => `${p.pct} % der Buchungen`,
    window_now: (p: P) => `Ferien (${p.name}) ${p.start} bis ${p.end}, Anzeigen ab ${p.adsStart}`,
    window_soon: (p: P) => `Ferien (${p.name}) ab ${p.start}, Anzeigen ab ${p.adsStart}`,
    window_later: (p: P) => `Ferien (${p.name}) ab ${p.start}`,
    window_running: (p: P) => `Ferien (${p.name}) laufen schon bis ${p.end}: nur noch kurzfristige Buchungen`,
    window_beyond: (p: P) => `Nächste Ferien (${p.name}) erst ab ${p.start}, für die aktuellen Lücken weniger wichtig`,
    no_window: () => "Keine Ferientermine hinterlegt",
    long_stay: (p: P) => `Bleibt lang (Ø ${p.stay} Nächte)`,
    group: (p: P) => `Reist in größeren Gruppen (Ø ${p.group} Personen)`,
    short_stay: (p: P) => `Kurze Aufenthalte (Ø ${p.stay} Nächte)`,
    couple: (p: P) => `Meist zu zweit (Ø ${p.group} Personen, ${p.stay} Nächte)`,
    big_villa_group: (p: P) => `Passt zu einer Villa für ${p.guests} Gäste (Gruppen Ø ${p.group})`
  } as Record<string, (p: P) => string>,
  notesTitle: "Bitte beachten",
  notes: {
    holidays_approx: () => "Die Ferienfenster sind typische Richtwerte. Sie unterscheiden sich je nach Region und Jahr.",
    all_channels: () => "Die Herkunft stammt aus allen Kanälen (Booking.com, Airbnb, direkt) und allen Einheiten mit dem Tag „indonesia“, auch Studios. Direktbucher können anders aussehen.",
    no_conversion_feedback: () => "Noch keine Rückmeldung aus Buchungen: Bekannt sind Klicks, aber nicht, welche Anzeige zu einer Buchung führte.",
    meta_decides: () => "Das Tool empfiehlt Länder, Zeitpunkt, Sprache und Motiv. Wer die Anzeige innerhalb eines Landes sieht, entscheidet Meta. Empfohlen: breite Zielgruppe statt vieler Interessen.",
    unknown_country: (pct: number) => `Bei ${pct} % der Buchungen fehlt das Land. Sie sind in den Anteilen nicht enthalten.`,
    restricted_ru: () => "Russland: Meta schaltet dort praktisch keine Anzeigen. Das Budget geht an andere Märkte. Russischsprachige im Ausland lassen sich über das Sprachtargeting prüfen."
  } as Record<string, (n: number) => string>
};

const en: typeof de = {
  tabAudience: "Audiences",
  title: "Audiences and timing for ads",
  intro: "A recommendation from your Elev8 data: which countries, when and with which angle ads are worth it for the villas with free nights. Nothing is published and no money is spent.",
  unavailableTitle: "Recommendation not available right now",
  unavailable: "The engine could not load the data from Elev8. Please try again later.",
  asOf: "As of",
  basisTitle: "Basis (last 12 months)",
  kBookings: "Bookings with origin",
  kLead: "Lead time (median)",
  kLeadSub: (p25: number, p75: number) => `25% book within ${p25} days, 75% within ${p75} days`,
  kFamily: "Bookings with children",
  kStay: "Stay (median)",
  days: "days",
  nights: "nights",
  marketsTitle: "Markets",
  marketsIntro: "Ranked by share of bookings and nights, weighted by whether school holidays in that country fall in the coming weeks. The budget is split across the five strongest markets.",
  colMarket: "Market",
  colShare: "Bookings",
  colNights: "Nights",
  colStay: "Avg. stay",
  colGroup: "Avg. group",
  colWindow: "Next holidays",
  colAds: "Ads from",
  colBudget: "Budget share",
  noAds: "No ads possible",
  noWindow: "not on file",
  villasTitle: "Recommendation per villa",
  villasIntro: "Sorted by free nights in the period.",
  free: (n: number, days: number, pct: number) => `${n} free nights in the next ${days} days (${pct}%)`,
  firstFree: "First free night",
  priority: { high: "High need", medium: "Medium need", low: "Low need" },
  languages: "Ad language",
  motif: "Angle idea",
  status: { now: "Advertise now", soon: "Start soon", running: "Holidays already running", later: "Later", beyond: "Relevant later" },
  windows: {
    christmas: "Christmas", summer: "Summer", easter: "Easter", winter: "Winter", spring: "Spring", autumn: "Autumn", feb_half: "February break", may_half: "May break",
    oct_half: "October break", pentecost: "Whitsun", thanksgiving: "Thanksgiving"
  },
  angles: {
    long_stay: "Workation, long stay, calm",
    group: "Time together, room for everyone",
    short_stay: "A break, switching off fast",
    couple: "Togetherness, privacy"
  },
  reasons: {
    share: (p) => `${p.pct}% of bookings`,
    window_now: (p) => `Holidays (${p.name}) ${p.start} to ${p.end}, ads from ${p.adsStart}`,
    window_soon: (p) => `Holidays (${p.name}) from ${p.start}, ads from ${p.adsStart}`,
    window_later: (p) => `Holidays (${p.name}) from ${p.start}`,
    window_running: (p) => `Holidays (${p.name}) already running until ${p.end}: short-notice bookings only`,
    window_beyond: (p) => `Next holidays (${p.name}) only from ${p.start}, less important for the current gaps`,
    no_window: () => "No holiday dates on file",
    long_stay: (p) => `Stays long (avg. ${p.stay} nights)`,
    group: (p) => `Travels in larger groups (avg. ${p.group} people)`,
    short_stay: (p) => `Short stays (avg. ${p.stay} nights)`,
    couple: (p) => `Mostly two people (avg. ${p.group} people, ${p.stay} nights)`,
    big_villa_group: (p) => `Fits a villa for ${p.guests} guests (groups avg. ${p.group})`
  },
  notesTitle: "Please note",
  notes: {
    holidays_approx: () => "The holiday windows are typical guide values. They differ by region and year.",
    all_channels: () => "Origin data comes from all channels (Booking.com, Airbnb, direct) and all units tagged “indonesia”, including studios. Direct bookers may look different.",
    no_conversion_feedback: () => "No feedback from bookings yet: clicks are known, but not which ad led to a booking.",
    meta_decides: () => "The tool recommends countries, timing, language and angle. Meta decides who sees the ad within a country. Recommended: a broad audience instead of many interests.",
    unknown_country: (pct) => `The country is missing for ${pct}% of bookings. They are not included in the shares.`,
    restricted_ru: () => "Russia: Meta practically does not deliver ads there. The budget goes to other markets. Russian speakers abroad can be checked via language targeting."
  }
};

export const audienceStrings = (locale: Locale) => (locale === "en" ? en : de);
export type AudienceStrings = ReturnType<typeof audienceStrings>;
