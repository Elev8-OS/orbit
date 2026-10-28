import type { RawMessage } from "../types";
import type { ConnectionWithToken } from "../store";

/**
 * Slack-Quelle. Liest mit einem Token (User-Token xoxp- empfohlen, dann sieht das Radar genau deine Channels).
 * Nötige Rechte (User Token Scopes): channels:read, channels:history, groups:read, groups:history, users:read.
 * Es wird nie etwas in Slack geschrieben.
 */
const API = "https://slack.com/api/";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type SlackResponse = { ok: boolean; error?: string; response_metadata?: { next_cursor?: string } } & Record<string, unknown>;

async function call(token: string, method: string, params: Record<string, string | number | undefined> = {}): Promise<SlackResponse> {
  const url = new URL(method, API);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
    if (res.status === 429) {
      await sleep(Math.min(Number(res.headers.get("retry-after")) || 3, 30) * 1000);
      continue;
    }
    const json = (await res.json().catch(() => null)) as SlackResponse | null;
    if (!json?.ok) throw new Error(`Slack: ${json?.error ?? res.status}`);
    return json;
  }
  throw new Error("Slack: Ratenlimit erreicht");
}

export type SlackConfig = {
  /** z.B. https://mein-workspace.slack.com/ (für Permalinks) */
  workspaceUrl: string;
  team: string;
  slackUser: string;
  channels: { id: string; name: string }[];
};

type SlackMessage = {
  ts: string;
  user?: string;
  username?: string;
  subtype?: string;
  text?: string;
  thread_ts?: string;
  reply_count?: number;
  latest_reply?: string;
  files?: { name?: string }[];
};

async function listChannels(token: string): Promise<{ id: string; name: string }[]> {
  const out: { id: string; name: string }[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const r = await call(token, "conversations.list", { types: "public_channel,private_channel", exclude_archived: "true", limit: 1000, cursor });
    for (const c of (r.channels as { id: string; name?: string }[] | undefined) ?? []) if (c.name) out.push({ id: c.id, name: c.name });
    cursor = r.response_metadata?.next_cursor || undefined;
    if (!cursor) break;
  }
  return out;
}

