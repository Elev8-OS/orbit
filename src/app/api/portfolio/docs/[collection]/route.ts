import { requireUser } from "@/lib/platform/access";
import { hasPortfolioAccess } from "@/lib/portfolio/access";
import { isCollection, listDocs } from "@/lib/portfolio/docs";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ collection: string }> }) {
  const ctx = await requireUser(hasPortfolioAccess);
  if ("response" in ctx) return ctx.response;
  const { collection } = await params;
  if (!isCollection(collection)) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ docs: await listDocs(collection) }, { headers: { "Cache-Control": "no-store" } });
}
