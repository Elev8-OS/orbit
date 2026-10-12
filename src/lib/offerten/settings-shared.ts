import { z } from "zod";

/**
 * Einstellungen der Offerten-App: Preisliste, Absenderangaben und Standardtexte.
 * Gemeinsam für Server und Browser (keine Datenbank-Importe).
 * Gespeichert als ein JSON-Dokument in quote_settings (key = 'config'), pflegbar unter /offerten/einstellungen.
 * Ohne gespeicherten Stand gelten die Standardwerte unten (Elev8-Preisliste laut Billing-Spezifikation).
 */

const localized = z.object({ de: z.string(), en: z.string() });
const money = z.number().min(0).max(1_000_000);

export const unitTierSchema = z.object({
  id: z.string().min(1).max(32),
  name: z.string().min(1).max(40),
  minUnits: z.number().int().min(1),
  maxUnits: z.number().int().min(1).nullable(),
  monthly: money,
  yearly: money,
  floor: z.number().int().min(1)
});

export const bookingPackageSchema = z.object({
  id: z.string().min(1).max(32),
  name: z.string().min(1).max(40),
  quota: z.number().int().min(1),
  price: money,
  priceWithCm: money
});

export const addonSchema = z.object({
  id: z.string().min(1).max(32),
  name: localized,
  description: localized,
  unit: localized,
  price: money,
  defaultQty: z.number().int().min(1),
  interval: z.enum(["once", "monthly", "yearly"])
});

export const settingsSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  validityDays: z.number().int().min(1).max(365),
  numberPrefix: z.string().regex(/^[A-Z0-9-]{1,12}$/),
  taxPercent: z.number().min(0).max(50),
  perUnit: z.object({
    contractMonths: z.number().int().min(1).max(60),
    tiers: z.array(unitTierSchema).min(1)
  }),
  perBooking: z.object({
    packages: z.array(bookingPackageSchema).min(1)
  }),
  addons: z.array(addonSchema).default([]),
  /** Länder (ISO-Code), für die auf dem Angebot das Reverse-Charge-Verfahren vermerkt wird */
  reverseChargeCountries: z.array(z.string().regex(/^[A-Z]{2}$/)).default(["DE"]),
  /** Tage bis zum ersten Nachfassen nach dem Versand und zwischen weiteren Nachfass-Mails */
  followUpDays: z.number().int().min(1).max(60).default(4),
  /** Noah, der Sales-Assistent: erscheint auf dem Angebot als Kontakt für Fragen (WhatsApp, 24/7) */
  assistant: z
    .object({
      name: z.string().max(40),
      whatsapp: z.string().max(30)
    })
    .default({ name: "Noah", whatsapp: "+41585909971" }),
  issuer: z.object({
    company: z.string().max(120),
    addressLines: z.array(z.string().max(120)).max(5),
    email: z.string().max(120),
    website: z.string().max(120),
    phone: z.string().max(60),
    taxId: z.string().max(60)
  }),
  texts: z.object({
    intro: localized,
    closing: localized,
    terms: localized,
    emailSubject: localized,
    emailBody: localized
  })
});

export type QuoteSettings = z.infer<typeof settingsSchema>;
export type UnitTier = z.infer<typeof unitTierSchema>;
export type BookingPackage = z.infer<typeof bookingPackageSchema>;
export type Addon = z.infer<typeof addonSchema>;

export const DEFAULT_SETTINGS: QuoteSettings = {
  currency: "USD",
  validityDays: 30,
  numberPrefix: "OF",
  taxPercent: 0,
  perUnit: {
    contractMonths: 12,
    tiers: [
      { id: "starter", name: "Starter", minUnits: 1, maxUnits: 4, monthly: 69, yearly: 63.25, floor: 1 },
      { id: "growth", name: "Growth", minUnits: 5, maxUnits: 19, monthly: 59, yearly: 54.08, floor: 5 },
      { id: "pro", name: "Pro", minUnits: 20, maxUnits: 49, monthly: 55, yearly: 50.42, floor: 20 },
      { id: "enterprise", name: "Enterprise", minUnits: 50, maxUnits: null, monthly: 49, yearly: 44.92, floor: 50 }
    ]
  },
  perBooking: {
    packages: [
      { id: "starter", name: "Starter", quota: 50, price: 9.9, priceWithCm: 13.9 },
      { id: "growth", name: "Growth", quota: 250, price: 8.91, priceWithCm: 11.9 },
      { id: "enterprise", name: "Enterprise", quota: 1000, price: 7.42, priceWithCm: 9.9 }
    ]
  },
  // Zusatzleistungen (z.B. Coins) erst aufnehmen, wenn sie produktiv verfügbar sind
  addons: [],
  reverseChargeCountries: ["DE"],
  followUpDays: 4,
  assistant: { name: "Noah", whatsapp: "+41585909971" },
  issuer: {
    company: "Elev8 Software AG",
    addressLines: ["Hauptgasse 33", "CH-4600 Olten"],
    email: "",
    website: "elev8-suite.com",
    phone: "",
    taxId: "UID CHE-398.140.212"
  },
  texts: {
    intro: {
      de: "Vielen Dank für das Gespräch. Wie besprochen erhalten Sie hier unser Angebot für die Elev8 Suite, abgestimmt auf Ihre Unterkünfte.",
      en: "Thank you for taking the time to talk with us. As discussed, here is our offer for the Elev8 Suite, tailored to your properties."
    },
    closing: {
      de: "Bei Fragen melden Sie sich jederzeit. Wir freuen uns darauf, Sie bei Elev8 an Bord zu haben.",
      en: "If you have any questions, just reply to this email. We look forward to welcoming you to Elev8."
    },
    terms: {
      de: "Alle Preise in {currency} exkl. MwSt. Per-Unit-Abos laufen {contractMonths} Monate und werden mindestens für die Paketuntergrenze verrechnet. Per-Booking-Kontingente verfallen nicht. Das Angebot ist gültig bis {validUntil}.",
      en: "All prices in {currency} excl. VAT. Per-unit subscriptions run for {contractMonths} months and are billed for at least the package minimum. Per-booking quotas don't expire. This offer is valid until {validUntil}."
    },
    emailSubject: {
      de: "Ihr Angebot für die Elev8 Suite ({number})",
      en: "Your Elev8 Suite offer ({number})"
    },
    emailBody: {
      de: "Hallo {firstName}\n\nVielen Dank für das Gespräch. Im Anhang finden Sie unser Angebot {number}, gültig bis {validUntil}.\n\nBei Fragen antworten Sie einfach auf diese E-Mail.\n\nFreundliche Grüsse\n{senderName}",
      en: "Hi {firstName},\n\nThank you for the call. Attached is our offer {number}, valid until {validUntil}.\n\nIf you have any questions, just reply to this email.\n\nBest regards,\n{senderName}"
    }
  }
};

/** Ersetzt {platzhalter} in Vorlagen. Unbekannte Platzhalter bleiben stehen. */
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** Telefonnummer lesbar formatieren: +41585909971 → +41 58 590 99 71 */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  const ch = digits.match(/^\+41(\d{2})(\d{3})(\d{2})(\d{2})$/);
  if (ch) return `+41 ${ch[1]} ${ch[2]} ${ch[3]} ${ch[4]}`;
  const de = digits.match(/^\+49(\d{3,4})(\d+)$/);
  if (de) return `+49 ${de[1]} ${de[2]}`;
  return raw.trim();
}

/** wa.me-Link für eine Telefonnummer */
export const whatsappLink = (raw: string) => `https://wa.me/${raw.replace(/\D/g, "")}`;
