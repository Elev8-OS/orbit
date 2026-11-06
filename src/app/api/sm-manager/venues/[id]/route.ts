import { requireUser } from "@/lib/platform/access";
import { hasSmAccess } from "@/lib/sm-manager/access";
import { getProfile } from "@/lib/venues/profile";
import { cleanEmail, cleanInstagram, cleanPhone, getVenue, listPhotos, rotateToken, updateVenue } from "@/lib/venues/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function idOf(ctx: Ctx): Promise<number | null> {
  const n = Number((await ctx.params).id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Ein Betrieb mit seinen Fotos und den freien Angaben, die er selbst gemacht hat
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const id = await idOf(ctx);
  const venue = id ? await getVenue(id) : null;
  if (!id || !venue) return Response.json({ error: "Not found" }, { status: 404 });
  const profile = await getProfile(id).catch(() => ({ about: "", tip: "" }));
  return Response.json({ venue, photos: await listPhotos(id), profile });
}

// Kontaktdaten und Einwilligung ändern; { rotate: true } erneuert den Link, { token_active: false } sperrt ihn,
// { mark_sent: "whatsapp" | "email" } hält den Versand fest (ein Betrieb mit Fotos bleibt auf seinem Status).
export async function PUT(req: Request, ctx: Ctx) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const id = await idOf(ctx);
  const current = id ? await getVenue(id) : null;
  if (!id || !current) return Response.json({ error: "Not found" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : undefined);

  if (b.rotate === true) await rotateToken(id);

  if (b.mark_sent === "whatsapp" || b.mark_sent === "email") {
    await updateVenue(id, { sent_at: new Date(), last_channel: b.mark_sent, ...(current.status === "new" ? { status: "sent" as const } : {}) });
  }

  const phoneIn = str("phone");
  const phone = phoneIn !== undefined ? cleanPhone(phoneIn) : undefined;
  const email = str("email");
  const instagram = str("instagram");
  const consentRef = str("consent_ref");
  await updateVenue(id, {
    ...(str("contact_name") !== undefined ? { contact_name: str("contact_name")!.trim().slice(0, 80) } : {}),
    // Eine von Hand geänderte Nummer gilt nicht mehr als Vorbelegung
    ...(phone !== undefined ? { phone, ...(phone !== current.phone ? { phone_source: "entered" } : {}) } : {}),
    ...(email !== undefined ? { email: cleanEmail(email) } : {}),
    ...(instagram !== undefined ? { instagram: cleanInstagram(instagram) } : {}),
    ...(consentRef !== undefined ? { consent_ref: consentRef.trim().slice(0, 200) } : {}),
    ...(b.consent_confirmed === true ? { consent_at: new Date() } : {}),
    ...(typeof b.token_active === "boolean" ? { token_active: b.token_active } : {})
  });
  return Response.json({ ok: true, venue: await getVenue(id) });
}
