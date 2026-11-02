type Locale = "de" | "en";

const de = {
  tabInquiries: "Anfragen",
  inquiriesIntro: "Instagram-Nachrichten von Interessenten. Der Assistent schreibt einen Antwortvorschlag mit Verfügbarkeit und Preis. Gesendet wird erst, wenn du es freigibst.",
  agentOff: "Der Assistent ist noch nicht aktiviert. Neue Nachrichten werden erst beantwortet, wenn er in Railway eingeschaltet ist.",
  empty: "Keine Anfragen. Neue Instagram-Nachrichten erscheinen hier automatisch.",
  guestSaid: "Nachricht des Gasts",
  draftLabel: "Antwortvorschlag (du kannst ihn bearbeiten)",
  sentLabel: "Gesendete Antwort",
  needsHuman: "Bitte prüfen",
  send: "Senden",
  confirmSend: "Diese Anfrage ist als heikel markiert. Trotzdem senden?",
  redraft: "Neu entwerfen",
  dismiss: "Verwerfen",
  working: "Moment …",
  saved: "Gespeichert",
  failed: "Hat nicht geklappt",
  noDraft: "Noch kein Entwurf.",
  statuses: { new: "Wird entworfen", draft_ready: "Entwurf bereit", sent: "Gesendet", dismissed: "Verworfen", ignored: "Ignoriert", failed: "Fehlgeschlagen" } as Record<string, string>,
  intents: { availability: "Verfügbarkeit", price: "Preis", info: "Info", booking: "Buchung", complaint: "Beschwerde", other: "Sonstiges" } as Record<string, string>,
  anonymous: "Unbekannt"
};

const en: typeof de = {
  tabInquiries: "Inquiries",
  inquiriesIntro: "Instagram messages from prospects. The assistant drafts a reply with availability and price. Nothing is sent until you approve it.",
  agentOff: "The assistant is not switched on yet. New messages are only answered once it is enabled in Railway.",
  empty: "No inquiries. New Instagram messages show up here automatically.",
  guestSaid: "Guest message",
  draftLabel: "Suggested reply (you can edit it)",
  sentLabel: "Reply sent",
  needsHuman: "Please check",
  send: "Send",
  confirmSend: "This inquiry is flagged as sensitive. Send anyway?",
  redraft: "Draft again",
  dismiss: "Dismiss",
  working: "One moment …",
  saved: "Saved",
  failed: "That did not work",
  noDraft: "No draft yet.",
  statuses: { new: "Drafting", draft_ready: "Draft ready", sent: "Sent", dismissed: "Dismissed", ignored: "Ignored", failed: "Failed" },
  intents: { availability: "Availability", price: "Price", info: "Info", booking: "Booking", complaint: "Complaint", other: "Other" },
  anonymous: "Unknown"
};

export const inquiryStrings = (locale: Locale) => (locale === "en" ? en : de);
export type InquiryStrings = ReturnType<typeof inquiryStrings>;
