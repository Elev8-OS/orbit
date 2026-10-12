import { auth } from "@/auth";
import { isAdmin } from "@/lib/apps";

/**
 * Zugriff auf die Offerten-App.
 * - App.Offerten: Offerten sehen, bearbeiten und versenden
 * - App.Offerten.Admin: zusätzlich Preise, Absender und Standardtexte pflegen
 * - Orbit.Admin: alles
 */
export const OFFERTEN_ROLE = process.env.OFFERTEN_ROLE || "App.Offerten";
export const OFFERTEN_ADMIN_ROLE = process.env.OFFERTEN_ADMIN_ROLE || "App.Offerten.Admin";

export type OffertenUser = { id: string; name: string; email: string; canManageSettings: boolean };

export function hasOffertenAccess(roles: string[]): boolean {
  return isAdmin(roles) || roles.includes(OFFERTEN_ROLE) || roles.includes(OFFERTEN_ADMIN_ROLE);
}

export async function currentOffertenUser(): Promise<OffertenUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;
  const roles = user.roles ?? [];
  if (!hasOffertenAccess(roles)) return null;
  return {
    id: user.id,
    name: user.name || user.email || "Elev8",
    email: (user.email ?? "").toLowerCase(),
    canManageSettings: isAdmin(roles) || roles.includes(OFFERTEN_ADMIN_ROLE)
  };
}

/** Für API-Routen: liefert den User oder eine fertige Fehlerantwort. */
export async function requireOffertenUser(): Promise<{ user: OffertenUser } | { response: Response }> {
  const session = await auth();
  if (!session?.user?.id) return { response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const user = await currentOffertenUser();
  if (!user) return { response: Response.json({ error: "forbidden" }, { status: 403 }) };
  return { user };
}
