/**
 * Gemeinsame Typen des Radars.
 *
 * Quellen liefern RawMessage. Das Radar kennt nur dieses Format; alles Quellspezifische (Slack-API, später
 * WhatsApp) bleibt im Connector. So kommen weitere Quellen dazu, ohne Bewertung, Speicher und Oberfläche anzufassen.
 */
export type RawMessage = {
  /** Eindeutig je Verbindung (Slack: Channel-ID:ts). Doppelte werden ignoriert. */
  externalId: string;
  /** Ort in der Quelle: Channel, Gruppe oder Chat */
  channel: string;
  author: string;
  postedAt: string;
  body: string;
  /** Direktlink zum Beitrag in der Quelle (Permalink) */
  url: string | null;
  threadId: string | null;
  /** Kurzer Zusammenhang, z.B. Beitrag, auf den geantwortet wird */
  context: string;
};

/** Verfügbare Quellen. Neue Quelle: hier ergänzen, Connector in connectors/index.ts eintragen. */
export const SOURCE_KINDS = ["slack"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export type Relevance = "high" | "normal" | "low";

export const CATEGORIES = ["competitor", "partner", "lead", "market", "risk", "product", "marketing", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Standardprofil, was für Elev8 relevant ist. Pro Person in den Einstellungen ergänzbar. */
export const DEFAULT_INTERESTS = [
  "Wettbewerber und neue Anbieter (PMS, Channel Manager, KI für Gästekommunikation, Pricing, Smart Lock, Reinigung)",
  "Mögliche Partner und Integrationen (APIs, Schnittstellen, Kooperationen)",
  "Leads und Kunden: Property Manager oder Hosts, die ein Problem haben, das Elev8 löst",
  "Marktnews und Plattformänderungen (Airbnb, Booking.com, Regeln, Gebühren, Nachfrage)",
  "Risiken für Technik und Betrieb (Sicherheitslücken, Ausfälle, Regulierung)",
  "Marketing- und Eventchancen mit echter Reichweite in der STR-Branche",
  "Rückmeldungen und Wünsche zu Funktionen von Elev8 (Hostbuddy, Cockpit, Channel Manager, Housekeeping, Smart Lock)"
].join("\n");
