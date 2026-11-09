import { sql } from "@/lib/db";
import { callClaudeTool, claudeConfigured } from "@/lib/offerten/claude";
import { mmss } from "./content";
import type { Webinar } from "./store";

/**
 * Erklärvideos aus Webinar-Aufzeichnungen. Orbit pflegt die Schnittliste (plan) und reiht den Auftrag ein,
 * der Render-Dienst (renderer/) schneidet und lädt das Ergebnis in den Bucket.
 * Alle Zeiten sind Sekunden im Video (Transkript-Zeit + Versatz).
 */

/** Eine Zeile Sprechertext: wann sie im Video gesagt wurde (Sekunden) und der bereinigte Text dazu. */
export type NarrationLine = { start: number; end: number; text: string };
export type Clip = { start: number; end: number; lines?: NarrationLine[] };
export type VideoChapter = { title: string; key: string; clips: Clip[] };
export type VideoPlan = {
  title: string;
  subtitle: string;
  meta: string;
  layout: "teams-share" | "full";
  allowGallery: boolean;
  /** Tab- und Adressleiste des geteilten Browsers zeigen (Standard: ausgeblendet) */
  browserBar: boolean;
  /** pro: feste ElevenLabs-Stimme für alle Erklärvideos (Kreis und Name entfallen), original: Stimme aus der Aufnahme */
  voice: "pro" | "original";
  pip: { enabled: boolean; name: string };
  outro: { title: string; url: string };
  chapters: VideoChapter[];
  youtube: { title: string; description: string; tags: string[] };
};
export type VideoStatus = "draft" | "queued" | "rendering" | "done" | "failed";
export type VideoResult = { durationSec: number; size: number; chapters: { title: string; at: number }[] };
export type VideoJob = {
  webinarId: string;
  plan: VideoPlan;
  status: VideoStatus;
  progress: number;
  message: string | null;
  version: number;
  fileKey: string | null;
  thumbKey: string | null;
  result: VideoResult | null;
  queuedAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  updatedAt: Date;
};

/** Gleiche Werte wie im Render-Dienst */
export const INTRO_SEC = 5;
export const OUTRO_SEC = 6;
export const TARGET = { min: 180, max: 240 };

export function emptyPlan(w: Webinar): VideoPlan {
  const date = new Intl.DateTimeFormat("de-CH", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zurich" }).format(w.startsAt);
  return {
    title: w.titleDe,
    subtitle: "",
    meta: `Aus dem Elev8-Webinar vom ${date}`,
    layout: "teams-share",
    allowGallery: false,
    browserBar: false,
    voice: "pro",
    pip: { enabled: true, name: w.speaker || "" },
    outro: { title: "Mehr über Elev8 erfahren", url: "elev8-suite.com" },
    chapters: [],
    youtube: { title: "", description: "", tags: [] }
  };
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 10) / 10 : 0);
const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Plan aus beliebiger Eingabe (Formular, Claude, Datenbank) in eine gültige Form bringen. */
export function normalizePlan(raw: unknown, w: Webinar): VideoPlan {
  const base = emptyPlan(w);
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pip = (r.pip ?? {}) as Record<string, unknown>;
  const outro = (r.outro ?? {}) as Record<string, unknown>;
  const yt = (r.youtube ?? {}) as Record<string, unknown>;
  const chapters = (Array.isArray(r.chapters) ? r.chapters : []).slice(0, 8).map((c) => {
    const ch = (c ?? {}) as Record<string, unknown>;
    const clips = (Array.isArray(ch.clips) ? ch.clips : [])
      .map((k) => {
        const clip: Clip = { start: num((k as Clip).start), end: num((k as Clip).end) };
        const lines = Array.isArray((k as Clip).lines) ? ((k as Clip).lines as NarrationLine[]) : null;
        if (lines)
          clip.lines = lines
            .map((l) => ({ start: num(l?.start), end: num(l?.end), text: String(l?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 400) }))
            .filter((l) => l.end >= l.start)
            .slice(0, 80);
        return clip;
      })
      .filter((k) => k.end > k.start)
      .slice(0, 6);
    return { title: text(ch.title, 70), key: text(ch.key, 160), clips };
  });
  return {
    title: text(r.title, 90) || base.title,
    subtitle: text(r.subtitle, 180),
    meta: text(r.meta, 90) || base.meta,
    layout: r.layout === "full" ? "full" : "teams-share",
    allowGallery: r.allowGallery === true,
    browserBar: r.browserBar === true,
    voice: r.voice === "original" ? "original" : "pro",
    pip: { enabled: pip.enabled !== false, name: text(pip.name, 40) },
    outro: { title: text(outro.title, 60) || base.outro.title, url: text(outro.url, 60) || base.outro.url },
    chapters,
    youtube: {
      title: text(yt.title, 100),
      description: String(yt.description ?? "").trim().slice(0, 4000),
      tags: (Array.isArray(yt.tags) ? yt.tags : []).map((t) => text(t, 40)).filter(Boolean).slice(0, 15)
    }
  };
}

