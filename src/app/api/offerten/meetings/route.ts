import { requireOffertenUser } from "@/lib/offerten/access";
import { firefliesConfigured, isInternalEmail, listRecentTranscripts } from "@/lib/offerten/fireflies";
import { listMeetings } from "@/lib/offerten/store";

export const dynamic = "force-dynamic";

/** Letzte Fireflies-Calls mit externen Teilnehmern, ergänzt um den Verarbeitungsstand in Orbit. */
export async function GET() {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  if (!firefliesConfigured()) return Response.json({ error: "fireflies_not_configured" }, { status: 503 });
  try {
    const [recent, processed] = await Promise.all([listRecentTranscripts(30), listMeetings(200)]);
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
    return Response.json({ meetings });
  } catch (err) {
    console.error("Fireflies-Liste:", err);
    return Response.json({ error: "fireflies_failed" }, { status: 502 });
  }
}
