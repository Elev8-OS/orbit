import { z } from "zod";
import { requireUser } from "@/lib/platform/access";
import { savePrefs, subscribe, unsubscribe } from "@/lib/push/service";
import { validTimeZone } from "@/lib/sales/service";

export const dynamic = "force-dynamic";

const b64u = z.string().regex(/^[A-Za-z0-9_-]+=*$/).max(200);
const subSchema = z.object({
  subscription: z.object({ endpoint: z.string().url().startsWith("https://").max(2000), keys: z.object({ p256dh: b64u, auth: b64u }) }),
  tz: z.string().max(64).optional(),
  locale: z.enum(["de", "en"]).optional()
});

/** Gerät für Mitteilungen anmelden (nach Zustimmung im Browser). */
export async function POST(req: Request) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const parsed = subSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  const { subscription, tz, locale } = parsed.data;
  await subscribe(r.user.id, { endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth }, req.headers.get("user-agent"));
  await savePrefs(r.user.id, { ...(tz ? { tz: validTimeZone(tz) } : {}), ...(locale ? { locale } : {}) });
  return Response.json({ ok: true });
}

/** Gerät abmelden. */
export async function DELETE(req: Request) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const parsed = z.object({ endpoint: z.string().url().max(2000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  await unsubscribe(r.user.id, parsed.data.endpoint);
  return Response.json({ ok: true });
}
