import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { getObject, putObject, storageConfigured } from "./s3.mjs";

/**
 * Profistimme für Erklärvideos, eine feste Stimme für alle Videos (ELEVENLABS_VIDEO_VOICE_ID):
 * - synchron: Speech-to-Speech über die bereinigte Originalspur (Timing und Betonung des Referenten bleiben),
 * - neu formuliert: Text-to-Speech aus dem von Claude geglätteten Sprechertext.
 * Ergebnisse werden im Bucket zwischengespeichert: erneutes Rendern mit gleichem Ton oder Text kostet nichts.
 */
const API = (process.env.ELEVENLABS_API_BASE || "https://api.elevenlabs.io/v1").replace(/\/+$/, "");
const MODEL = process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2";
const SETTINGS = { stability: 0.5, similarity_boost: 0.8, style: 0, use_speaker_boost: true, speed: 1 };
const STS_MODEL = process.env.ELEVENLABS_STS_MODEL || "eleven_multilingual_sts_v2";
const STS_SETTINGS = { stability: 0.5, similarity_boost: 0.8, style: 0, use_speaker_boost: true };

export const voiceId = () => String(process.env.ELEVENLABS_VIDEO_VOICE_ID || "").trim();
export const voiceConfigured = () => Boolean(process.env.ELEVENLABS_API_KEY && voiceId());

/** Aussprache: Markennamen und Abkürzungen so schreiben, wie sie gesprochen werden. */
export function spoken(text) {
  return String(text ?? "")
    .replace(/\bElev8\b/gi, "Elevate")
    .replace(/\bz\.\s?B\./g, "zum Beispiel")
    .replace(/\bd\.\s?h\./g, "das heisst")
    .replace(/\bu\.\s?a\./g, "unter anderem")
    .replace(/\bbzw\./g, "beziehungsweise")
    .replace(/\s&\s/g, " und ")
    .replace(/\s+/g, " ")
    .trim();
}

const cacheKey = (parts) =>
  `webinare/videos/stimme/${createHash("sha256").update(JSON.stringify([voiceId(), MODEL, SETTINGS, ...parts])).digest("hex").slice(0, 32)}.mp3`;

async function callTts(text, previous, next) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}/text-to-speech/${encodeURIComponent(voiceId())}?output_format=mp3_44100_192`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "", "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: SETTINGS, previous_text: previous || undefined, next_text: next || undefined }),
      signal: AbortSignal.timeout(120_000)
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, attempt * 5000));
      continue;
    }
    if (res.status === 401) throw new Error("ElevenLabs lehnt den API-Schlüssel ab. Bitte ELEVENLABS_API_KEY im Render-Dienst prüfen.");
    if (res.status === 404) throw new Error("Die Profistimme (ELEVENLABS_VIDEO_VOICE_ID) gibt es in diesem ElevenLabs-Konto nicht.");
    throw new Error(`ElevenLabs Sprachausgabe fehlgeschlagen (${res.status}): ${detail}`);
  }
}

/** Spricht eine Zeile und schreibt das MP3 nach outFile. Nachbarzeilen geben der Betonung Zusammenhang. Liefert true bei Treffer im Zwischenspeicher. */
export async function speak(text, outFile, { previous = "", next = "" } = {}) {
  const t = spoken(text);
  const p = spoken(previous);
  const n = spoken(next);
  const key = cacheKey([t, p, n]);
  if (storageConfigured()) {
    const hit = await getObject(key).catch(() => null);
    if (hit?.ok) {
      await writeFile(outFile, Buffer.from(await hit.arrayBuffer()));
      return true;
    }
  }
  const mp3 = await callTts(t, p, n);
  await writeFile(outFile, mp3);
  if (storageConfigured() && !process.env.NO_UPLOAD) await putObject(key, mp3, "audio/mpeg").catch(() => {});
  return false;
}

async function callSts(audio) {
  for (let attempt = 1; ; attempt++) {
    const form = new FormData();
    form.append("audio", new Blob([audio], { type: "audio/wav" }), "clip.wav");
    form.append("model_id", STS_MODEL);
    form.append("voice_settings", JSON.stringify(STS_SETTINGS));
    form.append("remove_background_noise", "true");
    const res = await fetch(`${API}/speech-to-speech/${encodeURIComponent(voiceId())}?output_format=mp3_44100_192`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" },
      body: form,
      signal: AbortSignal.timeout(180_000)
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, attempt * 5000));
      continue;
    }
    if (res.status === 401) throw new Error("ElevenLabs lehnt den API-Schlüssel ab. Bitte ELEVENLABS_API_KEY im Render-Dienst prüfen.");
    if (res.status === 404) throw new Error("Die Profistimme (ELEVENLABS_VIDEO_VOICE_ID) gibt es in diesem ElevenLabs-Konto nicht.");
    throw new Error(`ElevenLabs Stimmumwandlung fehlgeschlagen (${res.status}): ${detail}`);
  }
}

/** Synchron: die bereinigte Tonspur eines Clips (WAV) in die Profistimme umwandeln, gleiche Länge und Timing. */
export async function convert(inFile, outFile) {
  const audio = await readFile(inFile);
  const key = `webinare/videos/stimme/${createHash("sha256").update(JSON.stringify([voiceId(), STS_MODEL, STS_SETTINGS])).update(audio).digest("hex").slice(0, 32)}.mp3`;
  if (storageConfigured()) {
    const hit = await getObject(key).catch(() => null);
    if (hit?.ok) {
      await writeFile(outFile, Buffer.from(await hit.arrayBuffer()));
      return true;
    }
  }
  const mp3 = await callSts(audio);
  await writeFile(outFile, mp3);
  if (storageConfigured() && !process.env.NO_UPLOAD) await putObject(key, mp3, "audio/mpeg").catch(() => {});
  return false;
}
