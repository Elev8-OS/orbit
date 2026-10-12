import { sql } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/platform/crypto";

export type Account = {
  userId: string;
  email: string;
  name: string | null;
  enabled: boolean;
  locale: "de" | "en";
  styleNotes: string;
  signature: string;
  skipSenders: string;
  connectedAt: string;
  lastRunAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
};

type AccountRow = {
  user_id: string;
  email: string;
  name: string | null;
  enabled: boolean;
  refresh_token: string;
  locale: string;
  style_notes: string;
  signature: string;
  skip_senders: string;
  connected_at: Date;
  last_run_at: Date | null;
  last_error: string | null;
  last_error_at: Date | null;
};

const toAccount = (r: AccountRow): Account => ({
  userId: r.user_id,
  email: r.email,
  name: r.name,
  enabled: r.enabled,
  locale: r.locale === "en" ? "en" : "de",
  styleNotes: r.style_notes,
  signature: r.signature,
  skipSenders: r.skip_senders,
  connectedAt: r.connected_at.toISOString(),
  lastRunAt: r.last_run_at?.toISOString() ?? null,
  lastError: r.last_error,
  lastErrorAt: r.last_error_at?.toISOString() ?? null
});

export async function getAccount(userId: string): Promise<Account | null> {
  const [row] = await sql<AccountRow[]>`SELECT * FROM assistant_accounts WHERE user_id = ${userId}`;
  return row ? toAccount(row) : null;
}

export async function saveConnection(input: { userId: string; email: string; name: string | null; refreshToken: string; locale: "de" | "en" }) {
  await sql`
    INSERT INTO assistant_accounts (user_id, email, name, refresh_token, locale)
    VALUES (${input.userId}, ${input.email}, ${input.name}, ${encrypt(input.refreshToken)}, ${input.locale})
    ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, refresh_token = EXCLUDED.refresh_token,
      enabled = true, connected_at = now(), last_error = NULL, last_error_at = NULL`;
}

export async function refreshTokenOf(userId: string): Promise<string | null> {
  const [row] = await sql<{ refresh_token: string }[]>`SELECT refresh_token FROM assistant_accounts WHERE user_id = ${userId}`;
  return row ? decrypt(row.refresh_token) : null;
}

export async function storeRefreshToken(userId: string, token: string) {
  await sql`UPDATE assistant_accounts SET refresh_token = ${encrypt(token)} WHERE user_id = ${userId}`;
}

export async function updateSettings(
  userId: string,
  patch: Partial<Pick<Account, "enabled" | "styleNotes" | "signature" | "skipSenders" | "locale">>
) {
  const current = await getAccount(userId);
  if (!current) return null;
  const next = { ...current, ...patch };
  await sql`
    UPDATE assistant_accounts SET enabled = ${next.enabled}, style_notes = ${next.styleNotes}, signature = ${next.signature},
      skip_senders = ${next.skipSenders}, locale = ${next.locale}
    WHERE user_id = ${userId}`;
  return getAccount(userId);
}

export async function markRun(userId: string, error: string | null) {
  if (error) await sql`UPDATE assistant_accounts SET last_run_at = now(), last_error = ${error}, last_error_at = now() WHERE user_id = ${userId}`;
  else await sql`UPDATE assistant_accounts SET last_run_at = now(), last_error = NULL, last_error_at = NULL WHERE user_id = ${userId}`;
}

export async function disconnect(userId: string) {
  await sql`DELETE FROM assistant_accounts WHERE user_id = ${userId}`;
}

export async function activeAccounts(): Promise<{ userId: string }[]> {
  const rows = await sql<{ user_id: string }[]>`SELECT user_id FROM assistant_accounts WHERE enabled ORDER BY last_run_at NULLS FIRST`;
  return rows.map((r) => ({ userId: r.user_id }));
}

// ── Einträge ────────────────────────────────────────────────

export type ItemStatus = "open" | "done" | "discarded" | "error";
export type Item = {
  id: number;
  messageId: string;
  subject: string;
  fromName: string;
  fromAddress: string;
  receivedAt: string | null;
  webLink: string | null;
  decision: "reply" | "info" | "skip";
  priority: "high" | "normal" | "low";
  summary: string;
  reason: string;
  draftId: string | null;
  draftLink: string | null;
  draftPreview: string;
  status: ItemStatus;
  error: string | null;
  createdAt: string;
};

