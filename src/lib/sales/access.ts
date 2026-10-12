import { auth } from "@/auth";
import { isAdmin } from "@/lib/apps";

/**
 * Zugriff auf die Sales-App.
 * - App.Sales: eigene Termine, Follow-ups, Calls und Pipeline
 * - App.Sales.Admin: zusätzlich die Ansicht jedes anderen Sales-Mitarbeiters
 * - Orbit.Admin: alles
 */
export const SALES_ROLE = process.env.SALES_ROLE || "App.Sales";
export const SALES_ADMIN_ROLE = process.env.SALES_ADMIN_ROLE || "App.Sales.Admin";

export type SalesUser = { id: string; name: string; email: string; isManager: boolean };

export function hasSalesAccess(roles: string[]): boolean {
  return isAdmin(roles) || roles.includes(SALES_ROLE) || roles.includes(SALES_ADMIN_ROLE);
}

export async function currentSalesUser(): Promise<SalesUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;
  const roles = user.roles ?? [];
  if (!hasSalesAccess(roles)) return null;
  return {
    id: user.id,
    name: user.name || user.email || "Elev8",
    email: (user.email ?? "").toLowerCase(),
    isManager: isAdmin(roles) || roles.includes(SALES_ADMIN_ROLE)
  };
}

export async function requireSalesUser(): Promise<{ user: SalesUser } | { response: Response }> {
  const session = await auth();
  if (!session?.user?.id) return { response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const user = await currentSalesUser();
  if (!user) return { response: Response.json({ error: "forbidden" }, { status: 403 }) };
  return { user };
}