/** Prüft das Token und löst die Channel-Eingaben (Name oder ID) auf. Wirft verständliche Fehler. */
export async function connectSlack(token: string, inputs: string[]): Promise<SlackConfig> {
  if (!/^xox[pb]-/.test(token)) throw new Error("Das ist kein Slack-Token (er beginnt mit xoxp- oder xoxb-).");
  const auth = await call(token, "auth.test");
  const channels: SlackConfig["channels"] = [];
  let all: { id: string; name: string }[] | null = null;
  for (const raw of inputs) {
    const value = raw.trim().replace(/^#/, "");
    if (!value) continue;
    if (/^[CG][A-Z0-9]{8,}$/.test(value)) {
      const info = await call(token, "conversations.info", { channel: value });
      const ch = info.channel as { id?: string; name?: string } | undefined;
      channels.push({ id: ch?.id ?? value, name: ch?.name ?? value });
      continue;
    }
    if (!all) all = await listChannels(token);
    const found = all.find((c) => c.name.toLowerCase() === value.toLowerCase());
    if (!found) throw new Error(`Channel nicht gefunden: ${raw.trim()} (nur Channels, in denen das Token Mitglied ist)`);
    channels.push(found);
  }
  if (!channels.length) throw new Error("Mindestens ein Channel nötig.");
  const unique = [...new Map(channels.map((c) => [c.id, c])).values()];
  return { workspaceUrl: String(auth.url ?? ""), team: String(auth.team ?? ""), slackUser: String(auth.user ?? ""), channels: unique };
}

const SKIP_SUBTYPE = /^(channel_|group_|pinned_item|bot_add|bot_remove|bot_message|reminder_add)/;
const skip = (m: SlackMessage) => Boolean(m.subtype && SKIP_SUBTYPE.test(m.subtype)) || m.user === "USLACKBOT";

async function userName(token: string, id: string): Promise<string> {
  try {
    const r = await call(token, "users.info", { user: id });
    const u = r.user as { real_name?: string; name?: string; profile?: { display_name?: string; real_name?: string } } | undefined;
    return u?.profile?.real_name || u?.real_name || u?.profile?.display_name || u?.name || id;
  } catch {
    return id;
  }
}

/** Slack-Markup in lesbaren Text umwandeln (Erwähnungen, Links, Entitäten). */
function clean(text: string, users: Map<string, string>): string {
  return text
    .replace(/<@([A-Z0-9]+)(?:\|[^>]*)?>/g, (_, id: string) => `@${users.get(id) ?? id}`)
    .replace(/<!subteam\^[A-Z0-9]+\|(@[^>]+)>/g, "$1")
    .replace(/<!(channel|here|everyone)[^>]*>/g, "@$1")
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1")
    .replace(/<((?:https?:\/\/|mailto:)[^|>]+)\|([^>]+)>/g, "$2 ($1)")
    .replace(/<((?:https?:\/\/|mailto:)[^>]+)>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

const body = (m: SlackMessage, users: Map<string, string>) => {
  const text = clean(m.text ?? "", users);
  const files = (m.files ?? []).map((f) => `[Datei: ${f.name ?? "?"}]`).join(" ");
  return [text, files].filter(Boolean).join("\n").slice(0, 3000);
};

/**
 * Holt neue Beiträge und neue Thread-Antworten seit `sinceIso`.
 * Die Channel-Historie wird 7 Tage zurück gelesen, damit auch neue Antworten in älteren Threads auffallen.
 */
export async function collectSlack(conn: ConnectionWithToken, sinceIso: string): Promise<RawMessage[]> {
  const token = conn.token;
  if (!token) throw new Error("Slack: kein Token gespeichert");
  const cfg = conn.config as Partial<SlackConfig>;
  const channels = cfg.channels ?? [];
  if (!channels.length) throw new Error("Slack: keine Channels ausgewählt");
  const base = cfg.workspaceUrl ? cfg.workspaceUrl.replace(/\/?$/, "/") : "";
  const since = Date.parse(sinceIso) / 1000;
  const lookback = since - 7 * 86400;

  type Entry = { channel: { id: string; name: string }; m: SlackMessage; parent?: SlackMessage };
  const entries: Entry[] = [];
  for (const ch of channels) {
    let cursor: string | undefined;
    let pages = 0;
    do {
      const h = await call(token, "conversations.history", { channel: ch.id, oldest: lookback.toFixed(6), limit: 200, cursor });
      for (const m of (h.messages as SlackMessage[] | undefined) ?? []) {
        if (skip(m)) continue;
        if (Number(m.ts) >= since) entries.push({ channel: ch, m });
        if ((m.reply_count ?? 0) > 0 && Number(m.latest_reply ?? 0) >= since) {
          const r = await call(token, "conversations.replies", { channel: ch.id, ts: m.ts, oldest: since.toFixed(6), limit: 200 });
          for (const reply of (r.messages as SlackMessage[] | undefined) ?? []) {
            if (reply.ts === m.ts || skip(reply) || Number(reply.ts) < since) continue;
            entries.push({ channel: ch, m: reply, parent: m });
          }
        }
      }
      cursor = h.response_metadata?.next_cursor || undefined;
      pages++;
    } while (cursor && pages < 5);
  }

  // Namen auflösen (Autoren, Erwähnungen, Thread-Eröffner), jeden nur einmal
  const users = new Map<string, string>();
  const wanted = new Set<string>();
  for (const e of entries) {
    for (const x of [e.m, e.parent]) {
      if (!x) continue;
      if (x.user) wanted.add(x.user);
      for (const mention of (x.text ?? "").matchAll(/<@([A-Z0-9]+)/g)) wanted.add(mention[1]);
    }
  }
  for (const id of wanted) users.set(id, await userName(token, id));
  const nameOf = (m: SlackMessage) => (m.user ? users.get(m.user) ?? m.user : m.username ?? "");

  return entries.map(({ channel, m, parent }) => {
    const digits = m.ts.replace(".", "");
    const url = base ? `${base}archives/${channel.id}/p${digits}${parent ? `?thread_ts=${parent.ts}&cid=${channel.id}` : ""}` : null;
    return {
      externalId: `${channel.id}:${m.ts}`,
      channel: `#${channel.name}`,
      author: nameOf(m),
      postedAt: new Date(Number(m.ts) * 1000).toISOString(),
      body: body(m, users),
      url,
      threadId: parent ? parent.ts : (m.reply_count ?? 0) > 0 ? m.ts : null,
      context: parent ? `Antwort im Thread von ${nameOf(parent)}: ${body(parent, users).slice(0, 240)}` : ""
    };
  });
}
