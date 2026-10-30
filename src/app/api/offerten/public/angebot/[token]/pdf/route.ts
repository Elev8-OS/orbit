import { documentFor, renderFile } from "@/lib/offerten/service";
import { getSettings } from "@/lib/offerten/settings";
import { getQuoteByAcceptToken } from "@/lib/offerten/store";

export const dynamic = "force-dynamic";

/** Öffentlich (ohne Login): das versendete Angebot als PDF, für die Annahmeseite. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const quote = await getQuoteByAcceptToken((await params).token);
  if (!quote || quote.status !== "sent") return new Response("Not found", { status: 404 });
  const file = await renderFile(documentFor(quote, await getSettings()), "pdf");
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": `inline; filename="${file.filename}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex"
    }
  });
}
