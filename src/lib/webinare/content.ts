import { callClaudeTool, claudeConfigured } from "@/lib/offerten/claude";
import type { Bilingual, Chapter, Segment, Webinar } from "./store";

/**
 * Inhalte einer Aufzeichnung: Transkript aus Fireflies (mit Zeitmarken), daraus mit Claude
 * Kapitel, Zusammenfassung, Kernaussagen, Umsetzungs-Checkliste und die englische Fassung.
 */

const FIREFLIES = "https://api.fireflies.ai/graphql";

export function firefliesReady(): boolean {
  return Boolean(process.env.FIREFLIES_API_KEY);
}

async function ff<T>(gql: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(FIREFLIES, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.FIREFLIES_API_KEY}` },
    body: JSON.stringify({ query: gql, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(45_000)
  });
  const json = (await res.json().catch(() => null)) as { data?: T; errors?: { message: string }[] } | null;
  if (!res.ok || !json?.data || json.errors?.length) throw new Error(`Fireflies: ${json?.errors?.map((e) => e.message).join("; ") || res.status}`);
  return json.data;
}

export type FirefliesHit = { id: string; title: string; date: string | null; durationMin: number | null };

/** Aufnahmen rund um das Webinar-Datum, damit man die richtige auswählen kann. */
export async function findFireflies(around: Date): Promise<FirefliesHit[]> {
  const from = new Date(around.getTime() - 3 * 86400_000).toISOString();
  const to = new Date(around.getTime() + 21 * 86400_000).toISOString();
  const data = await ff<{ transcripts: { id: string; title: string | null; dateString: string | null; duration: number | null }[] }>(
    `query Find($from: DateTime, $to: DateTime) { transcripts(fromDate: $from, toDate: $to, limit: 50) { id title dateString duration } }`,
    { from, to }
  );
  return data.transcripts.map((t) => ({ id: t.id, title: t.title ?? "", date: t.dateString, durationMin: t.duration ? Math.round(t.duration) : null }));
}

/** Sätze zu lesbaren Abschnitten zusammenfassen: gleicher Sprecher, höchstens ~30 Sekunden bzw. 420 Zeichen. */
export function mergeSentences(sentences: { speaker: string; text: string; start: number; end: number }[]): Segment[] {
  const out: Segment[] = [];
  for (const s of sentences) {
    const text = s.text.trim();
    if (!text) continue;
    const last = out[out.length - 1];
    if (last && last.speaker === s.speaker && s.end - last.start < 30 && last.de.length + text.length < 420) {
      last.de = `${last.de} ${text}`;
      last.end = s.end;
    } else {
      out.push({ start: round(s.start), end: round(s.end), speaker: s.speaker, de: text, en: "" });
    }
  }
  return out;
}
const round = (n: number) => Math.round(n * 10) / 10;

export async function loadFireflies(id: string): Promise<{ title: string; segments: Segment[] }> {
  const data = await ff<{
    transcript: { title: string | null; sentences: { speaker_name: string | null; text: string | null; start_time: number | null; end_time: number | null }[] | null } | null;
  }>(`query T($id: String!) { transcript(id: $id) { title sentences { speaker_name text start_time end_time } } }`, { id });
  if (!data.transcript) throw new Error("Fireflies kennt diese Aufnahme nicht.");
  const sentences = (data.transcript.sentences ?? []).map((s) => ({
    speaker: s.speaker_name ?? "",
    text: s.text ?? "",
    start: Number(s.start_time ?? 0),
    end: Number(s.end_time ?? s.start_time ?? 0)
  }));
  return { title: data.transcript.title ?? "", segments: mergeSentences(sentences) };
}

export const mmss = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
};

function transcriptText(segments: Segment[], max = 140_000): string {
  let text = "";
  for (const s of segments) {
    const line = `[${Math.round(s.start)}] ${s.speaker}: ${s.de}\n`;
    if (text.length + line.length > max) break;
    text += line;
  }
  return text;
}

const SYSTEM = `Du bereitest Aufzeichnungen der Elev8-Kundenwebinare für das Webinar-Portal auf. Elev8 ist eine
Software für Ferienvermietung (Property Management, Channel Manager, Gästekommunikation). Zielgruppe: bestehende
Kunden, die das Gelernte direkt in Elev8 umsetzen wollen. Schreibe klar, konkret und ohne Marketing-Floskeln.
Deutsch in Schweizer Rechtschreibung (ss statt ß). Englisch natürlich und knapp. Zeitangaben sind Sekunden ab Videostart.`;

export type GeneratedContent = {
  titleEn: string;
  descriptionDe: string;
  descriptionEn: string;
  chapters: Chapter[];
  summaryDe: string;
  summaryEn: string;
  takeaways: Bilingual;
  checklist: Bilingual;
  teaser: { start: number; end: number } | null;
};

export async function generateContent(w: Webinar): Promise<GeneratedContent> {
  if (!claudeConfigured()) throw new Error("ANTHROPIC_API_KEY fehlt.");
  if (!w.transcript.length) throw new Error("Zuerst das Transkript laden.");
  const input = (await callClaudeTool({
    system: SYSTEM,
    user: `Webinar: ${w.titleDe}\nReferent: ${w.speaker || "unbekannt"}\n\nTranskript (Format: [Sekunde] Sprecher: Text):\n${transcriptText(w.transcript)}`,
    maxTokens: 6000,
    timeoutMs: 240_000,
    tool: {
      name: "webinar_inhalte",
      description: "Aufbereitete Inhalte der Aufzeichnung",
      input_schema: {
        type: "object",
        required: ["title_en", "description_de", "description_en", "chapters", "summary_de", "summary_en", "takeaways_de", "takeaways_en", "checklist_de", "checklist_en"],
        properties: {
          title_en: { type: "string", description: "Englischer Titel des Webinars" },
          description_de: { type: "string", description: "2 Sätze: worum geht es, was nimmt man mit" },
          description_en: { type: "string" },
          chapters: {
            type: "array",
            description: "5 bis 12 Kapitel in Videoreihenfolge, erstes bei 0",
            items: { type: "object", required: ["start", "de", "en"], properties: { start: { type: "number" }, de: { type: "string" }, en: { type: "string" } } }
          },
          summary_de: { type: "string", description: "Zusammenfassung in 2–4 kurzen Absätzen, getrennt durch Leerzeilen" },
          summary_en: { type: "string" },
          takeaways_de: { type: "array", items: { type: "string" }, description: "Genau 3 Kernaussagen, je ein Satz" },
          takeaways_en: { type: "array", items: { type: "string" } },
          checklist_de: { type: "array", items: { type: "string" }, description: "4–8 konkrete Schritte: So setzt du das morgen in Elev8 um" },
          checklist_en: { type: "array", items: { type: "string" } },
          teaser_start: { type: "number", description: "Beginn eines starken Ausschnitts von 45–90 Sekunden für die öffentliche Vorschau" },
          teaser_end: { type: "number" }
        }
      }
    }
  })) as Record<string, unknown>;

  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
  const chapters = (Array.isArray(input.chapters) ? input.chapters : [])
    .map((c) => c as { start?: number; de?: string; en?: string })
    .map((c) => ({ start: Math.max(0, Number(c.start ?? 0)), de: String(c.de ?? ""), en: String(c.en ?? "") }))
    .filter((c) => c.de)
    .sort((a, b) => a.start - b.start);
  const ts = Number(input.teaser_start);
  const te = Number(input.teaser_end);
  return {
    titleEn: String(input.title_en ?? ""),
    descriptionDe: String(input.description_de ?? ""),
    descriptionEn: String(input.description_en ?? ""),
    chapters,
    summaryDe: String(input.summary_de ?? ""),
    summaryEn: String(input.summary_en ?? ""),
    takeaways: { de: arr(input.takeaways_de).slice(0, 3), en: arr(input.takeaways_en).slice(0, 3) },
    checklist: { de: arr(input.checklist_de), en: arr(input.checklist_en) },
    teaser: Number.isFinite(ts) && Number.isFinite(te) && te > ts ? { start: Math.round(ts), end: Math.round(te) } : null
  };
}

/** Übersetzt die Transkript-Abschnitte ins Englische, in Paketen. Bereits übersetzte bleiben. */
export async function translateTranscript(segments: Segment[], onBatch?: (done: number) => Promise<void>): Promise<Segment[]> {
  if (!claudeConfigured()) throw new Error("ANTHROPIC_API_KEY fehlt.");
  const out = segments.map((s) => ({ ...s }));
  const todo = out.map((s, i) => ({ s, i })).filter((x) => !x.s.en);
  for (let k = 0; k < todo.length; k += 40) {
    const batch = todo.slice(k, k + 40);
    const input = (await callClaudeTool({
      system: `${SYSTEM}\nÜbersetze gesprochene Sprache (auch Schweizerdeutsch-Anklänge) in flüssiges, natürliches Englisch. Produktnamen bleiben.`,
      user: batch.map((x) => `#${x.i}: ${x.s.de}`).join("\n"),
      maxTokens: 8000,
      timeoutMs: 240_000,
      tool: {
        name: "uebersetzung",
        description: "Englische Übersetzung je Abschnitt",
        input_schema: {
          type: "object",
          required: ["items"],
          properties: { items: { type: "array", items: { type: "object", required: ["i", "en"], properties: { i: { type: "number" }, en: { type: "string" } } } } }
        }
      }
    })) as { items?: { i: number; en: string }[] };
    for (const item of input.items ?? []) if (out[item.i]) out[item.i].en = String(item.en ?? "");
    if (onBatch) await onBatch(Math.min(k + 40, todo.length));
  }
  return out;
}

