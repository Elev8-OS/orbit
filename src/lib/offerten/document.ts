import {
  DOC_LABELS,
  INTERVAL_LABEL,
  computeTotals,
  formatDate,
  formatMoney,
  formatNumber,
  lineTotal,
  withTax,
  type Interval,
  type ContactPerson,
  type Lang,
  type QuoteConfig,
  type QuoteLine,
  type QuoteTexts,
  type Recipient
} from "./quote";
import { fillTemplate, formatPhone, whatsappLink, type QuoteSettings } from "./settings-shared";

/**
 * Bereitet eine Offerte für die Ausgabe auf. PDF, Excel und die Vorschau im Editor nutzen dieses Modell,
 * damit überall dieselben Texte und Beträge stehen. Läuft auch im Browser.
 */

export type QuoteForDocument = {
  number: string;
  language: Lang;
  currency: string;
  recipient: Recipient;
  config: QuoteConfig;
  lines: QuoteLine[];
  texts: QuoteTexts;
  validUntil: string;
  createdAt: string;
  sentAt?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  /** Ansprechperson (Owner in GHL); hat Vorrang vor ownerName/ownerEmail */
  contactPerson?: ContactPerson | null;
};

export type DocLine = QuoteLine & {
  total: number;
  qtyText: string;
  unitText: string;
  unitPriceText: string;
  discountText: string;
  totalText: string;
  intervalText: string;
};

export type DocTotalRow = {
  label: string;
  amount: number;
  text: string;
  strong?: boolean;
  interval?: Interval;
  kind?: "total" | "firstYear";
};

export type QuoteDocument = {
  lang: Lang;
  labels: Record<keyof (typeof DOC_LABELS)["de"], string>;
  currency: string;
  number: string;
  dateText: string;
  validUntilText: string;
  issuer: QuoteSettings["issuer"];
  recipient: Recipient;
  contact: { name: string; email: string; phone: string };
  /** MwSt-Hinweis: Reverse Charge (z.B. Deutschland) oder "exkl. MwSt." */
  taxNote: string;
  reverseCharge: boolean;
  customerVatId: string;
  /** Persönliche Anrede am Anfang (von Noah geschrieben oder aus dem Namen abgeleitet) */
  salutation: string;
  intro: string;
  closing: string;
  notes: string;
  terms: string;
  /** Überschrift der Angebotsseite: "Ihr Angebot" bzw. "Dein Angebot" */
  offerHeading: string;
  /** Noah, der Sales-Assistent, als Kontakt für Fragen (WhatsApp, 24/7) */
  assistant: { text: string; phone: string; link: string } | null;
  /** Hinweis auf die persönliche Ansprechperson im Fragen-Kasten */
  personalText: string;
  /** Eckdaten fürs Deckblatt: Paket, Investition, Gültigkeit */
  facts: { label: string; value: string; sub?: string }[];
  /** Drei nächste Schritte auf der Angebotsseite */
  steps: { title: string; text: string }[];
  /** Name des Sales-Assistenten (für "WhatsApp an Noah") */
  assistantName: string;
  lines: DocLine[];
  hasDiscount: boolean;
  totals: DocTotalRow[];
  taxPercent: number;
  firstYear: number;
  fileBase: string;
};

