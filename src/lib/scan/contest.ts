/**
 * Gewinnspiel-Teilnahme aus dem Scanner: Teilnahmekarten (Papier) oder handgeschriebene Zettel landen im Lostopf
 * der Messe aus /messen, genau wie Teilnahmen über das Online-Formular. Reine Logik, läuft im Browser und auf dem Server.
 */

/** Antworten der Quizfrage „Was ist die Elev8-Suite?“ wie im Online-Formular; richtig ist „all“ */
export const QUIZ_ANSWERS = [
  { value: "cleaning", label: "Eine Reinigungs-App" },
  { value: "guide", label: "Ein Gästeguide" },
  { value: "communication", label: "Ein Kommunikations-Tool" },
  { value: "channel", label: "Ein Channel Manager" },
  { value: "all", label: "Alles davon" }
] as const;
export type QuizAnswer = (typeof QUIZ_ANSWERS)[number]["value"];

/** Units-Bereiche wie im Online-Formular */
export const UNIT_RANGES = [
  { value: "1-4", label: "1–4" },
  { value: "5-19", label: "5–19" },
  { value: "20-49", label: "20–49" },
  { value: "50+", label: "50+" },
  { value: "none", label: "vermietet nicht" }
] as const;
export type UnitRange = (typeof UNIT_RANGES)[number]["value"];

export const isQuiz = (v: unknown): v is QuizAnswer => QUIZ_ANSWERS.some((q) => q.value === v);
export const isUnitRange = (v: unknown): v is UnitRange => UNIT_RANGES.some((u) => u.value === v);

/** Losnummer im Format der Messen: E8-123 456 */
export const TICKET_RE = /^E8-\d{3} \d{3}$/;

/** "E8 123456", "e8-123-456", "123 456" → "E8-123 456"; sonst null */
export function normalizeTicket(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const digits = v.replace(/^\s*e\s*8/i, "").replace(/\D/g, "");
  if (digits.length !== 6 || digits.startsWith("0")) return null;
  return `E8-${digits.slice(0, 3)} ${digits.slice(3)}`;
}

/** Zahl der Units in den Bereich des Formulars einordnen */
export function unitRangeFor(units: number | null | undefined): UnitRange | null {
  if (units == null || !Number.isFinite(units) || units <= 0) return null;
  if (units <= 4) return "1-4";
  if (units <= 19) return "5-19";
  if (units <= 49) return "20-49";
  return "50+";
}

/** Was Claude auf einer Teilnahmekarte erkennt */
export type ContestInfo = {
  /** Karte oder Zettel ist eine Gewinnspiel-Teilnahme */
  isEntry: boolean;
  quizAnswer: QuizAnswer | null;
  unitRange: UnitRange | null;
  /** Angekreuzt: Werbung/Updates erlaubt. null = nicht ersichtlich */
  consentMarketing: boolean | null;
  /** Angekreuzt oder unterschrieben: Teilnahmebedingungen. null = nicht ersichtlich */
  consentTerms: boolean | null;
  preferredChannel: "whatsapp" | "email" | null;
  /** Auf der Karte vorgedruckte oder notierte Losnummer */
  ticket: string | null;
};

/** Was der Browser beim Senden mitschickt, wenn der Scan ins Gewinnspiel soll */
export type ContestEntry = {
  eventId: string;
  quizAnswer: QuizAnswer | null;
  unitRange: UnitRange | null;
  consentMarketing: boolean;
  preferredChannel: "whatsapp" | "email";
  ticket: string | null;
};

/** Ergebnis für die Erfolgsanzeige */
export type ContestResult = {
  eventName: string;
  ticket: string;
  /** Person war schon im Lostopf (z. B. online teilgenommen); kein zweites Los */
  existing: boolean;
};

/** Gewinnspiel offen: Messe aktiv und Ziehung noch nicht vorbei */
export function contestOpen(e: { active?: boolean; drawAt: string | Date | null }, now = Date.now()): boolean {
  if (e.active === false) return false;
  if (!e.drawAt) return true;
  return new Date(e.drawAt).getTime() > now;
}

/**
 * Welche Messe bekommt die Karte automatisch? Genau ein offenes Gewinnspiel → dieses.
 * Mehrere → keines (der Scanner fragt), ausser die Person hat in den Einstellungen bereits eines davon gewählt.
 */
export function autoContest<T extends { id: string }>(open: T[], chosenEventId: string | null): { pick: T | null; ask: boolean } {
  if (open.length === 1) return { pick: open[0], ask: false };
  if (open.length > 1) {
    const chosen = open.find((e) => e.id === chosenEventId) ?? null;
    return { pick: chosen, ask: true };
  }
  return { pick: null, ask: false };
}

/** Bevorzugter Kanal: von der Karte, sonst WhatsApp bei Mobilnummer, sonst E-Mail */
export function channelFor(info: ContestInfo | null, contact: { email?: string | null; mobile?: string | null; phone?: string | null }): "whatsapp" | "email" {
  if (info?.preferredChannel) return info.preferredChannel;
  if (contact.mobile || (!contact.email && contact.phone)) return "whatsapp";
  return "email";
}
