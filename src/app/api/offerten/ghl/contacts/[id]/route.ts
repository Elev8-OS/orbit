import { requireOffertenUser } from "@/lib/offerten/access";
import { getContact, ghlConfigured } from "@/lib/offerten/ghl";
import { prefillFromGhl } from "@/lib/offerten/service";

export const dynamic = "force-dynamic";

/** Kontaktdaten, Sprache und Opportunity eines GHL-Kontakts, um sie in einen Entwurf zu übernehmen. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  if (!ghlConfigured()) return Response.json({ error: "ghl_not_configured" }, { status: 503 });
  try {
    const contact = await getContact((await params).id);
    if (!contact) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ prefill: await prefillFromGhl(contact) });
  } catch (err) {
    console.error("GHL-Kontakt:", err);
    return Response.json({ error: "ghl_failed" }, { status: 502 });
  }
}
