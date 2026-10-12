import { z } from "zod";
import { requireOffertenUser } from "@/lib/offerten/access";
import { addNote, ghlConfigured } from "@/lib/offerten/ghl";
import { sendQuoteMail } from "@/lib/offerten/mailer";
import { personalizeConfigured, writeFollowUp } from "@/lib/offerten/personalize";
import { documentFor, renderFile } from "@/lib/offerten/service";
import { getSettings } from "@/lib/offerten/settings";
import { getQuote, logEvent, recordFollowUp } from "@/lib/offerten/store";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const daysSince = (iso: string | null) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000)) : 0);

/** Vorschlag für eine Nachfass-Mail (persönlich aus Gespräch und GHL-Verlauf). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  const quote = await getQuote((await params).id);
  if (!quote || quote.status !== "sent") return Response.json({ error: "not_found" }, { status: 404 });
  const to = quote.sentTo ?? [quote.recipient.email];
  if (!personalizeConfigured()) return Response.json({ to, subject: `Re: ${quote.texts.emailSubject || quote.number}`, body: "" });
  try {
    const settings = await getSettings();
    const draft = await writeFollowUp(quote, settings, { name: access.user.name }, {
      daysSinceSent: daysSince(quote.sentAt),
      followUpCount: quote.followUpCount
    });
    return Response.json({ to, ...draft });
  } catch (err) {
    console.error("Nachfass-Mail:", err);
    return Response.json({ to, subject: `Re: ${quote.texts.emailSubject || quote.number}`, body: "", error: "draft_failed" });
  }
}

const email = z.string().trim().toLowerCase().email().max(200);
const bodySchema = z.object({
  to: z.array(email).min(1).max(5),
  cc: z.array(email).max(5).default([]),
  subject: z.string().trim().min(1).max(250),
  body: z.string().trim().min(1).max(8000),
  attachPdf: z.boolean().default(false)
});

/** Nachfass-Mail aus dem eigenen Postfach senden, in GHL vermerken und nächsten Termin setzen. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  const { user } = access;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  const quote = await getQuote((await params).id);
  if (!quote || quote.status !== "sent") return Response.json({ error: "not_found" }, { status: 404 });
  const settings = await getSettings();
  const attachments = parsed.data.attachPdf ? [await renderFile(documentFor(quote, settings), "pdf")] : [];

  const sent = await sendQuoteMail({
    senderEmail: user.email,
    senderName: user.name,
    to: parsed.data.to,
    cc: parsed.data.cc,
    subject: parsed.data.subject,
    text: parsed.data.body,
    attachments: attachments.map((f) => ({ filename: f.filename, contentType: f.type, data: f.data }))
  });
  if (!sent.ok) {
    return Response.json({ error: sent.error === "mail_not_configured" ? "mail_not_configured" : "send_failed", detail: sent.error }, { status: 502 });
  }
  await recordFollowUp(quote.id, settings.followUpDays + 3);
  await logEvent(quote.id, user.name, "follow_up_sent", { to: parsed.data.to, subject: parsed.data.subject });
  if (quote.ghlContactId && ghlConfigured()) {
    await addNote(
      quote.ghlContactId,
      `Nachgefasst zu Offerte ${quote.number} von ${user.name} an ${parsed.data.to.join(", ")}.\n\n${parsed.data.body}`
    ).catch((err) => console.error("GHL-Notiz Nachfassen:", err));
  }
  return Response.json({ ok: true, quote: await getQuote(quote.id) });
}
