import { z } from "zod";
import { hasAssistentAccess, requireUser } from "@/lib/platform/access";
import { getItem, setItemStatus } from "@/lib/assistant/store";
import { discardDraft } from "@/lib/assistant/worker";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["done", "discard", "reopen"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireUser(hasAssistentAccess);
  if ("response" in r) return r.response;
  const id = Number((await params).id);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  const item = await getItem(r.user.id, id);
  if (!item) return Response.json({ error: "not_found" }, { status: 404 });
  try {
    if (parsed.data.action === "discard") await discardDraft(r.user.id, id);
    else await setItemStatus(r.user.id, id, parsed.data.action === "done" ? "done" : "open");
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Assistent: Aktion fehlgeschlagen:", err);
    return Response.json({ error: "failed" }, { status: 502 });
  }
}
