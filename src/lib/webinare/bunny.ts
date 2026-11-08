/**
 * Bunny Stream (Video-Bibliothek). Variablen:
 *   BUNNY_LIBRARY_ID, BUNNY_API_KEY (Bibliotheks-API-Schlüssel), BUNNY_CDN_HOST (z. B. vz-xxxx.b-cdn.net)
 * Für die englische Tonspur muss in der Bibliothek "MP4 Fallback" aktiv sein (ElevenLabs holt die MP4-Datei).
 */
const API = "https://video.bunnycdn.com";

export function bunnyConfigured(): boolean {
  return Boolean(process.env.BUNNY_LIBRARY_ID && process.env.BUNNY_API_KEY && process.env.BUNNY_CDN_HOST);
}

const lib = () => encodeURIComponent(process.env.BUNNY_LIBRARY_ID ?? "");
const headers = () => ({ AccessKey: process.env.BUNNY_API_KEY ?? "", Accept: "application/json" });

export type BunnyVideo = { guid: string; title: string; status: number; length: number; encodeProgress: number; availableResolutions: string };

export async function bunnyVideo(id: string): Promise<BunnyVideo> {
  const res = await fetch(`${API}/library/${lib()}/videos/${encodeURIComponent(id)}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`Bunny: Video ${id} nicht gefunden (${res.status})`);
  return (await res.json()) as BunnyVideo;
}

export const BUNNY_STATUS: Record<number, string> = {
  0: "angelegt",
  1: "hochgeladen",
  2: "wird verarbeitet",
  3: "wird umgewandelt",
  4: "bereit",
  5: "Fehler",
  6: "Upload fehlgeschlagen"
};

export async function createBunnyVideo(title: string): Promise<string> {
  const res = await fetch(`${API}/library/${lib()}/videos`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  });
  const json = (await res.json().catch(() => null)) as { guid?: string } | null;
  if (!res.ok || !json?.guid) throw new Error(`Bunny: Video konnte nicht angelegt werden (${res.status})`);
  return json.guid;
}

/** Lädt einen Datenstrom direkt in ein angelegtes Video (ohne Zwischenspeicher). */
export async function uploadBunnyStream(guid: string, body: ReadableStream<Uint8Array>): Promise<void> {
  const res = await fetch(`${API}/library/${lib()}/videos/${encodeURIComponent(guid)}`, {
    method: "PUT",
    headers: { AccessKey: process.env.BUNNY_API_KEY ?? "", "Content-Type": "application/octet-stream" },
    body,
    // @ts-expect-error Node braucht duplex für gestreamte Anfragen
    duplex: "half"
  });
  if (!res.ok) throw new Error(`Bunny: Upload fehlgeschlagen (${res.status})`);
}

export function bunnyMp4Url(id: string, height = 720): string {
  return `https://${process.env.BUNNY_CDN_HOST}/${id}/play_${height}p.mp4`;
}

export function bunnyThumb(id: string): string {
  return `https://${process.env.BUNNY_CDN_HOST}/${id}/thumbnail.jpg`;
}
