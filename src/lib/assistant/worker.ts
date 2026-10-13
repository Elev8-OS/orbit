import { exclusive } from "@/lib/platform/scheduler";
import * as store from "./store";
import * as graph from "./graph";
import { needsReconnect, refresh } from "./oauth";
import { replyHtml, ruleSkip, triage } from "./brain";
import { notifySafe } from "@/lib/push/service";
import { pushText } from "@/lib/push/texts";

/**
 * Ein Lauf des E-Mail-Assistenten für eine Person:
 * neue Mails im Posteingang holen, Offensichtliches per Regel überspringen, den Rest von Claude einordnen lassen
 * und für "reply" einen Allen-antworten-Entwurf in Outlook anlegen. Gesendet wird nie etwas.
 */
const LOOKBACK_HOURS = () => Math.max(1, Number(process.env.ASSISTENT_LOOKBACK_HOURS) || 48);
const BATCH = () => Math.max(1, Number(process.env.ASSISTENT_BATCH) || 10);

const tokens = new Map<string, { value: string; expires: number }>();

async function accessToken(userId: string): Promise<string> {
  const cached = tokens.get(userId);
  if (cached && cached.expires > Date.now() + 60_000) return cached.value;
  const rt = await store.refreshTokenOf(userId);
  if (!rt) throw new Error("Postfach nicht verbunden");
  const t = await refresh(rt);
  if (t.refreshToken && t.refreshToken !== rt) await store.storeRefreshToken(userId, t.refreshToken);
  tokens.set(userId, { value: t.accessToken, expires: Date.now() + t.expiresIn * 1000 });
  return t.accessToken;
}

const addr = (a: { emailAddress?: { name?: string; address?: string } } | null | undefined) => (a?.emailAddress?.address ?? "").toLowerCase();
const fmt = (list: { emailAddress?: { name?: string; address?: string } }[]) =>
  list.map((a) => (a.emailAddress?.name ? `${a.emailAddress.name} <${a.emailAddress.address}>` : a.emailAddress?.address ?? "")).filter(Boolean);

export type RunResult = { checked: number; drafted: number; info: number; skipped: number; errors: number; error?: string };

/** Läuft höchstens einmal gleichzeitig pro Person (auch über mehrere Server hinweg). */
export async function runForUser(userId: string): Promise<RunResult> {
  let outcome: RunResult | null = null;
  const ran = await exclusive(`assistant:${userId}`, async () => {
    outcome = await runLocked(userId);
  });
  if (!ran) return { checked: 0, drafted: 0, info: 0, skipped: 0, errors: 0, error: "läuft bereits" };
  return outcome ?? { checked: 0, drafted: 0, info: 0, skipped: 0, errors: 0, error: "Fehler" };
}

