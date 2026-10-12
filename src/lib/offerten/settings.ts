import { sql } from "@/lib/db";
import { DEFAULT_SETTINGS, settingsSchema, type QuoteSettings } from "./settings-shared";

// Server-Teil: Laden und Speichern. Schema, Standardwerte und Vorlagen liegen in settings-shared.ts,
// damit sie auch im Browser (Vorschau) nutzbar sind.
export * from "./settings-shared";

export async function getSettings(): Promise<QuoteSettings> {
  const rows = await sql<{ value: unknown }[]>`SELECT value FROM quote_settings WHERE key = 'config'`;
  if (!rows.length) return DEFAULT_SETTINGS;
  const parsed = settingsSchema.safeParse(rows[0].value);
  if (!parsed.success) {
    console.error("Offerten-Einstellungen ungültig, Standardwerte aktiv:", parsed.error.issues);
    return DEFAULT_SETTINGS;
  }
  return parsed.data;
}

export async function saveSettings(value: QuoteSettings, by: string): Promise<void> {
  await sql`
    INSERT INTO quote_settings (key, value, updated_by) VALUES ('config', ${sql.json(value)}, ${by})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`;
}

