import { hasAssistentAccess, requireUser } from "@/lib/platform/access";
import { disconnect } from "@/lib/assistant/store";
import { forgetToken } from "@/lib/assistant/worker";
import { audit } from "@/lib/platform/audit";

export const dynamic = "force-dynamic";

/** Postfach trennen: Token und alle Einträge werden gelöscht. Entwürfe in Outlook bleiben. */
export async function POST() {
  const r = await requireUser(hasAssistentAccess);
  if ("response" in r) return r.response;
  forgetToken(r.user.id);
  await disconnect(r.user.id);
  await audit({ id: r.user.id, email: r.user.email }, "assistant.disconnect", r.user.email);
  return Response.json({ ok: true });
}
