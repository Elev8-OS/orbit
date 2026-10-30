/**
 * Öffentliche Links für Kunden (ohne Login): Angebot annehmen und Onboarding-Checkliste.
 * Basis ist OFFERTEN_PUBLIC_URL, sonst die Orbit-Adresse.
 */
const base = () => (process.env.OFFERTEN_PUBLIC_URL || process.env.AUTH_URL || "https://myorbit.elev8-suite.com").replace(/\/+$/, "");

export const acceptUrl = (token: string) => `${base()}/angebot/${token}`;
export const onboardingUrl = (token: string) => `${base()}/onboarding/${token}`;

const GREETING = /^(freundliche|beste|liebe|herzliche|viele|sonnige)\s+gr(ü|ue)(ss|ß)e|^gr(ü|ue)(ss|ß)e|^best regards|^kind regards|^best,|^regards|^cheers|^warm regards|^all the best/im;

/**
 * Fügt den Annahme-Link in eine Mail ein, falls er noch fehlt: vor dem Gruss, sonst ans Ende.
 * So steht er in jeder Begleit- und Nachfass-Mail, auch wenn Noah oder die Sales-Person den Text frei schreibt.
 */
export function withAcceptLink(body: string, url: string, lang: "de" | "en"): string {
  if (body.includes(url)) return body;
  const line = lang === "en" ? `View and accept the offer online: ${url}` : `Angebot online ansehen und annehmen: ${url}`;
  const lines = body.split("\n");
  const idx = lines.findIndex((l) => GREETING.test(l.trim()));
  if (idx > 0) {
    const before = lines.slice(0, idx).join("\n").replace(/\s+$/, "");
    return `${before}\n\n${line}\n\n${lines.slice(idx).join("\n")}`;
  }
  return `${body.replace(/\s+$/, "")}\n\n${line}`;
}
