import { currentWebinarUser } from "@/lib/webinare/access";
import { getDeliverable } from "@/lib/webinare/store";
import { getObject } from "@/lib/venues/s3";

export const dynamic = "force-dynamic";

/** Hochgeladene Nachlieferung zum Prüfen in Orbit (der Bucket ist nicht öffentlich). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await currentWebinarUser())) return Response.json({ error: "Kein Zugriff" }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const d = await getDeliverable(id);
  if (!d?.fileKey) return Response.json({ error: "Not found" }, { status: 404 });
  const res = await getObject(d.fileKey);
  if (!res.ok || !res.body) return Response.json({ error: "Datei nicht verfügbar" }, { status: 502 });
  const name = d.fileName || "datei";
  return new Response(res.body, {
    headers: {
      "content-type": d.fileType || "application/octet-stream",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": "private, no-store"
    }
  });
}
