// Warum eine Business-WhatsApp-Nachricht nicht ankam, und wie lange der Knopf danach ruht.
// Reine Funktionen ohne Datenbank, damit Server (ghl.ts) und Oberfläche (SmVenues.tsx) dieselbe Regel benutzen.

export type WaFailure = 'limit' | 'number' | 'other';

/** So viele Tage bleibt der Business-Knopf nach einem Meta-Limit gesperrt. Ein Wiederholen hilft in dieser Zeit nicht. */
export const BLOCK_DAYS = 3;

/**
 * Fehlertext von GHL oder Meta:
 *   limit   Meta blockiert die Nachricht wegen des Limits pro Nutzer für Marketing-Vorlagen (Fehler 131049,
 *           "Message blocked to maintain quality standards"). Liegt nicht an der Nummer des Betriebs.
 *   number  Die Nummer hat kein WhatsApp oder ist ungültig.
 *   other   alles andere, oder kein Text vorhanden.
 */
export function waFailureKind(error: string | null | undefined): WaFailure {
  const e = String(error ?? '').toLowerCase();
  if (!e) return 'other';
  if (/quality standards|per-user|template limit|marketing template|131049/.test(e)) return 'limit';
  if (/not (a )?(valid )?whatsapp|not registered|invalid (phone|number|recipient)|undeliverable|131026|131021/.test(e)) return 'number';
  return 'other';
}

/** Bis wann der Business-Knopf nach einem Versand ruht; null, wenn der Versandzeitpunkt fehlt. */
export function blockedUntil(sentAt: string | null | undefined): Date | null {
  if (!sentAt) return null;
  const t = new Date(sentAt).getTime();
  return Number.isFinite(t) ? new Date(t + BLOCK_DAYS * 24 * 3600 * 1000) : null;
}
