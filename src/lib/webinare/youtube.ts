import { randomBytes } from "node:crypto";
import { sql } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/platform/crypto";

/**
 * YouTube-Kanal für die Erklärvideos. Eine Verbindung für alle (Tabelle youtube_connection), angemeldet per Google OAuth.
 * Hochladen macht der Render-Dienst (Auftrag "youtube"); Orbit verbindet den Kanal und reiht den Upload ein.
 * Variablen: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET (Google Cloud, OAuth-Client vom Typ Webanwendung).
 */
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.force-ssl"];
export const YT_COOKIE = "orbit_yt_oauth";

export const youtubeConfigured = () => Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET);
const base = () => (process.env.AUTH_URL || "").replace(/\/+$/, "");
export const redirectUri = () => `${base()}/api/webinare/youtube/callback`;

export type YoutubeConnection = { channelId: string; channelTitle: string; connectedBy: string | null; connectedAt: Date };

/** Upload-Stand eines Videos (webinar_videos.youtube) */
export type YoutubeUpload = {
  state: "queued" | "uploading" | "done" | "failed";
  privacy: "public" | "unlisted" | "private";
  publishAt?: string;
  playlistId?: string;
  synthetic: boolean;
  version: number;
  meta: { title: string; description: string; tags: string[] };
  videoId?: string;
  url?: string;
  privacyResult?: string;
  notes?: string[];
  message?: string;
  by?: string;
  at?: string;
};

export function loginUrl(webinarId: string): { url: string; cookie: string } {
  const state = randomBytes(18).toString("base64url");
  const q = new URLSearchParams({
    client_id: process.env.YOUTUBE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "true",
    state
  });
  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${q}`,
    cookie: encrypt(JSON.stringify({ state, webinarId, at: Date.now() }))
  };
}

export function readCookie(raw: string | undefined): { state: string; webinarId: string; at: number } | null {
  try {
    const v = JSON.parse(decrypt(raw ?? ""));
    return Date.now() - v.at < 600_000 ? v : null;
  } catch {
    return null;
  }
}

/** Code gegen Tokens tauschen und den Kanal des Kontos lesen. */
export async function connect(code: string, by: string): Promise<YoutubeConnection> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.YOUTUBE_CLIENT_ID ?? "",
      client_secret: process.env.YOUTUBE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(),
      grant_type: "authorization_code"
    }),
    signal: AbortSignal.timeout(20_000)
  });
  const tokens = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; error?: string };
  if (!res.ok || !tokens.access_token) throw new Error(`Google-Anmeldung fehlgeschlagen (${tokens.error ?? res.status})`);
  if (!tokens.refresh_token) throw new Error("Google hat keinen dauerhaften Zugang geliefert. Bitte nochmals verbinden.");
  const ch = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(20_000)
  });
  const data = (await ch.json().catch(() => ({}))) as { items?: { id: string; snippet?: { title?: string } }[] };
  const item = data.items?.[0];
  if (!ch.ok || !item) throw new Error("Zu diesem Google-Konto gibt es keinen YouTube-Kanal. Bei der Anmeldung den Kanal von Elev8 wählen.");
  const conn = { channelId: item.id, channelTitle: item.snippet?.title || item.id, connectedBy: by, connectedAt: new Date() };
  await sql`
    INSERT INTO youtube_connection (id, channel_id, channel_title, refresh_token, connected_by, connected_at)
    VALUES (1, ${conn.channelId}, ${conn.channelTitle}, ${encrypt(tokens.refresh_token)}, ${by}, now())
    ON CONFLICT (id) DO UPDATE SET channel_id = EXCLUDED.channel_id, channel_title = EXCLUDED.channel_title,
      refresh_token = EXCLUDED.refresh_token, connected_by = EXCLUDED.connected_by, connected_at = now()`;
  return conn;
}

export async function getConnection(): Promise<YoutubeConnection | null> {
  const [r] = await sql`SELECT channel_id, channel_title, connected_by, connected_at FROM youtube_connection WHERE id = 1`.catch(() => []);
  return r ? { channelId: r.channel_id as string, channelTitle: r.channel_title as string, connectedBy: (r.connected_by as string) ?? null, connectedAt: r.connected_at as Date } : null;
}

/** Verbindung trennen und den Zugang bei Google zurückziehen. */
export async function disconnect(): Promise<void> {
  const [r] = await sql`SELECT refresh_token FROM youtube_connection WHERE id = 1`;
  if (r) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(r.refresh_token as string))}`, { method: "POST", signal: AbortSignal.timeout(15_000) });
    } catch {
      // Zurückziehen ist nur Ordnung; die gespeicherte Verbindung wird so oder so gelöscht
    }
  }
  await sql`DELETE FROM youtube_connection WHERE id = 1`;
}

/** Upload einreihen. Nur für ein fertiges Video; finished_at und updated_at bleiben, das Video gilt nicht als geändert. */
export async function queueUpload(webinarId: string, upload: YoutubeUpload): Promise<boolean> {
  const rows = await sql`
    UPDATE webinar_videos SET status = 'queued', task = 'youtube', progress = 0, attempts = 0,
      message = 'Wartet auf den Render-Dienst …', queued_at = now(), youtube = ${sql.json(upload)}
    WHERE webinar_id = ${webinarId} AND status = 'done' AND file_key IS NOT NULL
    RETURNING webinar_id`;
  return rows.length > 0;
}
