"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth, signIn, signOut } from "@/auth";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { saveLocale } from "@/lib/preferences";

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  const session = await auth();
  if (session?.user?.id) {
    await saveLocale(session.user.id, locale).catch((err) => console.error("Sprache nicht gespeichert:", err));
  }
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
  await signOut({ redirectTo: "/signin" });
}