async function runLocked(userId: string): Promise<RunResult> {
  const result: RunResult = { checked: 0, drafted: 0, info: 0, skipped: 0, errors: 0 };
  try {
    const account = await store.getAccount(userId);
    if (!account || !account.enabled) return result;
    let token: string;
    try {
      token = await accessToken(userId);
    } catch (err) {
      const msg = needsReconnect(err) ? "reconnect" : err instanceof Error ? err.message : "Anmeldung fehlgeschlagen";
      await store.markRun(userId, msg);
      return { ...result, error: msg };
    }

    const since = new Date(Math.max(Date.now() - LOOKBACK_HOURS() * 3_600_000, Date.parse(account.connectedAt) - 24 * 3_600_000));
    const inbox = (await graph.inboxSince(token, since)).filter((m) => !m.isDraft);
    const known = await store.knownMessageIds(userId, inbox.map((m) => m.id));
    const fresh = inbox.filter((m) => !known.has(m.id)).reverse(); // älteste zuerst
    let claudeCalls = 0;
    let urgentDrafts = 0;

    for (const m of fresh) {
      const fromAddress = addr(m.from);
      const base = {
        messageId: m.id,
        conversationId: m.conversationId,
        subject: m.subject ?? "",
        fromName: m.from?.emailAddress?.name ?? fromAddress,
        fromAddress,
        receivedAt: m.receivedDateTime,
        webLink: m.webLink,
        draftId: null,
        draftLink: null,
        draftPreview: "",
        error: null
      };
      const rule = ruleSkip({ fromAddress, ownerEmail: account.email, classification: m.inferenceClassification, skipSenders: account.skipSenders });
      if (rule) {
        await store.saveItem(userId, { ...base, decision: "skip", priority: "low", summary: m.bodyPreview.slice(0, 200), reason: rule, status: "open" });
        result.skipped++;
        continue;
      }
      if (claudeCalls >= BATCH()) break; // Rest beim nächsten Lauf
      claudeCalls++;
      result.checked++;
      try {
        const body = await graph.messageText(token, m.id).catch(() => m.bodyPreview);
        const d = await triage(
          {
            ownerName: account.name || account.email,
            ownerEmail: account.email,
            locale: account.locale,
            styleNotes: account.styleNotes,
            fromName: base.fromName,
            fromAddress,
            to: fmt(m.toRecipients ?? []),
            cc: fmt(m.ccRecipients ?? []),
            subject: base.subject,
            received: m.receivedDateTime,
            body
          },
          process.env.ASSISTENT_MODEL || undefined
        );
        let draft: graph.Draft | null = null;
        if (d.decision === "reply") {
          draft = await graph.createReplyAllDraft(token, m.id, replyHtml(d.reply, account.signature));
          result.drafted++;
          if (d.priority === "high") urgentDrafts++;
        } else if (d.decision === "info") result.info++;
        else result.skipped++;
        await store.saveItem(userId, {
          ...base,
          decision: d.decision,
          priority: d.priority,
          summary: d.summary,
          reason: d.reason,
          draftId: draft?.id ?? null,
          draftLink: draft?.webLink ?? null,
          draftPreview: d.decision === "reply" ? d.reply.slice(0, 1500) : "",
          status: "open"
        });
      } catch (err) {
        result.errors++;
        console.error("Assistent: Mail nicht verarbeitet:", err);
        await store.saveItem(userId, {
          ...base,
          decision: "info",
          priority: "normal",
          summary: m.bodyPreview.slice(0, 200),
          reason: "",
          status: "error",
          error: err instanceof Error ? err.message.slice(0, 300) : "Fehler"
        });
      }
    }
    await store.markRun(userId, null);
    if (result.drafted) {
      await notifySafe([userId], "assistant", (prefs) => {
        const t = pushText(prefs.locale);
        return { title: t.newDrafts(result.drafted, urgentDrafts), body: t.draftsBody, url: "/?app=assistent", tag: "assistant" };
      }, { urgency: urgentDrafts ? "high" : "normal" });
    }
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 300) : "Fehler";
    await store.markRun(userId, msg).catch(() => {});
    return { ...result, error: msg };
  }
}

/** Entwürfe, die in Outlook gesendet oder gelöscht wurden, als erledigt markieren. */
export async function syncDrafts(userId: string): Promise<void> {
  const open = (await store.listItems(userId, "open", 30)).filter((i) => i.draftId && i.status === "open");
  if (!open.length) return;
  const token = await accessToken(userId);
  for (const item of open) {
    if (!(await graph.draftExists(token, item.draftId!).catch(() => true))) await store.setItemStatus(userId, item.id, "done");
  }
}

export async function discardDraft(userId: string, itemId: number): Promise<void> {
  const item = await store.getItem(userId, itemId);
  if (!item) return;
  if (item.draftId) await graph.deleteDraft(await accessToken(userId), item.draftId);
  await store.setItemStatus(userId, itemId, "discarded");
}

export async function runAll(): Promise<void> {
  for (const { userId } of await store.activeAccounts()) {
    const r = await runForUser(userId).catch((err) => ({ error: String(err) }) as RunResult);
    if (r.error && r.error !== "läuft bereits") console.warn(`Assistent ${userId}: ${r.error}`);
  }
}

export function forgetToken(userId: string) {
  tokens.delete(userId);
}
