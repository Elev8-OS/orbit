import { requireOffertenUser } from "@/lib/offerten/access";
import { documentFor, renderFile, syncToGhl, type Format } from "@/lib/offerten/service";
import { getSettings } from "@/lib/offerten/settings";
import { z } from "zod";
import { getQuote, setGhlLink } from "@/lib/offerten/store";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Ablage in GHL erneut ausführen, z.B. nach einem Fehler oder einer nachträglichen Kontaktzuordnung. */
const bodySchema = z.object({
  ghlContactId: z.string().max(64),
  ghlOpportunityId: z.string().max(64).nullable(),
  ghlPipelineId: z.string().max(64).nullable()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  const id = (await params).id;
  let quote = await getQuote(id);
  if (!quote) return Response.json({ error: "not_found" }, { status: 404 });
  if (quote.status !== "sent") return Response.json({ error: "not_sent" }, { status: 409 });
  // Optional: Kontakt nachträglich zuordnen
  const link = bodySchema.safeParse(await request.json().catch(() => null));
  if (link.success) {
    await setGhlLink(id, link.data);
    quote = (await getQuote(id))!;
  }
  const settings = await getSettings();
  const doc = documentFor(quote, settings);
  const formats = (quote.sentFormats ?? ["pdf"]).filter((f): f is Format => f === "pdf" || f === "xlsx");
  const files = await Promise.all(formats.map((f) => renderFile(doc, f)));
  const result = await syncToGhl(quote, files, settings, quote.sentByName ?? access.user.name);
  return Response.json({ ghl: result });
}