type ItemRow = {
  id: string;
  message_id: string;
  subject: string | null;
  from_name: string | null;
  from_address: string | null;
  received_at: Date | null;
  web_link: string | null;
  decision: Item["decision"];
  priority: Item["priority"];
  summary: string | null;
  reason: string | null;
  draft_id: string | null;
  draft_link: string | null;
  draft_preview: string | null;
  status: ItemStatus;
  error: string | null;
  created_at: Date;
};

const toItem = (r: ItemRow): Item => ({
  id: Number(r.id),
  messageId: r.message_id,
  subject: r.subject ?? "",
  fromName: r.from_name ?? "",
  fromAddress: r.from_address ?? "",
  receivedAt: r.received_at?.toISOString() ?? null,
  webLink: r.web_link,
  decision: r.decision,
  priority: r.priority,
  summary: r.summary ?? "",
  reason: r.reason ?? "",
  draftId: r.draft_id,
  draftLink: r.draft_link,
  draftPreview: r.draft_preview ?? "",
  status: r.status,
  error: r.error,
  createdAt: r.created_at.toISOString()
});

export async function knownMessageIds(userId: string, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await sql<{ message_id: string }[]>`SELECT message_id FROM assistant_items WHERE user_id = ${userId} AND message_id = ANY(${ids})`;
  return new Set(rows.map((r) => r.message_id));
}

export async function saveItem(userId: string, item: Omit<Item, "id" | "createdAt"> & { conversationId: string | null }) {
  await sql`
    INSERT INTO assistant_items (user_id, message_id, conversation_id, subject, from_name, from_address, received_at, web_link,
      decision, priority, summary, reason, draft_id, draft_link, draft_preview, status, error)
    VALUES (${userId}, ${item.messageId}, ${item.conversationId}, ${item.subject}, ${item.fromName}, ${item.fromAddress},
      ${item.receivedAt}, ${item.webLink}, ${item.decision}, ${item.priority}, ${item.summary}, ${item.reason},
      ${item.draftId}, ${item.draftLink}, ${item.draftPreview}, ${item.status}, ${item.error})
    ON CONFLICT (user_id, message_id) DO NOTHING`;
}

export async function listItems(userId: string, filter: "open" | "info" | "skip" | "done", limit = 100): Promise<Item[]> {
  const rows =
    filter === "open"
      ? await sql<ItemRow[]>`SELECT * FROM assistant_items WHERE user_id = ${userId} AND decision = 'reply' AND status IN ('open', 'error')
          ORDER BY (priority = 'high') DESC, received_at DESC NULLS LAST LIMIT ${limit}`
      : filter === "done"
        ? await sql<ItemRow[]>`SELECT * FROM assistant_items WHERE user_id = ${userId} AND status IN ('done', 'discarded')
            ORDER BY updated_at DESC LIMIT ${limit}`
        : await sql<ItemRow[]>`SELECT * FROM assistant_items WHERE user_id = ${userId} AND decision = ${filter} AND status = 'open'
            ORDER BY received_at DESC NULLS LAST LIMIT ${limit}`;
  return rows.map(toItem);
}

export async function getItem(userId: string, id: number): Promise<Item | null> {
  const [row] = await sql<ItemRow[]>`SELECT * FROM assistant_items WHERE user_id = ${userId} AND id = ${id}`;
  return row ? toItem(row) : null;
}

export async function setItemStatus(userId: string, id: number, status: ItemStatus) {
  await sql`UPDATE assistant_items SET status = ${status}, updated_at = now() WHERE user_id = ${userId} AND id = ${id}`;
}

export async function counts(userId: string): Promise<{ open: number; high: number; info: number }> {
  const [row] = await sql<{ open: number; high: number; info: number }[]>`
    SELECT count(*) FILTER (WHERE decision = 'reply' AND status = 'open')::int AS open,
           count(*) FILTER (WHERE decision = 'reply' AND status = 'open' AND priority = 'high')::int AS high,
           count(*) FILTER (WHERE decision = 'info' AND status = 'open')::int AS info
    FROM assistant_items WHERE user_id = ${userId}`;
  return row ?? { open: 0, high: 0, info: 0 };
}

export async function searchItems(userId: string, q: string, limit = 5): Promise<Item[]> {
  const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  const rows = await sql<ItemRow[]>`
    SELECT * FROM assistant_items WHERE user_id = ${userId} AND decision <> 'skip'
      AND (subject ILIKE ${like} OR from_name ILIKE ${like} OR from_address ILIKE ${like} OR summary ILIKE ${like})
    ORDER BY received_at DESC NULLS LAST LIMIT ${limit}`;
  return rows.map(toItem);
}
