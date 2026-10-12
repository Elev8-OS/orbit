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
  type Lang,
  type QuoteConfig,
  type QuoteLine,
  type QuoteTexts,
  type Recipient
} from "./quote";
import { fillTemplate, type QuoteSettings } from "./settings-shared";

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
  ownerName: string | null;
  ownerEmail: string | null;
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

export type DocTotalRow = { label: string; amount: number; text: string; strong?: boolean; interval?: Interval };

export type QuoteDocument = {
  lang: Lang;
  labels: (typeof DOC_LABELS)[Lang];
  currency: string;
  number: string;
  dateText: string;
  validUntilText: string;
  issuer: QuoteSettings["issuer"];
  recipient: Recipient;
  contact: { name: string; email: string };
  intro: string;
  closing: string;
  notes: string;
  terms: string;
  lines: DocLine[];
  hasDiscount: boolean;
  totals: DocTotalRow[];
  taxPercent: number;
  firstYear: number;
  fileBase: string;
};

export function buildDocument(q: QuoteForDocument, settings: QuoteSettings): QuoteDocument {
  const lang = q.language;
  const labels = DOC_LABELS[lang];
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
    totals.push({ label, amount: gross, text: money(gross), strong: true, interval });
  }
  if (t.intervals.length > 1 || t.intervals.includes("monthly")) {
    totals.push({ label: labels.firstYear, amount: t.firstYear, text: money(t.firstYear), strong: true });
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
    issuer: settings.issuer,
    recipient: q.recipient,
    contact: { name: q.ownerName ?? "", email: q.ownerEmail ?? settings.issuer.email },
    intro: q.texts.intro,
    closing: q.texts.closing,
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
