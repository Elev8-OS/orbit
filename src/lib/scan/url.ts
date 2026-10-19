/**
 * Webadressen vereinheitlichen: Visitenkarten zeigen meist nur "www.firma.com" oder "firma.com".
 * GHL und Browser erwarten eine vollständige URL, deshalb wird https:// ergänzt.
 */
export function normalizeUrl(v: string | null | undefined, max = 200): string | null {
  if (typeof v !== "string") return null;
  let t = v.trim().replace(/\s+/g, "").replace(/[.,;]+$/, "");
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) t = t.replace(/^http(s?):\/\//i, (_m, s) => `http${s}://`);
  else if (/^\/\//.test(t)) t = `https:${t}`;
  else if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return null; // mailto:, tel: usw. sind keine Website
  else t = `https://${t}`;
  try {
    const u = new URL(t);
    if (!u.hostname.includes(".")) return null;
    return u.toString().replace(/\/$/, "").slice(0, max);
  } catch {
    return null;
  }
}
