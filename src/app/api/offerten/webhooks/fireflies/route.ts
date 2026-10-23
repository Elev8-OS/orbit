import { after } from "next/server";
import { verifySignature, firefliesConfigured } from "@/lib/offerten/fireflies";
import { processMeeting } from "@/lib/offerten/service";
import { processOnboardingMeeting } from "@/lib/onboarding/service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Fireflies meldet hier jeden fertig verarbeiteten Call (Webhooks V1 und V2).
 * Öffentlich erreichbar, deshalb nur mit gültiger Signatur (FIREFLIES_WEBHOOK_SECRET).
 * Antwortet sofort; die Analysen laufen im Hintergrund weiter: Offerten und Onboarding getrennt,
 * ein Fehler in der einen Strecke stoppt die andere nicht.
 */
const ACCEPTED_EVENTS = new Set(["transcription completed", "meeting.transcribed", "meeting.summarized"]);

export async function POST(request: Request) {
  const secret = process.env.FIREFLIES_WEBHOOK_SECRET;
  if (!secret || !firefliesConfigured()) return Response.json({ error: "not_configured" }, { status: 503 });

  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-hub-signature"), secret)) {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const meetingId = String(payload.meetingId ?? payload.meeting_id ?? "").trim();
  const event = String(payload.eventType ?? payload.event ?? "").toLowerCase();
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(meetingId)) return Response.json({ error: "invalid_meeting" }, { status: 400 });
  if (!ACCEPTED_EVENTS.has(event)) return Response.json({ ok: true, ignored: event });

  after(async () => {
    await Promise.allSettled([processMeeting(meetingId), processOnboardingMeeting(meetingId)]);
  });
  return Response.json({ ok: true });
}
