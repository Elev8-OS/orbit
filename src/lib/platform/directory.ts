import { sql } from "@/lib/db";

/** Merkt sich, wer Orbit wann mit welchen Rollen geöffnet hat. Höchstens einmal pro Minute pro Person. */
export async function touchUser(user: { id: string; name?: string | null; email?: string | null; roles: string[] }) {
  await sql`
    INSERT INTO user_directory (user_id, name, email, roles)
    VALUES (${user.id}, ${user.name ?? null}, ${(user.email ?? "").toLowerCase() || null}, ${user.roles})
    ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, roles = EXCLUDED.roles, last_seen_at = now()
    WHERE user_directory.last_seen_at < now() - interval '1 minute'
       OR user_directory.roles IS DISTINCT FROM EXCLUDED.roles`;
}

export type DirectoryUser = {
  id: string;
  name: string | null;
  email: string | null;
  roles: string[];
  firstSeenAt: string;
  lastSeenAt: string;
};

export async function listUsers(): Promise<DirectoryUser[]> {
  const rows = await sql<{ user_id: string; name: string | null; email: string | null; roles: string[]; first_seen_at: Date; last_seen_at: Date }[]>`
    SELECT user_id, name, email, roles, first_seen_at, last_seen_at FROM user_directory ORDER BY last_seen_at DESC`;
  return rows.map((r) => ({
    id: r.user_id,
    name: r.name,
    email: r.email,
    roles: r.roles,
    firstSeenAt: r.first_seen_at.toISOString(),
    lastSeenAt: r.last_seen_at.toISOString()
  }));
}

export async function getDirectoryUser(id: string): Promise<DirectoryUser | null> {
  return (await listUsers()).find((u) => u.id === id) ?? null;
}
