/**
 * Gebrandetes E-Mail-Layout im Elev8-Look: schwarzer Kopf, weisser Inhalt, gelber Button.
 * Tabellen-Layout und Inline-Styles, damit es auch in Outlook sauber aussieht.
 * Bewusst ohne SVG-Logo (viele Mail-Clients blockieren SVG) – die Wortmarke ist Text.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Block =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "details"; rows: [string, string][] }
  | { type: "quote"; text: string };

export type EmailContent = {
  lang: "de" | "en";
  preheader: string;
  heading: string;
  blocks: Block[];
  cta?: { label: string; url: string };
  footer: string;
};

const FONT = "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function renderBlock(block: Block): string {
  switch (block.type) {
    case "paragraph":
      return `<p style="margin:0 0 16px;font:400 15px/1.6 ${FONT};color:#262626;">${escapeHtml(block.text)}</p>`;
    case "list":
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">${block.items
        .map(
          (item) =>
            `<tr><td style="padding:4px 10px 4px 0;vertical-align:top;"><span style="display:inline-block;width:8px;height:8px;border-radius:8px;background:#F6BB12;"></span></td><td style="padding:2px 0;font:500 15px/1.5 ${FONT};color:#000;">${escapeHtml(item)}</td></tr>`
        )
        .join("")}</table>`;
    case "details":
      return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px;border:1px solid #E5E5E5;border-radius:10px;">${block.rows
        .map(
          ([label, value], i) =>
            `<tr><td style="padding:10px 14px;font:400 13px/1.4 ${FONT};color:#5F5F5F;width:34%;${i ? "border-top:1px solid #E5E5E5;" : ""}">${escapeHtml(label)}</td><td style="padding:10px 14px;font:500 14px/1.4 ${FONT};color:#000;${i ? "border-top:1px solid #E5E5E5;" : ""}">${escapeHtml(value)}</td></tr>`
        )
        .join("")}</table>`;
    case "quote":
      return `<p style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #F6BB12;background:#FAFAFA;font:400 15px/1.6 ${FONT};color:#262626;white-space:pre-wrap;">${escapeHtml(block.text)}</p>`;
  }
}

function renderBlockText(block: Block): string {
  switch (block.type) {
    case "paragraph":
    case "quote":
      return block.text;
    case "list":
      return block.items.map((i) => `• ${i}`).join("\n");
    case "details":
      return block.rows.map(([l, v]) => `${l}: ${v}`).join("\n");
  }
}

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const cta = content.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;"><tr><td style="border-radius:10px;background:#F6BB12;"><a href="${escapeHtml(
        content.cta.url
      )}" style="display:inline-block;padding:13px 22px;font:600 15px/1 ${FONT};color:#000;text-decoration:none;border-radius:10px;">${escapeHtml(
        content.cta.label
      )}</a></td></tr></table>`
    : "";

  const html = `<!doctype html>
<html lang="${content.lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(content.heading)}</title></head>
<body style="margin:0;padding:0;background:#F5F5F5;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td style="background:#000;border-radius:16px 16px 0 0;padding:22px 28px;">
      <span style="font:700 20px/1 ${FONT};color:#fff;letter-spacing:-0.02em;">Orbit</span>
      <span style="display:inline-block;width:8px;height:8px;border-radius:8px;background:#F6BB12;margin-left:6px;vertical-align:middle;"></span>
      <span style="font:500 12px/1 ${FONT};color:#A3A3A3;margin-left:10px;">by elev8</span>
    </td></tr>
    <tr><td style="background:#fff;border-radius:0 0 16px 16px;padding:32px 28px 28px;">
      <h1 style="margin:0 0 18px;font:700 24px/1.25 ${FONT};color:#000;letter-spacing:-0.02em;">${escapeHtml(content.heading)}</h1>
      ${content.blocks.map(renderBlock).join("\n      ")}
      ${cta}
    </td></tr>
    <tr><td style="padding:18px 28px;font:400 12px/1.5 ${FONT};color:#8A8A8A;">${escapeHtml(content.footer)}</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    content.heading,
    "",
    ...content.blocks.map((b) => renderBlockText(b) + "\n"),
    content.cta ? `${content.cta.label}: ${content.cta.url}\n` : "",
    "—",
    content.footer
  ].join("\n");

  return { html, text };
}
