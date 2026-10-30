import { z } from "zod";
import { requireOffertenUser } from "@/lib/offerten/access";
import { getOnboarding, setItemDone, setOnboardingStatus } from "@/lib/offerten/onboarding";
import { logEvent } from "@/lib/offerten/store";

export const dynamic = "force-dynamic";

const bodySchema = z.union([
  z.object({ itemId: z.string().min(1).max(40), done: z.boolean() }),
  z.object({ status: z.enum(["open", "live"]) })
]);

/** Team in Orbit: beliebige Punkte abhaken oder das Onboarding als live markieren. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  const onboarding = await getOnboarding((await params).id);
  if (!onboarding) return Response.json({ error: "not_found" }, { status: 404 });
  if ("status" in parsed.data) {
    const updated = await setOnboardingStatus(onboarding.id, parsed.data.status);
    await logEvent(onboarding.quoteId, access.user.name, parsed.data.status === "live" ? "onboarding_live" : "onboarding_reopened");
    return Response.json({ onboarding: updated });
  }
  const updated = await setItemDone(onboarding, parsed.data.itemId, parsed.data.done, { name: access.user.name, asCustomer: false });
  if (!updated) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ onboarding: updated });
}
