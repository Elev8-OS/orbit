import { createDecipheriv, createHash } from "node:crypto";
import { open } from "node:fs/promises";

/**
 * Upload der Erklärvideos auf YouTube (Data API v3). Die Verbindung legt Orbit an (Tabelle youtube_connection,
 * Refresh-Token verschlüsselt wie in Orbit src/lib/platform/crypto.ts).
 * Variablen: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET und AUTH_SECRET (bzw. ORBIT_ENCRYPTION_KEY) wie in Orbit.
 */
const API = (process.env.YOUTUBE_API_BASE || "https://www.googleapis.com").replace(/\/+$/, "");
const TOKEN_URL = process.env.YOUTUBE_TOKEN_URL || "https://oauth2.googleapis.com/token";
// Teilgrösse beim Upload: Vielfaches von 256 KB, wie YouTube es verlangt (YOUTUBE_CHUNK_KB nur zum Testen)
const CHUNK = (Number(process.env.YOUTUBE_CHUNK_KB) || 16 * 1024) * 1024;

export const youtubeConfigured = () => Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET);

/** Gleiche Entschlüsselung wie Orbit (AES-256-GCM, Schlüssel aus ORBIT_ENCRYPTION_KEY oder AUTH_SECRET). */
function decrypt(sealed) {
  const secret = process.env.ORBIT_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET fehlt im Render-Dienst (für die YouTube-Verbindung).");
  const [version, iv, tag, data] = String(sealed).split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unbekanntes Format der YouTube-Verbindung.");
  const key = createHash("sha256").update(`orbit-secrets:${secret}`).digest();
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}

/** Verständliche Fehlermeldung aus einer Antwort der YouTube-API */
async function apiError(what, res) {
  const body = await res.json().catch(() => ({}));
  const reason = body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? body?.error ?? "";
  const msg = body?.error?.message ?? body?.error_description ?? "";
  const known = {
    quotaExceeded: "Das Tageskontingent der YouTube-API ist aufgebraucht. Morgen nochmals versuchen.",
    uploadLimitExceeded: "Der Kanal hat sein Upload-Limit für heute erreicht.",
    invalid_grant: "Die YouTube-Verbindung ist abgelaufen oder wurde entzogen. Bitte in Orbit den Kanal neu verbinden.",
    youtubeSignupRequired: "Zum Google-Konto gibt es keinen YouTube-Kanal.",
    forbidden: "YouTube erlaubt das für diesen Kanal nicht."
  };
  return new Error(known[reason] ?? `${what} fehlgeschlagen (${res.status}${reason ? `, ${reason}` : ""}): ${String(msg).slice(0, 300)}`);
}

/** Frischer Zugangsschlüssel aus der gespeicherten Verbindung. */
export async function accessToken(sql) {
  if (!youtubeConfigured()) throw new Error("YOUTUBE_CLIENT_ID und YOUTUBE_CLIENT_SECRET fehlen im Render-Dienst.");
  const [conn] = await sql`SELECT refresh_token FROM youtube_connection WHERE id = 1`;
  if (!conn) throw new Error("Kein YouTube-Kanal verbunden. Bitte in Orbit verbinden.");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET,
      refresh_token: decrypt(conn.refresh_token),
      grant_type: "refresh_token"
    }),
    signal: AbortSignal.timeout(20_000)
  });
  if (!res.ok) throw await apiError("Anmeldung bei YouTube", res);
  return (await res.json()).access_token;
}

