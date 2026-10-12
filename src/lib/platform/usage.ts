import { sql } from "@/lib/db";

/** Ein App-Aufruf; mehrere Aufrufe derselben App in derselben Stunde zählen einmal. */
export async function recordUsage(userId: string, appId: string) {
  await sql`
    INSERT INTO app_usage (user_id, app_id, bucket) VALUES (${userId}, ${appId}, date_trunc('hour', now()))
    ON CONFLICT DO NOTHING`;
}

export type AppUsage = { appId: string; users: number; sessions: number; lastUsed: string | null };

/** Nutzung der letzten Tage je App: Personen und Nutzungsstunden. */
export async function usageByApp(days = 30): Promise<Map<string, AppUsage>> {
  const rows = await sql<{ app_id: string; users: number; sessions: number; last_used: Date | null }[]>`
    SELECT app_id, count(DISTINCT user_id)::int AS users, count(*)::int AS sessions, max(bucket) AS last_used
    FROM app_usage WHERE bucket > now() - make_interval(days => ${days}) GROUP BY app_id`;
  return new Map(rows.map((r) => [r.app_id, { appId: r.app_id, users: r.users, sessions: r.sessions, lastUsed: r.last_used?.toISOString() ?? null }]));
}

export async function activeUsers(days: number): Promise<number> {
  const [row] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM user_directory WHERE last_seen_at > now() - make_interval(days => ${days})`;
  return row?.n ?? 0;
}
