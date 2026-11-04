import { requireUser } from "@/lib/platform/access";
import { hasSmAccess } from "@/lib/sm-manager/access";
import { cleanInstagram, cleanPhone, getVenue, listPhotos, rotateToken, updateVenue } from "@/lib/venues/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function idOf(ctx: Ctx): Promise<number | null> {
  const n = Number((await ctx.params).id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Ein Betrieb mit seinen Fotos
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const id = await idOf(ctx);
  const venue = id ? await getVenue(id) : null;
  if (!id || !venue) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ venue, photos: await listPhotos(id) });
}

// Kontaktdaten und Einwilligung ändern; { rotate: true } erneuert den Link, { token_active: false } sperrt ihn.
export async function PUT(req: Request, ctx: Ctx) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const id = await idOf(ctx);
  if (!id || !(await getVenue(id))) return Response.json({ error: "Not found" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : undefined);

  if (b.rotate === true) await rotateToken(id);

  const phone = str("phone");
  const email = str("email");
  const instagram = str("instagram");
  const consentRef = str("consent_ref");
  await updateVenue(id, {
    ...(str("contact_name") !== undefined ? { contact_name: str("contact_name")!.trim().slice(0, 80) } : {}),
    ...(phone !== undefined ? { phone: cleanPhone(phone) } : {}),
    ...(email !== undefined ? { email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? email.trim().slice(0, 120) : "" } : {}),
    ...(instagram !== undefined ? { instagram: cleanInstagram(instagram) } : {}),
    ...(consentRef !== undefined ? { consent_ref: consentRef.trim().slice(0, 200) } : {}),
    ...(b.consent_confirmed === true ? { consent_at: new Date() } : {}),
    ...(typeof b.token_active === "boolean" ? { token_active: b.token_active } : {})
  });
  return Response.json({ ok: true, venue: await getVenue(id) });
}