/** YouTube verbietet < und > in Titel und Beschreibung; Tags zusammen höchstens 500 Zeichen. */
const safe = (t, max) => String(t ?? "").replace(/</g, "‹").replace(/>/g, "›").slice(0, max);
function tagsWithin(tags) {
  const out = [];
  let len = 0;
  for (const t of tags ?? []) {
    const v = safe(t, 100).trim();
    const cost = v.length + (v.includes(" ") ? 2 : 0) + (out.length ? 1 : 0);
    if (!v || len + cost > 480) continue;
    out.push(v);
    len += cost;
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const offsetFrom = (res) => {
  const r = res.headers.get("range");
  return r ? Number(r.split("-")[1]) + 1 : 0;
};

/**
 * Video in Teilen hochladen (resumable). Bricht die Verbindung ab, wird der Stand bei YouTube abgefragt und dort
 * weitergemacht. Liefert die Video-Ressource (id, status).
 */
export async function uploadVideo(token, file, size, { meta, privacy, publishAt, synthetic }, onProgress) {
  const resource = {
    snippet: {
      title: safe(meta.title, 100),
      description: safe(meta.description, 5000),
      tags: tagsWithin(meta.tags),
      categoryId: "28",
      defaultLanguage: "de",
      defaultAudioLanguage: "de"
    },
    status: {
      privacyStatus: publishAt ? "private" : privacy,
      ...(publishAt ? { publishAt } : {}),
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: Boolean(synthetic),
      embeddable: true,
      license: "youtube"
    }
  };
  const init = await fetch(`${API}/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-length": String(size),
      "x-upload-content-type": "video/mp4"
    },
    body: JSON.stringify(resource),
    signal: AbortSignal.timeout(60_000)
  });
  if (!init.ok) throw await apiError("Upload starten", init);
  const session = init.headers.get("location");
  if (!session) throw new Error("YouTube hat keine Upload-Adresse geliefert.");
  const fh = await open(file, "r");
  let offset = 0;
  let tries = 0;
  try {
    for (;;) {
      const len = Math.min(CHUNK, size - offset);
      const buf = Buffer.alloc(len);
      await fh.read(buf, 0, len, offset);
      let res = null;
      try {
        res = await fetch(session, {
          method: "PUT",
          headers: { authorization: `Bearer ${token}`, "content-type": "video/mp4", "content-range": `bytes ${offset}-${offset + len - 1}/${size}` },
          body: buf,
          signal: AbortSignal.timeout(600_000)
        });
      } catch {
        res = null;
      }
      if (res && (res.status === 200 || res.status === 201)) return await res.json();
      if (res?.status === 308) {
        offset = offsetFrom(res);
        tries = 0;
        await onProgress(offset / size);
        continue;
      }
      if (res && res.status < 500 && ![408, 429].includes(res.status)) throw await apiError("Upload", res);
      if (++tries > 5) throw new Error("Der Upload ist mehrmals abgebrochen. Bitte später nochmals versuchen.");
      await sleep(tries * 5000);
      // Wie viel ist schon bei YouTube angekommen?
      const st = await fetch(session, {
        method: "PUT",
        headers: { authorization: `Bearer ${token}`, "content-range": `bytes */${size}` },
        body: "",
        signal: AbortSignal.timeout(60_000)
      }).catch(() => null);
      if (st && (st.status === 200 || st.status === 201)) return await st.json();
      if (st?.status === 308) offset = offsetFrom(st);
    }
  } finally {
    await fh.close();
  }
}

/** Eigenes Vorschaubild (JPEG, höchstens 2 MB). Braucht einen bestätigten Kanal. */
export async function setThumbnail(token, videoId, jpeg) {
  const res = await fetch(`${API}/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "image/jpeg" },
    body: jpeg,
    signal: AbortSignal.timeout(120_000)
  });
  if (res.ok) return;
  const err = await apiError("Vorschaubild", res);
  if (res.status === 403) throw new Error("Für eigene Vorschaubilder muss der Kanal bestätigt sein (youtube.com/verify). Danach in YouTube Studio setzen.");
  throw err;
}

/** Untertitelspur (SRT) hochladen. */
export async function insertCaption(token, videoId, language, name, srt) {
  const boundary = `orbit${Date.now().toString(36)}`;
  const meta = JSON.stringify({ snippet: { videoId, language, name, isDraft: false } });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
    Buffer.from(srt, "utf8"),
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);
  const res = await fetch(`${API}/upload/youtube/v3/captions?part=snippet&uploadType=multipart`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": `multipart/related; boundary=${boundary}` },
    body,
    signal: AbortSignal.timeout(120_000)
  });
  if (!res.ok) throw await apiError(`Untertitel ${name}`, res);
}

export async function addToPlaylist(token, playlistId, videoId) {
  const res = await fetch(`${API}/youtube/v3/playlistItems?part=snippet`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ snippet: { playlistId, resourceId: { kind: "youtube#video", videoId } } }),
    signal: AbortSignal.timeout(60_000)
  });
  if (!res.ok) throw await apiError("Playlist", res);
}
