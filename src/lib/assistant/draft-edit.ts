import { escapeHtml } from "@/lib/mail/layout";

/**
 * Antworttext eines Noah-Entwurfs in Outlook finden, als Text bearbeiten und wieder einsetzen.
 *
 * Der Entwurf in Outlook besteht aus unserem Antwortblock (ein <div> mit Calibri 11pt, nur <p> und <br> darin)
 * gefolgt vom zitierten Mailverlauf. Nur der Antwortblock wird ersetzt, der Rest (Verlauf, Empfänger, Betreff,
 * Anhänge) bleibt unberührt. Ist der Block nicht eindeutig zu finden, etwa weil der Entwurf in Outlook umgebaut
 * wurde, wird nichts verändert (findReplyBlock liefert null).
 */
const BLOCK_START = /<div\b[^>]*(?:id=["']orbit-reply["']|font-family:\s*["']?Calibri["']?,\s*Arial,\s*sans-serif;\s*font-size:\s*11pt)[^>]*>/i;

export function findReplyBlock(html: string): { start: number; end: number; inner: string } | null {
  const m = BLOCK_START.exec(html);
  if (!m) return null;
  const innerStart = m.index + m[0].length;
  const close = html.indexOf("</div>", innerStart);
  if (close < 0) return null;
  const inner = html.slice(innerStart, close);
  // Verschachtelte Blöcke (z.B. von Outlook umgebaut): nicht sicher ersetzbar
  if (/<div\b/i.test(inner)) return null;
  return { start: m.index, end: close + "</div>".length, inner };
}

/** Antwortblock als Text mit Absätzen (Leerzeile) und Zeilenumbrüchen. */
export function blockToText(inner: string): string {
  return inner
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<\/?p[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Text zurück in einen Antwortblock (gleiche Form wie beim Anlegen durch Noah, plus Kennung). */
export function textToBlock(text: string): string {
  const paragraphs = text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div id="orbit-reply" style="font-family:Calibri,Arial,sans-serif;font-size:11pt">${paragraphs}</div>`;
}
