import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { H, PIP, W, chapterPng, clean, introPng, keyPng, outroPng, pipPng, pipX, pipY, thumbPng } from "./overlays.mjs";
import { deleteObject, putObject, storageConfigured } from "./s3.mjs";
import { convertVoice, voiceConfigured } from "./voice.mjs";

/**
 * Render-Dienst für Erklärvideos aus Webinar-Aufzeichnungen.
 * Holt Aufträge aus webinar_videos (status 'queued'), schneidet die Clips aus dem Bunny-Video,
 * legt die Elev8-Einblendungen darüber und lädt MP4 und YouTube-Vorschaubild in den Bucket.
 *
 * Variablen: DATABASE_URL, BUNNY_CDN_HOST, S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
 * für die Profistimme ELEVENLABS_API_KEY und ELEVENLABS_VIDEO_VOICE_ID.
 * Zum Testen: SOURCE_OVERRIDE (lokale Datei statt Bunny), NO_UPLOAD=1 (Ergebnis bleibt in OUT_DIR).
 */

const sql = postgres(process.env.DATABASE_URL ?? "", { max: 2, idle_timeout: 30, connect_timeout: 15, onnotice: () => {} });
const POLL_MS = Number(process.env.POLL_MS || 10_000);
const INTRO_SEC = 5;
const OUTRO_SEC = 6;
const CHAPTER_SHOW = [0.4, 5.2]; // Kapiteltitel: von–bis ab Kapitelbeginn
const KEY_SEC = 7; // Kernaussage: die letzten Sekunden des Kapitels
const FPS = 30;

/** Bildausschnitte der Teams-Aufnahme (1920×1080) bei geteiltem Bildschirm */
const LAYOUTS = {
  "teams-share": { screen: { x: 0, y: 69, w: 1674, h: 942 }, cam: { x: 1731, y: 396, w: 128, h: 128 } },
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
async function clipPart({ src, start, dur, layout, pip, voice, chapterFile, chapterAt, keyFile, keyAt, out }) {
  const L = LAYOUTS[layout] ?? LAYOUTS["teams-share"];
  const inputs = ["-ss", start.toFixed(3), "-t", dur.toFixed(3), "-i", src];
  const f = [];
  const s = L.screen;
  f.push(`[0:v]crop=${s.w}:${s.h}:${s.x}:${s.y},scale=${W}:${H}:flags=lanczos,setsar=1,fps=${FPS}[base]`);
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
    const clips = chapters.flatMap((c, ci) => c.clips.filter((k) => Number(k.end) > Number(k.start)).map((k, ki, arr) => ({ ci, ki, last: ki === arr.length - 1, start: Number(k.start), end: Number(k.end) })));
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
    for (const [i, k] of clips.entries()) {
      const s = await snap(src, k.start, "start");
      const e = await snap(src, k.end, "end");
      const dur = Math.max(1, e - s);
      if (k.ki === 0) timeline.push({ title: clean(chapters[k.ci].title), at: Math.floor(at) });
      // Kapiteldauer: Summe aller Clips des Kapitels (für die Kernaussage am Schluss)
      const chapterClips = clips.filter((x) => x.ci === k.ci);
      const isLong = chapterClips.reduce((sum, x) => sum + (x.end - x.start), 0) >= CHAPTER_SHOW[1] + KEY_SEC + 1;
      const keyFile = k.last && isLong && clean(chapters[k.ci].key) ? join(dir, `key${k.ci}.png`) : null;
      const keyAt = [Math.max(k.ki === 0 ? CHAPTER_SHOW[1] + 0.5 : 0.4, dur - KEY_SEC - 0.4), dur - 0.4];
      const out = join(dir, `p_${String(i).padStart(2, "0")}.mp4`);
      let voice = null;
      if (proVoice) {
        await progress(id, (done / steps) * 100, `Profistimme für Clip ${i + 1} von ${clips.length} …`);
        const wavFile = join(dir, `v_${i}.wav`);
        await run("ffmpeg", ["-hide_banner", "-y", "-ss", s.toFixed(3), "-t", dur.toFixed(3), "-i", src, "-vn", "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", wavFile]);
        voice = join(dir, `v_${i}.mp3`);
        const hit = await convertVoice(await readFile(wavFile), voice, [w.bunny_video_de, s.toFixed(2), dur.toFixed(2)]);
        log(`Clip ${i + 1}: Profistimme ${hit ? "aus Zwischenspeicher" : "umgewandelt"}`);
      }
      await clipPart({
        src,
        start: s,
        dur,
        layout: k.gallery ? "full" : layout,
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
    await run("ffmpeg", ["-hide_banner", "-y", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-c", "copy", "-movflags", "+faststart", final]);
    const thumb = join(dir, "thumbnail.png");
    await writeFile(thumb, await thumbPng(p));
    const size = (await stat(final)).size;
    const result = { durationSec: Math.round(at), chapters: timeline, size };

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

async function claim() {
  const [job] = await sql`
    UPDATE webinar_videos SET status = 'rendering', progress = 0, message = 'Startet …', attempts = attempts + 1, started_at = now(), updated_at = now()
    WHERE webinar_id = (SELECT webinar_id FROM webinar_videos WHERE status = 'queued' ORDER BY queued_at NULLS FIRST LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING *`;
  return job ?? null;
}

async function loop() {
  // Beim Start: abgebrochene Aufträge einmal neu einreihen, danach als fehlgeschlagen markieren
  await sql`UPDATE webinar_videos SET status = 'queued', message = 'Neu eingereiht nach Neustart' WHERE status = 'rendering' AND attempts < 2`;
  await sql`UPDATE webinar_videos SET status = 'failed', message = 'Abgebrochen (Dienst neu gestartet)' WHERE status = 'rendering'`;
  log("Render-Dienst bereit");
  for (;;) {
    let job = null;
    try {
      job = await claim();
      if (job) {
        log("Auftrag", job.webinar_id);
        await render(job);
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
