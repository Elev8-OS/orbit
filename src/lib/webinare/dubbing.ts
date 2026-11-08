import { createBunnyVideo, uploadBunnyStream } from "./bunny";

/**
 * Englische Tonspur über ElevenLabs Dubbing (neutrale KI-Stimme). Ablauf:
 * 1. startDubbing: ElevenLabs holt die deutsche MP4 von Bunny und synchronisiert nach Englisch.
 * 2. dubbingStatus: abfragen, bis "dubbed".
 * 3. transferDubbing: fertiges Video direkt von ElevenLabs nach Bunny streamen → neue Video-ID (EN).
 * Variable: ELEVENLABS_API_KEY
 */
const API = "https://api.elevenlabs.io/v1";

export function elevenConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

const key = () => ({ "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" });

export async function startDubbing(sourceUrl: string, name: string): Promise<string> {
  const form = new FormData();
  form.set("source_url", sourceUrl);
  form.set("source_lang", "de");
  form.set("target_lang", "en");
  form.set("num_speakers", "0");
  form.set("watermark", "false");
  form.set("name", name.slice(0, 100));
  const res = await fetch(`${API}/dubbing`, { method: "POST", headers: key(), body: form });
  const json = (await res.json().catch(() => null)) as { dubbing_id?: string; detail?: unknown } | null;
  if (!res.ok || !json?.dubbing_id) throw new Error(`ElevenLabs: ${JSON.stringify(json?.detail ?? res.status).slice(0, 300)}`);
  return json.dubbing_id;
}

export async function dubbingStatus(id: string): Promise<{ status: string; error: string | null }> {
  const res = await fetch(`${API}/dubbing/${encodeURIComponent(id)}`, { headers: key(), cache: "no-store" });
  const json = (await res.json().catch(() => null)) as { status?: string; error?: string | null } | null;
  if (!res.ok || !json) throw new Error(`ElevenLabs: Status nicht lesbar (${res.status})`);
  return { status: json.status ?? "unbekannt", error: json.error ?? null };
}

export async function transferDubbing(id: string, title: string): Promise<string> {
  const res = await fetch(`${API}/dubbing/${encodeURIComponent(id)}/audio/en`, { headers: key(), cache: "no-store" });
  if (!res.ok || !res.body) throw new Error(`ElevenLabs: Ergebnis nicht abrufbar (${res.status})`);
  const guid = await createBunnyVideo(`${title} (EN)`);
  await uploadBunnyStream(guid, res.body);
  return guid;
}
