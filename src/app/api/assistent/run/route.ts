import { hasAssistentAccess, requireUser } from "@/lib/platform/access";
import { runForUser, syncDrafts } from "@/lib/assistant/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** „Jetzt prüfen“: ein Lauf nur für die angemeldete Person. */
export async function POST() {
  const r = await requireUser(hasAssistentAccess);
  if ("response" in r) return r.response;
  await syncDrafts(r.user.id).catch(() => {});
  const result = await runForUser(r.user.id);
  return Response.json(result, { status: result.error && result.error !== "läuft bereits" ? 502 : 200 });
}
