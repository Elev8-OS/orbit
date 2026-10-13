import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { auth } from "@/auth";
import { getPreferences } from "@/lib/preferences";
import { LOCALE_COOKIE, defaultLocale, isLocale, type Locale } from "./config";

/**
 * Sprache in dieser Reihenfolge:
 * 1. Cookie (gesetzt über den Sprachumschalter)
 * 2. Gespeicherte Einstellung des Users (gilt geräteübergreifend)
 * 3. Browsersprache
 * 4. ORBIT_DEFAULT_LOCALE
 */
async function resolveLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  try {
    const session = await auth();
    if (session?.user?.id) {
      const prefs = await getPreferences(session.user.id);
      if (prefs?.locale) return prefs.locale;
    }
  } catch {
    // Datenbank nicht erreichbar: mit Browsersprache weitermachen
  }

  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const lang = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(lang)) return lang;
  }
  return defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    // Texte einzelner Apps liegen in eigenen Dateien (messages/<app>/<sprache>.json), damit Änderungen
    // an einer App die gemeinsamen Dateien nicht berühren
    messages: {
      ...(await import(`../../messages/${locale}.json`)).default,
      sales: (await import(`../../messages/sales/${locale}.json`)).default,
      platform: (await import(`../../messages/platform/${locale}.json`)).default,
      push: (await import(`../../messages/push/${locale}.json`)).default
    }
  };
});
