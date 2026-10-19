import { auth } from "@/auth";
import { isAdmin } from "@/lib/apps";

/**
 * Zugriff auf den Visitenkarten-Scanner (/scan).
 * Standard: App.Scan, sowie alle, die Messen oder Sales nutzen dürfen (sie scannen auf Messen und bei Terminen).
 * Über SCAN_ROLES (kommagetrennt) überschreibbar. Orbit.Admin sieht alles.
 */
const DEFAULT_ROLES = ["App.Scan", "App.Messen", "App.Sales", "App.Sales.Admin"];

const fromEnv = (process.env.SCAN_ROLES || "").split(",").map((s) => s.trim()).filter(Boolean);
export const SCAN_ROLES: string[] = fromEnv.length ? fromEnv : DEFAULT_ROLES;

export type ScanUser = { id: string; name: string; email: string };

export function hasScanAccess(roles: string[]): boolean {
  return isAdmin(roles) || roles.some((r) => SCAN_ROLES.includes(r));
}

export async function currentScanUser(): Promise<ScanUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;
  if (!hasScanAccess(user.roles ?? [])) return null;
  return { id: user.id, name: user.name || user.email || "Elev8", email: (user.email ?? "").toLowerCase() };
}

/** Für API-Routen: liefert den User oder eine fertige Fehlerantwort. */
export async function requireScanUser(): Promise<{ user: ScanUser } | { response: Response }> {
  const session = await auth();
  if (!session?.user?.id) return { response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const user = await currentScanUser();
  if (!user) return { response: Response.json({ error: "forbidden" }, { status: 403 }) };
  return { user };
}
