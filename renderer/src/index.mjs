import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { H, PIP, W, chapterPng, clean, introPng, keyPng, outroPng, pipPng, pipX, pipY, thumbPng } from "./overlays.mjs";
import { deleteObject, getObject, putObject, storageConfigured } from "./s3.mjs";
import { clipWords } from "./stt.mjs";
import { convert, speak, voiceConfigured } from "./voice.mjs";
import { accessToken, addToPlaylist, insertCaption, setThumbnail, uploadVideo } from "./youtube.mjs";

/**
 * Render-Dienst für Erklärvideos aus Webinar-Aufzeichnungen.
 * Holt Aufträge aus webinar_videos (status 'queued'), schneidet die Clips aus dem Bunny-Video,
 * legt die Elev8-Einblendungen darüber und lädt MP4 und YouTube-Vorschaubild in den Bucket.
 *
 * Variablen: DATABASE_URL, BUNNY_CDN_HOST, S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
 * für die Profistimme ELEVENLABS_API_KEY und ELEVENLABS_VIDEO_VOICE_ID.
 * Aufträge "prepare"/"prepare-all": Clips wortgenau transkribieren und Füllwörter markieren (für die synchrone Profistimme).
 * Auftrag "youtube": fertiges Video auf YouTube hochladen (YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, AUTH_SECRET wie in Orbit).
 * Zum Testen: SOURCE_OVERRIDE (lokale Datei statt Bunny), NO_UPLOAD=1 (Ergebnis bleibt in OUT_DIR).
 */

const sql = postgres(process.env.DATABASE_URL ?? "", { max: 2, idle_timeout: 30, connect_timeout: 15, onnotice: () => {} });
const POLL_MS = Number(process.env.POLL_MS || 10_000);
const INTRO_SEC = 5;
const OUTRO_SEC = 6;
const CHAPTER_SHOW = [0.4, 5.2]; // Kapiteltitel: von–bis ab Kapitelbeginn
const KEY_SEC = 7; // Kernaussage: die letzten Sekunden des Kapitels
const FPS = 30;
const MAX_TEMPO = 1.15; // Profistimme höchstens so viel schneller, wenn eine Zeile knapp wird
const GAP = 0.15; // Mindestpause zwischen zwei gesprochenen Zeilen

/**
 * Bildausschnitte der Teams-Aufnahme (1920×1080) bei geteiltem Bildschirm.
 * screen: ganzer geteilter Browser, app: ohne Tab- und Adressleiste (92 px, Chrome ohne Lesezeichenleiste).
 */
const LAYOUTS = {
  "teams-share": { screen: { x: 0, y: 69, w: 1674, h: 942 }, app: { x: 0, y: 162, w: 1674, h: 849 }, cam: { x: 1731, y: 396, w: 128, h: 128 } },
  full: { screen: { x: 0, y: 0, w: 1920, h: 1080 }, cam: null }
};

const log = (...a) => console.log(new Date().toISOString(), ...a);

function run(cmd, args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => {
      err += d;
      if (err.length > 200_000) err = err.slice(-100_000);
    });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 || capture ? resolve({ code, out, err }) : reject(new Error(`${cmd} ${code}: ${err.slice(-1500)}`))));
  });
}

/** Höchste Auflösung aus der Bunny-Playlist; sonst die MP4-Fassung. */
async function sourceFor(videoId) {
  if (process.env.SOURCE_OVERRIDE) return process.env.SOURCE_OVERRIDE;
  const host = String(process.env.BUNNY_CDN_HOST || "").trim().replace(/^["']|["']$/g, "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!host) throw new Error("BUNNY_CDN_HOST fehlt im Render-Dienst.");
  const master = `https://${host}/${videoId}/playlist.m3u8`;
  try {
    const res = await fetch(master, { signal: AbortSignal.timeout(20_000) });
    if (res.ok) {
      const text = await res.text();
      const lines = text.split(/\r?\n/);
      let best = null;
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^#EXT-X-STREAM-INF:.*BANDWIDTH=(\d+)/);
        if (m && lines[i + 1] && !lines[i + 1].startsWith("#")) {
          const bw = Number(m[1]);
          if (!best || bw > best.bw) best = { bw, url: new URL(lines[i + 1].trim(), master).toString() };
        }
      }
      if (best) return best.url;
    }
  } catch (err) {
    log("Playlist nicht lesbar, nehme MP4:", err.message);
  }
  return `https://${host}/${videoId}/play_720p.mp4`;
}

/** Schnittpunkt auf die nächste Sprechpause legen (±1.2 s), damit kein Wort abgeschnitten wird. */
async function snap(src, t, kind) {
  const from = Math.max(0, t - 1.2);
  const { err } = await run(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-ss", String(from), "-t", "2.4", "-i", src, "-vn", "-af", "silencedetect=n=-32dB:d=0.22", "-f", "null", "-"],
    { capture: true }
  );
  const starts = [...err.matchAll(/silence_start: ([\d.]+)/g)].map((m) => from + Number(m[1]));
  const ends = [...err.matchAll(/silence_end: ([\d.]+)/g)].map((m) => from + Number(m[1]));
  const gaps = starts.map((s, i) => ({ s, e: ends[i] ?? from + 2.4 }));
  if (!gaps.length) return t;
  const best = gaps.reduce((a, g) => (Math.abs((g.s + g.e) / 2 - t) < Math.abs((a.s + a.e) / 2 - t) ? g : a));
  // Anfang: kurz bevor wieder gesprochen wird. Ende: kurz nachdem die Rede aufhört.
  return kind === "start" ? Math.max(best.s, best.e - 0.3) : Math.min(best.e, best.s + 0.3);
}

const mmss = (sec) => {
  const t = Math.max(0, Math.floor(sec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const r = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
};

/**
 * Läuft in diesem Clip die Bildschirmfreigabe? Bei Teams liegt dann oben links die helle Browserleiste der App
 * (fast 100 % helle Pixel), in der Galerie ist der Streifen grösstenteils schwarz (gemessen: 38 %).
 * Prüft alle 3 Sekunden ein Bild. Liefert die Stellen ohne Freigabe.
 */
async function galleryAt(src, start, dur) {
  const fw = 163;
  const fh = 3;
  const out = await new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", start.toFixed(3), "-t", dur.toFixed(3), "-i", src, "-an",
      "-vf", `fps=1/3,crop=1630:30:20:75,scale=${fw}:${fh},format=gray`, "-f", "rawvideo", "-"]);
    const chunks = [];
    let err = "";
    p.stdout.on("data", (d) => chunks.push(d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`Layout-Prüfung: ${err.slice(-500)}`))));
  });
  const size = fw * fh;
  const bad = [];
  for (let i = 0; i + size <= out.length; i += size) {
    let bright = 0;
    for (let j = i; j < i + size; j++) if (out[j] > 180) bright++;
    if (bright / size < 0.9) bad.push(start + (i / size) * 3);
  }
  return bad;
}

