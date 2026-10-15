import { requireUser } from "@/lib/platform/access";
import { canEditPortfolio, hasPortfolioAccess } from "@/lib/portfolio/access";
import { disconnect, mdvStatus } from "@/lib/portfolio/mdvOauth";

export const dynamic = "force-dynamic";

/** Stand der myDataValue-Verbindung (ohne Tokens). */
export async function GET() {
  const ctx = await requireUser(hasPortfolioAccess);
  if ("response" in ctx) return ctx.response;
  try {
    return Response.json(await mdvStatus(), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[portfolio] mdv status:", err);
    return Response.json({ connected: false, error: "status_failed" }, { status: 500 });
  }
}

/** Verbindung trennen (Token wird bei myDataValue widerrufen, falls möglich). */
export async function DELETE() {
  const ctx = await requireUser(canEditPortfolio);
  if ("response" in ctx) return ctx.response;
  await disconnect();
  return Response.json({ ok: true });
}
