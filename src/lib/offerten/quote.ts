import { z } from "zod";
import type { QuoteSettings, UnitTier } from "./settings-shared";

/**
 * Datenmodell einer Offerte und Preislogik. Läuft auf Server und Client (keine Node-Importe),
 * damit Editor, Vorschau, PDF und Excel exakt dieselben Beträge rechnen.
 */

export type Lang = "de" | "en";
export type Interval = "once" | "monthly" | "yearly";

export const lineSchema = z.object({
  id: z.string().min(1).max(40),
  /** Gesetzt bei Positionen aus dem Konfigurator ("plan", "addon:coins"). Leer = freie Position. */
  key: z.string().max(40).nullable(),
  title: z.string().max(200),
  detail: z.string().max(600),
  qty: z.number().min(0).max(1_000_000),
  unit: z.string().max(40),
  unitPrice: z.number().min(-1_000_000).max(1_000_000),
  discountPercent: z.number().min(0).max(100),
  interval: z.enum(["once", "monthly", "yearly"])
});
export type QuoteLine = z.infer<typeof lineSchema>;

export const configSchema = z.object({
  model: z.enum(["per_unit", "per_booking", "none"]),
  units: z.number().int().min(1).max(100_000),
  billing: z.enum(["monthly", "yearly"]),
  bookingPackageId: z.string().max(32),
  bookingPackageCount: z.number().int().min(1).max(100),
  channelManager: z.boolean(),
  addons: z.array(z.object({ id: z.string().max(32), qty: z.number().int().min(1).max(1_000_000) })).max(20)
});
export type QuoteConfig = z.infer<typeof configSchema>;

export const recipientSchema = z.object({
  name: z.string().max(120),
  firstName: z.string().max(60),
  email: z.string().max(200),
  company: z.string().max(160),
  addressLines: z.array(z.string().max(160)).max(5),
  phone: z.string().max(60),
  /** ISO-Ländercode (CH, DE, …). Steuert den MwSt-Hinweis, z.B. Reverse Charge für Deutschland. */
  country: z.string().max(2).default(""),
  /** USt-IdNr. bzw. UID des Kunden, erscheint bei Reverse Charge auf dem Angebot */
  vatId: z.string().max(40).default("")
});
export type Recipient = z.infer<typeof recipientSchema>;

export const textsSchema = z.object({
  /** Persönliche Anrede am Anfang der Offerte, z.B. "Guten Tag Herr Kümin" oder "Hallo Rico" */
  salutation: z.string().max(200).default(""),
  intro: z.string().max(3000),
  closing: z.string().max(3000),
  notes: z.string().max(3000),
  /** Persönliche Mail zur Offerte (von Claude aus dem Gespräch geschrieben, im Editor anpassbar) */
  emailSubject: z.string().max(250).default(""),
  emailBody: z.string().max(6000).default(""),
  /** Anrede wie im Gespräch: "du" oder "sie" */
  addressForm: z.enum(["du", "sie"]).default("sie")
});
export type QuoteTexts = z.infer<typeof textsSchema>;

export const EMPTY_RECIPIENT: Recipient = {
  name: "",
  firstName: "",
  email: "",
  company: "",
  addressLines: [],
  phone: "",
  country: "",
  vatId: ""
};

/** Ältere Datensätze haben noch nicht alle Felder: mit Standardwerten auffüllen. */
export const normalizeRecipient = (r: Partial<Recipient> | null | undefined): Recipient => ({ ...EMPTY_RECIPIENT, ...(r ?? {}) });
export const normalizeTexts = (t: Partial<QuoteTexts> | null | undefined): QuoteTexts => ({
  salutation: "",
  intro: "",
  closing: "",
  notes: "",
  emailSubject: "",
  emailBody: "",
  addressForm: "sie",
  ...(t ?? {})
});

/** Ansprechperson bei Elev8 auf dem Dokument (Owner des Kontakts in GHL, sonst der Absender) */
export type ContactPerson = { name: string; email: string; phone: string };

export function defaultConfig(settings: QuoteSettings): QuoteConfig {
  return {
    model: "per_unit",
    units: 5,
    billing: "yearly",
    bookingPackageId: settings.perBooking.packages[0]?.id ?? "",
    bookingPackageCount: 1,
    channelManager: true,
    addons: []
  };
}