/**
 * Übersetzt kurze Texte (Titel, Beschreibungen, Kapitel, Listen) ins Englische. Leere Texte bleiben leer.
 * Ist der Text schon Englisch, kommt er unverändert zurück. Reihenfolge und Anzahl bleiben gleich.
 */
export async function translateToEnglish(texts: string[]): Promise<string[]> {
  const out = texts.map(() => "");
  const todo = texts.map((t, i) => ({ t: t.trim(), i })).filter((x) => x.t);
  if (!todo.length) return out;
  if (!claudeConfigured()) throw new Error("ANTHROPIC_API_KEY fehlt.");
  for (let k = 0; k < todo.length; k += 60) {
    const batch = todo.slice(k, k + 60);
    const input = (await callClaudeTool({
      system: `${SYSTEM}\nÜbersetze die nummerierten Texte ins Englische: natürlich, freundlich, kurz wie das Original, Du-Form wird zu \"you\". Produktnamen (Elev8, Journey, PriceLabs …) bleiben. Zeilenumbrüche innerhalb eines Textes bleiben erhalten. Ist ein Text schon Englisch, gib ihn unverändert zurück.`,
      user: batch.map((x) => `#${x.i}:\n${x.t}`).join("\n\n"),
      maxTokens: 6000,
      timeoutMs: 120_000,
      tool: {
        name: "uebersetzung",
        description: "Englische Übersetzung je Text",
        input_schema: {
          type: "object",
          required: ["items"],
          properties: { items: { type: "array", items: { type: "object", required: ["i", "en"], properties: { i: { type: "number" }, en: { type: "string" } } } } }
        }
      }
    })) as { items?: { i: number; en: string }[] };
    for (const item of input.items ?? []) if (item.i in out) out[item.i] = String(item.en ?? "").trim();
  }
  return out;
}
