import type { ImportRow, Registration } from "./store";

/**
 * Teams-Anwesenheitsbericht (CSV, UTF-16, Tabulator, Abschnitte "1. Zusammenfassung", "2. Teilnehmer" …).
 * Liest Anmeldungen und Teilnahme. Sprachunabhängig über Spaltennamen in Deutsch und Englisch.
 */

export type ParsedReport = { rows: ImportRow[]; meetingSeconds: number | null; registered: number; attended: number };

export function decodeReport(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  return new TextDecoder("utf-8").decode(bytes);
}

export function parseDuration(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  let total = 0;
  let matched = false;
  for (const m of t.matchAll(/(\d+)\s*(h|m|s|std|min|sek)/gi)) {
    matched = true;
    const v = Number(m[1]);
    const u = m[2].toLowerCase();
    total += u.startsWith("h") || u === "std" ? v * 3600 : u.startsWith("m") ? v * 60 : v;
  }
  return matched ? total : null;
}

function splitLine(line: string): string[] {
  return line.split("\t").map((c) => c.replace(/^"|"$/g, "").trim());
}

/** Datum im Teams-Format "11/02/26, 4:51:01 PM" (MM/DD/YY) */
function parseTeamsDate(s: string): Date | null {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!m) return null;
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  let h = Number(m[4]);
  if (m[7]?.toUpperCase() === "PM" && h < 12) h += 12;
  if (m[7]?.toUpperCase() === "AM" && h === 12) h = 0;
  return new Date(year, Number(m[1]) - 1, Number(m[2]), h, Number(m[5]), Number(m[6] ?? 0));
}

export function parseTeamsReport(text: string): ParsedReport {
  const lines = text.replace(/\r/g, "").split("\n");
  let meetingSeconds: number | null = null;
  for (const l of lines) {
    const [k, v] = splitLine(l);
    if (/^(Besprechungsdauer|Meeting duration)$/i.test(k ?? "")) meetingSeconds = parseDuration(v ?? "");
  }
  const start = lines.findIndex((l) => /^2\.\s*(Teilnehmer|Participants)/i.test(l.trim()));
  if (start < 0) throw new Error("Abschnitt „2. Teilnehmer“ nicht gefunden. Ist das ein Teams-Anwesenheitsbericht?");
  const header = splitLine(lines[start + 1] ?? "");
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  const cFirstJoin = col(/^(Erster Beitritt|First Join)/i);
  const cDuration = col(/^(Dauer der Besprechung|In-Meeting Duration|Duration)/i);
  const cEmail = col(/^(E-Mail|Email)$/i);
  const cRegFirst = col(/(Registrierung: Vorname|Registration: First name)/i);
  const cRegLast = col(/(Registrierung: Nachname|Registration: Last name)/i);
  const cRegEmail = col(/(Registrierungs-E-Mail|Registration email)/i);
  const cRegAt = col(/(Zeitpunkt der Registrierung|Registration time)/i);
  const cNews = col(/newsletter/i);
  const cOrg = col(/^(Organisation|Organization)$/i);
  const cPms = col(/PMS/);
  const cUnits = col(/(Einheiten|units)/i);
  const cName = col(/^Name$/i);

  const rows: ImportRow[] = [];
  for (let i = start + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || /^\d+\.\s/.test(line.trim())) break;
    const c = splitLine(line);
    const email = (c[cRegEmail] || c[cEmail] || "").toLowerCase();
    if (!email.includes("@")) continue;
    const joined = cFirstJoin >= 0 && Boolean(c[cFirstJoin]);
    const seconds = cDuration >= 0 ? parseDuration(c[cDuration] ?? "") : null;
    const display = (c[cName] ?? "").replace(/\s*\((Ungeprüft|Unverified)\)/i, "");
    rows.push({
      email,
      firstName: c[cRegFirst] || display.split(" ")[0] || "",
      lastName: c[cRegLast] || display.split(" ").slice(1).join(" ") || "",
      organization: cOrg >= 0 ? c[cOrg] ?? "" : "",
      pms: cPms >= 0 ? (c[cPms] ?? "").trim() : "",
      units: cUnits >= 0 ? c[cUnits] ?? "" : "",
      newsletter: cNews >= 0 ? /^(yes|ja|true)$/i.test(c[cNews] ?? "") : false,
      attendedSeconds: joined ? seconds ?? 0 : null,
      status: joined ? "attended" : "missed",
      registeredAt: cRegAt >= 0 ? parseTeamsDate(c[cRegAt] ?? "") : null
    });
  }
  return { rows, meetingSeconds, registered: rows.length, attended: rows.filter((r) => r.status === "attended").length };
}

/** Prüft, ob ein Teilnahmebericht glaubwürdig ist, bevor Tags gesetzt werden. */
export function plausibility(input: { meetingSeconds: number | null; registered: number; attended: number; plannedMin: number }): string[] {
  const warnings: string[] = [];
  if (input.meetingSeconds !== null && input.meetingSeconds < 300) {
    warnings.push(`Die Sitzung dauerte laut Bericht nur ${Math.round(input.meetingSeconds)} Sekunden. Lief das Webinar über einen anderen Link?`);
  } else if (input.meetingSeconds !== null && input.meetingSeconds < input.plannedMin * 60 * 0.4) {
    warnings.push(`Die Sitzung war mit ${Math.round(input.meetingSeconds / 60)} Minuten deutlich kürzer als geplant (${input.plannedMin} Minuten).`);
  }
  if (input.registered >= 5 && input.attended / input.registered < 0.1) {
    warnings.push(`Nur ${input.attended} von ${input.registered} Angemeldeten gelten als anwesend.`);
  }
  return warnings;
}

export function countByStatus(regs: Registration[]) {
  return {
    registered: regs.length,
    attended: regs.filter((r) => r.status === "attended").length,
    missed: regs.filter((r) => r.status === "missed").length,
    open: regs.filter((r) => r.status === "registered").length
  };
}
