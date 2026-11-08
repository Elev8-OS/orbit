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

/**
 * Sucht eine öffentlich abrufbare MP4-Datei des Videos (MP4 Fallback), bevorzugt eine kleine Auflösung,
 * denn ElevenLabs braucht nur den Ton. Prüft jede Adresse ohne Referrer, so wie ElevenLabs sie abholt.
 * Liefert die Adresse oder eine verständliche Erklärung, warum keine erreichbar ist.
 */
export async function findMp4(id: string): Promise<{ url: string } | { error: string }> {
  const v = await bunnyVideo(id);
  if (v.status !== 4) return { error: `Das Video ist in Bunny noch nicht fertig (${BUNNY_STATUS[v.status] ?? v.status}). Bitte warten, bis es „bereit“ ist.` };
  const heights = (v.availableResolutions || "")
    .split(",")
    .map((r) => parseInt(r, 10))
    .filter((h) => Number.isFinite(h) && h > 0);
  const order = [480, 360, 720, 240, 1080, ...heights].filter((h, i, a) => a.indexOf(h) === i);
  const statuses: string[] = [];
  for (const h of order) {
    const url = bunnyMp4Url(id, h);
    try {
      const res = await fetch(url, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (res.ok) return { url };
      statuses.push(`${h}p: ${res.status}`);
      if (res.status === 403) {
        return {
          error:
            "Bunny sperrt den direkten Abruf der MP4-Datei (403). In der Video-Bibliothek unter Security die erlaubten Domains leeren oder „Block direct URL file access“ ausschalten, sonst kann ElevenLabs das Video nicht holen."
        };
      }
    } catch {
      statuses.push(`${h}p: nicht erreichbar`);
    }
  }
  return {
    error: `Bunny hat für dieses Video keine MP4-Datei (${statuses.slice(0, 4).join(", ")}). In der Video-Bibliothek unter Encoding „MP4 Fallback“ einschalten und das Video danach neu umwandeln lassen (Video öffnen, „Re-encode video“). MP4-Dateien entstehen nur beim Umwandeln.`
  };
}

export function bunnyThumb(id: string): string {
  return `https://${process.env.BUNNY_CDN_HOST}/${id}/thumbnail.jpg`;
}
