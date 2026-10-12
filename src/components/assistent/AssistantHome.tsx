"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, ExternalLink, Loader2, RefreshCw, Settings, Trash2, Undo2 } from "lucide-react";
import type { Account, Item } from "@/lib/assistant/store";

type View = "open" | "info" | "skip" | "done";

/** Übersicht des E-Mail-Assistenten: Entwürfe, Infos, Übersprungenes, Erledigtes und Einstellungen. */
export function AssistantHome({
  account,
  items,
  view,
  counts,
  justConnected
}: {
  account: Account;
  items: Item[];
  view: View;
  counts: { open: number; high: number; info: number };
  justConnected: boolean;
}) {
  const t = useTranslations("platform.assistent");
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(justConnected ? t("connectedNow") : null);
  const [busy, setBusy] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const fmt = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "";

  const run = async () => {
    setRunning(true);
    setRunMsg(null);
    try {
      const res = await fetch("/api/assistent/run", { method: "POST" });
      const r = (await res.json()) as { drafted?: number; info?: number; skipped?: number; error?: string };
      setRunMsg(r.error ? (r.error === "reconnect" ? t("reconnectNeeded") : t("runError", { error: r.error })) : t("runDone", { drafted: r.drafted ?? 0, info: r.info ?? 0, skipped: r.skipped ?? 0 }));
      router.refresh();
    } catch {
      setRunMsg(t("runError", { error: "–" }));
    } finally {
      setRunning(false);
    }
  };

  const act = async (id: number, action: "done" | "discard" | "reopen") => {
    if (action === "discard" && !window.confirm(t("confirmDiscard"))) return;
    setBusy(id);
    try {
      await fetch(`/api/assistent/items/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const tabs: { id: View; label: string; count?: number }[] = [
    { id: "open", label: t("tabs.open"), count: counts.open },
    { id: "info", label: t("tabs.info"), count: counts.info },
    { id: "skip", label: t("tabs.skip") },
    { id: "done", label: t("tabs.done") }
  ];

  return (
    <div className="p-page">
      <div className="p-page-head">
        <div>
          <h1 className="p-page-title">{t("title")}</h1>
          <p className="p-page-lead">
            {account.enabled ? t("status.active", { email: account.email }) : t("status.paused", { email: account.email })}
            {account.lastRunAt && ` · ${t("status.lastRun", { time: fmt(account.lastRunAt) })}`}
          </p>
        </div>
        <div className="p-head-actions">
          <button type="button" className="button-ghost" onClick={() => setSettingsOpen((v) => !v)} aria-expanded={settingsOpen}>
            <Settings size={15} aria-hidden="true" />
            {t("settings.title")}
          </button>
          <button type="button" className="p-button-primary" onClick={run} disabled={running}>
            {running ? <Loader2 size={15} className="p-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
            {running ? t("running") : t("runNow")}
          </button>
        </div>
      </div>

      {account.lastError === "reconnect" && (
        <div className="p-banner is-danger" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{t("reconnectNeeded")}</span>
          <button
            type="button"
            className="p-link p-link-strong"
            onClick={() => {
              const target = "/api/assistent/connect";
              if (window.top && window.top !== window) window.top.location.href = target;
              else window.location.href = target;
            }}
          >
            {t("reconnect")}
          </button>
        </div>
      )}
      {account.lastError && account.lastError !== "reconnect" && (
        <div className="p-banner is-warning" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{t("lastError", { error: account.lastError })}</span>
        </div>
      )}
      {runMsg && (
        <p className="p-banner" role="status">
          {runMsg}
        </p>
      )}

      {settingsOpen && <SettingsForm account={account} onSaved={() => router.refresh()} />}

      <nav className="p-tabs" aria-label={t("title")}>
        {tabs.map((tab) => (
          <a key={tab.id} href={`/assistent?ansicht=${tab.id}`} aria-current={view === tab.id ? "page" : undefined}>
            {tab.label}
            {!!tab.count && <span className="p-count">{tab.count}</span>}
          </a>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className="p-empty">{t(`empty.${view}`)}</p>
      ) : (
        <ul className="p-mail-list">
          {items.map((item) => (
            <li key={item.id} className={`p-card p-mail is-${item.priority}${item.status === "error" ? " is-error" : ""}`}>
              <div className="p-mail-head">
                <div className="p-mail-from">
                  <span className="p-mail-subject">{item.subject || t("noSubject")}</span>
                  <span className="p-muted">
                    {item.fromName}
                    {item.fromAddress && item.fromName !== item.fromAddress ? ` <${item.fromAddress}>` : ""} · {fmt(item.receivedAt)}
                  </span>
                </div>
                {item.priority === "high" && <span className="p-status is-high">{t("priority.high")}</span>}
              </div>
              {item.summary && <p className="p-mail-summary">{item.summary}</p>}
              {item.error && <p className="p-error">{t("itemError", { error: item.error })}</p>}
              {item.draftPreview && (
                <details className="p-mail-draft">
                  <summary>{t("draftPreview")}</summary>
                  <p>{item.draftPreview}</p>
                </details>
              )}
              {item.reason && view !== "open" && <p className="p-muted">{t("reason", { reason: item.reason })}</p>}
              <div className="p-mail-actions">
                {item.draftLink && item.status === "open" && (
                  <a className="p-button-primary" href={item.draftLink} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} aria-hidden="true" />
                    {t("openDraft")}
                  </a>
                )}
                {!item.draftLink && item.webLink && (
                  <a className="button-secondary" href={item.webLink} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} aria-hidden="true" />
                    {t("openMail")}
                  </a>
                )}
                {view === "done" ? (
                  <button type="button" className="button-ghost" onClick={() => act(item.id, "reopen")} disabled={busy === item.id}>
                    <Undo2 size={15} aria-hidden="true" />
                    {t("reopen")}
                  </button>
                ) : (
                  <>
                    <button type="button" className="button-secondary" onClick={() => act(item.id, "done")} disabled={busy === item.id}>
                      <Check size={15} aria-hidden="true" />
                      {t("markDone")}
                    </button>
                    {item.draftId && item.status === "open" && (
                      <button type="button" className="button-ghost" onClick={() => act(item.id, "discard")} disabled={busy === item.id}>
                        <Trash2 size={15} aria-hidden="true" />
                        {t("discard")}
                      </button>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SettingsForm({ account, onSaved }: { account: Account; onSaved: () => void }) {
  const t = useTranslations("platform.assistent.settings");
  const [form, setForm] = useState({
    enabled: account.enabled,
    styleNotes: account.styleNotes,
    signature: account.signature,
    skipSenders: account.skipSenders,
    locale: account.locale
  });
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const save = async () => {
    setState("saving");
    const res = await fetch("/api/assistent/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setState(res.ok ? "saved" : "error");
    if (res.ok) onSaved();
  };
  const disconnect = async () => {
    if (!window.confirm(t("confirmDisconnect"))) return;
    await fetch("/api/assistent/disconnect", { method: "POST" });
    onSaved();
  };

  return (
    <section className="p-card p-form" aria-label={t("title")}>
      <label className="p-switch">
        <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
        <span>{t("enabled")}</span>
      </label>
      <label className="p-field">
        <span>{t("style")}</span>
        <textarea rows={4} value={form.styleNotes} onChange={(e) => setForm({ ...form, styleNotes: e.target.value })} placeholder={t("stylePlaceholder")} maxLength={2000} />
      </label>
      <label className="p-field">
        <span>{t("signature")}</span>
        <textarea rows={4} value={form.signature} onChange={(e) => setForm({ ...form, signature: e.target.value })} placeholder={t("signaturePlaceholder")} maxLength={1000} />
      </label>
      <label className="p-field">
        <span>{t("skip")}</span>
        <textarea rows={2} value={form.skipSenders} onChange={(e) => setForm({ ...form, skipSenders: e.target.value })} placeholder={t("skipPlaceholder")} maxLength={2000} />
      </label>
      <label className="p-field">
        <span>{t("language")}</span>
        <select value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value === "en" ? "en" : "de" })}>
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
      </label>
      <div className="p-form-actions">
        <button type="button" className="p-button-primary" onClick={save} disabled={state === "saving"}>
          {state === "saving" ? t("saving") : t("save")}
        </button>
        {state === "saved" && <span className="p-ok">{t("saved")}</span>}
        {state === "error" && <span className="p-error">{t("error")}</span>}
        <button type="button" className="button-ghost p-push-right" onClick={disconnect}>
          {t("disconnect")}
        </button>
      </div>
    </section>
  );
}
