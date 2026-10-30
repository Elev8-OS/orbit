import { z } from "zod";
import { acceptQuote } from "@/lib/offerten/accept";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const text = (max: number) => z.string().trim().max(max);
const bodySchema = z.object({
  name: text(120).min(2),
  role: text(120).default(""),
  email: z.string().trim().toLowerCase().email().max(200),
  company: text(160).min(1),
  addressLines: z.array(text(160)).min(1).max(5),
  country: text(60).default(""),
  vatId: text(40).default(""),
  note: text(1500).default(""),
  terms: z.literal(true)
});

/** Öffentlich (ohne Login): Kunde nimmt das Angebot an. Der Token im Pfad ist der Zugang. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  const { terms: _terms, addressLines, ...rest } = parsed.data;
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const result = await acceptQuote(
    (await params).token,
    { ...rest, addressLines: addressLines.filter(Boolean) },
    { ip, userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null }
  );
  if (!result.ok) return Response.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 409 });
  // Relativ, damit der Weiterleitungs-Knopf auf jeder Orbit-Adresse funktioniert (Mails enthalten den vollen Link)
  return Response.json({ ok: true, onboardingUrl: `/onboarding/${result.onboarding.token}` });
}
