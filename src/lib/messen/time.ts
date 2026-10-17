/** Zeitzonen für die Ziehung. Die Landingpage zeigt die Uhrzeit in der Zeitzone der Messe. */
export const TIME_ZONES = [
  { id: "Asia/Makassar", label: "Bali (WITA, UTC+8)" },
  { id: "Asia/Jakarta", label: "Jakarta (WIB, UTC+7)" },
  { id: "Asia/Singapore", label: "Singapur (UTC+8)" },
  { id: "Asia/Bangkok", label: "Bangkok (UTC+7)" },
  { id: "Asia/Dubai", label: "Dubai (UTC+4)" },
  { id: "Australia/Sydney", label: "Sydney" },
  { id: "Europe/Zurich", label: "Zürich" },
  { id: "Europe/Berlin", label: "Berlin" },
  { id: "Europe/London", label: "London" },
  { id: "America/New_York", label: "New York" }
] as const;

export function isTimeZone(tz: string): boolean {
  return TIME_ZONES.some((z) => z.id === tz);
}

/** Abstand der Zeitzone zu UTC in Millisekunden zum Zeitpunkt `at` */
function offsetMs(at: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(new Date(at));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - at;
}

/** "2026-11-14T16:00" in der Zeitzone → Date (UTC). Ungültig → null */
export function localInputToDate(value: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let utc = guess - offsetMs(guess, timeZone);
  utc = guess - offsetMs(utc, timeZone); // Sommerzeit-Wechsel berücksichtigen
  return new Date(utc);
}

/** Date → "2026-11-14T16:00" in der Zeitzone (für <input type="datetime-local">) */
export function dateToLocalInput(date: Date | null, timeZone: string): string {
  if (!date) return "";
  const local = new Date(date.getTime() + offsetMs(date.getTime(), timeZone));
  return local.toISOString().slice(0, 16);
}

export function formatInZone(date: Date | null, timeZone: string, locale = "de-CH"): string {
  if (!date) return "–";
  return new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "medium", timeStyle: "short" }).format(date);
}
