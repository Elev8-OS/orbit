import { isAdmin } from "@/lib/apps";

/**
 * Wer den SM Manager nutzen darf. Standard: Rolle App.SMManager (Orbit.Admin immer).
 * Über SM_MANAGER_ROLES änderbar, kommagetrennt.
 */
export const SM_ROLES = () =>
  (process.env.SM_MANAGER_ROLES || "App.SMManager")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

export const hasSmAccess = (roles: string[]) => isAdmin(roles) || roles.some((r) => SM_ROLES().includes(r));

/** Verbindung zum Render- und Planungsdienst (Repo SM_engine, Railway-Dienst render-service). */
export const smConfigured = () => Boolean(process.env.SM_ENGINE_URL && process.env.SM_ENGINE_API_KEY);
