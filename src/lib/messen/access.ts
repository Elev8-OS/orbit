import { auth } from "@/auth";
import { isAdmin } from "@/lib/apps";

/**
 * Zugriff auf das Messen-Modul (/messen).
 * - App.Messen: Messen anlegen, bearbeiten, Leads sehen und exportieren
 * - Orbit.Admin: alles
 * Die öffentliche Landingpage (/m/<slug>) und das Lead-Formular brauchen keinen Login.
 */
export const MESSEN_ROLE = process.env.MESSEN_ROLE || "App.Messen";

export type MessenUser = { id: string; name: string; email: string };

export function hasMessenAccess(roles: string[]): boolean {
  return isAdmin(roles) || roles.includes(MESSEN_ROLE);
}

export async function currentMessenUser(): Promise<MessenUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;
  if (!hasMessenAccess(user.roles ?? [])) return null;
  return { id: user.id, name: user.name || user.email || "Elev8", email: (user.email ?? "").toLowerCase() };
}

/** Für API-Routen: liefert den User oder eine fertige Fehlerantwort. */
export async function requireMessenUser(): Promise<{ user: MessenUser } | { response: Response }> {
  const session = await auth();
  if (!session?.user?.id) return { response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const user = await currentMessenUser();
  if (!user) return { response: Response.json({ error: "forbidden" }, { status: 403 }) };
  return { user };
}
