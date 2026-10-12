"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ExternalLink, FilePen, Video } from "lucide-react";
import type { TodayData } from "@/lib/sales/service";
import { FollowUpDialog, type FollowUpTarget } from "./FollowUpDialog";
import { ToastProvider, formatMoney, post, useFormat, useToast, type Locale } from "./shared";

type Props = {
  data: TodayData;
  locale: Locale;
  currency: string;
  canOffer: boolean;
  staleDays: number;
};

export function TodayView(props: Props) {
  return (
    <ToastProvider>
      <Today {...props} />
    </ToastProvider>
  );
}

function Today({ data, locale, currency, canOffer, staleDays }: Props) {
  const t = useTranslations("sales.today");
  const router = useRouter();
  const toast = useToast();
  const f = useFormat(locale);
  const [hiddenCalls, setHiddenCalls] = useState<Set<string>>(new Set());
  const [doneTasks, setDoneTasks] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<FollowUpTarget | null>(null);

  const calls = data.calls.filter((c) => !hiddenCalls.has(c.meetingId));
  const tasks = data.tasks.filter((x) => !doneTasks.has(x.id));
  const due = tasks.filter((x) => x.bucket !== "soon");
  const soon = tasks.filter((x) => x.bucket === "soon");
  const todayEvents = data.events.filter((e) => e.day === "today");
  const tomorrowEvents = data.events.filter((e) => e.day === "tomorrow");
  const upcomingToday = todayEvents.filter((e) => Date.parse(e.end || e.start) > Date.now());

  const dismiss = async (meetingId: string) => {
    setHiddenCalls((s) => new Set(s).add(meetingId));
    const { ok } = await post(`/api/sales/calls/${encodeURIComponent(meetingId)}`, { action: "dismiss" });
    if (!ok) {
      setHiddenCalls((s) => {
        const n = new Set(s);
        n.delete(meetingId);
        return n;
      });
      toast({ text: t("failed"), tone: "error" });
      return;
    }
    toast({
      text: t("dismissed"),
      tone: "ok",
      action: {
        label: t("undo"),
        run: async () => {
          await post(`/api/sales/calls/${encodeURIComponent(meetingId)}`, { action: "restore" });
          setHiddenCalls((s) => {
            const n = new Set(s);
            n.delete(meetingId);
            return n;
          });
        }
      }
    });
  };

  const complete = async (taskId: string, contactId: string) => {
    setDoneTasks((s) => new Set(s).add(taskId));
    const { ok } = await post(`/api/sales/tasks/${encodeURIComponent(taskId)}`, { action: "complete", contactId });
    if (!ok) {
      setDoneTasks((s) => {
        const n = new Set(s);
        n.delete(taskId);
        return n;
      });
      toast({ text: t("failed"), tone: "error" });
    } else toast({ text: t("completed"), tone: "ok" });
  };

  const reschedule = async (taskId: string, contactId: string, dueDate: string) => {
    const { ok } = await post(`/api/sales/tasks/${encodeURIComponent(taskId)}`, { action: "reschedule", contactId, dueDate });
    toast(ok ? { text: t("rescheduled", { date: f.date(dueDate, true) }), tone: "ok" } : { text: t("failed"), tone: "error" });
    if (ok) router.refresh();
  };

  const startOffer = async (meetingId: string) => {
    const res = await fetch("/api/offerten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId })
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { id?: string } | null;
    if (json?.id) window.location.href = `/offerten/${json.id}`;
    else toast({ text: t("failed"), tone: "error" });
  };

  const overdue = due.filter((x) => x.bucket === "overdue").length;
  const summary = [
    t("summary.events", { count: upcomingToday.length }),
    t("summary.tasks", { count: due.length }),
    calls.length ? t("summary.calls", { count: calls.length }) : null
  ].filter(Boolean);

  return (
    <div className="sl-today">
      <header className="sl-hero">
        <h1>{f.longToday()}</h1>
        <p className="sl-hero-line">{summary.join(" ")}</p>
        <a href="/sales/pipeline" className="sl-hero-pipeline">
          {t("pipeline", { count: data.pipeline.open, value: formatMoney(data.pipeline.value, currency, locale) })}
          {data.pipeline.stale > 0 && <span className="sl-stale-note">{t("stale", { count: data.pipeline.stale, days: staleDays })}</span>}
        </a>
        {data.errors.length > 0 && (
          <p className="sl-error" role="alert">
            {t("partial", { parts: data.errors.map((e) => t(`parts.${e}`)).join(", ") })}
          </p>
        )}
      </header>

      <div className="sl-columns">
        <div className="sl-col-main">
          {calls.length > 0 && (
            <section className="sl-section sl-open-calls" aria-labelledby="sl-open-calls">
              <h2 id="sl-open-calls">{t("calls.title")}</h2>
              <p className="sl-section-lead">{t("calls.lead")}</p>
              <ul className="sl-list">
                {calls.map((c) => {
                  const who = [c.contactName, c.company].filter(Boolean).join(", ");
                  return (
                    <li key={c.meetingId} className="sl-call">
                      <div className="sl-call-head">
                        <strong>{who || c.title}</strong>
                        {c.date && <span className="sl-muted">{f.relativeDay(c.date)}</span>}
                      </div>
                      {who && <p className="sl-call-title">{c.title}</p>}
                      {c.summary && <p className="sl-call-summary">{c.summary}</p>}
                      <div className="sl-actions">
                        <button
                          type="button"
                          className="button-yellow sl-small"
                          onClick={() =>
                            setDialog({
                              meetingId: c.meetingId,
                              contactId: c.contactId,
                              contactLabel: who || c.contactEmail || "",
                              callTitle: c.title
                            })
                          }
                        >
                          {t("calls.followUp")}
                        </button>
                        {canOffer && (
                          <button type="button" className="button-secondary sl-small" onClick={() => startOffer(c.meetingId)}>
                            <FilePen size={15} aria-hidden="true" />
                            {t("calls.offer")}
                          </button>
                        )}
                        <button type="button" className="button-ghost" onClick={() => dismiss(c.meetingId)}>
                          {t("calls.dismiss")}
                        </button>
                        {c.contactId && (
                          <a className="button-ghost" href={`/sales/kontakt/${c.contactId}`}>
                            {t("open")}
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="sl-section" aria-labelledby="sl-tasks">
            <h2 id="sl-tasks">
              {t("tasks.title")}
              {overdue > 0 && <span className="sl-count is-danger">{t("tasks.overdue", { count: overdue })}</span>}
            </h2>
            {due.length === 0 ? (
              <p className="sl-empty">{t("tasks.empty")}</p>
            ) : (
              <ul className="sl-list">
                {due.map((x) => (
                  <TaskRow key={x.id} task={x} locale={locale} onDone={complete} onMove={reschedule} />
                ))}
              </ul>
            )}
            {soon.length > 0 && (
              <details className="sl-soon">
                <summary>{t("tasks.soon", { count: soon.length })}</summary>
                <ul className="sl-list">
                  {soon.map((x) => (
                    <TaskRow key={x.id} task={x} locale={locale} onDone={complete} onMove={reschedule} />
                  ))}
                </ul>
              </details>
            )}
          </section>
        </div>

        <aside className="sl-col-side" aria-labelledby="sl-agenda">
          <section className="sl-section sl-agenda">
            <h2 id="sl-agenda">{t("events.title")}</h2>
            <Agenda events={todayEvents} locale={locale} empty={t("events.empty")} />
            {tomorrowEvents.length > 0 && (
              <>
                <h3 className="sl-agenda-day">{t("events.tomorrow")}</h3>
                <Agenda events={tomorrowEvents} locale={locale} empty="" />
              </>
            )}
          </section>
        </aside>
      </div>

      {dialog && (
        <FollowUpDialog
          target={dialog}
          onClose={() => setDialog(null)}
          onCreated={() => {
            if (dialog.meetingId) setHiddenCalls((s) => new Set(s).add(dialog.meetingId!));
            toast({ text: t("created"), tone: "ok" });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function TaskRow({
  task,
  locale,
  onDone,
  onMove
}: {
  task: TodayData["tasks"][number];
  locale: Locale;
  onDone: (id: string, contactId: string) => void;
  onMove: (id: string, contactId: string, date: string) => void;
}) {
  const t = useTranslations("sales.today.tasks");
  const f = useFormat(locale);
  const due = task.dueDate ? f.relativeDay(task.dueDate) : t("noDate");
  return (
    <li className="sl-task">
      <button type="button" className="sl-done" onClick={() => onDone(task.id, task.contactId)} aria-label={t("done", { title: task.title })}>
        <Check size={15} aria-hidden="true" />
      </button>
      <div className="sl-task-body">
        <div className="sl-task-title">{task.title}</div>
        <div className="sl-task-meta">
          <span className={task.bucket === "overdue" ? "sl-due is-overdue" : "sl-due"}>{due}</span>
          {task.contactId && (
            <a href={`/sales/kontakt/${task.contactId}`} className="sl-task-contact">
              {task.contactName || t("contact")}
            </a>
          )}
        </div>
        {task.body && <p className="sl-task-text">{task.body}</p>}
      </div>
      <label className="sl-move">
        <span className="sl-sr">{t("move")}</span>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) onMove(task.id, task.contactId, e.target.value);
          }}
        >
          <option value="">{t("move")}</option>
          <option value={f.workdays(1)}>{t("moveTomorrow")}</option>
          <option value={f.workdays(3)}>{t("moveThree")}</option>
          <option value={f.nextMonday()}>{t("moveMonday")}</option>
        </select>
      </label>
    </li>
  );
}

function Agenda({ events, locale, empty }: { events: TodayData["events"]; locale: Locale; empty: string }) {
  const t = useTranslations("sales.today.events");
  const f = useFormat(locale);
  if (!events.length) return empty ? <p className="sl-empty">{empty}</p> : null;
  const now = Date.now();
  return (
    <ol className="sl-agenda-list">
      {events.map((e) => {
        const past = Date.parse(e.end || e.start) < now;
        const live = Date.parse(e.start) <= now && !past;
        return (
          <li key={e.id} className={past ? "sl-event is-past" : live ? "sl-event is-live" : "sl-event"}>
            <time dateTime={e.start} className="sl-event-time">
              {f.time(e.start)}
            </time>
            <div className="sl-event-body">
              <div className="sl-event-title">
                {e.contactId ? <a href={`/sales/kontakt/${e.contactId}`}>{e.contactName || e.title}</a> : e.title}
              </div>
              <div className="sl-muted">{[e.company, e.contactName ? e.title : ""].filter(Boolean).join(", ")}</div>
              {e.meetingUrl && !past && (
                <a className="sl-join" href={e.meetingUrl} target="_blank" rel="noreferrer">
                  <Video size={14} aria-hidden="true" />
                  {live ? t("joinNow") : t("join")}
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
