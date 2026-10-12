import { sql } from "./db";
import type { Locale } from "@/i18n/config";

export type Preferences = {
  tileOrder: string[];
  locale: Locale | null;
};

export async function getPreferences(userId: string): Promise<Preferences | null> {
  const rows = await sql<{ tile_order: string[]; locale: Locale | null }[]>`
    SELECT tile_order, locale FROM user_preferences WHERE user_id = ${userId}
  `;
  if (rows.length === 0) return null;
  return { tileOrder: rows[0].tile_order, locale: rows[0].locale };
}

export async function saveTileOrder(userId: string, order: string[]): Promise<void> {
  await sql`
    INSERT INTO user_preferences (user_id, tile_order)
    VALUES (${userId}, ${order})
    ON CONFLICT (user_id) DO UPDATE
      SET tile_order = EXCLUDED.tile_order, updated_at = now()
  `;
}

export async function saveLocale(userId: string, locale: Locale): Promise<void> {
  await sql`
    INSERT INTO user_preferences (user_id, locale)
    VALUES (${userId}, ${locale})
    ON CONFLICT (user_id) DO UPDATE
      SET locale = EXCLUDED.locale, updated_at = now()
  `;
}

/**
 * Legt den User beim ersten Besuch an und speichert die Start-Reihenfolge.
 * Gibt true zurück, wenn es wirklich der erste Besuch war.
 */
export async function registerFirstVisit(userId: string, initialOrder: string[]): Promise<boolean> {
  const rows = await sql`
    INSERT INTO user_preferences (user_id, tile_order)
    VALUES (${userId}, ${initialOrder})
    ON CONFLICT (user_id) DO NOTHING
    RETURNING user_id
  `;
  return rows.length > 0;
}

/** Markiert die Willkommensmail als gesendet. Gibt false zurück, wenn das schon passiert ist. */
export async function claimWelcomeEmail(userId: string): Promise<boolean> {
  const rows = await sql`
    UPDATE user_preferences SET welcomed_at = now()
    WHERE user_id = ${userId} AND welcomed_at IS NULL
    RETURNING user_id
  `;
  return rows.length > 0;
}
