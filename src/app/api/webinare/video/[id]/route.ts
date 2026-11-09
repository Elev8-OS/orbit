import { currentWebinarUser } from "@/lib/webinare/access";
import { getWebinar } from "@/lib/webinare/store";
import { getVideoFiles } from "@/lib/webinare/video";
import { getObject } from "@/lib/venues/s3";

export const dynamic = "force-dynamic";

/**
 * Fertiges Erklärvideo (?f=mp4) oder YouTube-Vorschaubild (?f=png) aus dem Bucket.
 * Mit Range-Unterstützung, damit das Video im Browser (auch Safari) abspielbar ist. ?download=1 lädt herunter.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await currentWebinarUser())) return Response.json({ error: "Kein Zugriff" }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const url = new URL(req.url);
  const kind = url.searchParams.get("f") === "png" ? "png" : "mp4";
  const files = await getVideoFiles(id);
  const key = kind === "png" ? files?.thumbKey : files?.fileKey;
  if (!key) return Response.json({ error: "Not found" }, { status: 404 });
  const range = req.headers.get("range");
  let res: Response;
  try {
    res = await getObject(key, range && /^bytes=\d*-\d*$/.test(range) ? { range } : undefined);
  } catch {
    return Response.json({ error: "Datei-Speicher nicht erreichbar" }, { status: 502 });
  }
  if (!(res.ok || res.status === 206) || !res.body) return Response.json({ error: "Datei nicht verfügbar" }, { status: 502 });
  const w = await getWebinar(id);
  const name = `erklaervideo-${w?.slug ?? id}.${kind}`;
  const headers = new Headers({
    "content-type": kind === "png" ? "image/png" : "video/mp4",
    "content-disposition": `${url.searchParams.get("download") ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(name)}`,
    "cache-control": "private, no-store",
    "accept-ranges": "bytes"
  });
  for (const h of ["content-length", "content-range"]) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(res.body, { status: res.status === 206 ? 206 : 200, headers });
}
