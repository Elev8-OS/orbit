import { auth } from "@/auth";
import { isAdmin } from "@/lib/apps";

/**
 * Zugriff auf das Webinar-Modul (/webinare). Rollen kommen aus Entra (App Roles der Orbit-App):
 * - App.Webinar: Redaktion – Webinare, Aufzeichnungen, KI-Inhalte, Teilnahme, Abstimmungen
 * - App.Webinar.Moderation: Vorab-Fragen und Themenvorschläge
 * - Orbit.Admin: alles
 * Das öffentliche Portal (webinar.elev8-suite.com) ist ein eigener Service und braucht keine Orbit-Rolle.
 */
export const WEBINAR_ROLE = process.env.WEBINAR_ROLE || "App.Webinar";
export const WEBINAR_MOD_ROLE = process.env.WEBINAR_MOD_ROLE || "App.Webinar.Moderation";

export type WebinarUser = { id: string; name: string; email: string; canEdit: boolean; canModerate: boolean };

export function webinarRights(roles: string[]) {
  const admin = isAdmin(roles);
  const canEdit = admin || roles.includes(WEBINAR_ROLE);
  const canModerate = canEdit || roles.includes(WEBINAR_MOD_ROLE);
  return { canEdit, canModerate };
}

export async function currentWebinarUser(): Promise<WebinarUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;
  const rights = webinarRights(user.roles ?? []);
  if (!rights.canModerate) return null;
  return { id: user.id, name: user.name || user.email || "Elev8", email: (user.email ?? "").toLowerCase(), ...rights };
}

/** Für Server Actions: wirft, wenn das Recht fehlt. */
export async function requireWebinarUser(need: "edit" | "moderate"): Promise<WebinarUser> {
  const user = await currentWebinarUser();
  if (!user) throw new Error("Kein Zugriff auf das Webinar-Modul.");
  if (need === "edit" && !user.canEdit) throw new Error("Dafür brauchst du die Rolle App.Webinar.");
  return user;
}

export function portalUrl(path = ""): string {
  const base = (process.env.WEBINAR_PORTAL_URL || "https://webinar.elev8-suite.com").replace(/\/$/, "");
  return `${base}${path}`;
}
