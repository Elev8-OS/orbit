import { z } from "zod";
import { requireOnboardingUser } from "@/lib/onboarding/access";
import { createManual } from "@/lib/onboarding/service";

export const dynamic = "force-dynamic";

/** Entwurf von Hand anlegen (ohne Call). */
export async function POST(request: Request) {
  const gate = await requireOnboardingUser();
  if ("response" in gate) return gate.response;
  const parsed = z
    .object({
      name: z.string().trim().max(120).optional(),
      email: z.string().trim().max(200).optional(),
      company: z.string().trim().max(160).optional(),
      phone: z.string().trim().max(40).optional(),
      language: z.enum(["de", "en"]).optional()
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const draft = await createManual(gate.user, parsed.data);
  return Response.json({ id: draft.id }, { status: 201 });
}
