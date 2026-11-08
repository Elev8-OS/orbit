import zlib from "node:zlib";
import type { Segment } from "./store";

/**
 * Teams-Transkript als Datei übernehmen: .docx (Download aus Teams/Stream) oder .vtt.
 * Ohne Zusatzbibliothek: die .docx ist ein ZIP, gelesen wird nur word/document.xml.
 */

function unzipEntry(buf: Buffer, name: string): Buffer | null {
  // Ende des zentralen Verzeichnisses suchen
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66_000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Die Datei ist keine gültige .docx.");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const entry = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (entry === name) {
      const lName = buf.readUInt16LE(local + 26);
      const lExtra = buf.readUInt16LE(local + 28);
      const start = local + 30 + lName + lExtra;
      const data = buf.subarray(start, start + size);
      return method === 0 ? Buffer.from(data) : zlib.inflateRawSync(data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");

function docxParagraphs(buf: Buffer): string[] {
  const xml = unzipEntry(buf, "word/document.xml");
  if (!xml) throw new Error("In der .docx fehlt der Text (word/document.xml).");
  const out: string[] = [];
  for (const p of xml.toString("utf8").split(/<\/w:p>/)) {
    let text = "";
    for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)) text += m[1] !== undefined ? decodeXml(m[1]) : m[0] === "<w:tab/>" ? "\t" : "\n";
    out.push(text);
  }
  return out;
}

/** Teams-Vermerke wie „Reto Wyss hat die Transkription beendet“ */
const STOP_NOTE = /\s*[\p{Lu}][\p{L}'-]+(?: [\p{Lu}][\p{L}'-]+)*\s+(?:hat die )?(?:Transkription|transcription)\s+(?:beendet|gestartet|gestoppt|started|stopped)\.?\s*$/u;

const toSec = (t: string) => t.split(":").map(Number).reduce((a, b) => a * 60 + b, 0);

/** Lange Wortmeldungen in lesbare Abschnitte teilen; Zeiten anteilig nach Textlänge. */
function chunk(speaker: string, start: number, end: number, lines: string[]): Segment[] {
  const text = lines.join(" ").replace(/\s+/g, " ").trim();
  if (!text) return [];
  const sentences = text.match(/[^.!?]+[.!?]+["“”']?|\S[^.!?]*$/g) ?? [text];
  const parts: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && cur.length + s.length > 380) {
      parts.push(cur.trim());
      cur = "";
    }
    cur += s;
  }
  if (cur.trim()) parts.push(cur.trim());
  const total = parts.reduce((a, b) => a + b.length, 0) || 1;
  const span = Math.max(1, end - start);
  let at = start;
  return parts.map((de) => {
    const len = (de.length / total) * span;
    const seg = { start: Math.round(at * 10) / 10, end: Math.round((at + len) * 10) / 10, speaker, de, en: "" };
    at += len;
    return seg;
  });
}

/** Teams-.docx: Kopfzeile „Name   0:12“, darunter die Wortmeldung. */
export function parseTeamsDocx(buf: Buffer): Segment[] {
  const paras = docxParagraphs(buf);
  const header = /^(.{2,80}?)\s{2,}(\d{1,2}:\d{2}(?::\d{2})?)\s*$/;
  const blocks: { speaker: string; start: number; lines: string[] }[] = [];
  // Teams schreibt Kopfzeile und Text oft in denselben Absatz, getrennt durch Zeilenumbrüche
  for (const raw of paras.flatMap((p) => p.split("\n"))) {
    const line = raw.replace(/\t/g, "  ").replace(STOP_NOTE, "");
    if (!line.trim()) continue;
    const m = line.match(header);
    if (m) blocks.push({ speaker: m[1].trim(), start: toSec(m[2]), lines: [] });
    else if (blocks.length) blocks[blocks.length - 1].lines.push(line.trim());
  }
  if (!blocks.length) throw new Error("Keine Sprecher mit Zeitmarken gefunden. Ist das ein Teams-Transkript?");
  return blocks.flatMap((b, i) => chunk(b.speaker, b.start, blocks[i + 1]?.start ?? b.start + 30, b.lines));
}

/** WebVTT aus Teams: „<v Name>Text</v>“ */
export function parseVtt(text: string): Segment[] {
  const cues: { speaker: string; start: number; end: number; text: string }[] = [];
  const blocks = text.replace(/\r/g, "").split(/\n\n+/);
  const time = (t: string) => {
    const [h, m, s] = t.trim().replace(",", ".").split(":");
    return s === undefined ? Number(h) * 60 + Number(m) : Number(h) * 3600 + Number(m) * 60 + Number(s);
  };
  for (const b of blocks) {
    const lines = b.split("\n");
    const ti = lines.findIndex((l) => l.includes("-->"));
    if (ti < 0) continue;
    const [a, z] = lines[ti].split("-->");
    const body = lines.slice(ti + 1).join(" ");
    const v = body.match(/<v\s+([^>]+)>/);
    cues.push({ speaker: v?.[1]?.trim() ?? "", start: time(a), end: time(z.split(" ").filter(Boolean)[0] ?? a), text: body.replace(/<[^>]+>/g, "").trim() });
  }
  const out: Segment[] = [];
  for (const c of cues) {
    if (!c.text) continue;
    const last = out[out.length - 1];
    if (last && last.speaker === c.speaker && c.end - last.start < 30 && last.de.length + c.text.length < 420) {
      last.de = `${last.de} ${c.text}`;
      last.end = c.end;
    } else out.push({ start: c.start, end: c.end, speaker: c.speaker, de: c.text, en: "" });
  }
  return out;
}

export function parseTranscriptFile(name: string, buf: Buffer): Segment[] {
  if (/\.vtt$/i.test(name)) return parseVtt(buf.toString("utf8"));
  if (/\.docx$/i.test(name)) return parseTeamsDocx(buf);
  throw new Error("Bitte eine .docx- oder .vtt-Datei aus Teams wählen.");
}
