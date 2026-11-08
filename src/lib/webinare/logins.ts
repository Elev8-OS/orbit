import { sql } from "@/lib/db";

/** Login-Protokoll des Portals (Tabelle webinar_logins, geschrieben vom Portal beim Login per E-Mail-Code). */

export const KEEP_MONTHS = 12;

export type Login = { id: string; email: string; name: string; at: Date; device: string; source: string };
export type LoginPerson = { email: string; name: string; logins: number; first: Date; last: Date; liveEver: boolean; isCustomer: boolean };
export type LoginStats = { today: number; week: number; month: number; peopleMonth: number };

/** Name aus webinar_people, sonst aus der jüngsten Anmeldung */
const NAME = sql`COALESCE(NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
  (SELECT NULLIF(TRIM(r.first_name || ' ' || r.last_name), '') FROM webinar_registrations r WHERE r.email = l.email ORDER BY r.created_at DESC LIMIT 1), '')`;

const pattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function pruneLogins(): Promise<void> {
  await sql`DELETE FROM webinar_logins WHERE at < now() - make_interval(months => ${KEEP_MONTHS})`;
}

export async function loginStats(): Promise<LoginStats> {
  const [r] = await sql`SELECT
      count(*) FILTER (WHERE at >= date_trunc('day', now() AT TIME ZONE 'Europe/Zurich') AT TIME ZONE 'Europe/Zurich')::int AS today,
      count(*) FILTER (WHERE at >= now() - interval '7 days')::int AS week,
      count(*) FILTER (WHERE at >= now() - interval '30 days')::int AS month,
      count(DISTINCT email) FILTER (WHERE at >= now() - interval '30 days')::int AS people_month
    FROM webinar_logins`;
  return { today: r.today, week: r.week, month: r.month, peopleMonth: r.people_month };
}

export async function listLogins(q: string, limit = 300): Promise<Login[]> {
  const rows = await sql`SELECT l.id, l.email, l.at, l.device, l.source, ${NAME} AS name
    FROM webinar_logins l LEFT JOIN webinar_people p ON p.email = l.email
    WHERE ${q ? sql`(l.email ILIKE ${pattern(q)} OR p.first_name ILIKE ${pattern(q)} OR p.last_name ILIKE ${pattern(q)})` : sql`TRUE`}
    ORDER BY l.at DESC LIMIT ${limit}`;
  return rows.map((r) => ({ id: String(r.id), email: r.email, name: r.name, at: r.at, device: r.device, source: r.source }));
}

export async function loginPeople(q: string, limit = 300): Promise<LoginPerson[]> {
  const rows = await sql`SELECT l.email, count(*)::int AS logins, min(l.at) AS first, max(l.at) AS last,
      COALESCE(bool_or(p.live_ever), FALSE) AS live_ever, COALESCE(bool_or(p.is_customer), FALSE) AS is_customer,
      max(${NAME}) AS name
    FROM webinar_logins l LEFT JOIN webinar_people p ON p.email = l.email
    WHERE ${q ? sql`(l.email ILIKE ${pattern(q)} OR p.first_name ILIKE ${pattern(q)} OR p.last_name ILIKE ${pattern(q)})` : sql`TRUE`}
    GROUP BY l.email ORDER BY max(l.at) DESC LIMIT ${limit}`;
  return rows.map((r) => ({ email: r.email, name: r.name ?? "", logins: r.logins, first: r.first, last: r.last, liveEver: r.live_ever, isCustomer: r.is_customer }));
}
