import { isAdmin } from "@/lib/apps";

/**
 * Wer das Radar nutzen darf. Standard: Rolle App.Radar (Orbit.Admin immer). Über RADAR_ROLES änderbar, kommagetrennt.
 * V1: nur für die Person, die es aufbaut. Später für alle Orbit-Nutzer, z.B. RADAR_ROLES=Orbit.Staff.
 * Jede Person sieht und konfiguriert nur ihre eigenen Verbindungen und Einträge.
 */
export const RADAR_ROLES = () =>
  (process.env.RADAR_ROLES || "App.Radar")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

export const hasRadarAccess = (roles: string[]) => isAdmin(roles) || roles.some((r) => RADAR_ROLES().includes(r));

/** Hintergrundlauf und Karte in „Mein Tag“ erst mit RADAR_ENABLED=true. */
export const radarEnabled = () => process.env.RADAR_ENABLED === "true";
