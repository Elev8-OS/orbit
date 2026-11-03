import type { InsightStrings } from "./insights-i18n";

type Typed = { format: string | null; type: string | null };

const tag = (locale: string) => (locale === "en" ? "en-GB" : "de-CH");

export const nf = (n: number | null | undefined, locale: string) => (typeof n === "number" ? new Intl.NumberFormat(tag(locale)).format(n) : "–");

export const pct = (n: number | null | undefined, locale: string) =>
  typeof n === "number" ? `${new Intl.NumberFormat(tag(locale), { maximumFractionDigits: 1 }).format(n)} %` : "–";

/** Reel, Karussell, ... : our own format when the post is matched, otherwise what Instagram reports. */
export const postLabel = (s: InsightStrings, p: Typed) => s.types[p.format ?? ""] ?? s.types[p.type ?? ""] ?? p.type ?? "";

export const dateFormatter = (locale: string, withYear: boolean) => new Intl.DateTimeFormat(tag(locale), { day: "numeric", month: "short", year: withYear ? "2-digit" : undefined });
