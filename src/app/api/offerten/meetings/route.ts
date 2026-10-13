import { requireOffertenUser } from "@/lib/offerten/access";
import { TRANSCRIPT_PAGE_SIZE, firefliesConfigured, isInternalEmail, listRecentTranscripts } from "@/lib/offerten/fireflies";
import { listMeetings } from "@/lib/offerten/store";

export const dynamic = "force-dynamic";

/**
 * Fireflies-Calls mit externen Teilnehmern, ergänzt um den Verarbeitungsstand in Orbit.
 * Seitenweise: ?skip=0 liefert die neuesten 50, ?skip=50 die nächsten usw.
 */
export async function GET(request: Request) {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  if (!firefliesConfigured()) return Response.json({ error: "fireflies_not_configured" }, { status: 503 });
  try {
    const skipParam = Number(new URL(request.url).searchParams.get("skip") ?? 0);
    const skip = Number.isFinite(skipParam) && skipParam > 0 ? Math.min(Math.floor(skipParam), 5000) : 0;
    const [recent, processed] = await Promise.all([listRecentTranscripts(TRANSCRIPT_PAGE_SIZE, skip), listMeetings(2000)]);
    const byId = new Map(processed.map((m) => [m.meetingId, m]));
    const meetings = recent
      .filter((t) => t.participants.some((p) => !isInternalEmail(p)))
      .map((t) => {
        const m = byId.get(t.id);
        return {
          id: t.id,
          title: t.title,
          date: t.dateString,
          organizer: t.organizerEmail,
          external: t.participants.filter((p) => !isInternalEmail(p)),
          status: m?.status ?? null,
          reason: m?.reason ?? null,
          quoteId: m?.quoteId ?? null,
          dismissedBy: m?.dismissedBy ?? null
        };
      });
    // Volle Seite = es gibt vermutlich ältere Calls; nextSkip zählt alle Calls, auch interne, die wir ausfiltern
    return Response.json({ meetings, nextSkip: skip + recent.length, hasMore: recent.length === TRANSCRIPT_PAGE_SIZE });
  } catch (err) {
    console.error("Fireflies-Liste:", err);
    return Response.json({ error: "fireflies_failed" }, { status: 502 });
  }
}
