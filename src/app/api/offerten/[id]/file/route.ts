import { requireOffertenUser } from "@/lib/offerten/access";
import { documentFor, refreshLines, renderFile, type Format } from "@/lib/offerten/service";
import { getSettings } from "@/lib/offerten/settings";
import { getQuote } from "@/lib/offerten/store";

export const dynamic = "force-dynamic";

/** PDF oder Excel der Offerte im aktuellen Stand. ?download=1 lädt herunter, sonst Anzeige im Browser. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") as Format;
  if (format !== "pdf" && format !== "xlsx") return Response.json({ error: "invalid_format" }, { status: 400 });

  const quote = await getQuote((await params).id);
  if (!quote) return Response.json({ error: "not_found" }, { status: 404 });
  const settings = await getSettings();
  // Entwürfe immer mit aktuellen Preisen; ohne GHL-Owner erscheint der angemeldete User als Kontakt
  const view = quote.status === "draft" ? { ...quote, lines: refreshLines(quote, settings) } : quote;
  const file = await renderFile(documentFor(view, settings, { name: access.user.name, email: access.user.email }), format);
  const disposition = url.searchParams.get("download") === "1" || format === "xlsx" ? "attachment" : "inline";
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": `${disposition}; filename="${file.filename}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "Cache-Control": "private, no-store",
      // Vorschau im eigenen Editor erlauben
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "frame-ancestors 'self'"
    }
  });
}
