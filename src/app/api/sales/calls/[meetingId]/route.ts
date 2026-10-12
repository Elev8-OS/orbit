import { z } from "zod";
import { apiViewer, bad, forbidden, readJson, requestTimeZone } from "@/lib/sales/api";
import { canUseCall, markCall, suggestionFor, unmarkCall } from "@/lib/sales/service";

const schema = z.object({
  action: z.enum(["suggest", "dismiss", "restore"]),
  refresh: z.boolean().default(false),
  as: z.string().max(100).nullish()
});

/** suggest: Follow-up-Vorschlag von Claude · dismiss: kein nächster Schritt nötig · restore: wieder anzeigen */
export async function POST(req: Request, { params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  const input = await readJson(req, schema);
  if (!input) return bad();
  const ctx = await apiViewer(input.as);
  if ("response" in ctx) return ctx.response;
  const { viewer } = ctx;
  if (!(await canUseCall(viewer, meetingId))) return forbidden();

  if (input.action === "dismiss") {
    await markCall(meetingId, "dismissed", viewer.user.email);
    return Response.json({ ok: true });
  }
  if (input.action === "restore") {
    await unmarkCall(meetingId);
    return Response.json({ ok: true });
  }
  try {
    const suggestion = await suggestionFor(meetingId, input.refresh, await requestTimeZone());
    return Response.json({ ok: true, suggestion });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    console.error("Sales: Vorschlag fehlgeschlagen:", message);
    const code = message === "claude_not_configured" ? "claude_not_configured" : "suggest_failed";
    return Response.json({ error: code }, { status: code === "claude_not_configured" ? 409 : 502 });
  }
}
