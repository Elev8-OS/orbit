import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { isAdmin } from "@/lib/apps";
import { currentUser, type PlatformUser } from "@/lib/platform/access";
import type { GroRole, Tenant } from "./types";

/**
 * Zugriff auf das GRO-Modul (/gro). Zwei Wege:
 * 1. Orbit-Rollen (Entra): GRO_ROLES (Standard App.GRO und App.GRO.Edit) gelten für den Standard-Mandanten
 *    GRO_DEFAULT_TENANT (Standard "elevate"); App.GRO.Edit macht zum Bearbeiter, GRO_ADMIN_ROLE (App.GRO.Admin) zum Admin.
 * 2. Mitgliedschaft pro Mandant (Tabelle gro_members, per E-Mail): so schalten wir andere Kunden auf, ohne Entra-Rollen.
 * Orbit.Admin sieht alle Mandanten und ist überall Admin (Plattform-Admin).
 */
const list = (name: string, fallback: string) =>
  (process.env[name] || fallback)
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

export const GRO_ROLES = () => list("GRO_ROLES", "App.GRO,App.GRO.Edit,App.GRO.Admin");
export const GRO_EDIT_ROLES = () => list("GRO_EDIT_ROLES", "App.GRO.Edit,App.GRO.Admin");
export const GRO_ADMIN_ROLES = () => list("GRO_ADMIN_ROLES", "App.GRO.Admin");
export const DEFAULT_TENANT = () => process.env.GRO_DEFAULT_TENANT || "elevate";
const COOKIE = "gro_tenant";

const RANK: Record<GroRole, number> = { viewer: 0, editor: 1, admin: 2 };
export const atLeast = (role: GroRole, min: GroRole) => RANK[role] >= RANK[min];

type Row = Record<string, unknown>;
export function toTenant(r: Row): Tenant {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    isTemplate: r.is_template === true,
    active: r.active !== false,
    elev8Url: (r.elev8_url as string | null) ?? null,
    hasToken: Boolean(r.elev8_token),
    listingTags: (r.listing_tags as string[] | null) ?? [],
    baseGuests: Number(r.base_guests ?? 2)
  };
}

export type GroContext = {
  user: PlatformUser;
  platformAdmin: boolean;
  tenants: Tenant[];
  tenant: Tenant;
  role: GroRole;
  canSeeCodes: boolean;
};

/** Mandanten und Rolle der angemeldeten Person; null = kein Zugriff */
export async function groContext(): Promise<GroContext | null> {
  const user = await currentUser();
  if (!user) return null;
  const platformAdmin = isAdmin(user.roles);
  const all = (await sql`SELECT * FROM gro_tenants WHERE active ORDER BY is_template, name`).map(toTenant);

  const grants = new Map<string, { role: GroRole; codes: boolean }>();
  const members = await sql<{ tenant_id: string; role: GroRole; can_see_codes: boolean }[]>`SELECT tenant_id, role, can_see_codes FROM gro_members WHERE email = ${user.email}`;
  for (const m of members) grants.set(m.tenant_id, { role: m.role, codes: m.can_see_codes });

  const viaRole = user.roles.some((r) => GRO_ROLES().includes(r));
  if (viaRole) {
    const def = all.find((t) => t.slug === DEFAULT_TENANT());
    if (def) {
      const role: GroRole = user.roles.some((r) => GRO_ADMIN_ROLES().includes(r)) ? "admin" : user.roles.some((r) => GRO_EDIT_ROLES().includes(r)) ? "editor" : "viewer";
      const prev = grants.get(def.id);
      if (!prev || RANK[role] > RANK[prev.role]) grants.set(def.id, { role, codes: prev?.codes ?? role !== "viewer" });
    }
  }

  const visible = platformAdmin ? all : all.filter((t) => grants.has(t.id) && !t.isTemplate);
  if (!visible.length) return null;
  const wanted = (await cookies()).get(COOKIE)?.value;
  const tenant = visible.find((t) => t.slug === wanted) ?? visible.find((t) => t.slug === DEFAULT_TENANT()) ?? visible.find((t) => !t.isTemplate) ?? visible[0];
  const g = grants.get(tenant.id);
  const role: GroRole = platformAdmin ? "admin" : g?.role ?? "viewer";
  return { user, platformAdmin, tenants: visible, tenant, role, canSeeCodes: platformAdmin || Boolean(g?.codes) };
}

export const TENANT_COOKIE = COOKIE;

/** Für Server Actions: Kontext mit Mindestrolle oder Fehler */
export async function requireGro(min: GroRole = "viewer"): Promise<GroContext> {
  const ctx = await groContext();
  if (!ctx) throw new Error("Kein Zugriff auf den GRO Service");
  if (!atLeast(ctx.role, min)) throw new Error("Dafür fehlt dir die Berechtigung");
  return ctx;
}
