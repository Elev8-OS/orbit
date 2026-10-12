import { requireOffertenUser } from "@/lib/offerten/access";
import { getSettings } from "@/lib/offerten/settings";
import { createQuote, getQuote, logEvent } from "@/lib/offerten/store";

export const dynamic = "force-dynamic";

/** Neuer Entwurf auf Basis einer bestehenden Offerte, z.B. für eine überarbeitete Version. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  const source = await getQuote((await params).id);
  if (!source) return Response.json({ error: "not_found" }, { status: 404 });
  const settings = await getSettings();
  const validUntil = new Date(Date.now() + settings.validityDays * 86_400_000).toISOString().slice(0, 10);
  const copy = await createQuote(
    {
      language: source.language,
      currency: source.currency,
      source: "manual",
      analysis: source.analysis,
      ghlContactId: source.ghlContactId,
      ghlOpportunityId: source.ghlOpportunityId,
      ghlPipelineId: source.ghlPipelineId,
      recipient: source.recipient,
      config: source.config,
      lines: source.lines,
      texts: source.texts,
      validUntil,
      ownerId: access.user.id,
      ownerName: access.user.name,
      ownerEmail: access.user.email
    },
    settings.numberPrefix,
    access.user.name
  );
  await logEvent(copy.id, access.user.name, "duplicated", { from: source.number });
  return Response.json({ id: copy.id });
}
