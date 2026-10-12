import { requireOffertenUser } from "@/lib/offerten/access";
import { ghlConfigured, searchContacts } from "@/lib/offerten/ghl";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  if (!ghlConfigured()) return Response.json({ error: "ghl_not_configured" }, { status: 503 });
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return Response.json({ contacts: [] });
  try {
    const contacts = await searchContacts(q);
    return Response.json({
      contacts: contacts.map((c) => ({ id: c.id, name: c.name, email: c.email, company: c.company }))
    });
  } catch (err) {
    console.error("GHL-Suche:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: /access to this location/i.test(detail) ? "ghl_wrong_location" : "ghl_failed", detail },
      { status: 502 }
    );
  }
}
