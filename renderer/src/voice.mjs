import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { getObject, putObject, storageConfigured } from "./s3.mjs";

/**
 * Profistimme für Erklärvideos: ElevenLabs Speech-to-Speech. Die Stimme spricht exakt das Gesagte mit demselben
 * Timing nach, darum bleibt sie zum Bild synchron. Eine feste Stimme für alle Videos (ELEVENLABS_VIDEO_VOICE_ID).
 * Umgewandelte Clips werden im Bucket zwischengespeichert: erneutes Rendern mit gleichen Clips kostet nichts.
 */
const API = (process.env.ELEVENLABS_API_BASE || "https://api.elevenlabs.io/v1").replace(/\/+$/, "");
const MODEL = process.env.ELEVENLABS_STS_MODEL || "eleven_multilingual_sts_v2";
const SETTINGS = { stability: 0.55, similarity_boost: 0.85, style: 0, use_speaker_boost: true };

export const voiceId = () => String(process.env.ELEVENLABS_VIDEO_VOICE_ID || "").trim();
export const voiceConfigured = () => Boolean(process.env.ELEVENLABS_API_KEY && voiceId());

const cacheKey = (parts) =>
  `webinare/videos/stimme/${createHash("sha256").update(JSON.stringify([voiceId(), MODEL, SETTINGS, ...parts])).digest("hex").slice(0, 32)}.mp3`;

async function callSts(wav) {
  for (let attempt = 1; ; attempt++) {
    const form = new FormData();
    form.set("audio", new Blob([wav], { type: "audio/wav" }), "clip.wav");
    form.set("model_id", MODEL);
    form.set("remove_background_noise", "true");
    form.set("voice_settings", JSON.stringify(SETTINGS));
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

/** Wandelt eine WAV-Datei in die Profistimme um und schreibt das MP3 nach outFile. Liefert true bei Treffer im Zwischenspeicher. */
export async function convertVoice(wav, outFile, cacheParts) {
  const key = cacheKey(cacheParts);
  if (storageConfigured()) {
    const hit = await getObject(key).catch(() => null);
    if (hit?.ok) {
      await writeFile(outFile, Buffer.from(await hit.arrayBuffer()));
      return true;
    }
  }
  const mp3 = await callSts(wav);
  await writeFile(outFile, mp3);
  if (storageConfigured() && !process.env.NO_UPLOAD) await putObject(key, mp3, "audio/mpeg").catch(() => {});
  return false;
}