const enc = ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS), "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"];

async function stillPart(pngFile, sec, out) {
  await run("ffmpeg", [
    "-hide_banner", "-y", "-loop", "1", "-t", String(sec), "-i", pngFile,
    "-f", "lavfi", "-t", String(sec), "-i", "anullsrc=r=48000:cl=stereo",
    "-vf", `fps=${FPS},format=yuv420p,fade=in:st=0:d=0.5,fade=out:st=${sec - 0.5}:d=0.5`,
    "-shortest", ...enc, out
  ]);
}

/** Ein Clip: Bildschirm-Ausschnitt, Sprecher im Kreis, Kapitel- und Kernaussage-Einblendung, weiche Übergänge. */
async function clipPart({ src, start, dur: srcDur, stretch = 1, layout, bar, pip, voice, chapterFile, chapterAt, keyFile, keyAt, out }) {
  const L = LAYOUTS[layout] ?? LAYOUTS["teams-share"];
  // dur: Länge im fertigen Video. Mit stretch > 1 läuft das Bild etwas langsamer, damit der Sprechertext Platz hat.
  const dur = srcDur * stretch;
  const slow = stretch > 1.001 ? `setpts=${stretch.toFixed(4)}*PTS,` : "";
  const inputs = ["-ss", start.toFixed(3), "-t", srcDur.toFixed(3), "-i", src];
  const f = [];
  // Ohne Browserleiste ist der Ausschnitt breiter als 16:9: auf volle Breite skalieren, oben und unten schwarzer Rand.
  const s = !bar && L.app ? L.app : L.screen;
  const fit = s.w / s.h > W / H + 0.01 ? `scale=${W}:-2:flags=lanczos,pad=${W}:${H}:0:(oh-ih)/2:black` : `scale=${W}:${H}:flags=lanczos`;
  f.push(`[0:v]crop=${s.w}:${s.h}:${s.x}:${s.y},${slow}${fit},setsar=1,fps=${FPS}[base]`);
  let cur = "base";
  let n = 1;
  if (pip && L.cam) {
    const c = L.cam;
    const S = PIP.size;
    f.push(
      `[0:v]crop=${c.w}:${c.h}:${c.x}:${c.y},scale=${S}:${S}:flags=lanczos,fps=${FPS},format=yuva420p,` +
        `geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='if(lte(hypot(X-${S / 2},Y-${S / 2}),${S / 2 - 0.5}),255,0)'[cam]`
    );
    f.push(`[${cur}][cam]overlay=${pipX}:${pipY}[c1]`);
    inputs.push("-loop", "1", "-t", dur.toFixed(3), "-i", pip);
    f.push(`[c1][${n}:v]overlay=0:0[c2]`);
    cur = "c2";
    n++;
  }
  const timed = (file, from, to, label) => {
    if (!file || to <= from) return;
    inputs.push("-loop", "1", "-t", dur.toFixed(3), "-i", file);
    f.push(`[${n}:v]format=rgba,fade=in:st=${from}:d=0.35:alpha=1,fade=out:st=${Math.max(from, to - 0.35)}:d=0.35:alpha=1[${label}o]`);
    f.push(`[${cur}][${label}o]overlay=0:0:enable='between(t,${from},${to})'[${label}]`);
    cur = label;
    n++;
  };
  if (chapterFile) timed(chapterFile, chapterAt[0], Math.min(chapterAt[1], dur - 0.3), "ch");
  if (keyFile) timed(keyFile, keyAt[0], keyAt[1], "ky");
  // Ton: Originalaufnahme oder die umgewandelte Profistimme (auf Clip-Länge aufgefüllt bzw. gekürzt)
  let audio = "[0:a]aresample=48000";
  if (voice) {
    inputs.push("-i", voice);
    audio = `[${n}:a]aresample=48000,apad,atrim=0:${dur.toFixed(3)}`;
    n++;
  }
  f.push(`[${cur}]format=yuv420p,fade=in:st=0:d=0.25,fade=out:st=${Math.max(0, dur - 0.25).toFixed(3)}:d=0.25[v]`);
  f.push(`${audio},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,aformat=channel_layouts=stereo,afade=in:st=0:d=0.15,afade=out:st=${Math.max(0, dur - 0.2).toFixed(3)}:d=0.2[a]`);
  await run("ffmpeg", ["-hide_banner", "-y", ...inputs, "-filter_complex", f.join(";"), "-map", "[v]", "-map", "[a]", "-t", dur.toFixed(3), ...enc, out]);
}

