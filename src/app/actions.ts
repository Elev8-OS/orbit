"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth, signIn, signOut } from "@/auth";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { saveLocale } from "@/lib/preferences";
import { PASS_COOKIE, passCookieDomain, passCookieOptions, passIssuer } from "@/lib/orbit-pass";
import { SHARED_LOCALE_COOKIE, THEME_COOKIE, isTheme } from "@/lib/prefs";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Einstellung für Orbit und alle Tools auf der Hauptdomain speichern (nicht geheim). */
function sharedPrefCookie(maxAge = ONE_YEAR) {
  return { domain: passCookieDomain(), path: "/", maxAge, sameSite: "lax" as const, secure: passIssuer().startsWith("https://"), httpOnly: false };
}

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  // Für die eingebetteten Tools
  jar.set(SHARED_LOCALE_COOKIE, locale, sharedPrefCookie());
  const session = await auth();
  if (session?.user?.id) {
    await saveLocale(session.user.id, locale).catch((err) => console.error("Sprache nicht gespeichert:", err));
  }
  revalidatePath("/", "layout");
}

/** Darstellung (System / Hell / Dunkel) für Orbit und alle Tools. */
export async function setThemeAction(theme: string) {
  if (!isTheme(theme)) return;
  (await cookies()).set(THEME_COOKIE, theme, sharedPrefCookie());
  revalidatePath("/", "layout");
}

/**
 * Erlaubt nur interne Pfade als Ziel nach dem Login (verhindert Open Redirects)
 * und hängt ?welcome=1 an, damit das Dashboard die Begrüssungs-Animation zeigt.
 */
function welcomeRedirect(value: FormDataEntryValue | null): string {
  let path = typeof value === "string" ? value : "/";
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) path = "/";
  const url = new URL(path, "http://orbit.local");
  url.searchParams.set("welcome", "1");
  return url.pathname + url.search;
}

export async function signInAction(formData: FormData) {
  await signIn("microsoft-entra-id", { redirectTo: welcomeRedirect(formData.get("callbackUrl")) });
}

export async function signOutAction() {
  // Orbit-Pass sofort entfernen, damit eingebettete Tools die Abmeldung direkt mitbekommen
  (await cookies()).set(PASS_COOKIE, "", passCookieOptions(0));
  await signOut({ redirectTo: "/signin" });
}
