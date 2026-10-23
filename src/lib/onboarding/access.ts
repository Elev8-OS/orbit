import { auth } from "@/auth";
import { isAdmin } from "@/lib/apps";

/**
 * Zugriff auf die Onboarding-App.
 * - App.Onboarding: Entwürfe sehen, anpassen und senden
 * - App.Onboarding.Admin: wie App.Onboarding (Einstellungen kommen später dazu)
 * - Orbit.Admin: alles
 */
export const ONBOARDING_ROLE = process.env.ONBOARDING_ROLE || "App.Onboarding";
export const ONBOARDING_ADMIN_ROLE = process.env.ONBOARDING_ADMIN_ROLE || "App.Onboarding.Admin";

export type OnboardingUser = { id: string; name: string; email: string };

export function hasOnboardingAccess(roles: string[]): boolean {
  return isAdmin(roles) || roles.includes(ONBOARDING_ROLE) || roles.includes(ONBOARDING_ADMIN_ROLE);
}

export async function currentOnboardingUser(): Promise<OnboardingUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;
  if (!hasOnboardingAccess(user.roles ?? [])) return null;
  return { id: user.id, name: user.name || user.email || "Elev8", email: (user.email ?? "").toLowerCase() };
}

/** Für API-Routen: liefert den User oder eine fertige Fehlerantwort. */
export async function requireOnboardingUser(): Promise<{ user: OnboardingUser } | { response: Response }> {
  const session = await auth();
  if (!session?.user?.id) return { response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const user = await currentOnboardingUser();
  if (!user) return { response: Response.json({ error: "forbidden" }, { status: 403 }) };
  return { user };
}
