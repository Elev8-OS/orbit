"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ExternalLink, FilePen, Mail, Phone, Plus } from "lucide-react";
import type { ContactView } from "@/lib/sales/service";
import { FollowUpDialog } from "./FollowUpDialog";
import { ToastProvider, formatMoney, post, useFormat, useToast, type Locale } from "./shared";

type Props = { view: ContactView; locale: Locale; currency: string; canOffer: boolean; viewerGhlId: string };

export function ContactPage(props: Props) {
  return (
    <ToastProvider>
      <Contact {...props} />
    </ToastProvider>
  );
}

function Contact({ view, locale, currency, canOffer }: Props) {
  const t = useTranslations("sales.contact");
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState(false);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());
  const { contact } = view;
  const f = useFormat(locale);

  const openTasks = view.tasks.filter((x) => !x.completed && !done.has(x.id));
  const now = Date.now();
  const upcoming = view.events.filter((e) => Date.parse(e.start) > now).reverse();
  const past = view.events.filter((e) => Date.parse(e.start) <= now).slice(0, 5);

  const complete = async (taskId: string) => {
    setDone((s) => new Set(s).add(taskId));
    const { ok } = await post(`/api/sales/tasks/${encodeURIComponent(taskId)}`, { action: "complete", contactId: contact.id });
    if (!ok) {
      setDone((s) => {
        const n = new Set(s);
        n.delete(taskId);
        return n;
      });
      toast({ text: t("failed"), tone: "error" });
    }
  };

  const saveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSavingNote(true);
    const { ok } = await post("/api/sales/notes", { contactId: contact.id, body: note.trim() });
    setSavingNote(false);
    if (ok) {
      setNote("");
      toast({ text: t("noteSaved"), tone: "ok" });
      router.refresh();
    } else toast({ text: t("failed"), tone: "error" });
  };

  const moveStage = async (oppId: string, stageId: string) => {
    const { ok } = await post(`/api/sales/opportunities/${encodeURIComponent(oppId)}`, { stageId });
    toast(ok ? { text: t("stageSaved"), tone: "ok" } : { text: t("failed"), tone: "error" });
    if (ok) router.refresh();
  };

  const startOffer = async () => {
    const res = await fetch("/api/offerten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ghlContactId: contact.id })
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { id?: string } | null;
    if (json?.id) window.location.href = `/offerten/${json.id}`;
    else toast({ text: t("failed"), tone: "error" });
  };

  return (
    <div className="sl-contact">
      <header className="sl-contact-head">
        <div>
          <h1>{contact.company || contact.name || contact.email}</h1>
          {contact.company && contact.name && <p className="sl-hero-line">{contact.name}</p>}
          <p className="sl-contact-links">
            {contact.email && (
              <a href={`mailto:${contact.email}`}>
                <Mail size={14} aria-hidden="true" />
                {contact.email}
              </a>
            )}
            {contact.phone && (
              <a href={`tel:${contact.phone}`}>
                <Phone size={14} aria-hidden="true" />
                {contact.phone}
              </a>
            )}
          </p>
        </div>
        <div className="sl-actions">
          <button type="button" className="button-yellow sl-small" onClick={() => setDialog(true)}>
            <Plus size={16} aria-hidden="true" />
            {t("newFollowUp")}
          </button>
          {canOffer && (
            <button type="button" className="button-secondary sl-small" onClick={startOffer}>
              <FilePen size={15} aria-hidden="true" />
              {t("newOffer")}
            </button>
          )}
          <a className="button-secondary sl-small" href={view.url} target="_blank" rel="noreferrer">
            {t("openGhl")}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </header>

      <div className="sl-columns">
        <div className="sl-col-main">
          <section className="sl-section" aria-labelledby="sl-c-next">
            <h2 id="sl-c-next">{t("next")}</h2>
            {openTasks.length === 0 && upcoming.length === 0 ? (
              <p className="sl-empty is-warn">{t("noNext")}</p>
            ) : (
              <ul className="sl-list">
                {upcoming.map((e) => (
                  <li key={e.id} className="sl-task">
                    <span className="sl-done is-static" aria-hidden="true" />
                    <div className="sl-task-body">
                      <div className="sl-task-title">{e.title || t("meeting")}</div>
                      <div className="sl-task-meta">
                        <span className="sl-due">
                          {f.date(e.start, true)}, {f.time(e.start)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
                {openTasks.map((x) => (
                  <li key={x.id} className="sl-task">
                    <button type="button" className="sl-done" onClick={() => complete(x.id)} aria-label={t("done", { title: x.title })}>
                      <Check size={15} aria-hidden="true" />
                    </button>
                    <div className="sl-task-body">
                      <div className="sl-task-title">{x.title}</div>
                      <div className="sl-task-meta">
                        <span className={x.dueDate && Date.parse(x.dueDate) < now ? "sl-due is-overdue" : "sl-due"}>
                          {x.dueDate ? f.relativeDay(x.dueDate) : ""}
                        </span>
                      </div>
                      {x.body && <p className="sl-task-text">{x.body}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="sl-section" aria-labelledby="sl-c-calls">
            <h2 id="sl-c-calls">{t("calls")}</h2>
            {view.calls.length === 0 && past.length === 0 ? (
              <p className="sl-empty">{t("noCalls")}</p>
            ) : (
              <ul className="sl-list">
                {view.calls.map((c) => (
                  <li key={c.meetingId} className="sl-call">
                    <div className="sl-call-head">
                      <strong>{c.title}</strong>
                      {c.date && <span className="sl-muted">{f.date(c.date)}</span>}
                    </div>
                    {c.summary && <p className="sl-call-summary is-full">{c.summary}</p>}
                  </li>
                ))}
                {view.calls.length === 0 &&
                  past.map((e) => (
                    <li key={e.id} className="sl-call">
                      <div className="sl-call-head">
                        <strong>{e.title || t("meeting")}</strong>
                        <span className="sl-muted">{f.date(e.start)}</span>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <section className="sl-section" aria-labelledby="sl-c-notes">
            <h2 id="sl-c-notes">{t("notes")}</h2>
            <form onSubmit={saveNote} className="sl-note-form">
              <label className="sl-sr" htmlFor="sl-note">
                {t("notePlaceholder")}
              </label>
              <textarea id="sl-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t("notePlaceholder")} maxLength={5000} />
              <button type="submit" className="button-secondary sl-small" disabled={savingNote || !note.trim()}>
                {t("saveNote")}
              </button>
            </form>
            {view.notes.length > 0 && (
              <ul className="sl-notes">
                {view.notes.map((n) => (
                  <li key={n.id}>
                    {n.date && <span className="sl-muted">{f.date(n.date)}</span>}
                    <p>{n.body.replace(/<[^>]+>/g, " ")}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="sl-col-side">
          <section className="sl-section" aria-labelledby="sl-c-deals">
            <h2 id="sl-c-deals">{t("deals")}</h2>
            {view.opportunities.length === 0 ? (
              <p className="sl-empty">{t("noDeals")}</p>
            ) : (
              <ul className="sl-side-list">
                {view.opportunities.map((o) => (
                  <li key={o.id}>
                    <strong>{o.name}</strong>
                    <span className="sl-muted">
                      {o.pipelineName}
                      {o.value ? `, ${formatMoney(o.value, currency, locale)}` : ""}
                    </span>
                    {o.status === "open" ? (
                      <label>
                        <span className="sl-sr">{t("stage")}</span>
                        <select defaultValue={o.stageId} onChange={(e) => moveStage(o.id, e.target.value)}>
                          {(view.stages[o.pipelineId] ?? []).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <span className="sl-badge">{t(`status.${o.status === "won" ? "won" : o.status === "lost" ? "lost" : "other"}`)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {view.quotes.length > 0 && (
            <section className="sl-section" aria-labelledby="sl-c-quotes">
              <h2 id="sl-c-quotes">{t("quotes")}</h2>
              <ul className="sl-side-list">
                {view.quotes.map((q) => (
                  <li key={q.id}>
                    <a href={`/offerten/${q.id}`}>
                      <strong>{q.number}</strong>
                    </a>
                    <span className="sl-muted">
                      {q.status === "sent" && q.sentAt ? t("quoteSent", { date: f.date(q.sentAt) }) : t("quoteDraft")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {dialog && (
        <FollowUpDialog
          target={{ contactId: contact.id, contactLabel: [contact.name, contact.company].filter(Boolean).join(", ") || contact.email }}
          onClose={() => setDialog(false)}
          onCreated={() => {
            toast({ text: t("created"), tone: "ok" });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
