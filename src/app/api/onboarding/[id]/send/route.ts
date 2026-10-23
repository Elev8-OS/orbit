import { requireOnboardingUser } from "@/lib/onboarding/access";
import { sendDraft } from "@/lib/onboarding/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Freigeben: legt in Orbit 4 das Kundenkonto an und schickt die Einladung. Nur auf ausdrücklichen Klick. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireOnboardingUser();
  if ("response" in gate) return gate.response;
  const { id } = await params;
  const result = await sendDraft(id, gate.user);
  if (!result.ok) return Response.json({ error: result.code, message: result.message }, { status: result.code === "not_found" ? 404 : 409 });
  return Response.json({ ok: true, mailed: result.draft.orbitResult?.mailed ?? false, partner: result.draft.orbitResult?.partner ?? "none" });
}
