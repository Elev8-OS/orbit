import { getLocale } from "next-intl/server";
import { hasKundenAccess, requireUser } from "@/lib/platform/access";
import { createBriefing, loadCustomer } from "@/lib/kunden/service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Noah schreibt ein neues Kurzbriefing zum Kunden (ersetzt das gespeicherte). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireUser(hasKundenAccess);
  if ("response" in r) return r.response;
  const { id } = await params;
  const locale = (await getLocale()) === "en" ? "en" : "de";
  try {
    const customer = await loadCustomer(id, r.user, locale);
    if (!customer) return Response.json({ error: "not_found" }, { status: 404 });
    const briefing = await createBriefing(customer, locale, r.user.email);
    return Response.json({ briefing });
  } catch (err) {
    console.error("Kundenbriefing:", err);
    const code = err instanceof Error && err.message === "claude_not_configured" ? 503 : 502;
    return Response.json({ error: code === 503 ? "not_configured" : "failed" }, { status: code });
  }
}
