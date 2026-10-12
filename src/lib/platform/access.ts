import { auth } from "@/auth";
import { isAdmin } from "@/lib/apps";

/**
 * Rollen der Plattform-Funktionen. Alle über Umgebungsvariablen änderbar (kommagetrennt).
 *
 * - Kunden-360: Wer mit Kunden arbeitet. Standard: App.Kunden sowie die Sales- und Offerten-Rollen.
 * - Assistent (Moneypenny für alle): Standard App.Assistent und alle internen Mitarbeitenden (Orbit.Staff).
 * - Orbit.Admin darf immer alles.
 */
const list = (name: string, fallback: string) =>
  (process.env[name] || fallback)
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

export const KUNDEN_ROLES = () => list("KUNDEN_ROLES", "App.Kunden,App.Sales,App.Sales.Admin,App.Offerten,App.Offerten.Admin");
export const ASSISTENT_ROLES = () => list("ASSISTENT_ROLES", "App.Assistent,Orbit.Staff");

const hasAny = (roles: string[], allowed: string[]) => isAdmin(roles) || roles.some((r) => allowed.includes(r));

export const hasKundenAccess = (roles: string[]) => hasAny(roles, KUNDEN_ROLES());
export const hasAssistentAccess = (roles: string[]) => hasAny(roles, ASSISTENT_ROLES());

export type PlatformUser = { id: string; name: string; email: string; roles: string[]; admin: boolean };

export async function currentUser(): Promise<PlatformUser | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return null;
  const roles = u.roles ?? [];
  return { id: u.id, name: u.name || u.email || "Elev8", email: (u.email ?? "").toLowerCase(), roles, admin: isAdmin(roles) };
}

type Check = (roles: string[]) => boolean;

/** Für API-Routen: angemeldete Person mit passender Rolle, sonst eine fertige Fehlerantwort. */
export async function requireUser(check?: Check): Promise<{ user: PlatformUser } | { response: Response }> {
  const user = await currentUser();
  if (!user) return { response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  if (check && !check(user.roles)) return { response: Response.json({ error: "forbidden" }, { status: 403 }) };
  return { user };
}

export const requireAdmin = () => requireUser(isAdmin);
