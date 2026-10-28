/** Microsoft Graph mit dem Token der Person: nur ihr eigenes Postfach. */
const GRAPH = "https://graph.microsoft.com/v1.0";

export class GraphError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function graph<T>(token: string, path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const { prefer, ...rest } = init;
  const res = await fetch(`${GRAPH}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
      ...(rest.headers ?? {})
    },
    signal: AbortSignal.timeout(20_000)
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new GraphError(res.status, `Graph ${res.status}: ${json.error?.message ?? "Fehler"}`);
  return json;
}

export type Me = { id: string; mail: string | null; userPrincipalName: string; displayName: string };
export const me = (token: string) => graph<Me>(token, "/me?$select=id,mail,userPrincipalName,displayName");

type Address = { emailAddress?: { name?: string; address?: string } };
export type InboxMessage = {
  id: string;
  conversationId: string | null;
  subject: string | null;
  from: Address | null;
  toRecipients: Address[];
  ccRecipients: Address[];
  receivedDateTime: string;
  bodyPreview: string;
  webLink: string | null;
  inferenceClassification: "focused" | "other" | null;
  isDraft: boolean;
};

export async function inboxSince(token: string, since: Date, top = 40): Promise<InboxMessage[]> {
  const params = new URLSearchParams({
    $filter: `receivedDateTime ge ${since.toISOString()}`,
    $orderby: "receivedDateTime desc",
    $top: String(top),
    $select: "id,conversationId,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,webLink,inferenceClassification,isDraft"
  });
  const res = await graph<{ value: InboxMessage[] }>(token, `/me/mailFolders/inbox/messages?${params}`);
  return res.value;
}

/** Nur der neue Teil der Nachricht (ohne zitierten Verlauf), als Text. */
export async function messageText(token: string, id: string): Promise<string> {
  const res = await graph<{ uniqueBody?: { content?: string }; body?: { content?: string } }>(
    token,
    `/me/messages/${encodeURIComponent(id)}?$select=uniqueBody,body`,
    { prefer: 'outlook.body-content-type="text"' }
  );
  return (res.uniqueBody?.content || res.body?.content || "").trim();
}

export type Draft = { id: string; webLink: string | null; body: { contentType: string; content: string } };

/** Allen-antworten-Entwurf im Thread anlegen und den Text vor den zitierten Verlauf setzen. */
export async function createReplyAllDraft(token: string, messageId: string, replyHtml: string): Promise<Draft> {
  const draft = await graph<Draft>(token, `/me/messages/${encodeURIComponent(messageId)}/createReplyAll`, {
    method: "POST",
    body: JSON.stringify({})
  });
  const content = `<div>${replyHtml}</div>${draft.body?.content ?? ""}`;
  return graph<Draft>(token, `/me/messages/${encodeURIComponent(draft.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ body: { contentType: "HTML", content } })
  });
}

/** Gibt es den Entwurf noch? false = gesendet oder gelöscht. */
export async function draftExists(token: string, draftId: string): Promise<boolean> {
  try {
    const res = await graph<{ isDraft: boolean }>(token, `/me/messages/${encodeURIComponent(draftId)}?$select=isDraft`);
    return res.isDraft;
  } catch (err) {
    if (err instanceof GraphError && err.status === 404) return false;
    throw err;
  }
}

export async function deleteDraft(token: string, draftId: string): Promise<void> {
  try {
    await graph(token, `/me/messages/${encodeURIComponent(draftId)}`, { method: "DELETE" });
  } catch (err) {
    if (!(err instanceof GraphError && err.status === 404)) throw err;
  }
}

export type DraftState = { id: string; isDraft: boolean; webLink: string | null; body: { contentType: string; content: string } };

/** Entwurf mit seinem aktuellen HTML-Text lesen (für die Bearbeitung in Orbit). */
export const getDraft = (token: string, draftId: string) =>
  graph<DraftState>(token, `/me/messages/${encodeURIComponent(draftId)}?$select=id,isDraft,webLink,body`);

/** Nur den Text eines bestehenden Entwurfs ersetzen. Empfänger, Betreff und Anhänge bleiben. */
export async function setDraftHtml(token: string, draftId: string, html: string): Promise<void> {
  await graph(token, `/me/messages/${encodeURIComponent(draftId)}`, {
    method: "PATCH",
    body: JSON.stringify({ body: { contentType: "HTML", content: html } })
  });
}
