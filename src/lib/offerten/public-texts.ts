import type { Lang } from "./quote";

/**
 * Texte der öffentlichen Seiten (Angebot annehmen, Onboarding). Sie richten sich nach der Sprache und Anrede
 * der Offerte, nicht nach der Orbit-Spracheinstellung, denn hier liest der Kunde.
 */
const de = {
  offer: "Angebot",
  offerFor: "Angebot für",
  summary: "Ihr Angebot im Überblick",
  pdf: "Angebot als PDF",
  accept: "Angebot annehmen",
  acceptLead: "Mit der Annahme starten wir Ihr Onboarding. Sie erhalten sofort eine Bestätigung und den Link zu Ihrer Onboarding-Checkliste.",
  name: "Ihr Name",
  role: "Funktion (optional)",
  email: "E-Mail",
  company: "Firma",
  address: "Rechnungsadresse",
  addressHint: "Eine Zeile pro Adresszeile",
  country: "Land",
  vatId: "USt-IdNr. / UID",
  vatIdHint: "Für Rechnungen nach Deutschland nötig (Reverse Charge)",
  note: "Bemerkung (optional)",
  terms: "Konditionen",
  agree: "Ich habe das Angebot und die Konditionen gelesen und nehme das Angebot im Namen der genannten Firma verbindlich an.",
  submit: "Verbindlich annehmen",
  submitting: "Wird übermittelt …",
  invalid: "Bitte Name, E-Mail, Firma und Rechnungsadresse ausfüllen und die Konditionen bestätigen.",
  failed: "Das hat nicht geklappt. Bitte versuchen Sie es erneut oder schreiben Sie uns.",
  thanksTitle: "Vielen Dank!",
  thanksBody: "Ihr Angebot ist angenommen. Eine Bestätigung ist unterwegs an",
  toOnboarding: "Zur Onboarding-Checkliste",
  alreadyTitle: "Dieses Angebot ist bereits angenommen",
  alreadyBody: "Ihr Onboarding läuft. Alle nächsten Schritte finden Sie auf Ihrer Onboarding-Seite.",
  expiredTitle: "Dieses Angebot ist abgelaufen",
  expiredBody: "Gerne erstellen wir Ihnen ein aktuelles Angebot. Melden Sie sich einfach bei uns.",
  closedTitle: "Dieses Angebot ist nicht mehr offen",
  closedBody: "Bei Fragen melden Sie sich gerne bei uns.",
  validUntil: "gültig bis",
  questions: "Fragen?",
  noah: "{name}, unser Sales-Assistent, ist rund um die Uhr per WhatsApp erreichbar.",
  contact: "Ihr Kontakt",
  // Onboarding
  onboardingTitle: "Ihr Onboarding",
  onboardingLead: "Alle Schritte bis zum Go-live. Haken Sie Ihre Punkte ab, sobald sie erledigt sind – wir sehen das sofort.",
  progress: "{done} von {total} erledigt",
  phases: { start: "Start", setup: "Einrichtung", golive: "Go-live" },
  owner: { customer: "Sie", elev8: "Elev8", both: "Gemeinsam" },
  openLink: "Termin buchen",
  doneBy: "erledigt",
  live: "Sie sind live. Willkommen bei Elev8!",
  saveFailed: "Nicht gespeichert. Bitte erneut versuchen."
};

type Texts = Omit<typeof de, "phases" | "owner"> & {
  phases: Record<keyof typeof de.phases, string>;
  owner: Record<keyof typeof de.owner, string>;
};

const deDu: Texts = {
  ...de,
  summary: "Dein Angebot im Überblick",
  acceptLead: "Mit der Annahme starten wir dein Onboarding. Du erhältst sofort eine Bestätigung und den Link zu deiner Onboarding-Checkliste.",
  name: "Dein Name",
  failed: "Das hat nicht geklappt. Bitte versuch es erneut oder schreib uns.",
  invalid: "Bitte Name, E-Mail, Firma und Rechnungsadresse ausfüllen und die Konditionen bestätigen.",
  thanksBody: "Dein Angebot ist angenommen. Eine Bestätigung ist unterwegs an",
  alreadyBody: "Dein Onboarding läuft. Alle nächsten Schritte findest du auf deiner Onboarding-Seite.",
  expiredBody: "Gerne erstellen wir dir ein aktuelles Angebot. Melde dich einfach bei uns.",
  closedBody: "Bei Fragen melde dich gerne bei uns.",
  contact: "Dein Kontakt",
  onboardingTitle: "Dein Onboarding",
  onboardingLead: "Alle Schritte bis zum Go-live. Hak deine Punkte ab, sobald sie erledigt sind – wir sehen das sofort.",
  owner: { customer: "Du", elev8: "Elev8", both: "Gemeinsam" },
  live: "Du bist live. Willkommen bei Elev8!"
};

const en: Texts = {
  offer: "Offer",
  offerFor: "Offer for",
  summary: "Your offer at a glance",
  pdf: "Offer as PDF",
  accept: "Accept the offer",
  acceptLead: "Accepting starts your onboarding. You will receive a confirmation right away with the link to your onboarding checklist.",
  name: "Your name",
  role: "Role (optional)",
  email: "Email",
  company: "Company",
  address: "Billing address",
  addressHint: "One line per address line",
  country: "Country",
  vatId: "VAT ID",
  vatIdHint: "Required for invoices to Germany (reverse charge)",
  note: "Note (optional)",
  terms: "Terms",
  agree: "I have read the offer and the terms and accept the offer on behalf of the company named above.",
  submit: "Accept with obligation",
  submitting: "Sending …",
  invalid: "Please fill in name, email, company and billing address and confirm the terms.",
  failed: "That didn't work. Please try again or write to us.",
  thanksTitle: "Thank you!",
  thanksBody: "Your offer is accepted. A confirmation is on its way to",
  toOnboarding: "Go to the onboarding checklist",
  alreadyTitle: "This offer has already been accepted",
  alreadyBody: "Your onboarding is under way. You'll find all next steps on your onboarding page.",
  expiredTitle: "This offer has expired",
  expiredBody: "We're happy to send you an updated offer. Just get in touch.",
  closedTitle: "This offer is no longer open",
  closedBody: "If you have questions, just get in touch.",
  validUntil: "valid until",
  questions: "Questions?",
  noah: "{name}, our sales assistant, is available around the clock on WhatsApp.",
  contact: "Your contact",
  onboardingTitle: "Your onboarding",
  onboardingLead: "Every step until go-live. Tick off your items once they're done – we see it right away.",
  progress: "{done} of {total} done",
  phases: { start: "Start", setup: "Setup", golive: "Go-live" },
  owner: { customer: "You", elev8: "Elev8", both: "Together" },
  openLink: "Book a time",
  doneBy: "done",
  live: "You're live. Welcome to Elev8!",
  saveFailed: "Not saved. Please try again."
};

export type PublicTexts = Texts;

export function publicTexts(lang: Lang, addressForm: "du" | "sie"): PublicTexts {
  if (lang === "en") return en;
  return addressForm === "du" ? deDu : de;
}
