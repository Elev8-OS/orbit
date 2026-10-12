import { z } from "zod";
import { getLocale } from "next-intl/server";
import { requireUser } from "@/lib/platform/access";
import { askNoah, noahConfigured } from "@/lib/platform/noah";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) }))
    .min(1)
    .max(30),
  app: z.string().max(64).nullable().optional()
});

const recent = new Map<string, number[]>();

export async function POST(req: Request) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  if (!noahConfigured()) return Response.json({ error: "not_configured" }, { status: 503 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });

  // Höchstens 30 Fragen pro Person und Stunde
  const now = Date.now();
  const list = (recent.get(r.user.id) ?? []).filter((t) => now - t < 3_600_000);
  if (list.length >= 30) return Response.json({ error: "rate_limited" }, { status: 429 });
  recent.set(r.user.id, [...list, now]);

  try {
    const locale = (await getLocale()) === "en" ? "en" : "de";
    const answer = await askNoah(r.user, locale, parsed.data.messages, { app: parsed.data.app ?? null });
    return Response.json(answer);
  } catch (err) {
    console.error("Noah:", err);
    return Response.json({ error: "failed" }, { status: 502 });
  }
}
