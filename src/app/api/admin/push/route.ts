import { z } from "zod";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/platform/access";
import { audienceIds, sendBroadcast, type Audience } from "@/lib/push/jobs";
import { audit } from "@/lib/platform/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_PER_DAY = Math.max(1, Number(process.env.ORBIT_PUSH_BROADCASTS_PER_DAY) || 5);

const audienceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("all") }),
  z.object({ type: z.literal("roles"), roles: z.array(z.string().min(1).max(120)).min(1).max(30) }),
  z.object({ type: z.literal("users"), ids: z.array(z.string().min(1).max(100)).min(1).max(500) })
]);
const schema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(300),
  url: z
    .string()
    .trim()
    .max(500)
    .refine((u) => u.startsWith("/") && !u.startsWith("//"), "internal_path")
    .optional(),
  audience: audienceSchema,
  scheduledAt: z.string().datetime({ offset: true }).optional()
});

/** Vorschau: wie viele Personen mit Geräten erreicht würden. */
export async function PUT(req: Request) {
  const r = await requireAdmin();
  if ("response" in r) return r.response;
  const parsed = audienceSchema.safeParse((await req.json().catch(() => null))?.audience);
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  return Response.json({ users: (await audienceIds(parsed.data as Audience)).length });
}

/** Mitteilung senden (sofort) oder planen. */
export async function POST(req: Request) {
  const r = await requireAdmin();
  if ("response" in r) return r.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body", detail: parsed.error.issues[0]?.message }, { status: 400 });
  const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM push_broadcasts WHERE created_at > now() - interval '1 day' AND cancelled_at IS NULL`;
  if (n >= MAX_PER_DAY) return Response.json({ error: "rate_limited", limit: MAX_PER_DAY }, { status: 429 });

  const when = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : new Date();
  if (when.getTime() < Date.now() - 60_000) return Response.json({ error: "in_past" }, { status: 400 });
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO push_broadcasts (created_by, title, body, url, audience, scheduled_at)
    VALUES (${r.user.email}, ${parsed.data.title}, ${parsed.data.body}, ${parsed.data.url ?? null}, ${sql.json(parsed.data.audience as never)}, ${when})
    RETURNING id`;
  const id = Number(row.id);
  await audit({ id: r.user.id, email: r.user.email }, "push.broadcast", parsed.data.title, { id, audience: parsed.data.audience, scheduledAt: when.toISOString() });
  if (when.getTime() <= Date.now() + 30_000) {
    const result = await sendBroadcast(id);
    return Response.json({ id, sent: true, result });
  }
  return Response.json({ id, sent: false, scheduledAt: when.toISOString() });
}

/** Geplante Mitteilung zurückziehen (?id=). */
export async function DELETE(req: Request) {
  const r = await requireAdmin();
  if ("response" in r) return r.response;
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ error: "invalid_body" }, { status: 400 });
  const rows = await sql`UPDATE push_broadcasts SET cancelled_at = now() WHERE id = ${id} AND sent_at IS NULL AND cancelled_at IS NULL RETURNING id`;
  if (!rows.length) return Response.json({ error: "not_found" }, { status: 404 });
  await audit({ id: r.user.id, email: r.user.email }, "push.cancel", String(id));
  return Response.json({ ok: true });
}
