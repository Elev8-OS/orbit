import { requireUser } from "@/lib/platform/access";
import { hasSmAccess } from "@/lib/sm-manager/access";
import { VENUE_SPOTS } from "@/lib/venues/spots";
import { createVenues, listVenues } from "@/lib/venues/store";
import { storageConfigured } from "@/lib/venues/s3";

export const dynamic = "force-dynamic";

function origin(req: Request): string {
  return (process.env.AUTH_URL ?? new URL(req.url).origin).replace(/\/$/, "");
}

// Alle Betriebe mit Status, Foto-Zählern und persönlichem Link
export async function GET(req: Request) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const base = origin(req);
  const venues = (await listVenues()).map((v) => ({ ...v, link: `${base}/contribute/${v.token}` }));
  return Response.json({ venues, storage: storageConfigured() });
}

// Betriebe anlegen: { seed: true } für die Liste aus dem Umgebungs-Guide, oder { names: ["…"] }
export async function POST(req: Request) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const body = (await req.json().catch(() => ({}))) as { seed?: boolean; names?: unknown };
  const items = body.seed ? VENUE_SPOTS : Array.isArray(body.names) ? body.names.filter((n): n is string => typeof n === "string").map((name) => ({ name })) : [];
  if (items.length === 0) return Response.json({ error: "Nothing to create" }, { status: 400 });
  const created = await createVenues(items);
  return Response.json({ created }, { status: 201 });
}
