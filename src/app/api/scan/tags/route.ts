import { requireScanUser } from "@/lib/scan/access";
import { createTag, ghlConfigured, listTags } from "@/lib/scan/ghl";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireScanUser();
  if ("response" in guard) return guard.response;
  if (!ghlConfigured()) return Response.json({ tags: [] });
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  return Response.json({ tags: await listTags(fresh) });
}

/** Neuen Tag in GHL anlegen. Body: { name } */
export async function POST(req: Request) {
  const guard = await requireScanUser();
  if ("response" in guard) return guard.response;
  if (!ghlConfigured()) return Response.json({ error: "ghl_not_configured" }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name ?? "").trim();
  if (!name || name.length > 60) return Response.json({ error: "invalid_name" }, { status: 400 });
  try {
    return Response.json({ tag: await createTag(name) });
  } catch (err) {
    return Response.json({ error: "ghl_failed", message: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
