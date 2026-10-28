import { z } from "zod";
import { hasAssistentAccess, requireUser } from "@/lib/platform/access";
import { needsReconnect } from "@/lib/assistant/oauth";
import { readDraftText, saveDraftText } from "@/lib/assistant/worker";

export const dynamic = "force-dynamic";

const body = z.object({ text: z.string().max(20_000) });

type Ctx = { params: Promise<{ id: string }> };

function fail(err: unknown) {
  const msg = err instanceof Error ? err.message : "";
  if (msg === "draft_changed") return Response.json({ error: "draft_changed" }, { status: 409 });
  if (msg === "draft_gone") return Response.json({ error: "draft_gone" }, { status: 410 });
  if (msg === "not_found" || msg === "no_draft") return Response.json({ error: msg }, { status: 404 });
  if (needsReconnect(err)) return Response.json({ error: "reconnect" }, { status: 401 });
  console.error("Assistent: Entwurf bearbeiten fehlgeschlagen:", err);
  return Response.json({ error: "failed" }, { status: 502 });
}

/** Antworttext des Entwurfs, wie er jetzt in Outlook steht. */
export async function GET(_req: Request, { params }: Ctx) {
  const r = await requireUser(hasAssistentAccess);
  if ("response" in r) return r.response;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "invalid" }, { status: 400 });
  try {
    return Response.json({ text: await readDraftText(r.user.id, id) });
  } catch (err) {
    return fail(err);
  }
}

/** Bearbeiteten Text in den Outlook-Entwurf schreiben. Gesendet wird nie etwas. */
export async function PUT(req: Request, { params }: Ctx) {
  const r = await requireUser(hasAssistentAccess);
  if ("response" in r) return r.response;
  const id = Number((await params).id);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success || !parsed.data.text.trim()) return Response.json({ error: "invalid" }, { status: 400 });
  try {
    return Response.json({ ok: true, item: await saveDraftText(r.user.id, id, parsed.data.text) });
  } catch (err) {
    return fail(err);
  }
}
