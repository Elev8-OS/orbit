import { requireUser } from "@/lib/platform/access";
import { canEditPortfolio } from "@/lib/portfolio/access";
import { deleteDoc, isCollection, setDoc, validId } from "@/lib/portfolio/docs";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ collection: string; id: string }> };

/** Dokument speichern (ersetzt den ganzen Inhalt). Nur mit Bearbeitungsrecht. */
export async function PUT(req: Request, { params }: Params) {
  const ctx = await requireUser(canEditPortfolio);
  if ("response" in ctx) return ctx.response;
  const { collection, id } = await params;
  if (!isCollection(collection) || !validId(id)) return Response.json({ error: "not_found" }, { status: 404 });
  const text = await req.text();
  if (text.length > 20_000) return Response.json({ error: "too_large" }, { status: 413 });
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return Response.json({ error: "bad_request" }, { status: 400 });
  await setDoc(collection, id, data as Record<string, unknown>, ctx.user.email);
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const ctx = await requireUser(canEditPortfolio);
  if ("response" in ctx) return ctx.response;
  const { collection, id } = await params;
  if (!isCollection(collection) || !validId(id)) return Response.json({ error: "not_found" }, { status: 404 });
  await deleteDoc(collection, id);
  return Response.json({ ok: true });
}
