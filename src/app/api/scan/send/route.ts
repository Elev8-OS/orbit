import { requireScanUser } from "@/lib/scan/access";
import { attachPhotos, contactUrl, eventSourceAndTags, findDuplicate, ghlConfigured, upsertContact } from "@/lib/scan/ghl";
import { addHistory } from "@/lib/scan/store";
import { getEvent } from "@/lib/messen/store";
import type { DuplicateHit, ScanContact, SendRequest, SendResult } from "@/lib/scan/types";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const str = (v: unknown, max = 300): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t || null;
};

function cleanContact(raw: unknown): ScanContact {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    firstName: str(o.firstName, 80),
    lastName: str(o.lastName, 80),
    email: str(o.email, 160)?.toLowerCase() ?? null,
    phone: str(o.phone, 40),
    mobile: str(o.mobile, 40),
    company: str(o.company, 160),
    title: str(o.title, 160),
    website: str(o.website, 200),
    street: str(o.street, 200),
    city: str(o.city, 100),
    state: str(o.state, 100),
    postalCode: str(o.postalCode, 20),
    country: str(o.country, 80),
    timezone: str(o.timezone, 60),
    linkedin: str(o.linkedin, 200),
    industry: str(o.industry, 80),
    language: str(o.language, 5)?.toLowerCase() ?? null,
    roleTags: Array.isArray(o.roleTags) ? o.roleTags.map((t) => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 3) : [],
    notes: str(o.notes, 2000),
    sourceType: o.sourceType === "linkedin_profile" ? "linkedin_profile" : "business_card"
  };
}

const tagSafe = (t: string) => t.trim().slice(0, 60);

/** Kontakt nach GHL schreiben: Upsert, Notiz, Fotos, Historie. Vorher Dublettenhinweis, wenn nicht bestätigt. */
export async function POST(req: Request) {
  const guard = await requireScanUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;
  if (!ghlConfigured()) return Response.json({ error: "ghl_not_configured", message: "GHL_API_TOKEN/GHL_LOCATION_ID fehlen" }, { status: 503 });

  let body: SendRequest;
  try {
    body = (await req.json()) as SendRequest;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const contact = cleanContact(body.contact);
  if (!contact.firstName && !contact.lastName && !contact.email && !contact.phone && !contact.mobile) {
    return Response.json({ error: "empty", message: "Mindestens Name, E-Mail oder Telefon nötig" }, { status: 400 });
  }
  if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
    return Response.json({ error: "invalid_email", message: `E-Mail „${contact.email}“ ist ungültig` }, { status: 400 });
  }

  // Dublette melden, bevor etwas geschrieben wird – ausser der User hat das Aktualisieren bestätigt
  if (!body.confirmUpdate) {
    const dup = await findDuplicate(contact.email, contact.phone ?? contact.mobile).catch((): DuplicateHit => ({ found: false }));
    if (dup.found) return Response.json({ duplicate: dup }, { status: 409 });
  }

  const event = body.eventId ? await getEvent(String(body.eventId)) : null;
  const auto = eventSourceAndTags(event, user.name);
  const tags = [...new Set([...auto.tags, ...(Array.isArray(body.tags) ? body.tags.map(tagSafe) : []), ...(contact.roleTags ?? []).map((r) => `rolle-${r}`)].filter(Boolean))];

  try {
    const up = await upsertContact({ contact, tags, source: auto.source, scannedBy: { name: user.name, email: user.email } });
    const photos = await attachPhotos(up.id, body.photos ?? {});
    await addHistory({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      eventId: event?.id ?? null,
      contactId: up.id,
      isNew: up.isNew,
      name: [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email || contact.phone || "Ohne Namen",
      company: contact.company ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? contact.mobile ?? "",
      tags,
      sourceType: contact.sourceType ?? "business_card",
      photos: photos.count
    }).catch((err) => console.warn("Scan: Historie nicht gespeichert:", err));
    const result: SendResult = {
      ok: true,
      contactId: up.id,
      isNew: up.isNew,
      contactUrl: contactUrl(up.id),
      photos: photos.count,
      warnings: [...up.warnings, ...photos.warnings]
    };
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Scan ${user.email}: Senden an GHL fehlgeschlagen:`, message);
    return Response.json({ error: "ghl_failed", message }, { status: 502 });
  }
}
