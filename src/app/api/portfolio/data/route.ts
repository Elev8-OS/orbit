import { requireUser } from "@/lib/platform/access";
import { hasPortfolioAccess } from "@/lib/portfolio/access";
import { loadDatasets } from "@/lib/portfolio/sources";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Alle Datensätze des Portfolio-Moduls. ?refresh=1 holt die Live-Quellen neu (sonst aus dem Cache). */
export async function GET(req: Request) {
  const ctx = await requireUser(hasPortfolioAccess);
  if ("response" in ctx) return ctx.response;
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  try {
    return Response.json(await loadDatasets(force), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[portfolio] data:", err);
    return Response.json({ error: "data_failed" }, { status: 500 });
  }
}
