import { z } from "zod";
import { getOnboardingByToken, setItemDone } from "@/lib/offerten/onboarding";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ itemId: z.string().min(1).max(40), done: z.boolean() });

/** Öffentlich (ohne Login): Kunde hakt eigene oder gemeinsame Punkte ab. Elev8-Punkte bleiben gesperrt. */
export async function PATCH(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  const onboarding = await getOnboardingByToken((await params).token);
  if (!onboarding) return Response.json({ error: "not_found" }, { status: 404 });
  const updated = await setItemDone(onboarding, parsed.data.itemId, parsed.data.done, {
    name: onboarding.contactName || "Kunde",
    asCustomer: true
  });
  if (!updated) return Response.json({ error: "not_allowed" }, { status: 403 });
  return Response.json({ items: updated.items });
}
