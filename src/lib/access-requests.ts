import { sql } from "./db";

export const MAX_REQUESTS_PER_HOUR = 5;

export async function countRecentRequests(userId: string): Promise<number> {
  const [row] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM access_requests
    WHERE user_id = ${userId} AND created_at > now() - interval '1 hour'
  `;
  return row?.count ?? 0;
}

export async function hasOpenRequest(userId: string, appId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM access_requests
    WHERE user_id = ${userId} AND app_id = ${appId} AND status = 'open'
      AND created_at > now() - interval '7 days'
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function openRequestIds(userId: string): Promise<string[]> {
  const rows = await sql<{ app_id: string }[]>`
    SELECT DISTINCT app_id FROM access_requests
    WHERE user_id = ${userId} AND status = 'open' AND created_at > now() - interval '7 days'
  `;
  return rows.map((r) => r.app_id);
}

export async function createRequest(input: {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  appId: string;
  message: string | null;
}): Promise<number> {
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO access_requests (user_id, user_name, user_email, app_id, message)
    VALUES (${input.userId}, ${input.userName}, ${input.userEmail}, ${input.appId}, ${input.message})
    RETURNING id
  `;
  return row.id;
}

export async function deleteRequest(id: number): Promise<void> {
  await sql`DELETE FROM access_requests WHERE id = ${id}`;
}
