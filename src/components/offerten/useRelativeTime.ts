"use client";

/** Kurze, menschenlesbare Zeitangabe: "vor 5 Min.", "gestern", "12.10.2026". */
export function relativeTime(iso: string, locale: "de" | "en"): string {
  const date = new Date(iso);
  const diff = (Date.now() - date.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale === "de" ? "de-CH" : "en", { numeric: "auto", style: "short" });
  if (diff < 60) return rtf.format(0, "second");
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (diff < 86_400) return rtf.format(-Math.round(diff / 3600), "hour");
  if (diff < 7 * 86_400) return rtf.format(-Math.round(diff / 86_400), "day");
  return new Intl.DateTimeFormat(locale === "de" ? "de-CH" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
