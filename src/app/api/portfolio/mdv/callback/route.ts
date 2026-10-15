import { sql } from "@/lib/db";
import { requireUser } from "@/lib/platform/access";
import { canEditPortfolio } from "@/lib/portfolio/access";
import { finishConnect } from "@/lib/portfolio/mdvOauth";
import { resultPage } from "@/lib/portfolio/mdvPage";

export const dynamic = "force-dynamic";

/** Rücksprung von myDataValue: Code gegen Tokens tauschen, Verbindung prüfen. */
export async function GET(req: Request) {
  const ctx = await requireUser(canEditPortfolio);
  if ("response" in ctx) return ctx.response;
  const q = new URL(req.url).searchParams;
  const error = q.get("error");
  if (error) return resultPage(false, q.get("error_description") || error);
  const code = q.get("code");
  const state = q.get("state");
  if (!code || !state) return resultPage(false, "Antwort von myDataValue unvollständig");
  try {
    const { team } = await finishConnect(code, state);
    // Bewertungen beim nächsten Laden sofort über die neue Verbindung holen
    await sql`DELETE FROM portfolio_cache WHERE source = 'booking_reviews'`.catch(() => {});
    return resultPage(true, team ? `Verbunden mit Team „${team}“.` : "Verbunden.");
  } catch (err) {
    console.error("[portfolio] mdv callback:", err);
    return resultPage(false, String((err as Error).message ?? err));
  }
}
