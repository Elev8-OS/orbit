import { z } from "zod";
import { requireOffertenUser } from "@/lib/offerten/access";
import { sendQuoteMail } from "@/lib/offerten/mailer";
import { documentFor, renderFile, syncToGhl } from "@/lib/offerten/service";
import { getSettings } from "@/lib/offerten/settings";
import { claimSend, getQuote, logEvent, markSent, releaseSend } from "@/lib/offerten/store";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const email = z.string().trim().toLowerCase().email().max(200);
const bodySchema = z.object({
  to: z.array(email).min(1).max(5),
  cc: z.array(email).max(5).default([]),
  subject: z.string().trim().min(1).max(250),
  body: z.string().trim().min(1).max(10_000),
  formats: z.array(z.enum(["pdf", "xlsx"])).min(1).max(2)
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  const { user } = access;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  const input = parsed.data;
  if (!user.email) return Response.json({ error: "no_sender_email" }, { status: 400 });

  const id = (await params).id;
  const quote = await getQuote(id);
  if (!quote) return Response.json({ error: "not_found" }, { status: 404 });
  if (quote.status !== "draft") return Response.json({ error: "already_sent" }, { status: 409 });
  if (!quote.lines.length) return Response.json({ error: "no_lines" }, { status: 400 });

  // Dateien mit Versanddatum und Absender rendern, bevor der Status wechselt
  const settings = await getSettings();
  const doc = documentFor({ ...quote, sentAt: new Date().toISOString(), ownerName: user.name, ownerEmail: user.email }, settings);
  const formats = [...new Set(input.formats)];
  const files = await Promise.all(formats.map((f) => renderFile(doc, f)));

  // Doppelversand verhindern (Doppelklick, zwei Tabs)
  if (!(await claimSend(id))) return Response.json({ error: "already_sent" }, { status: 409 });

  const sent = await sendQuoteMail({
    senderEmail: user.email,
    senderName: user.name,
    to: input.to,
    cc: input.cc,
    subject: input.subject,
    text: input.body,
    attachments: files.map((f) => ({ filename: f.filename, contentType: f.type, data: f.data }))
  });
  if (!sent.ok) {
    await releaseSend(id);
    await logEvent(id, user.name, "send_failed", { error: sent.error });
    return Response.json(
      { error: sent.error === "mail_not_configured" ? "mail_not_configured" : "send_failed", detail: sent.error },
      { status: 502 }
    );
  }

  await markSent(id, { byName: user.name, byEmail: user.email, formats, to: input.to });
  await logEvent(id, user.name, "sent", { to: input.to, cc: input.cc, formats, provider: sent.provider, subject: input.subject });

  const fresh = (await getQuote(id))!;
  const ghl = await syncToGhl({ ...fresh, ownerName: user.name, ownerEmail: user.email }, files, settings, user.name);
  return Response.json({ ok: true, provider: sent.provider, ghl });
}
