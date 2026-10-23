import { z } from "zod";
import { requireOnboardingUser } from "@/lib/onboarding/access";
import { discardDraft, getDraft, logEvent, updateDraft } from "@/lib/onboarding/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  recipient: z.object({ name: z.string().max(120), email: z.string().max(200), company: z.string().max(160), phone: z.string().max(40) }).optional(),
  language: z.enum(["de", "en"]).optional(),
  contractFirst: z.boolean().optional(),
  partnerEmail: z.string().max(200).nullable().optional(),
  partnerName: z.string().max(120).nullable().optional(),
  note: z.string().max(2000).nullable().optional()
});

/** Entwurf speichern. Gesendete oder verworfene Entwürfe bleiben unverändert. */
export async function PATCH(request: Request, { params }: Ctx) {
  const gate = await requireOnboardingUser();
  if ("response" in gate) return gate.response;
  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const draft = await updateDraft(id, parsed.data);
  if (!draft) return Response.json({ error: (await getDraft(id)) ? "not_editable" : "not_found" }, { status: 409 });
  await logEvent(id, gate.user.name, "edited", { fields: Object.keys(parsed.data) });
  return Response.json({ ok: true });
}

/** Entwurf verwerfen. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const gate = await requireOnboardingUser();
  if ("response" in gate) return gate.response;
  const { id } = await params;
  if (!(await discardDraft(id))) return Response.json({ error: "not_editable" }, { status: 409 });
  await logEvent(id, gate.user.name, "discarded");
  return Response.json({ ok: true });
}
