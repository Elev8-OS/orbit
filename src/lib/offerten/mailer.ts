import { Resend } from "resend";
import { escapeHtml } from "@/lib/mail/layout";

/**
 * Versand der Offerte an den Kunden.
 *
 * Bevorzugt Microsoft Graph: Die Mail geht aus dem Postfach des angemeldeten Users, Antworten landen bei ihm
 * und die Mail steht in seinen gesendeten Objekten. Voraussetzung: Die Entra-App "Orbit" hat die
 * Anwendungsberechtigung Mail.Send (mit Admin-Zustimmung) und OFFERTEN_MAIL_PROVIDER=graph.
 *
 * Fallback Resend: Absender OFFERTEN_MAIL_FROM (oder MAIL_FROM), Antwortadresse = angemeldeter User.
 */

export type Attachment = { filename: string; contentType: string; data: Buffer };

export type OutgoingMail = {
  senderEmail: string;
  senderName: string;
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  attachments: Attachment[];
};

export type SendResult = { ok: true; provider: "graph" | "resend" } | { ok: false; error: string };

export function mailProvider(): "graph" | "resend" | null {
  const wanted = (process.env.OFFERTEN_MAIL_PROVIDER ?? "graph").toLowerCase();
  if (wanted === "graph" && graphConfigured()) return "graph";
  if (process.env.RESEND_API_KEY && (process.env.OFFERTEN_MAIL_FROM || process.env.MAIL_FROM)) return "resend";
  return null;
}

function tenantId(): string | null {
  const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ?? "";
  return issuer.match(/login\.microsoftonline\.com\/([0-9a-f-]{36})\//i)?.[1] ?? null;
}

function graphConfigured(): boolean {
  return Boolean(tenantId() && process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET);
}

let graphToken: { value: string; expires: number } | null = null;

async function getGraphToken(): Promise<string> {
  if (graphToken && graphToken.expires > Date.now() + 60_000) return graphToken.value;
  const res = await fetch(`https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_MICROSOFT_ENTRA_ID_ID ?? "",
      client_secret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ?? "",
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials"
    }),
    signal: AbortSignal.timeout(20_000)
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) throw new Error(`Graph-Token: ${json.error_description ?? res.status}`);
  graphToken = { value: json.access_token, expires: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return graphToken.value;
}

/** Einfaches, kundentaugliches HTML aus dem Klartext (Absätze, Zeilenumbrüche). */
export function textToHtml(text: string): string {
  const paragraphs = text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font:400 15px/1.6 'Segoe UI',Inter,Arial,sans-serif;color:#1a1a1a;">${paragraphs}</div>`;
}

export async function sendQuoteMail(mail: OutgoingMail): Promise<SendResult> {
  const provider = mailProvider();
  if (!provider) return { ok: false, error: "mail_not_configured" };
  try {
    if (provider === "graph") {
      const token = await getGraphToken();
      const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mail.senderEmail)}/sendMail`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            subject: mail.subject,
            body: { contentType: "HTML", content: textToHtml(mail.text) },
            toRecipients: mail.to.map((address) => ({ emailAddress: { address } })),
            ccRecipients: mail.cc.map((address) => ({ emailAddress: { address } })),
            attachments: mail.attachments.map((a) => ({
              "@odata.type": "#microsoft.graph.fileAttachment",
              name: a.filename,
              contentType: a.contentType,
              contentBytes: a.data.toString("base64")
            }))
          },
          saveToSentItems: true
        }),
        signal: AbortSignal.timeout(60_000)
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
        return { ok: false, error: `Graph ${res.status}: ${body?.error?.code ?? ""} ${body?.error?.message ?? ""}`.trim() };
      }
      return { ok: true, provider };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromAddress = process.env.OFFERTEN_MAIL_FROM || process.env.MAIL_FROM || "";
    const bare = fromAddress.match(/<([^>]+)>/)?.[1] ?? fromAddress;
    const { error } = await resend.emails.send({
      from: `${mail.senderName.replace(/[<>"]/g, "")} via Elev8 <${bare}>`,
      to: mail.to,
      cc: mail.cc.length ? mail.cc : undefined,
      replyTo: mail.senderEmail,
      subject: mail.subject,
      text: mail.text,
      html: textToHtml(mail.text),
      attachments: mail.attachments.map((a) => ({ filename: a.filename, content: a.data, contentType: a.contentType })),
      tags: [{ name: "type", value: "quote" }]
    });
    if (error) return { ok: false, error: `Resend: ${error.message}` };
    return { ok: true, provider };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
