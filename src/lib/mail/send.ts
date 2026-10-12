import { Resend } from "resend";

let client: Resend | null = null;

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

function resend(): Resend {
  client ??= new Resend(process.env.RESEND_API_KEY);
  return client;
}

export type Mail = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
};

export type MailResult = { ok: true; id: string } | { ok: false; reason: "not_configured" | "send_failed"; detail?: string };

/**
 * Versendet eine E-Mail über Resend. Wirft nie – Aufrufer entscheiden anhand des Ergebnisses,
 * ob ein Fehler für den User relevant ist.
 */
export async function sendMail(mail: Mail): Promise<MailResult> {
  if (!mailConfigured()) {
    console.warn(`E-Mail nicht gesendet (RESEND_API_KEY/MAIL_FROM fehlen): ${mail.subject}`);
    return { ok: false, reason: "not_configured" };
  }
  try {
    const { data, error } = await resend().emails.send({
      from: process.env.MAIL_FROM!,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: mail.replyTo,
      tags: mail.tags
    });
    if (error || !data) {
      console.error("Resend-Fehler:", error);
      return { ok: false, reason: "send_failed", detail: error?.message };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    console.error("Resend nicht erreichbar:", err);
    return { ok: false, reason: "send_failed" };
  }
}

/** Kommagetrennte Empfängerliste aus einer Umgebungsvariable. */
export function recipientsFromEnv(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
