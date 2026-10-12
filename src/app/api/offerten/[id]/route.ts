import { z } from "zod";
import { requireOffertenUser } from "@/lib/offerten/access";
import { configSchema, lineSchema, recipientSchema, textsSchema } from "@/lib/offerten/quote";
import { getQuote, listEvents, logEvent, setStatus, updateDraft } from "@/lib/offerten/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  const quote = await getQuote((await params).id);
  if (!quote) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ quote, events: await listEvents(quote.id) });
}

const patchSchema = z
  .object({
    language: z.enum(["de", "en"]),
    recipient: recipientSchema,
    config: configSchema,
    lines: z.array(lineSchema).max(40),
    texts: textsSchema,
    validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ghlContactId: z.string().max(64).nullable(),
    ghlOpportunityId: z.string().max(64).nullable(),
    ghlPipelineId: z.string().max(64).nullable()
  })
  .partial();

export async function PATCH(request: Request, { params }: Ctx) {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_body", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  }
  const id = (await params).id;
  const quote = await updateDraft(id, parsed.data);
  if (!quote) {
    const existing = await getQuote(id);
    return Response.json({ error: existing ? "not_editable" : "not_found" }, { status: existing ? 409 : 404 });
  }
  return Response.json({ quote });
}

/** Entwurf verwerfen. Versendete Offerten bleiben zur Nachvollziehbarkeit erhalten. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  const quote = await getQuote((await params).id);
  if (!quote) return Response.json({ error: "not_found" }, { status: 404 });
  if (quote.status !== "draft") return Response.json({ error: "not_editable" }, { status: 409 });
  await setStatus(quote.id, "discarded");
  await logEvent(quote.id, access.user.name, "discarded");
  return Response.json({ ok: true });
}
