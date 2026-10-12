"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, Search, Sparkles, X } from "lucide-react";
import { post, useFormat } from "./shared";

export type FollowUpTarget = {
  meetingId?: string;
  contactId: string | null;
  contactLabel: string;
  callTitle?: string;
};

type Suggestion = { title: string; body: string; dueDate: string; basis: string; agreed: boolean };
type FoundContact = { id: string; name: string; company: string; email: string };

export function FollowUpDialog({ target, onClose, onCreated }: { target: FollowUpTarget; onClose: () => void; onCreated: () => void }) {
  const t = useTranslations("sales.dialog");
  const ref = useRef<HTMLDialogElement>(null);
  const f = useFormat("de");
  const [contact, setContact] = useState<{ id: string; label: string } | null>(
    target.contactId ? { id: target.contactId, label: target.contactLabel } : null
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueDate, setDueDate] = useState(() => f.workdays(3));
  const [noteFromCall, setNoteFromCall] = useState(true);
  const [basis, setBasis] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "suggesting" | "saving">(target.meetingId ? "suggesting" : "idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const suggest = async (refresh = false) => {
    if (!target.meetingId) return;
    setState("suggesting");
    setError(null);
    const { ok, data } = await post<{ suggestion?: Suggestion }>(`/api/sales/calls/${encodeURIComponent(target.meetingId)}`, {
      action: "suggest",
      refresh
    });
    if (ok && data.suggestion) {
      setTitle(data.suggestion.title);
      setBody(data.suggestion.body);
      setDueDate(data.suggestion.dueDate);
      setBasis(data.suggestion.basis);
    } else {
      setError(data.error === "claude_not_configured" ? t("noClaude") : t("suggestFailed"));
    }
    setState("idle");
  };

  useEffect(() => {
    void suggest(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact || !title.trim()) return;
    setState("saving");
    setError(null);
    const { ok, data } = await post("/api/sales/tasks", {
      contactId: contact.id,
      title: title.trim(),
      body,
      dueDate,
      meetingId: target.meetingId ?? null,
      noteFromCall: Boolean(target.meetingId) && noteFromCall
    });
    if (ok) {
      onCreated();
      ref.current?.close();
      return;
    }
    setState("idle");
    setError(data.error === "forbidden" ? t("forbidden") : t("saveFailed", { detail: data.detail ?? data.error ?? "" }));
  };

  const quick: { label: string; value: string }[] = [
    { label: t("due.tomorrow"), value: f.workdays(1) },
    { label: t("due.three"), value: f.workdays(3) },
    { label: t("due.monday"), value: f.nextMonday() },
    { label: t("due.twoWeeks"), value: f.workdays(10) }
  ];

  return (
    <dialog ref={ref} className="sl-dialog" onClose={onClose} aria-labelledby="sl-dialog-title">
      <form onSubmit={submit} className="sl-dialog-form">
        <header className="sl-dialog-head">
          <div>
            <h2 id="sl-dialog-title">{t("title")}</h2>
            {target.callTitle && <p className="sl-muted">{t("afterCall", { title: target.callTitle })}</p>}
          </div>
          <button type="button" className="sl-icon-button" onClick={() => ref.current?.close()} aria-label={t("close")}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {state === "suggesting" ? (
          <div className="sl-suggesting" role="status">
            <Sparkles size={18} aria-hidden="true" />
            {t("suggesting")}
          </div>
        ) : (
          <>
            {basis && (
              <p className="sl-basis">
                <Sparkles size={14} aria-hidden="true" />
                <span>{basis}</span>
                <button type="button" className="sl-link-button" onClick={() => suggest(true)}>
                  <RefreshCw size={13} aria-hidden="true" />
                  {t("again")}
                </button>
              </p>
            )}

            <div className="sl-field">
              <span className="sl-label">{t("contact")}</span>
              {contact ? (
                <div className="sl-contact-chosen">
                  <span>{contact.label}</span>
                  {!target.contactId && (
                    <button type="button" className="sl-link-button" onClick={() => setContact(null)}>
                      {t("change")}
                    </button>
                  )}
                </div>
              ) : (
                <ContactSearch onPick={(c) => setContact({ id: c.id, label: [c.name, c.company].filter(Boolean).join(", ") || c.email })} />
              )}
            </div>

            <label className="sl-field">
              <span className="sl-label">{t("taskTitle")}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
            </label>

            <label className="sl-field">
              <span className="sl-label">{t("body")}</span>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={4000} />
            </label>

            <div className="sl-field">
              <label className="sl-label" htmlFor="sl-due">
                {t("dueDate")}
              </label>
              <div className="sl-due-row">
                <input id="sl-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
                <div className="sl-quick">
                  {quick.map((q) => (
                    <button key={q.label} type="button" className="sl-quick-chip" aria-pressed={dueDate === q.value} onClick={() => setDueDate(q.value)}>
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {target.meetingId && (
              <label className="sl-check">
                <input type="checkbox" checked={noteFromCall} onChange={(e) => setNoteFromCall(e.target.checked)} />
                {t("noteFromCall")}
              </label>
            )}
          </>
        )}

        {error && (
          <p className="sl-error" role="alert">
            {error}
          </p>
        )}

        <footer className="sl-dialog-foot">
          <p className="sl-muted">{t("hint")}</p>
          <div className="sl-dialog-actions">
            <button type="button" className="button-secondary" onClick={() => ref.current?.close()}>
              {t("cancel")}
            </button>
            <button type="submit" className="button-yellow" disabled={state !== "idle" || !contact || !title.trim()}>
              {state === "saving" ? t("saving") : t("create")}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}

function ContactSearch({ onPick }: { onPick: (c: FoundContact) => void }) {
  const t = useTranslations("sales.dialog");
  const [q, setQ] = useState("");
  const [list, setList] = useState<FoundContact[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) {
      setList([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      const res = await fetch(`/api/sales/contacts?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as { contacts?: FoundContact[] } | null;
      setList(data?.contacts ?? []);
      setBusy(false);
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);
  return (
    <div className="sl-search">
      <div className="sl-search-input">
        <Search size={16} aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchContact")} aria-label={t("searchContact")} />
      </div>
      {q.trim().length >= 2 && (
        <ul className="sl-search-list">
          {list.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onPick(c)}>
                <strong>{c.name || c.email}</strong>
                <span>{[c.company, c.email].filter(Boolean).join(", ")}</span>
              </button>
            </li>
          ))}
          {!busy && list.length === 0 && <li className="sl-muted sl-search-empty">{t("noContacts")}</li>}
        </ul>
      )}
    </div>
  );
}