const probe = async (file) => Number((await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file])).out.trim());

/**
 * Sprechertext eines Clips mit der Profistimme: jede Zeile startet dort, wo sie im Original gesagt wurde (oder direkt
 * nach der vorherigen). Ist eine Zeile länger als ihr Platz, spricht die Stimme bis 15 % schneller; reicht das nicht,
 * läuft das Bild am Ende etwas langsamer (stretch). Langes Schweigen am Clip-Ende wird gekürzt.
 */
async function narrate({ dir, i, lines, start, dur }) {
  const rows = (lines ?? [])
    .map((l) => ({ t: Math.max(0, Number(l.start) - start), text: String(l.text ?? "").trim(), en: String(l.en ?? "").trim() }))
    .filter((l) => l.text && l.t < dur - 0.3)
    .sort((a, b) => a.t - b.t);
  if (!rows.length) throw new Error(`Clip ${i + 1} hat keinen Sprechertext. Bitte in Orbit „Sprechertext bereinigen“ wählen oder den Text eintragen.`);
  const parts = [];
  let end = 0;
  for (const [k, r] of rows.entries()) {
    const file = join(dir, `n_${i}_${k}.mp3`);
    await speak(r.text, file, { previous: rows[k - 1]?.text, next: rows[k + 1]?.text });
    const len = await probe(file);
    const at = Math.max(r.t, k ? end + GAP : r.t);
    const room = (rows[k + 1]?.t ?? dur) - at;
    const tempo = room > 0 && len > room ? Math.min(MAX_TEMPO, len / room) : 1;
    parts.push({ file, at, tempo, end: at + len / tempo, de: r.text, en: r.en });
    end = at + len / tempo;
  }
  const outDur = end + 0.4 > dur ? end + 0.4 : dur - end > 3 ? end + 1.5 : dur;
  const stretch = Math.max(1, outDur / dur);
  const srcDur = outDur / stretch;
  const f = parts.map((p, k) => `[${k}:a]aresample=44100,${p.tempo > 1.001 ? `atempo=${p.tempo.toFixed(4)},` : ""}adelay=${Math.round(p.at * 1000)}:all=1[a${k}]`);
  f.push(`${parts.map((_, k) => `[a${k}]`).join("")}amix=inputs=${parts.length}:normalize=0:dropout_transition=0,apad,atrim=0:${outDur.toFixed(3)}[a]`);
  const audio = join(dir, `n_${i}.wav`);
  await run("ffmpeg", ["-hide_banner", "-y", ...parts.flatMap((p) => ["-i", p.file]), "-filter_complex", f.join(";"), "-map", "[a]", "-ac", "1", "-ar", "44100", audio]);
  if (stretch > 1.25) log(`Clip ${i + 1}: Sprechertext deutlich länger als das Original, Bild um ${Math.round((stretch - 1) * 100)} % verlangsamt`);
  const cues = parts.map((p) => ({ start: p.at, end: p.end, de: p.de, en: p.en }));
  return { audio, srcDur, stretch, cues, sped: parts.filter((p) => p.tempo > 1.001).length };
}

/** Gleiche Regeln wie in Orbit (src/lib/webinare/words.ts) */
const wordsValid = (k) =>
  Boolean(k.words?.length && Array.isArray(k.wordsFor) && Math.abs(k.wordsFor[0] - k.start) < 0.05 && Math.abs(k.wordsFor[1] - k.end) < 0.05);
