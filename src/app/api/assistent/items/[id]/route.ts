import { z } from "zod";
import { hasAssistentAccess, requireUser } from "@/lib/platform/access";
import { getItem, setItemStatus } from "@/lib/assistant/store";
import { completeItem, discardDraft, redraft } from "@/lib/assistant/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({
  action: z.enum(["done", "discard", "reopen", "reply", "rephrase"]),
  instruction: z.string().trim().max(500).optional()
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireUser(hasAssistentAccess);
  if ("response" in r) return r.response;
  const id = Number((await params).id);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  const item = await getItem(r.user.id, id);
  if (!item) return Response.json({ error: "not_found" }, { status: 404 });
  try {
    if (parsed.data.action === "reply" || parsed.data.action === "rephrase") {
      if (parsed.data.action === "rephrase" && !item.draftId) return Response.json({ error: "no_draft" }, { status: 409 });
      const updated = await redraft(r.user.id, id, parsed.data.action, parsed.data.instruction || undefined);
      return Response.json({ ok: true, item: updated });
    }
    if (parsed.data.action === "done") {
      // Erledigt löscht auch den ungesendeten Entwurf in Outlook
      return Response.json({ ok: true, ...(await completeItem(r.user.id, id)) });
    }
    if (parsed.data.action === "discard") await discardDraft(r.user.id, id);
    else await setItemStatus(r.user.id, id, "open");
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Assistent: Aktion fehlgeschlagen:", err);
    return Response.json({ error: "failed" }, { status: 502 });
  }
}
