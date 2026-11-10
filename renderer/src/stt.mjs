import { readFile } from "node:fs/promises";

/**
 * Wortgenaues Transkript mit ElevenLabs Scribe für die synchrone Profistimme.
 * Jeder Clip wird zweimal transkribiert: wörtlich und ohne Füllwörter und Fehlstarts (no_verbatim). Wörter, die nur in
 * der wörtlichen Fassung vorkommen, werden zum Streichen markiert, dazu Geräusche und klassische Füllwörter.
 */
const API = (process.env.ELEVENLABS_API_BASE || "https://api.elevenlabs.io/v1").replace(/\/+$/, "");
const MODEL = process.env.ELEVENLABS_STT_MODEL || "scribe_v2";
const FILLER = /^(ä+h+m*|äm+|ö+h+m*|e+h+m+|h+m+|mhm|uh+m*|um+)$/i;

async function transcribe(file, { verbatim }) {
  const form = new FormData();
  form.append("model_id", MODEL);
  form.append("file", new Blob([await readFile(file)], { type: "audio/flac" }), "clip.flac");
  form.append("language_code", "de");
  form.append("timestamps_granularity", "word");
  form.append("tag_audio_events", "true");
  form.append("diarize", "false");
  if (!verbatim) form.append("no_verbatim", "true");
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}/speech-to-text`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" },
      body: form,
      signal: AbortSignal.timeout(180_000)
    });
    if (res.ok) {
      const data = await res.json();
      return (data.words ?? [])
        .filter((w) => (w.type === "word" || w.type === "audio_event") && String(w.text ?? "").trim() && Number.isFinite(w.start))
        .map((w) => ({ s: Number(w.start), e: Number(w.end ?? w.start), t: String(w.text).trim(), k: w.type === "audio_event" ? "a" : "w" }));
    }
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, attempt * 5000));
      continue;
    }
    if (res.status === 401) throw new Error("ElevenLabs lehnt den API-Schlüssel ab. Bitte ELEVENLABS_API_KEY im Render-Dienst prüfen.");
    throw new Error(`ElevenLabs Transkription fehlgeschlagen (${res.status}): ${detail}`);
  }
}

const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Wörtliche Fassung mit der bereinigten abgleichen (längste gemeinsame Folge). Eine Lücke, in der die bereinigte Fassung
 * nichts hat, ist gestrichen; hat sie dort andere Wörter, ist es eine Umschreibung (z. B. "2" statt "zwei") und bleibt.
 */
export function markCuts(full, clean) {
  const a = full.map((w) => (w.k === "a" ? "" : norm(w.t)));
  const b = (clean ?? []).filter((w) => w.k !== "a").map((w) => norm(w.t));
  const words = full.map((w) => ({ ...w }));
  if (b.length) {
    const n = a.length;
    const m = b.length;
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] && a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    let i = 0;
    let j = 0;
    let gap = [];
    let other = 0;
    const close = () => {
      if (!other) for (const x of gap) words[x].cut = true;
      gap = [];
      other = 0;
    };
    while (i < n && j < m) {
      if (a[i] && a[i] === b[j]) {
        close();
        i++;
        j++;
      } else if (L[i + 1][j] >= L[i][j + 1]) gap.push(i++);
      else {
        other++;
        j++;
      }
    }
    while (i < n) gap.push(i++);
    other += m - j;
    close();
  }
  for (const w of words) if (w.k === "a" || FILLER.test(norm(w.t))) w.cut = true;
  for (const w of words) if (!w.cut) delete w.cut;
  return words;
}

/** Ein Clip: wörtlich und bereinigt transkribieren (parallel), Zeiten ab offset, markiert. */
export async function clipWords(file, offset) {
  const [full, clean] = await Promise.all([
    transcribe(file, { verbatim: true }),
    transcribe(file, { verbatim: false }).catch((err) => {
      console.log("Bereinigte Fassung nicht verfügbar, nur Füllwortliste:", err.message);
      return null;
    })
  ]);
  const shift = (w) => ({ ...w, s: Math.round((w.s + offset) * 100) / 100, e: Math.round((w.e + offset) * 100) / 100 });
  return markCuts(full.map(shift), clean?.map(shift) ?? null);
}
