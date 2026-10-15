import { requireUser } from "@/lib/platform/access";
import { canEditPortfolio } from "@/lib/portfolio/access";
import { startConnect } from "@/lib/portfolio/mdvOauth";
import { resultPage } from "@/lib/portfolio/mdvPage";

export const dynamic = "force-dynamic";

/** Startet die Anmeldung bei myDataValue (öffnet sich im eigenen Fenster). Nur mit Pflegerechten. */
export async function GET() {
  const ctx = await requireUser(canEditPortfolio);
  if ("response" in ctx) return ctx.response;
  try {
    return Response.redirect(await startConnect(ctx.user.email), 302);
  } catch (err) {
    console.error("[portfolio] mdv connect:", err);
    return resultPage(false, String((err as Error).message ?? err));
  }
}
