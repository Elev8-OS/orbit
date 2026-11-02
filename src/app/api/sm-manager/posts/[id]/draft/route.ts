import { requireUser } from "@/lib/platform/access";
import { hasSmAccess } from "@/lib/sm-manager/access";
import { EngineError, engine } from "@/lib/sm-manager/client";

export const dynamic = "force-dynamic";

/** Legt den GHL-Entwurf erneut an (z. B. nachdem die Social-Konten in GHL verbunden wurden). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "invalid" }, { status: 400 });
  try {
    await engine(`/posts/${id}/ghl-draft`, { method: "POST", body: {} });
    return Response.json({ ok: true });
  } catch (e) {
    const status = e instanceof EngineError ? e.status : 502;
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: status >= 400 && status < 600 ? status : 502 });
  }
}