export function tierForUnits(tiers: UnitTier[], units: number): UnitTier {
  const sorted = [...tiers].sort((a, b) => a.minUnits - b.minUnits);
  return (
    sorted.find((t) => units >= t.minUnits && (t.maxUnits === null || units <= t.maxUnits)) ??
    (units < sorted[0].minUnits ? sorted[0] : sorted[sorted.length - 1])
  );
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const L = {
  de: {
    perUnitTitle: (tier: string) => `Elev8 Suite – Paket ${tier} (Per Unit)`,
    perUnitMonthly: (units: number, months: number) =>
      `${units} ${units === 1 ? "Unit" : "Units"}, monatliche Zahlung, Laufzeit ${months} Monate`,
    perUnitYearly: (units: number, perMonth: string) =>
      `${units} ${units === 1 ? "Unit" : "Units"}, jährliche Zahlung (11 Monate zahlen, 12 erhalten), entspricht ${perMonth} pro Unit und Monat`,
    floor: (floor: number) => ` Mindestverrechnung im Paket: ${floor} Units.`,
    unitMonth: "Unit / Monat",
    unitYear: "Unit / Jahr",
    bookingTitle: (name: string, quota: number) => `Elev8 Suite – Booking-Paket ${name} (${quota} Buchungen)`,
    bookingDetail: (cm: boolean) =>
      `Prepaid-Kontingent ohne Laufzeit, verfällt nicht, automatische Nachladung bei 10 % Restkontingent.${cm ? " Inklusive Channel Manager." : ""}`,
    booking: "Buchung"
  },
  en: {
    perUnitTitle: (tier: string) => `Elev8 Suite – ${tier} package (per unit)`,
    perUnitMonthly: (units: number, months: number) =>
      `${units} ${units === 1 ? "unit" : "units"}, billed monthly, ${months}-month term`,
    perUnitYearly: (units: number, perMonth: string) =>
      `${units} ${units === 1 ? "unit" : "units"}, billed yearly (pay 11 months, get 12), equals ${perMonth} per unit per month`,
    floor: (floor: number) => ` Package minimum: ${floor} units billed.`,
    unitMonth: "unit / month",
    unitYear: "unit / year",
    bookingTitle: (name: string, quota: number) => `Elev8 Suite – ${name} booking package (${quota} bookings)`,
    bookingDetail: (cm: boolean) =>
      `Prepaid quota with no term and no expiry, auto-refill at 10% remaining.${cm ? " Channel manager included." : ""}`,
    booking: "booking"
  }
};

/**
 * Erzeugt die Konfigurator-Positionen neu. Freie Positionen bleiben unverändert erhalten,
 * Rabatte auf Konfigurator-Positionen werden über den key übernommen.
 */
export function buildLines(
  config: QuoteConfig,
  settings: QuoteSettings,
  lang: Lang,
  previous: QuoteLine[] = []
): QuoteLine[] {
  const t = L[lang];
  const fmt = (n: number) => formatMoney(n, settings.currency, lang);
  const discountOf = (key: string) => previous.find((l) => l.key === key)?.discountPercent ?? 0;
  const generated: QuoteLine[] = [];

  if (config.model === "per_unit") {
    const tier = tierForUnits(settings.perUnit.tiers, config.units);
    const billed = Math.max(config.units, tier.floor);
    const floorNote = billed > config.units ? t.floor(tier.floor) : "";
    if (config.billing === "monthly") {
      generated.push({
        id: "plan",
        key: "plan",
        title: t.perUnitTitle(tier.name),
        detail: t.perUnitMonthly(config.units, settings.perUnit.contractMonths) + "." + floorNote,
        qty: billed,
        unit: t.unitMonth,
        unitPrice: tier.monthly,
        discountPercent: discountOf("plan"),
        interval: "monthly"
      });
    } else {
      generated.push({
        id: "plan",
        key: "plan",
        title: t.perUnitTitle(tier.name),
        detail: t.perUnitYearly(config.units, fmt(tier.yearly)) + "." + floorNote,
        qty: billed,
        unit: t.unitYear,
        unitPrice: round2(tier.yearly * 12),
        discountPercent: discountOf("plan"),
        interval: "yearly"
      });
    }
  } else if (config.model === "per_booking") {
    const pkg =
      settings.perBooking.packages.find((p) => p.id === config.bookingPackageId) ?? settings.perBooking.packages[0];
    generated.push({
      id: "plan",
      key: "plan",
      title: t.bookingTitle(pkg.name, pkg.quota) + (config.bookingPackageCount > 1 ? ` × ${config.bookingPackageCount}` : ""),
      detail: t.bookingDetail(config.channelManager),
      qty: pkg.quota * config.bookingPackageCount,
      unit: t.booking,
      unitPrice: config.channelManager ? pkg.priceWithCm : pkg.price,
      discountPercent: discountOf("plan"),
      interval: "once"
    });
  }

  for (const selected of config.addons) {
    const addon = settings.addons.find((a) => a.id === selected.id);
    if (!addon) continue;
    const key = `addon:${addon.id}`;
    generated.push({
      id: key,
      key,
      title: addon.name[lang],
      detail: addon.description[lang],
      qty: selected.qty,
      unit: addon.unit[lang],
      unitPrice: addon.price,
      discountPercent: discountOf(key),
      interval: addon.interval
    });
  }

  const custom = previous.filter((l) => !l.key);
  return [...generated, ...custom];
}

export function lineTotal(line: QuoteLine): number {
  return round2(line.qty * line.unitPrice * (1 - line.discountPercent / 100));
}

export type Totals = {
  once: number;
  monthly: number;
  yearly: number;
  taxPercent: number;
  /** Summe der Beträge, die im ersten Vertragsjahr anfallen (inkl. Steuer). Wird als Opportunity-Wert in GHL gesetzt. */
  firstYear: number;
  intervals: Interval[];
};

export function computeTotals(lines: QuoteLine[], taxPercent: number): Totals {
  const sum = (interval: Interval) =>
    round2(lines.filter((l) => l.interval === interval).reduce((acc, l) => acc + lineTotal(l), 0));
  const once = sum("once");
  const monthly = sum("monthly");
  const yearly = sum("yearly");
  const net = once + monthly * 12 + yearly;
  const intervals = (["once", "monthly", "yearly"] as Interval[]).filter((i) => lines.some((l) => l.interval === i));
  return { once, monthly, yearly, taxPercent, firstYear: round2(net * (1 + taxPercent / 100)), intervals };
}

export const withTax = (amount: number, taxPercent: number) => round2(amount * (1 + taxPercent / 100));

// Node und Browser setzen das Schweizer Tausendertrennzeichen unterschiedlich (' oder ’). Einheitlich ’.
const swissApostrophe = (s: string) => s.replace(/'/g, "’");

export function formatMoney(amount: number, currency: string, lang: Lang): string {
  return swissApostrophe(new Intl.NumberFormat(lang === "de" ? "de-CH" : "en-US", {
    style: "currency",
    currency,
    // "USD 1'234.50" statt "$ 1'234.50": eindeutig für Kunden in allen Märkten
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount));
}

export function formatNumber(n: number, lang: Lang): string {
  return swissApostrophe(new Intl.NumberFormat(lang === "de" ? "de-CH" : "en-US", { maximumFractionDigits: 2 }).format(n));
}

export function formatDate(value: string | Date, lang: Lang): string {
  const date = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value) : value;
  return new Intl.DateTimeFormat(lang === "de" ? "de-CH" : "en-GB", {
    day: "numeric",
    month: lang === "de" ? "2-digit" : "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

export const INTERVAL_LABEL: Record<Lang, Record<Interval, string>> = {
  de: { once: "Einmalig", monthly: "Pro Monat", yearly: "Pro Jahr" },
  en: { once: "One-time", monthly: "Per month", yearly: "Per year" }
};

/** Texte, die im PDF, im Excel und in der Vorschau gleich lauten. */
export const DOC_LABELS = {
  de: {
    document: "Angebot",
    number: "Angebotsnummer",
    date: "Datum",
    validUntil: "Gültig bis",
    contact: "Ihr Kontakt",
    for: "Für",
    position: "Position",
    qty: "Menge",
    unitPrice: "Einzelpreis",
    discount: "Rabatt",
    total: "Betrag",
    interval: "Abrechnung",
    subtotal: "Zwischentotal",
    tax: "Steuer",
    totalOnce: "Total einmalig",
    totalMonthly: "Total pro Monat",
    totalYearly: "Total pro Jahr",
    firstYear: "Total im ersten Jahr",
    notes: "Aus unserem Gespräch",
    exclVat: "exkl. MwSt.",
    vatNote: "Alle Preise verstehen sich exklusive Mehrwertsteuer.",
    reverseCharge: "Steuerschuldnerschaft des Leistungsempfängers (Reverse-Charge-Verfahren, § 13b UStG). Die Umsatzsteuer schuldet der Leistungsempfänger.",
    customerVatId: "USt-IdNr. Kunde",
    terms: "Konditionen",
    page: "Seite",
    sheetQuote: "Angebot",
    sheetHint: "Mengen und Rabatte in den gelben Feldern anpassen, die Beträge rechnen automatisch.",
    included: "Inklusive",
    offerFor: "Angebot für",
    yourOffer: "Ihr Angebot",
    yourOfferDu: "Dein Angebot",
    questions: "Fragen?",
    assistant: "{name}, unser Sales-Assistent, beantwortet Fragen rund um die Uhr per WhatsApp:",
    assistantDu: "{name}, unser Sales-Assistent, beantwortet deine Fragen rund um die Uhr per WhatsApp:",
    personal: "Persönlich erreichen Sie {name}:",
    personalDu: "Persönlich erreichst du {name}:",
    validShort: "gültig bis",
    factPackage: "Paket",
    factInvestment: "Investition im ersten Jahr",
    factValid: "Gültig bis",
    highlights: "Aus unserem Gespräch",
    nextSteps: "So geht es weiter",
    step1Title: "Angebot bestätigen",
    step1: "Antworten Sie auf unsere E-Mail oder schreiben Sie Noah per WhatsApp.",
    step1Du: "Antworte auf unsere E-Mail oder schreib Noah per WhatsApp.",
    step2Title: "Gemeinsam einrichten",
    step2: "Wir richten die Elev8 Suite mit Ihnen ein und binden Ihre Kanäle an.",
    step2Du: "Wir richten die Elev8 Suite mit dir ein und binden deine Kanäle an.",
    step3Title: "Starten",
    step3: "Ihr Team und Ihre Gäste arbeiten ab dem ersten Tag mit der Suite.",
    step3Du: "Dein Team und deine Gäste arbeiten ab dem ersten Tag mit der Suite.",
    whatsappCta: "WhatsApp an {name}",
    available: "rund um die Uhr erreichbar"
  },
  en: {
    document: "Offer",
    number: "Offer number",
    date: "Date",
    validUntil: "Valid until",
    contact: "Your contact",
    for: "For",
    position: "Item",
    qty: "Qty",
    unitPrice: "Unit price",
    discount: "Discount",
    total: "Amount",
    interval: "Billing",
    subtotal: "Subtotal",
    tax: "Tax",
    totalOnce: "Total one-time",
    totalMonthly: "Total per month",
    totalYearly: "Total per year",
    firstYear: "Total in the first year",
    notes: "From our conversation",
    exclVat: "excl. VAT",
    vatNote: "All prices are exclusive of VAT.",
    reverseCharge: "Reverse charge: VAT is payable by the recipient of the service (§ 13b UStG).",
    customerVatId: "Customer VAT ID",
    terms: "Terms",
    page: "Page",
    sheetQuote: "Offer",
    sheetHint: "Change quantities and discounts in the yellow cells; amounts update automatically.",
    included: "Included",
    offerFor: "Offer for",
    yourOffer: "Your offer",
    yourOfferDu: "Your offer",
    questions: "Questions?",
    assistant: "{name}, our sales assistant, answers questions around the clock on WhatsApp:",
    assistantDu: "{name}, our sales assistant, answers your questions around the clock on WhatsApp:",
    personal: "To reach {name} personally:",
    personalDu: "To reach {name} personally:",
    validShort: "valid until",
    factPackage: "Package",
    factInvestment: "Investment in the first year",
    factValid: "Valid until",
    highlights: "From our conversation",
    nextSteps: "Next steps",
    step1Title: "Confirm the offer",
    step1: "Reply to our email or message Noah on WhatsApp.",
    step1Du: "Reply to our email or message Noah on WhatsApp.",
    step2Title: "Set up together",
    step2: "We set up the Elev8 Suite with you and connect your channels.",
    step2Du: "We set up the Elev8 Suite with you and connect your channels.",
    step3Title: "Go live",
    step3: "Your team and your guests work with the Suite from day one.",
    step3Du: "Your team and your guests work with the Suite from day one.",
    whatsappCta: "WhatsApp {name}",
    available: "available around the clock"
  }
} as const;
