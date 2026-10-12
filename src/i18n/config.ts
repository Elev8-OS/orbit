export const locales = ["de", "en"] as const;
export type Locale = (typeof locales)[number];
export const LOCALE_COOKIE = "ORBIT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export const defaultLocale: Locale = isLocale(process.env.ORBIT_DEFAULT_LOCALE)
  ? process.env.ORBIT_DEFAULT_LOCALE
  : "de";