export function plannedSeconds(plan: VideoPlan): number {
  return plan.chapters.reduce((s, c) => s + c.clips.reduce((a, k) => a + (k.end - k.start), 0), 0);
}

/** Zeitachse fürs YouTube-Inhaltsverzeichnis: nach dem Rendern exakt, vorher geschätzt. */
export function timeline(plan: VideoPlan, result: VideoResult | null): { title: string; at: number }[] {
  if (result?.chapters?.length) return result.chapters;
  let at = INTRO_SEC;
  return plan.chapters
    .filter((c) => c.clips.length)
    .map((c) => {
      const entry = { title: c.title, at: Math.floor(at) };
      at += c.clips.reduce((a, k) => a + (k.end - k.start), 0);
      return entry;
    });
}

export function youtubeDescription(plan: VideoPlan, result: VideoResult | null, portal: string): string {
  const marks = [{ title: "Einleitung", at: 0 }, ...timeline(plan, result)];
  const chapters = marks.map((m) => `${mmss(m.at)} ${m.title}`).join("\n");
  // Hashtag-Zeilen gehören ans Ende: YouTube zeigt die ersten drei über dem Titel.
  const lines = plan.youtube.description.trim().split("\n");
  const isTags = (l: string) => /^\s*(#[\p{L}\p{N}_]+\s*)+$/u.test(l);
  const body = lines.filter((l) => !isTags(l)).join("\n").trim();
  const tags = lines.filter(isTags).join(" ").trim();
  return [body, `Kapitel\n${chapters}`, `Mehr über Elev8: https://${plan.outro.url.replace(/^https?:\/\//, "")}`, portal ? `Kundenwebinare: ${portal}` : "", tags]
    .filter(Boolean)
    .join("\n\n");
}

/** YouTube-Texte aus den Webinar-Daten, solange Claude noch keine formuliert hat. */
export function youtubeFallback(w: Webinar, plan: VideoPlan): VideoPlan["youtube"] {
  const first = (t: string) => (t.match(/^[^.!?]*[.!?]/)?.[0] ?? t).trim();
  return {
    title: plan.title.slice(0, 70),
    description: [plan.subtitle || first(w.descriptionDe), plan.chapters.filter((c) => c.key).map((c) => `• ${c.key}`).join("\n")].filter(Boolean).join("\n\n"),
    tags: ["Elev8", "Ferienvermietung", "Ferienwohnung", "Gastgeber", "Property Management", "Gästekommunikation"]
  };
}

/** Zeitangabe lesen: 75, 1:15, 0:01:15, 1:15.5 */
export function parseTime(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const parts = t.split(":").map(Number);
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  const sec = parts.reduce((a, p) => a * 60 + p, 0);
  return Math.round(sec * 10) / 10;
}

/** Transkripttext eines Clips zur Kontrolle (Abschnitte, die den Clip überlappen). */
export function clipText(w: Webinar, clip: Clip): string {
  const off = w.transcriptOffsetSec;
  return w.transcript
    .filter((s) => s.start + off < clip.end && s.end + off > clip.start)
    .map((s) => s.de)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Transkript-Abschnitte eines Clips mit Zeiten im Video, auf die Clip-Grenzen beschnitten. */
export function clipSegments(w: Webinar, clip: Clip): NarrationLine[] {
  const off = w.transcriptOffsetSec;
  return w.transcript
    .map((s) => ({ start: Math.max(s.start + off, clip.start), end: Math.min(s.end + off, clip.end), text: s.de }))
    .filter((s) => s.end - s.start >= 0.3)
    .map((s) => ({ start: num(s.start), end: num(s.end), text: s.text.replace(/\s+/g, " ").trim() }));
}

/** Sprechertext, der zum Clip passt (Zeilen ausserhalb gelten nach einer Zeitänderung als veraltet). */
export function clipNarration(clip: Clip): NarrationLine[] {
  return (clip.lines ?? []).filter((l) => l.start >= clip.start - 0.5 && l.start < clip.end && l.text);
}

/** Einfache Bereinigung ohne Claude (Rückfall): Füllwörter und doppelte Wörter weg. */
export function roughClean(text: string): string {
  const word = (w: string) => new RegExp(`(?<!\\p{L})(?:${w})(?!\\p{L})[,.]?\\s*`, "giu");
  return text
    .replace(word("äh+m*|öh+m*|hm+|äm+|ehm+|mhm"), "")
    .replace(/(?<!\p{L})(\p{L}+)(?:\s+\1)+(?!\p{L})/giu, "$1")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const NARRATION_SYSTEM = `Du bereitest den Sprechertext für ein Elev8-Erklärvideo vor. Ein professioneller Sprecher liest ihn,
Zeile für Zeile genau dann, wenn der Referent sie in der Bildschirm-Demo gesagt hat. Grundlage ist das Transkript des Referenten.
Für jede Zeile gibst du die bereinigte Fassung zurück, in derselben Reihenfolge und mit genau so vielen Zeilen wie geliefert:
- Füllwörter weg (äh, ähm, also am Satzanfang, sozusagen, quasi, halt, eben, irgendwie, ja am Satzende, gell, oder? als Füllfrage).
- Versprecher, Satzabbrüche, Wiederholungen und Selbstkorrekturen glätten: nur die gemeinte, korrigierte Fassung behalten.
- Sauberes, flüssiges Hochdeutsch in Schweizer Rechtschreibung (ss statt ß), kurze klare Sätze, sicherer Ton.
- Inhalt, Reihenfolge, Fachbegriffe und Produktnamen (Elev8, Journey, Gap Night, Upsell) unverändert lassen. Nichts dazuerfinden.
- Anrede beibehalten (du oder Sie wie im Original).
- Nicht länger als das Original, eher etwas kürzer: der Text muss in dieselbe Zeit passen.
- Zeilen, die nur Füllwörter, Technik oder Organisatorisches enthalten ("Seht ihr meinen Bildschirm?", "Moment"), oder Namen von
  Teilnehmenden ansprechen, werden zu einer leeren Zeichenkette.`;

/**
 * Claude bereinigt den Sprechertext der Clips (Füllwörter, Versprecher). onlyMissing: nur Clips ohne passenden Text.
 * Liefert den Plan mit Sprechertext und die Zahl der bearbeiteten Clips.
 */
export async function cleanNarration(w: Webinar, plan: VideoPlan, onlyMissing: boolean): Promise<{ plan: VideoPlan; count: number }> {
  if (!w.transcript.length) throw new Error("Zuerst das Transkript laden (Abschnitt Aufzeichnung).");
  const todo: { ci: number; ki: number; segs: NarrationLine[] }[] = [];
  plan.chapters.forEach((c, ci) =>
    c.clips.forEach((k, ki) => {
      if (onlyMissing && clipNarration(k).length) return;
      const segs = clipSegments(w, k);
      if (segs.length) todo.push({ ci, ki, segs });
    })
  );
  const next: VideoPlan = JSON.parse(JSON.stringify(plan));
  // Zeilen ausserhalb von Von–Bis (nach geänderten Zeiten) nicht mitsprechen
  next.chapters.forEach((c) => c.clips.forEach((k) => k.lines && (k.lines = clipNarration(k))));
  if (!todo.length) return { plan: next, count: 0 };
  let cleaned: string[][] | null = null;
  if (claudeConfigured()) {
    const input = (await callClaudeTool({
      system: NARRATION_SYSTEM,
      user: todo.map((t, i) => `Clip ${i + 1}:\n${t.segs.map((s, j) => `${j + 1}. ${s.text}`).join("\n")}`).join("\n\n"),
      maxTokens: 8000,
      timeoutMs: 240_000,
      tool: {
        name: "sprechertext",
        description: "Bereinigter Sprechertext, pro Clip die Zeilen in derselben Reihenfolge und Anzahl",
        input_schema: {
          type: "object",
          required: ["clips"],
          properties: { clips: { type: "array", items: { type: "object", required: ["lines"], properties: { lines: { type: "array", items: { type: "string" } } } } } }
        }
      }
    })) as { clips?: { lines?: unknown[] }[] };
    cleaned = todo.map((_, i) => (input.clips?.[i]?.lines ?? []).map((x) => String(x ?? "")));
  }
  todo.forEach((t, i) => {
    const got = cleaned?.[i];
    const ok = got && got.length === t.segs.length;
    next.chapters[t.ci].clips[t.ki].lines = t.segs.map((s, j) => ({ ...s, text: (ok ? got[j] : roughClean(s.text)).replace(/\s+/g, " ").trim() }));
  });
  return { plan: next, count: todo.length };
}

type Row = Record<string, unknown>;
const toJob = (r: Row, w: Webinar): VideoJob => ({
  webinarId: r.webinar_id as string,
  plan: normalizePlan(r.plan, w),
  status: r.status as VideoStatus,
  progress: Number(r.progress ?? 0),
  message: (r.message as string) ?? null,
  version: Number(r.version ?? 0),
  fileKey: (r.file_key as string) ?? null,
  thumbKey: (r.thumb_key as string) ?? null,
  result: (r.result as VideoResult) ?? null,
  queuedAt: (r.queued_at as Date) ?? null,
  startedAt: (r.started_at as Date) ?? null,
  finishedAt: (r.finished_at as Date) ?? null,
  updatedAt: r.updated_at as Date
});

export async function getVideoJob(w: Webinar): Promise<VideoJob | null> {
  const [r] = await sql`SELECT * FROM webinar_videos WHERE webinar_id = ${w.id}`;
  return r ? toJob(r as Row, w) : null;
}

export async function getVideoFiles(webinarId: string): Promise<{ fileKey: string | null; thumbKey: string | null } | null> {
  const [r] = await sql`SELECT file_key, thumb_key FROM webinar_videos WHERE webinar_id = ${webinarId}`;
  return r ? { fileKey: (r.file_key as string) ?? null, thumbKey: (r.thumb_key as string) ?? null } : null;
}

export async function savePlan(webinarId: string, plan: VideoPlan, by: string): Promise<void> {
  await sql`
    INSERT INTO webinar_videos (webinar_id, plan, updated_by) VALUES (${webinarId}, ${sql.json(plan)}, ${by})
    ON CONFLICT (webinar_id) DO UPDATE SET plan = EXCLUDED.plan, updated_by = EXCLUDED.updated_by, updated_at = now()`;
}

/** Auftrag einreihen. Läuft schon einer, bleibt er unverändert (false). */
export async function queueRender(webinarId: string, by: string): Promise<boolean> {
  const rows = await sql`
    UPDATE webinar_videos SET status = 'queued', progress = 0, attempts = 0, message = 'Wartet auf den Render-Dienst …',
      queued_at = now(), started_at = NULL, finished_at = NULL, updated_by = ${by}, updated_at = now()
    WHERE webinar_id = ${webinarId} AND status NOT IN ('queued', 'rendering')
    RETURNING webinar_id`;
  return rows.length > 0;
}

/** Wartenden Auftrag zurücknehmen (ein laufender wird zu Ende gerendert). */
export async function cancelQueued(webinarId: string): Promise<boolean> {
  const rows = await sql`UPDATE webinar_videos SET status = 'draft', message = NULL, updated_at = now() WHERE webinar_id = ${webinarId} AND status = 'queued' RETURNING webinar_id`;
  return rows.length > 0;
}

/** Regeln für die YouTube-Texte (Vorschlag der Schnittliste und eigene Formulierung). */
const YT_RULES = `YouTube-Texte, gefunden werden über die Suche von Gastgebern:
- Titel höchstens 70 Zeichen. Vorne das Suchwort, nach dem Gastgeber suchen würden (z. B. "Gästekommunikation automatisieren"),
  dann der konkrete Nutzen. Kein Clickbait, keine Emojis, keine Grossbuchstaben-Wörter, "Elev8" nur wenn es passt.
- Beschreibung: Der erste Satz (höchstens 150 Zeichen) sagt, was man im Video lernt; YouTube zeigt ihn in der Suche.
  Danach ein kurzer Absatz zum Problem und zur Lösung, dann "Im Video:" mit 3 bis 5 Zeilen, die mit "• " beginnen und je
  einen Punkt aus dem Video nennen. Letzte Zeile: genau 3 Hashtags ohne Umlaute (z. B. #Ferienvermietung #Gastgeber #Elev8).
  Keine Kapitelliste, keine Links, keine Zeitangaben: die werden automatisch ergänzt. Nur was im Video gezeigt wird.
- Tags: 8 bis 12, zusammen höchstens 400 Zeichen, ohne #. Mischung aus Marke (Elev8), Thema und Suchphrasen,
  die Gastgeber eintippen (z. B. "Gäste Nachrichten automatisch", "Ferienwohnung vermieten", "Airbnb Gastgeber").`;

const SYSTEM = `Du schneidest aus der Aufzeichnung eines Elev8-Kundenwebinars ein Erklärvideo für YouTube.
Elev8 ist eine Software für Ferienvermietung (Property Management, Channel Manager, Gästekommunikation mit KI).
Zielgruppe des Videos: Gastgeber und Vermieter, die Elev8 noch nicht kennen. Das Video erklärt eine Funktion an echten
Beispielen aus der Demo, ohne Werbesprache.

Regeln für die Auswahl:
- Gesamtlänge der Clips ${TARGET.min} bis ${TARGET.max} Sekunden. 4 bis 6 Kapitel in sinnvoller Reihenfolge.
- Pro Kapitel 1 bis 2 Clips, jeder Clip 8 bis 60 Sekunden. Ein Clip beginnt am Anfang eines Satzes und endet nach einem
  abgeschlossenen Gedanken. Zeiten so wählen, wie das Transkript sie zeigt; der Render-Dienst legt die Schnitte genau auf Sprechpausen.
- Nur Demo-Teile, in denen der Referent die Software erklärt. Weglassen: Begrüssung, Organisatorisches, Technikprobleme,
  Fragen zu einzelnen Kundenkonten, Namen von Teilnehmenden, persönliche Daten, Rechtsauskünfte, Versprechen zu künftigen Funktionen.
- Kapiteltitel: höchstens 45 Zeichen, sagt, was man lernt. Kernaussage: ein Satz, höchstens 120 Zeichen, nur was im Clip gesagt wird.
- Titel des Videos höchstens 60 Zeichen, Untertitel ein Satz Nutzen.
${YT_RULES}
Deutsch in Schweizer Rechtschreibung (ss statt ß). Zeitangaben sind Sekunden ab Videostart.`;

/** Claude schlägt die Schnittliste vor. */
export async function suggestPlan(w: Webinar): Promise<VideoPlan> {
  if (!claudeConfigured()) throw new Error("ANTHROPIC_API_KEY fehlt.");
  if (!w.transcript.length) throw new Error("Zuerst das Transkript laden (Abschnitt Aufzeichnung).");
  const off = w.transcriptOffsetSec;
  const lines = w.transcript.map((s) => `[${Math.round(s.start + off)}–${Math.round(s.end + off)}] ${s.speaker}: ${s.de}`).join("\n");
  const input = (await callClaudeTool({
    system: SYSTEM,
    user: `Webinar: ${w.titleDe}\nReferent: ${w.speaker || "unbekannt"}\n\nTranskript (Format: [Start–Ende in Sekunden] Sprecher: Text):\n${lines}`,
    maxTokens: 6000,
    timeoutMs: 240_000,
    tool: {
      name: "schnittliste",
      description: "Schnittliste für das Erklärvideo",
      input_schema: {
        type: "object",
        required: ["title", "subtitle", "chapters", "youtube"],
        properties: {
          title: { type: "string" },
          subtitle: { type: "string" },
          chapters: {
            type: "array",
            items: {
              type: "object",
              required: ["title", "key", "clips"],
              properties: {
                title: { type: "string" },
                key: { type: "string" },
                clips: { type: "array", items: { type: "object", required: ["start", "end"], properties: { start: { type: "number" }, end: { type: "number" } } } }
              }
            }
          },
          youtube: {
            type: "object",
            required: ["title", "description", "tags"],
            properties: { title: { type: "string" }, description: { type: "string" }, tags: { type: "array", items: { type: "string" } } }
          }
        }
      }
    }
  })) as Record<string, unknown>;
  const plan = normalizePlan({ ...emptyPlan(w), ...input }, w);
  if (!plan.chapters.some((c) => c.clips.length)) throw new Error("Claude hat keine brauchbaren Clips vorgeschlagen. Bitte nochmals versuchen.");
  if (!plan.youtube.title || !plan.youtube.description) plan.youtube = { ...youtubeFallback(w, plan), ...(plan.youtube.tags.length ? { tags: plan.youtube.tags } : {}) };
  return plan;
}

const YT_SYSTEM = `Du schreibst die YouTube-Texte für ein Elev8-Erklärvideo. Elev8 ist eine Software für Ferienvermietung
(Property Management, Channel Manager, Gästekommunikation mit KI). Zielgruppe: Gastgeber und Vermieter, die Elev8 noch nicht kennen.
Grundlage ist nur der fertige Schnitt: Kapitel, Kernaussagen und was in den Clips gesagt wird. Nichts versprechen, was dort nicht vorkommt.
${YT_RULES}
Deutsch in Schweizer Rechtschreibung (ss statt ß).`;

/** Claude formuliert Titel, Beschreibung und Tags passend zur gespeicherten Schnittliste. */
export async function suggestYoutube(w: Webinar, plan: VideoPlan): Promise<VideoPlan["youtube"]> {
  if (!claudeConfigured()) throw new Error("ANTHROPIC_API_KEY fehlt.");
  const chapters = plan.chapters.filter((c) => c.clips.length);
  if (!chapters.length) throw new Error("Zuerst eine Schnittliste mit Clips speichern.");
  const cut = chapters
    .map((c, i) => {
      const said = c.clips.map((k) => clipText(w, k)).join(" ").slice(0, 1800);
      return `Kapitel ${i + 1}: ${c.title}${c.key ? `\nKernaussage: ${c.key}` : ""}\nGesagt: ${said || "(kein Transkript)"}`;
    })
    .join("\n\n");
  const input = (await callClaudeTool({
    system: YT_SYSTEM,
    user: `Videotitel: ${plan.title}\nUntertitel: ${plan.subtitle || "-"}\nAus dem Webinar: ${w.titleDe}\nVideolänge etwa ${mmss(plannedSeconds(plan) + INTRO_SEC + OUTRO_SEC)} Minuten\n\n${cut}`,
    maxTokens: 1500,
    timeoutMs: 120_000,
    tool: {
      name: "youtube_texte",
      description: "Titel, Beschreibung und Tags für YouTube",
      input_schema: {
        type: "object",
        required: ["title", "description", "tags"],
        properties: { title: { type: "string" }, description: { type: "string" }, tags: { type: "array", items: { type: "string" } } }
      }
    }
  })) as Record<string, unknown>;
  const yt = normalizePlan({ ...plan, youtube: input }, w).youtube;
  if (!yt.title || !yt.description) throw new Error("Claude hat keine brauchbaren YouTube-Texte geliefert. Bitte nochmals versuchen.");
  return yt;
}

/** Nur die YouTube-Texte speichern. Ändert updated_at nicht: das Video muss dafür nicht neu gerendert werden. */
export async function saveYoutube(webinarId: string, youtube: VideoPlan["youtube"], by: string): Promise<void> {
  await sql`UPDATE webinar_videos SET plan = jsonb_set(plan, '{youtube}', ${sql.json(youtube)}), updated_by = ${by} WHERE webinar_id = ${webinarId}`;
}

export { mmss };
