import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type { z } from "zod";
import { appSchema, appsConfigSchema, categorySchema } from "./apps-schema.mjs";

export type OrbitApp = z.infer<typeof appSchema>;
export type OrbitCategory = z.infer<typeof categorySchema>;
export type AppsConfig = z.infer<typeof appsConfigSchema>;

export const ADMIN_ROLE = process.env.ORBIT_ADMIN_ROLE || "Orbit.Admin";
const EVERYONE = "*";

let cached: Promise<AppsConfig> | null = null;

async function readConfig(): Promise<AppsConfig> {
  const file = path.join(process.cwd(), process.env.APPS_CONFIG_PATH || "config/apps.yaml");
  const raw = YAML.parse(await fs.readFile(file, "utf8"));
  const result = appsConfigSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`apps.yaml ist ungültig – ${details}`);
  }
  return result.data;
}

/** Lädt die App-Registry. In Produktion einmal pro Prozess, in der Entwicklung bei jedem Aufruf. */
export function loadAppsConfig(): Promise<AppsConfig> {
  if (process.env.NODE_ENV !== "production") return readConfig();
  cached ??= readConfig().catch((err) => {
    cached = null;
    throw err;
  });
  return cached;
}

export function isAdmin(roles: string[]): boolean {
  return roles.includes(ADMIN_ROLE);
}

export function canSeeApp(app: OrbitApp, roles: string[]): boolean {
  if (!app.enabled) return false;
  if (isAdmin(roles)) return true;
  return app.roles.some((role) => role === EVERYONE || roles.includes(role));
}

export function visibleApps(config: AppsConfig, roles: string[]): OrbitApp[] {
  return config.apps.filter((app) => canSeeApp(app, roles));
}

/** Apps, die der User nicht sieht, aber über "Zugriff anfragen" anfordern darf. */
export function requestableApps(config: AppsConfig, roles: string[]): OrbitApp[] {
  return config.apps.filter(
    (app) =>
      app.enabled &&
      !canSeeApp(app, roles) &&
      app.requestableBy.some((role) => role === EVERYONE || roles.includes(role))
  );
}

/**
 * Wendet die gespeicherte Reihenfolge an.
 * Apps, die in der gespeicherten Reihenfolge fehlen (neu freigeschaltet), kommen ans Ende
 * und werden als "neu" markiert. Ohne gespeicherte Reihenfolge gilt die Reihenfolge aus apps.yaml.
 */
export function arrangeApps(apps: OrbitApp[], savedOrder: string[] | null) {
  if (!savedOrder || savedOrder.length === 0) return { ordered: apps, newIds: [] as string[] };
  const byId = new Map(apps.map((a) => [a.id, a]));
  const saved = new Set(savedOrder);
  const kept = savedOrder.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const added = apps.filter((a) => !saved.has(a.id));
  return { ordered: [...kept, ...added], newIds: added.map((a) => a.id) };
}