function linesFromWords(words) {
  // gap: ob die Pause davor echt ist (lagen nur gestrichene Wörter dazwischen, ist sie im Video herausgeschnitten)
  const kept = words
    .map((w, i) => ({ w, cutBefore: i > 0 && Boolean(words[i - 1].cut) }))
    .filter(({ w }) => !w.cut && w.k !== "a" && String(w.t).trim())
    .map(({ w, cutBefore }) => ({ ...w, cutBefore }));
  const ends = (t) => /[.!?…]["»“]?$/.test(t);
  const lines = [];
  let cur = [];
  const flush = () => {
    if (cur.length) lines.push(cur);
    cur = [];
  };
  kept.forEach((w, i) => {
    const prev = kept[i - 1];
    if (prev && cur.length && ((!w.cutBefore && w.s - prev.e > 0.8) || (ends(prev.t) && cur.length >= 3))) flush();
    cur.push(w);
    if (cur.length >= 14) {
      const comma = cur.findLastIndex((x, j) => j >= 5 && /,$/.test(x.t));
      if (comma >= 0 && comma < cur.length - 1) {
        const rest = cur.slice(comma + 1);
        cur = cur.slice(0, comma + 1);
        flush();
        cur = rest;
      } else flush();
    }
  });
  flush();
  return lines.map((ws) => {
    const t = ws.map((w) => w.t.trim()).join(" ").replace(/\s+([,.!?;:])/g, "$1");
    return { start: ws[0].s, end: ws[ws.length - 1].e, text: t.charAt(0).toUpperCase() + t.slice(1) };
  });
}

/**
 * Synchron: zu behaltende Abschnitte zwischen s und e. Jedes gestrichene Wort fällt heraus, dazu die Hälfte der Pausen
 * davor und danach (mindestens 0.12 s bleiben stehen, damit es nicht gehetzt klingt).
 */
export function keepSegments(words, s, e) {
  const inside = words.filter((w) => w.e > s && w.s < e);
  const cuts = [];
  inside.forEach((w, i) => {
    if (!w.cut) return;
    let prev = s;
    for (let j = i - 1; j >= 0; j--) if (!inside[j].cut) { prev = inside[j].e; break; }
    let next = e;
    for (let j = i + 1; j < inside.length; j++) if (!inside[j].cut) { next = inside[j].s; break; }
    const hi = Math.max(prev, w.s - 0.02);
    const lo = Math.min(next, w.e + 0.02);
    const a = Math.min(hi, Math.max(prev === s ? s : prev + 0.12, (prev + w.s) / 2));
    const b = Math.max(lo, Math.min(next === e ? e : next - 0.12, (w.e + next) / 2));
    cuts.push([Math.max(s, a), Math.min(e, b)]);
  });
  cuts.sort((x, y) => x[0] - y[0]);
  const keep = [];
  let pos = s;
  for (const [a, b] of cuts) {
    if (a - pos >= 0.12) keep.push([pos, a]);
    pos = Math.max(pos, b);
  }
  if (e - pos >= 0.12) keep.push([pos, e]);
  return keep;
}

/** Synchron: Bild und Ton eines Clips ohne die gestrichenen Stellen; map rechnet eine Originalzeit in Clip-Zeit um. */
async function cutClip({ dir, i, src, s, e, words }) {
  const keep = keepSegments(words, s, e);
  if (!keep.length) throw new Error(`Clip ${i + 1}: Es ist alles gestrichen.`);
  const expr = keep.map(([a, b]) => `between(t,${(a - s).toFixed(3)},${(b - s).toFixed(3)})`).join("+");
  const video = join(dir, `cut_${i}.mp4`);
  const audio = join(dir, `cut_${i}.wav`);
  await run("ffmpeg", [
    "-hide_banner", "-y", "-ss", s.toFixed(3), "-t", (e - s).toFixed(3), "-i", src,
    "-filter_complex", `[0:v]fps=${FPS},select='${expr}',setpts=N/(${FPS}*TB)[v];[0:a]aresample=48000,aselect='${expr}',asetpts=N/SR/TB[a]`,
    "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "14", "-pix_fmt", "yuv420p", video,
    "-map", "[a]", "-vn", "-ac", "1", "-ar", "48000", audio
  ]);
  let o = 0;
  const segs = keep.map(([a, b]) => {
    const g = { a, b, o };
    o += b - a;
    return g;
  });
  const map = (t) => {
    for (const g of segs) {
      if (t < g.a) return g.o;
      if (t <= g.b) return g.o + t - g.a;
    }
    return o;
  };
  return { video, audio, dur: o, map, saved: e - s - o };
}

/** Untertitel als SRT (Zeiten in Sekunden im fertigen Video). */
const srtTime = (sec) => {
  const ms = Math.max(0, Math.round(sec * 1000));
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3_600_000))}:${p(Math.floor(ms / 60_000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
export const toSrt = (cues, lang) =>
  cues
    .filter((c) => c[lang])
    .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c[lang]}\n`)
    .join("\n");

async function progress(id, pct, message) {
  await sql`UPDATE webinar_videos SET progress = ${Math.round(pct)}, message = ${message}, updated_at = now() WHERE webinar_id = ${id}`;
}

export async function render(job) {
  const id = job.webinar_id;
  const plan = job.plan ?? {};
  const [w] = await sql`SELECT bunny_video_de, title_de FROM webinar_webinars WHERE id = ${id}`;
  if (!w?.bunny_video_de) throw new Error("Für dieses Webinar ist kein Bunny-Video eingetragen.");
  const chapters = (plan.chapters ?? []).filter((c) => (c.clips ?? []).some((k) => Number(k.end) > Number(k.start)));
  if (!chapters.length) throw new Error("Die Schnittliste ist leer.");
  const dir = await mkdtemp(join(process.env.OUT_DIR || tmpdir(), "video-"));
  try {
    const src = await sourceFor(w.bunny_video_de);
    log("Quelle", src);
    const title = clean(plan.title || w.title_de);
    const p = { ...plan, title };
    const clips = chapters.flatMap((c, ci) => c.clips.filter((k) => Number(k.end) > Number(k.start)).map((k, ki, arr) => ({ ci, ki, last: ki === arr.length - 1, start: Number(k.start), end: Number(k.end), lines: k.lines ?? [], words: k.words, wordsFor: k.wordsFor })));
    // Vor dem Rendern: zeigt jeder Clip die Bildschirmfreigabe? Sonst wären Teilnehmende im Bild.
    const layout = plan.layout ?? "teams-share";
    if (layout === "teams-share") {
      await progress(id, 1, "Prüft die Bildausschnitte …");
      const problems = [];
      for (const [i, k] of clips.entries()) {
        const bad = await galleryAt(src, k.start, k.end - k.start);
        k.gallery = bad.length > 0;
        if (bad.length) problems.push(`Clip ${i + 1} (${mmss(k.start)}–${mmss(k.end)}) zeigt ab ${mmss(bad[0])} keine Bildschirmfreigabe, sondern die Teams-Ansicht mit Teilnehmenden`);
      }
      if (problems.length && !plan.allowGallery) {
        throw new Error(`${problems.join(". ")}. Bitte die Zeiten anpassen oder in Orbit „Ansicht mit Teilnehmenden zulassen“ wählen.`);
      }
    }
    const steps = clips.length + 4;
    let done = 0;
    const tick = (msg) => progress(id, (++done / steps) * 100, msg);

    await writeFile(join(dir, "intro.png"), await introPng(p));
    await writeFile(join(dir, "outro.png"), await outroPng(p));
    // Profistimme (Standard): Kamerabild und Name des Referenten passen dann nicht und entfallen.
    const proVoice = plan.voice !== "original";
    // Synchron (Standard der Profistimme): Originalspur ohne Füllwörter, in die Profistimme umgewandelt
    const sync = proVoice && plan.voice !== "script";
    if (sync) {
      const open = clips.map((k, i) => (wordsValid(k) ? null : i + 1)).filter(Boolean);
      if (open.length) throw new Error(`Clip ${open.join(", ")} ist noch nicht bereinigt. Bitte in Orbit „Ton bereinigen“ wählen.`);
    }
    if (proVoice && !voiceConfigured()) throw new Error("Die Profistimme ist im Render-Dienst nicht eingerichtet (ELEVENLABS_API_KEY, ELEVENLABS_VIDEO_VOICE_ID). Bitte melden oder in Orbit „Originalstimme“ wählen.");
    const pipOn = !proVoice && plan.pip?.enabled !== false && (plan.layout ?? "teams-share") === "teams-share";
    if (pipOn) await writeFile(join(dir, "pip.png"), await pipPng({ name: clean(plan.pip?.name || "") }));
    for (const [ci, c] of chapters.entries()) {
      await writeFile(join(dir, `ch${ci}.png`), await chapterPng({ label: `${ci + 1} von ${chapters.length}`, title: clean(c.title) }));
      if (clean(c.key)) await writeFile(join(dir, `key${ci}.png`), await keyPng({ text: clean(c.key) }));
    }

    const parts = [join(dir, "p_intro.mp4")];
    await stillPart(join(dir, "intro.png"), INTRO_SEC, parts[0]);
    await tick("Eröffnung fertig");

    // Schnittpunkte auf Pausen legen, Kapitel-Zeitachse fürs YouTube-Inhaltsverzeichnis mitschreiben
    let at = INTRO_SEC;
    const timeline = [];
    const captions = [];
    for (const [i, k] of clips.entries()) {
      const s = await snap(src, k.start, "start");
      const e = await snap(src, k.end, "end");
      let dur = Math.max(1, e - s);
      if (k.ki === 0) timeline.push({ title: clean(chapters[k.ci].title), at: Math.floor(at) });
      const out = join(dir, `p_${String(i).padStart(2, "0")}.mp4`);
      let voice = null;
      let srcDur = dur;
      let stretch = 1;
      let cues = [];
      let clipSrc = src;
      let clipStart = s;
      if (sync) {
        await progress(id, (done / steps) * 100, `Schneidet und spricht Clip ${i + 1} von ${clips.length} …`);
        const c = await cutClip({ dir, i, src, s, e, words: k.words });
        voice = join(dir, `v_${i}.mp3`);
        await convert(c.audio, voice);
        clipSrc = c.video;
        clipStart = 0;
        dur = c.dur;
        srcDur = c.dur;
        const own = (k.lines ?? []).filter((l) => l.start >= k.start - 0.5 && l.start < k.end && String(l.text ?? "").trim());
        cues = (own.length ? own : linesFromWords(k.words))
          .map((l) => ({ start: c.map(l.start), end: c.map(l.end), de: String(l.text).trim(), en: String(l.en ?? "").trim() }))
          .filter((x) => x.end - x.start > 0.2);
        log(`Clip ${i + 1}: synchron, ${c.saved.toFixed(1)} s gestrichen`);
      } else if (proVoice) {
        await progress(id, (done / steps) * 100, `Profistimme für Clip ${i + 1} von ${clips.length} …`);
        const n = await narrate({ dir, i, lines: k.lines, start: s, dur });
        voice = n.audio;
        srcDur = n.srcDur;
        stretch = n.stretch;
        dur = srcDur * stretch;
        cues = n.cues;
        log(`Clip ${i + 1}: Sprechertext ${n.sped ? `(${n.sped} Zeilen leicht schneller)` : ""}${stretch > 1 ? ` Bild ×${stretch.toFixed(2)}` : ""}`);
      }
      if (!proVoice) {
        // Originalstimme: Untertitel an den Zeiten des Transkripts
        cues = (k.lines ?? [])
          .map((l) => ({ start: Number(l.start) - s, end: Number(l.end) - s, de: String(l.text ?? "").trim(), en: String(l.en ?? "").trim() }))
          .filter((c) => c.de && c.end > 0 && c.start < dur)
          .map((c) => ({ ...c, start: Math.max(0, c.start), end: Math.min(dur, c.end) }));
      }
      for (const c of cues) captions.push({ start: +(at + c.start).toFixed(2), end: +(at + c.end).toFixed(2), de: c.de, en: c.en });
      // Kapiteldauer: Summe aller Clips des Kapitels (für die Kernaussage am Schluss)
      const chapterClips = clips.filter((x) => x.ci === k.ci);
      const isLong = chapterClips.reduce((sum, x) => sum + (x.end - x.start), 0) >= CHAPTER_SHOW[1] + KEY_SEC + 1;
      const keyFile = k.last && isLong && clean(chapters[k.ci].key) ? join(dir, `key${k.ci}.png`) : null;
      const keyAt = [Math.max(k.ki === 0 ? CHAPTER_SHOW[1] + 0.5 : 0.4, dur - KEY_SEC - 0.4), dur - 0.4];
      await clipPart({
        src: clipSrc,
        start: clipStart,
        dur: srcDur,
        stretch,
        layout: k.gallery ? "full" : layout,
        bar: plan.browserBar === true,
        pip: pipOn && !k.gallery ? join(dir, "pip.png") : null,
        voice,
        chapterFile: k.ki === 0 ? join(dir, `ch${k.ci}.png`) : null,
        chapterAt: CHAPTER_SHOW,
        keyFile,
        keyAt,
        out
      });
      parts.push(out);
      at += dur;
      await tick(`Clip ${i + 1} von ${clips.length} fertig`);
    }

    const outro = join(dir, "p_outro.mp4");
    await stillPart(join(dir, "outro.png"), OUTRO_SEC, outro);
    parts.push(outro);
    at += OUTRO_SEC;
    await tick("Abschluss fertig");

    await writeFile(join(dir, "list.txt"), parts.map((x) => `file '${x}'`).join("\n"));
    const final = join(dir, "erklaervideo.mp4");
    const joined = join(dir, "zusammen.mp4");
    await run("ffmpeg", ["-hide_banner", "-y", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-c", "copy", joined]);
    // Untertitel (Englisch, Deutsch) als zuschaltbare Spuren ins MP4; für YouTube gibt Orbit sie als SRT aus
    const subs = [["en", "eng", "English"], ["de", "deu", "Deutsch"]].filter(([l]) => captions.some((c) => c[l]));
    for (const [l] of subs) await writeFile(join(dir, `${l}.srt`), toSrt(captions, l));
    await run("ffmpeg", [
      "-hide_banner", "-y", "-i", joined, ...subs.flatMap(([l]) => ["-i", join(dir, `${l}.srt`)]),
      "-map", "0", ...subs.flatMap((_, j) => ["-map", String(j + 1)]),
      "-c", "copy", ...(subs.length ? ["-c:s", "mov_text"] : []),
      ...subs.flatMap(([, iso, name], j) => [`-metadata:s:s:${j}`, `language=${iso}`, `-metadata:s:s:${j}`, `title=${name}`]),
      "-movflags", "+faststart", final
    ]);
    const thumb = join(dir, "thumbnail.png");
    await writeFile(thumb, await thumbPng(p));
    const size = (await stat(final)).size;
    const result = { durationSec: Math.round(at), chapters: timeline, size, captions };

    if (process.env.NO_UPLOAD) {
      log("Fertig (ohne Upload):", final, result);
      await sql`UPDATE webinar_videos SET status = 'done', progress = 100, message = ${"Fertig (lokal: " + final + ")"}, result = ${sql.json(result)}, finished_at = now(), updated_at = now() WHERE webinar_id = ${id}`;
      return { final, result, dir };
    }
    if (!storageConfigured()) throw new Error("Der Datei-Speicher (S3_*) ist im Render-Dienst nicht eingerichtet.");
    await progress(id, 99, "Lädt hoch …");
    const version = Number(job.version || 0) + 1;
    const fileKey = `webinare/videos/${id}/v${version}.mp4`;
    const thumbKey = `webinare/videos/${id}/v${version}.png`;
    await putObject(fileKey, await readFile(final), "video/mp4");
    await putObject(thumbKey, await readFile(thumb), "image/png");
    const [old] = await sql`SELECT file_key, thumb_key FROM webinar_videos WHERE webinar_id = ${id}`;
    await sql`
      UPDATE webinar_videos SET status = 'done', progress = 100, message = NULL, version = ${version},
        file_key = ${fileKey}, thumb_key = ${thumbKey}, result = ${sql.json(result)}, finished_at = now(), updated_at = now()
      WHERE webinar_id = ${id}`;
    for (const k of [old?.file_key, old?.thumb_key]) if (k && k !== fileKey && k !== thumbKey) await deleteObject(k).catch(() => {});
    log("Fertig", fileKey, result);
    return { result };
  } finally {
    if (!process.env.NO_UPLOAD) await rm(dir, { recursive: true, force: true });
  }
}

/** Ton der Clips wortgenau transkribieren und Füllwörter markieren; schreibt die Wörter in die Schnittliste. */
export async function prepare(job) {
  const id = job.webinar_id;
  const plan = job.plan ?? {};
  const [w] = await sql`SELECT bunny_video_de FROM webinar_webinars WHERE id = ${id}`;
  if (!w?.bunny_video_de) throw new Error("Für dieses Webinar ist kein Bunny-Video eingetragen.");
  if (!process.env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY fehlt im Render-Dienst.");
  const all = job.task === "prepare-all";
  const todo = (plan.chapters ?? []).flatMap((c) => c.clips ?? []).filter((k) => Number(k.end) > Number(k.start) && (all || !wordsValid(k)));
  if (!todo.length) return { plan, count: 0, cut: 0 };
  const src = await sourceFor(w.bunny_video_de);
  const dir = await mkdtemp(join(process.env.OUT_DIR || tmpdir(), "ton-"));
  let cut = 0;
  try {
    for (const [i, k] of todo.entries()) {
      await progress(id, (i / todo.length) * 100, `Transkribiert Clip ${i + 1} von ${todo.length} …`);
      const from = Math.max(0, Number(k.start) - 0.3);
      const file = join(dir, `t_${i}.flac`);
      await run("ffmpeg", ["-hide_banner", "-y", "-ss", from.toFixed(3), "-t", (Number(k.end) - from + 0.3).toFixed(3), "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "flac", file]);
      const words = (await clipWords(file, from)).filter((x) => (x.s + x.e) / 2 >= Number(k.start) && (x.s + x.e) / 2 <= Number(k.end));
      k.words = words;
      k.wordsFor = [Number(k.start), Number(k.end)];
      delete k.lines;
      cut += words.filter((x) => x.cut).length;
      log(`Clip ${i + 1}: ${words.length} Wörter, ${words.filter((x) => x.cut).length} gestrichen`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  return { plan, count: todo.length, cut };
}

async function runPrepare(job) {
  const id = job.webinar_id;
  const back = sql`CASE WHEN file_key IS NOT NULL THEN 'done' ELSE 'draft' END`;
  try {
    const r = await prepare(job);
    const msg = r.count
      ? `Ton bereinigt: ${r.count} ${r.count === 1 ? "Clip" : "Clips"}, ${r.cut} Wörter gestrichen. Bitte die Streichungen unter jedem Clip prüfen.`
      : "Alle Clips waren bereits bereinigt.";
    await sql`UPDATE webinar_videos SET plan = ${sql.json(r.plan)}, status = ${back}, progress = 100, message = ${msg}, updated_at = now() WHERE webinar_id = ${id}`;
    log("Bereinigt", id, msg);
  } catch (err) {
    log("Fehler beim Bereinigen", err);
    const msg = `Bereinigen fehlgeschlagen: ${String(err?.message || err)}`.slice(0, 1500);
    await sql`UPDATE webinar_videos SET status = ${back}, progress = 0, message = ${msg}, updated_at = now() WHERE webinar_id = ${id}`.catch(() => {});
  }
}

/** Datei aus dem Bucket auf die Platte laden */
async function download(key, file) {
  const res = await getObject(key);
  if (!res?.ok) throw new Error(`Datei ${key} nicht im Speicher (${res?.status}).`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
}

/** Fertiges Video mit Vorschaubild, Untertiteln und Playlist auf YouTube. Ändert updated_at nicht (das Video gilt nicht als geändert). */
export async function runYoutube(job) {
  const id = job.webinar_id;
  const y = job.youtube ?? {};
  const step = (pct, message) => sql`UPDATE webinar_videos SET progress = ${Math.round(pct)}, message = ${message} WHERE webinar_id = ${id}`;
  const patch = (p) => sql`UPDATE webinar_videos SET youtube = COALESCE(youtube, '{}'::jsonb) || ${sql.json(p)} WHERE webinar_id = ${id}`;
  const dir = await mkdtemp(join(process.env.OUT_DIR || tmpdir(), "youtube-"));
  try {
    if (!job.file_key) throw new Error("Es gibt noch kein fertiges Video.");
    await patch({ state: "uploading", message: null });
    await step(1, "Meldet sich bei YouTube an …");
    const token = await accessToken(sql);
    await step(2, "Holt das Video aus dem Speicher …");
    const file = join(dir, "video.mp4");
    await download(job.file_key, file);
    const size = (await stat(file)).size;
    let last = 0;
    const video = await uploadVideo(token, file, size, y, async (f) => {
      if (f - last < 0.05 && f < 1) return;
      last = f;
      await step(3 + f * 85, `Lädt auf YouTube hoch … ${Math.round(f * 100)} %`);
    });
    log("YouTube: hochgeladen", video.id);
    const notes = [];
    if (job.thumb_key) {
      await step(90, "Setzt das Vorschaubild …");
      try {
        const png = join(dir, "thumb.png");
        const jpg = join(dir, "thumb.jpg");
        await download(job.thumb_key, png);
        await run("ffmpeg", ["-hide_banner", "-y", "-i", png, "-vf", "scale=1280:-2", "-q:v", "3", jpg]);
        await setThumbnail(token, video.id, await readFile(jpg));
      } catch (err) {
        notes.push(`Vorschaubild nicht gesetzt: ${err.message}`);
      }
    }
    const caps = job.result?.captions ?? [];
    for (const [lang, name] of [["de", "Deutsch"], ["en", "English"]]) {
      if (!caps.some((c) => c[lang])) continue;
      await step(94, `Lädt die Untertitel ${name} hoch …`);
      try {
        await insertCaption(token, video.id, lang, name, toSrt(caps, lang));
      } catch (err) {
        notes.push(`Untertitel ${name} nicht hochgeladen: ${err.message}`);
      }
    }
    if (y.playlistId) {
      await step(98, "Fügt das Video der Playlist hinzu …");
      try {
        await addToPlaylist(token, y.playlistId, video.id);
      } catch (err) {
        notes.push(`Nicht zur Playlist hinzugefügt: ${err.message}`);
      }
    }
    await patch({ state: "done", videoId: video.id, url: `https://youtu.be/${video.id}`, privacyResult: video.status?.privacyStatus ?? y.privacy, notes, message: null, at: new Date().toISOString() });
    await sql`UPDATE webinar_videos SET status = 'done', progress = 100, message = NULL WHERE webinar_id = ${id}`;
    log("YouTube: fertig", video.id, notes.join(" | "));
  } catch (err) {
    log("Fehler beim YouTube-Upload", err);
    await patch({ state: "failed", message: String(err?.message || err).slice(0, 1000) }).catch(() => {});
    await sql`UPDATE webinar_videos SET status = CASE WHEN file_key IS NOT NULL THEN 'done' ELSE 'draft' END, progress = 0, message = NULL WHERE webinar_id = ${id}`.catch(() => {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function claim() {
  const [job] = await sql`
    UPDATE webinar_videos SET status = 'rendering', progress = 0, message = 'Startet …', attempts = attempts + 1, started_at = now()
    WHERE webinar_id = (SELECT webinar_id FROM webinar_videos WHERE status = 'queued' ORDER BY queued_at NULLS FIRST LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING *`;
  return job ?? null;
}

async function loop() {
  // Beim Start: ein abgebrochener YouTube-Upload wird nicht wiederholt (sonst womöglich doppelt auf YouTube)
  await sql`
    UPDATE webinar_videos SET status = CASE WHEN file_key IS NOT NULL THEN 'done' ELSE 'draft' END, progress = 0, message = NULL,
      youtube = COALESCE(youtube, '{}'::jsonb) || ${sql.json({ state: "failed", message: "Abgebrochen (Dienst neu gestartet). Bitte in YouTube Studio prüfen, ob das Video teilweise hochgeladen wurde." })}
    WHERE status = 'rendering' AND task = 'youtube'`;
  // Übrige abgebrochene Aufträge einmal neu einreihen, danach als fehlgeschlagen markieren
  await sql`UPDATE webinar_videos SET status = 'queued', message = 'Neu eingereiht nach Neustart' WHERE status = 'rendering' AND attempts < 2`;
  await sql`UPDATE webinar_videos SET status = 'failed', message = 'Abgebrochen (Dienst neu gestartet)' WHERE status = 'rendering'`;
  log("Render-Dienst bereit");
  for (;;) {
    let job = null;
    try {
      job = await claim();
      if (job) {
        log("Auftrag", job.webinar_id, job.task ?? "render");
        if (job.task === "prepare" || job.task === "prepare-all") await runPrepare(job);
        else if (job.task === "youtube") await runYoutube(job);
        else await render(job);
        continue;
      }
    } catch (err) {
      log("Fehler", err);
      if (job) {
        const msg = String(err?.message || err).slice(0, 1500);
        await sql`UPDATE webinar_videos SET status = 'failed', message = ${msg}, updated_at = now() WHERE webinar_id = ${job.webinar_id}`.catch(() => {});
      }
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  loop().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