export function buildDocument(q: QuoteForDocument, settings: QuoteSettings): QuoteDocument {
  const lang = q.language;
  const du = q.texts.addressForm === "du";
  const labels: Record<keyof (typeof DOC_LABELS)["de"], string> = {
    ...DOC_LABELS[lang],
    ...(lang === "de" && du ? { contact: "Dein Kontakt" } : {})
  };
  const money = (n: number) => formatMoney(n, q.currency, lang);
  const validUntilText = formatDate(q.validUntil, lang);
  const taxPercent = settings.taxPercent;

  const lines: DocLine[] = q.lines.map((l) => ({
    ...l,
    total: lineTotal(l),
    qtyText: formatNumber(l.qty, lang),
    unitText: l.unit,
    unitPriceText: l.unitPrice === 0 ? labels.included : money(l.unitPrice),
    discountText: l.discountPercent ? `${formatNumber(l.discountPercent, lang)} %` : "",
    totalText: l.unitPrice === 0 ? labels.included : money(lineTotal(l)),
    intervalText: INTERVAL_LABEL[lang][l.interval]
  }));

  const country = (q.recipient.country ?? "").toUpperCase();
  const reverseCharge = Boolean(country && (settings.reverseChargeCountries ?? ["DE"]).includes(country));
  const t = computeTotals(q.lines, taxPercent);
  const totals: DocTotalRow[] = [];
  const intervalRows: [Interval, string, number][] = [
    ["once", labels.totalOnce, t.once],
    ["monthly", labels.totalMonthly, t.monthly],
    ["yearly", labels.totalYearly, t.yearly]
  ];
  for (const [interval, label, amount] of intervalRows) {
    if (!t.intervals.includes(interval)) continue;
    if (taxPercent > 0) {
      totals.push({ label: `${label} (${labels.subtotal})`, amount, text: money(amount), interval });
      const tax = withTax(amount, taxPercent) - amount;
      totals.push({ label: `${labels.tax} ${formatNumber(taxPercent, lang)} %`, amount: tax, text: money(tax), interval });
    }
    const gross = withTax(amount, taxPercent);
    totals.push({
      label: taxPercent > 0 ? label : `${label} ${labels.exclVat}`,
      amount: gross,
      text: money(gross),
      strong: true,
      interval,
      kind: "total"
    });
  }
  if (t.intervals.length > 1 || t.intervals.includes("monthly")) {
    totals.push({
      label: taxPercent > 0 ? labels.firstYear : `${labels.firstYear} ${labels.exclVat}`,
      amount: t.firstYear,
      text: money(t.firstYear),
      strong: true,
      kind: "firstYear"
    });
  }

  const recipientName = q.recipient.company || q.recipient.name || "Offer";
  const safe = recipientName.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 40);

  return {
    lang,
    labels,
    currency: q.currency,
    number: q.number,
    dateText: formatDate(q.sentAt ?? new Date().toISOString(), lang),
    validUntilText,
    issuer: { ...settings.issuer, phone: formatPhone(settings.issuer.phone) },
    recipient: q.recipient,
    contact: {
      name: q.contactPerson?.name ?? q.ownerName ?? "",
      email: q.contactPerson?.email || q.ownerEmail || settings.issuer.email,
      phone: formatPhone(q.contactPerson?.phone ?? "")
    },
    taxNote: reverseCharge ? labels.reverseCharge : labels.vatNote,
    reverseCharge,
    customerVatId: reverseCharge ? (q.recipient.vatId ?? "") : "",
    salutation: q.texts.salutation?.trim() || defaultSalutation(q),
    intro: q.texts.intro,
    closing: q.texts.closing,
    offerHeading: du ? labels.yourOfferDu : labels.yourOffer,
    assistant: settings.assistant?.whatsapp
      ? {
          text: fillTemplate(du ? labels.assistantDu : labels.assistant, { name: settings.assistant.name || "Noah" }),
          phone: formatPhone(settings.assistant.whatsapp),
          link: whatsappLink(settings.assistant.whatsapp)
        }
      : null,
    personalText: fillTemplate(du ? labels.personalDu : labels.personal, {
      name: q.contactPerson?.name || q.ownerName || ""
    }),
    facts: buildFacts(q, labels, money, validUntilText, t),
    steps: [
      { title: labels.step1Title, text: du ? labels.step1Du : labels.step1 },
      { title: labels.step2Title, text: du ? labels.step2Du : labels.step2 },
      { title: labels.step3Title, text: du ? labels.step3Du : labels.step3 }
    ],
    assistantName: settings.assistant?.name || "Noah",
    notes: q.texts.notes,
    terms: fillTemplate(settings.texts.terms[lang], {
      currency: q.currency,
      contractMonths: settings.perUnit.contractMonths,
      validUntil: validUntilText
    }),
    lines,
    hasDiscount: lines.some((l) => l.discountPercent > 0),
    totals,
    taxPercent,
    firstYear: t.firstYear,
    fileBase: `${lang === "de" ? "Angebot" : "Offer"}-${q.number}${safe ? `-${safe}` : ""}`
  };
}

/**
 * Anrede, falls Noah keine geschrieben hat: Du-Form mit Vorname, sonst mit vollem Namen.
 * Ohne bekanntes Geschlecht bewusst neutral ("Guten Tag Rico Kümin" statt "Herr/Frau").
 */
export function defaultSalutation(q: Pick<QuoteForDocument, "language" | "recipient" | "texts">): string {
  const first = q.recipient.firstName?.trim();
  const full = q.recipient.name?.trim();
  const du = q.texts.addressForm === "du";
  if (q.language === "en") return first ? `Dear ${first},` : "Hello,";
  if (du) return first ? `Hallo ${first}` : "Hallo zusammen";
  return full ? `Guten Tag ${full}` : "Guten Tag";
}

/** Eckdaten fürs Deckblatt: welches Paket, was es im ersten Jahr kostet, bis wann das Angebot gilt. */
function buildFacts(
  q: QuoteForDocument,
  labels: Record<keyof (typeof DOC_LABELS)["de"], string>,
  money: (n: number) => string,
  validUntilText: string,
  t: ReturnType<typeof computeTotals>
): { label: string; value: string; sub?: string }[] {
  const facts: { label: string; value: string; sub?: string }[] = [];
  const plan = q.lines.find((l) => l.key === "plan");
  if (plan) {
    // "Elev8 Suite – Paket Growth (Per Unit)" → "Growth" mit "Per Unit · 5 Units"
    const short = plan.title.replace(/^Elev8 Suite\s*[–-]\s*/, "");
    const m = short.match(/^(?:Paket|Booking-Paket)?\s*(.+?)\s*(?:package|booking package)?\s*\(([^)]+)\)(.*)$/i);
    const name = m ? m[1].trim() : short;
    const model = m ? m[2].trim() : "";
    const units = q.config.model === "per_unit" ? `${q.config.units} ${q.config.units === 1 ? "Unit" : "Units"}` : (m?.[3] ?? "").trim();
    facts.push({ label: labels.factPackage, value: name, sub: [model, units].filter(Boolean).join(" · ") || undefined });
  }
  if (t.firstYear > 0) {
    facts.push({ label: labels.factInvestment, value: money(t.firstYear), sub: labels.exclVat });
  }
  facts.push({ label: labels.factValid, value: validUntilText });
  return facts;
}
