import { requireUser } from "@/lib/platform/access";
import { hasSmAccess } from "@/lib/sm-manager/access";
import { deleteObject, getObject } from "@/lib/venues/s3";
import { deletePhoto, getPhoto, reviewPhoto, type Review } from "@/lib/venues/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ photoId: string }> };

async function idOf(ctx: Ctx): Promise<number | null> {
  const n = Number((await ctx.params).photoId);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Das Bild selbst, nur für angemeldete Nutzer (der Bucket ist nicht öffentlich)
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const id = await idOf(ctx);
  const photo = id ? await getPhoto(id) : null;
  if (!photo) return Response.json({ error: "Not found" }, { status: 404 });
  const res = await getObject(photo.storageKey);
  if (!res.ok || !res.body) return Response.json({ error: "Image not available" }, { status: 502 });
  return new Response(res.body, { headers: { "content-type": photo.contentType, "cache-control": "private, max-age=300" } });
}

// Freigeben, ablehnen oder zurück auf «offen»
export async function PUT(req: Request, ctx: Ctx) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const id = await idOf(ctx);
  if (!id || !(await getPhoto(id))) return Response.json({ error: "Not found" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { review?: string };
  if (!b.review || !(["pending", "approved", "rejected"] as string[]).includes(b.review)) return Response.json({ error: "Invalid review" }, { status: 400 });
  await reviewPhoto(id, b.review as Review);
  return Response.json({ ok: true });
}

// Foto samt Datei löschen
export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const id = await idOf(ctx);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const key = await deletePhoto(id);
  if (!key) return Response.json({ error: "Not found" }, { status: 404 });
  await deleteObject(key).catch((e) => console.error("Venue photo delete failed:", e));
  return Response.json({ ok: true });
}
