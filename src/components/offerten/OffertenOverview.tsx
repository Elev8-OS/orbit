"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Ban, Check, FileText, Mail, Mic, Plus, Rocket, RotateCcw, Search, X } from "lucide-react";
import { formatMoney } from "@/lib/offerten/quote";
import { FollowUpDialog } from "./FollowUpDialog";
import { useGhlSearch } from "./useGhlSearch";
import { relativeTime } from "./useRelativeTime";

export type QuoteRow = {
  id: string;
  number: string;
  status: "draft" | "sent" | "discarded";
  recipient: string;
  recipientSub: string;
  source: "fireflies" | "manual";
  meetingTitle: string | null;
  owner: string | null;
  firstYear: number;
  currency: string;
  updatedAt: string;
  sentAt: string | null;
  ghlIncomplete: boolean;
  followUpAt: string | null;
  followUpCount: number;
  lastFollowUpAt: string | null;
  outcome: "open" | "won" | "lost";
  validUntil: string;
};

type Tab = "drafts" | "follow" | "sent" | "calls" | "onboarding";

export type OnboardingRow = {
  id: string;
  company: string;
  contact: string;
  owner: string;
  status: "open" | "live";
  createdAt: string;
  done: number;
  total: number;
  percent: number;
};

type Meeting = {
  id: string;
  title: string;
  date: string | null;
  organizer: string | null;
  external: string[];
  status: string | null;
  reason: string | null;
  quoteId: string | null;
  dismissedBy: string | null;
};

type Props = { quotes: QuoteRow[]; initialTab: Tab; ghlEnabled: boolean; locale: "de" | "en"; onboardings: OnboardingRow[] };

const today = () => new Date().toISOString().slice(0, 10);

export function OffertenOverview({ quotes: initialQuotes, initialTab, ghlEnabled, locale, onboardings }: Props) {
  const t = useTranslations("offerten");
  const [quotes, setQuotes] = useState(initialQuotes);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [dialogOpen, setDialogOpen] = useState(false);
  const drafts = quotes.filter((q) => q.status === "draft");
  const sent = quotes.filter((q) => q.status === "sent");
  const due = sent.filter((q) => q.outcome === "open" && q.followUpAt && q.followUpAt <= today());

  const selectTab = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "drafts") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="of-page">
      <div className="of-page-head">
        <div>
          <h1 className="of-h1">{t("overview.title")}</h1>
          <p className="of-lead">{t("overview.lead")}</p>
        </div>
        <button type="button" className="button-yellow" onClick={() => setDialogOpen(true)}>
          <Plus size={18} aria-hidden="true" />
          {t("overview.new")}
        </button>
      </div>

      <div className="of-tabs" role="tablist">
        {(
          [
            ["drafts", t("overview.tabs.drafts"), drafts.length, false],
            ["follow", t("overview.tabs.follow"), due.length, due.length > 0],
            ["sent", t("overview.tabs.sent"), sent.length, false],
            ["onboarding", t("overview.tabs.onboarding"), onboardings.filter((o) => o.status === "open").length, false],
            ["calls", t("overview.tabs.calls"), null, false]
          ] as [Tab, string, number | null, boolean][]
        ).map(([id, label, count, alert]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className="of-tab" onClick={() => selectTab(id)}>
            {label}
            {count !== null && <span className={alert ? "of-tab-count of-tab-count-alert" : "of-tab-count"}>{count}</span>}
          </button>
        ))}
      </div>

      {tab === "drafts" && <QuoteList rows={drafts} empty={t("overview.empty.drafts")} locale={locale} />}
      {tab === "follow" && (
        <FollowUpList
          rows={sent}
          locale={locale}
          onChange={(id, patch) => setQuotes((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)))}
        />
      )}
      {tab === "sent" && <QuoteList rows={sent} empty={t("overview.empty.sent")} locale={locale} />}
      {tab === "onboarding" && <OnboardingList rows={onboardings} locale={locale} />}
      {tab === "calls" && <CallList locale={locale} />}

      <NewQuoteDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        ghlEnabled={ghlEnabled}
        onFromCall={() => {
          setDialogOpen(false);
          selectTab("calls");
        }}
      />
    </div>
  );
}

function QuoteList({ rows, empty, locale }: { rows: QuoteRow[]; empty: string; locale: "de" | "en" }) {
  const t = useTranslations("offerten.overview");
  if (!rows.length) return <p className="of-empty">{empty}</p>;
  return (
    <ul className="of-list">
      {rows.map((q) => (
        <li key={q.id}>
          <a href={`/offerten/${q.id}`} className="of-row">
            <span className="of-row-icon" aria-hidden="true">
              {q.source === "fireflies" ? <Mic size={18} /> : <FileText size={18} />}
            </span>
            <span className="of-row-main">
              <span className="of-row-title">
                {q.recipient || <em className="of-muted">{t("noRecipient")}</em>}
                {q.status === "sent" && q.outcome !== "open" && (
                  <span className={`of-chip of-chip-${q.outcome}`}>{t(`outcome.${q.outcome}`)}</span>
                )}
                {q.ghlIncomplete && (
                  <span className="of-chip of-chip-warn">
                    <AlertTriangle size={12} aria-hidden="true" />
                    {t("ghlMissing")}
                  </span>
                )}
              </span>
              <span className="of-row-sub">
                {q.number}
                {q.recipientSub ? ` · ${q.recipientSub}` : ""}
                {q.source === "fireflies" && q.meetingTitle ? ` · ${t("fromCall")}: ${q.meetingTitle}` : ""}
              </span>
            </span>
            <span className="of-row-side">
              <span className="of-row-amount">{q.firstYear ? formatMoney(q.firstYear, q.currency, locale) : "–"}</span>
              <span className="of-row-sub" suppressHydrationWarning>
                {q.status === "sent" && q.sentAt
                  ? t("sentOn", { time: relativeTime(q.sentAt, locale) })
                  : t("updated", { time: relativeTime(q.updatedAt, locale) })}
                {q.owner ? ` · ${q.owner}` : ""}
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

// ── Nachverfolgen ───────────────────────────────────────────

function FollowUpList({
  rows,
  locale,
  onChange
}: {
  rows: QuoteRow[];
  locale: "de" | "en";
  onChange: (id: string, patch: Partial<QuoteRow>) => void;
}) {
  const t = useTranslations("offerten.follow");
  const [writing, setWriting] = useState<QuoteRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = today();

  const groups = useMemo(() => {
    const open = rows.filter((q) => q.outcome === "open");
    return {
      due: open.filter((q) => q.followUpAt && q.followUpAt <= now).sort((a, b) => (a.followUpAt ?? "").localeCompare(b.followUpAt ?? "")),
      upcoming: open.filter((q) => !q.followUpAt || q.followUpAt > now).sort((a, b) => (a.followUpAt ?? "9").localeCompare(b.followUpAt ?? "9")),
      closed: rows.filter((q) => q.outcome !== "open")
    };
  }, [rows, now]);

  const patch = async (q: QuoteRow, body: { followUpAt?: string | null; outcome?: "open" | "won" | "lost" }) => {
    setBusy(q.id);
    setError(null);
    const res = await fetch(`/api/offerten/${q.id}/tracking`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).catch(() => null);
    setBusy(null);
    const data = (await res?.json().catch(() => null)) as {
      quote?: { followUpAt: string | null; outcome: QuoteRow["outcome"] };
      ghl?: { ok: boolean; error?: string } | null;
    } | null;
    if (!res?.ok || !data?.quote) {
      setError(t("saveFailed"));
      return;
    }
    onChange(q.id, { followUpAt: data.quote.followUpAt, outcome: data.quote.outcome });
    if (data.ghl && !data.ghl.ok) setError(t("ghlFailed", { detail: data.ghl.error ?? "" }));
  };

  const afterSent = async (id: string) => {
    const res = await fetch(`/api/offerten/${id}`).catch(() => null);
    const data = (await res?.json().catch(() => null)) as {
      quote?: { followUpAt: string | null; followUpCount: number; lastFollowUpAt: string | null };
    } | null;
    if (data?.quote) {
      onChange(id, { followUpAt: data.quote.followUpAt, followUpCount: data.quote.followUpCount, lastFollowUpAt: data.quote.lastFollowUpAt });
    }
  };

  const row = (q: QuoteRow) => {
    const expired = q.validUntil < now;
    const overdueDays = q.followUpAt && q.followUpAt < now ? Math.round((Date.parse(now) - Date.parse(q.followUpAt)) / 86_400_000) : 0;
    return (
      <li key={q.id} className="of-row of-row-static of-follow-row">
        <span className="of-row-icon" aria-hidden="true">
          <Mail size={18} />
        </span>
        <span className="of-row-main">
          <a href={`/offerten/${q.id}`} className="of-row-title of-row-link">
            {q.recipient || q.number}
            {expired && q.outcome === "open" && <span className="of-chip of-chip-warn">{t("expired")}</span>}
            {q.outcome !== "open" && <span className={`of-chip of-chip-${q.outcome}`}>{t(`outcome.${q.outcome}`)}</span>}
          </a>
          <span className="of-row-sub" suppressHydrationWarning>
            {q.number} · {q.firstYear ? formatMoney(q.firstYear, q.currency, locale) : "–"} ·{" "}
            {q.sentAt ? t("sentAgo", { time: relativeTime(q.sentAt, locale) }) : ""}
            {q.followUpCount ? ` · ${t("followedUp", { count: q.followUpCount })}` : ""}
            {overdueDays > 0 ? ` · ${t("overdue", { days: overdueDays })}` : ""}
          </span>
        </span>
        <span className="of-follow-actions">
          {q.outcome === "open" ? (
            <>
              <label className="of-follow-date">
                <span className="of-muted of-small">{t("next")}</span>
                <input
                  type="date"
                  value={q.followUpAt ?? ""}
                  disabled={busy === q.id}
                  onChange={(e) => patch(q, { followUpAt: e.target.value || null })}
                />
              </label>
              <button type="button" className="button-yellow" onClick={() => setWriting(q)}>
                <Mail size={16} aria-hidden="true" /> {t("followUp")}
              </button>
              <button type="button" className="button-secondary of-icon-only" title={t("won")} aria-label={t("won")} disabled={busy === q.id} onClick={() => patch(q, { outcome: "won" })}>
                <Check size={16} />
              </button>
              <button type="button" className="button-secondary of-icon-only" title={t("lost")} aria-label={t("lost")} disabled={busy === q.id} onClick={() => patch(q, { outcome: "lost" })}>
                <X size={16} />
              </button>
            </>
          ) : (
            <button type="button" className="button-ghost" disabled={busy === q.id} onClick={() => patch(q, { outcome: "open" })}>
              <RotateCcw size={16} aria-hidden="true" /> {t("reopen")}
            </button>
          )}
        </span>
      </li>
    );
  };

  if (!rows.length) return <p className="of-empty">{t("empty")}</p>;
  return (
    <div className="of-follow">
      <p className="of-muted">{t("lead")}</p>
      {error && <p className="form-error">{error}</p>}
      {(
        [
          ["due", groups.due],
          ["upcoming", groups.upcoming],
          ["closed", groups.closed]
        ] as const
      ).map(([key, list]) =>
        list.length ? (
          <section key={key} className="of-follow-group">
            <h2 className="of-h3">
              {t(`groups.${key}`)} <span className="of-muted">({list.length})</span>
            </h2>
            <ul className="of-list">{list.map(row)}</ul>
          </section>
        ) : key === "due" ? (
          <p key={key} className="of-ok-line">
            <Check size={16} aria-hidden="true" /> {t("nothingDue")}
          </p>
        ) : null
      )}
      <FollowUpDialog
        quoteId={writing?.id ?? null}
        title={writing?.recipient ?? ""}
        onClose={() => setWriting(null)}
        onSent={afterSent}
      />
    </div>
  );
}

// ── Onboarding ───────────────────────────────────────────────────────

function OnboardingList({ rows, locale }: { rows: OnboardingRow[]; locale: "de" | "en" }) {
  const t = useTranslations("offerten.onboarding");
  if (!rows.length) return <p className="of-empty">{t("empty")}</p>;
  return (
    <div className="of-calls">
      <p className="of-muted">{t("listLead")}</p>
      <ul className="of-list">
        {rows.map((o) => (
          <li key={o.id}>
            <a href={`/offerten/onboarding/${o.id}`} className="of-row">
              <span className="of-row-icon" aria-hidden="true">
                <Rocket size={18} />
              </span>
              <span className="of-row-main">
                <span className="of-row-title">
                  {o.company || o.contact}
                  <span className={`of-chip ${o.status === "live" ? "of-chip-won" : ""}`}>{t(o.status === "live" ? "live" : "open")}</span>
                </span>
                <span className="of-row-sub" suppressHydrationWarning>
                  {t("since", { time: relativeTime(o.createdAt, locale) })}
                  {o.owner ? ` · ${o.owner}` : ""}
                </span>
              </span>
              <span className="of-row-side" style={{ minWidth: "9rem" }}>
                <span className="of-row-amount">{o.percent} %</span>
                <span style={{ display: "block", width: "100%", height: 6, borderRadius: 999, background: "var(--line)", overflow: "hidden" }}>
                  <span style={{ display: "block", width: `${o.percent}%`, height: "100%", background: "var(--yellow)" }} />
                </span>
                <span className="of-row-sub">{t("progress", { done: o.done, total: o.total })}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Calls ───────────────────────────────────────────────────

function CallList({ locale }: { locale: "de" | "en" }) {
  const t = useTranslations("offerten.calls");
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [nextSkip, setNextSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  /** Lädt eine Seite Calls von Fireflies (50 pro Seite) und hängt sie an die Liste an. */
  const loadPage = async (skip: number) => {
    const res = await fetch(`/api/offerten/meetings?skip=${skip}`);
    if (!res.ok) throw new Error();
    const data = (await res.json()) as { meetings: Meeting[]; nextSkip: number; hasMore: boolean };
    setMeetings((list) => {
      const known = new Set((list ?? []).map((m) => m.id));
      return [...(skip === 0 ? [] : (list ?? [])), ...data.meetings.filter((m) => skip === 0 || !known.has(m.id))];
    });
    setNextSkip(data.nextSkip);
    setHasMore(data.hasMore);
  };

  useEffect(() => {
    loadPage(0).catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = async () => {
    setLoadingMore(true);
    await loadPage(nextSkip).catch(() => setError(true));
    setLoadingMore(false);
  };

  const create = async (meetingId: string) => {
    setBusy(meetingId);
    const res = await fetch("/api/offerten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId })
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    if (data.id) window.location.href = `/offerten/${data.id}`;
    else {
      setBusy(null);
      setError(true);
    }
  };

  const mark = async (m: Meeting, action: "dismiss" | "restore") => {
    setBusy(m.id);
    const res = await fetch(`/api/offerten/meetings/${m.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, title: m.title })
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) return;
    setMeetings((list) =>
      (list ?? []).map((x) =>
        x.id === m.id ? { ...x, status: action === "dismiss" ? "dismissed" : null, dismissedBy: action === "dismiss" ? "–" : null } : x
      )
    );
  };

  const isDone = (m: Meeting) => m.status === "dismissed" || m.status === "internal";
  const visible = (meetings ?? []).filter((m) => showDone || !isDone(m));
  const doneCount = (meetings ?? []).filter(isDone).length;

  return (
    <div className="of-calls">
      <div className="of-calls-head">
        <p className="of-muted">{t("lead")}</p>
        {doneCount > 0 && (
          <label className="of-check of-small">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            {t("showDone", { count: doneCount })}
          </label>
        )}
      </div>
      {error && <p className="form-error">{t("error")}</p>}
      {!meetings && !error && <p className="of-empty">{t("loading")}</p>}
      {meetings && !visible.length && <p className="of-empty">{t("empty")}</p>}
      {visible.length > 0 && (
        <ul className="of-list">
          {visible.map((m) => {
            const status = m.status ?? "none";
            return (
              <li key={m.id} className={`of-row of-row-static${isDone(m) ? " is-done" : ""}`}>
                <span className="of-row-icon" aria-hidden="true">
                  <Mic size={18} />
                </span>
                <span className="of-row-main">
                  <span className="of-row-title">
                    {m.title || "Call"}
                    <span className={`of-chip of-chip-${status}`}>{t(`status.${status}` as "status.none")}</span>
                  </span>
                  <span className="of-row-sub" suppressHydrationWarning>
                    {m.date ? relativeTime(m.date, locale) : ""}
                    {m.external.length ? ` · ${m.external.join(", ")}` : ""}
                  </span>
                  {m.reason && !["quote_created", "dismissed"].includes(status) && <span className="of-row-reason">{m.reason}</span>}
                </span>
                <span className="of-row-side of-row-actions">
                  {m.quoteId ? (
                    <a className="button-secondary" href={`/offerten/${m.quoteId}`}>
                      {t("open")}
                    </a>
                  ) : status === "dismissed" ? (
                    <button type="button" className="button-ghost" disabled={busy !== null} onClick={() => mark(m, "restore")}>
                      <RotateCcw size={16} aria-hidden="true" /> {t("restore")}
                    </button>
                  ) : (
                    <>
                      <button type="button" className="button-ghost" disabled={busy !== null} onClick={() => mark(m, "dismiss")}>
                        <Ban size={16} aria-hidden="true" /> {t("dismiss")}
                      </button>
                      <button type="button" className="button-secondary" disabled={busy !== null} onClick={() => create(m.id)}>
                        {busy === m.id ? t("creating") : t("create")}
                      </button>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {meetings && (hasMore || nextSkip > 0) && (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: "0.5rem" }}>
          {hasMore ? (
            <button type="button" className="button-secondary" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? t("loadingMore") : t("loadMore")}
            </button>
          ) : (
            <p className="of-muted of-small">{t("noMore")}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Neue Offerte ────────────────────────────────────────────

function NewQuoteDialog({
  open,
  onClose,
  ghlEnabled,
  onFromCall
}: {
  open: boolean;
  onClose: () => void;
  ghlEnabled: boolean;
  onFromCall: () => void;
}) {
  const t = useTranslations("offerten.newDialog");
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const { hits, searching, error } = useGhlSearch(q, ghlEnabled && open);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const create = async (ghlContactId?: string) => {
    setCreating(true);
    const res = await fetch("/api/offerten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ghlContactId ? { ghlContactId } : {})
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    if (data.id) window.location.href = `/offerten/${data.id}`;
    else setCreating(false);
  };

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="of-new-title">
      <div className="dialog-head">
        <h2 id="of-new-title">{t("title")}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label={t("cancel")}>
          <X size={18} />
        </button>
      </div>
      <div className="dialog-body">
        <p className="dialog-intro">{ghlEnabled ? t("intro") : t("ghlUnavailable")}</p>
        {ghlEnabled && (
          <label className="field">
            <span className="field-label">{t("search")}</span>
            <span className="of-search">
              <Search size={16} aria-hidden="true" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} autoFocus />
            </span>
          </label>
        )}
        {searching && <p className="of-muted">{t("searching")}</p>}
        {error && <p className="form-error">{t(error === "wrong_location" ? "ghlWrongLocation" : "ghlFailed")}</p>}
        {creating && <p className="of-muted">{t("creating")}</p>}
        {hits && !searching && hits.length === 0 && <p className="of-muted">{t("noResults")}</p>}
        {hits && hits.length > 0 && (
          <ul className="of-hits">
            {hits.map((h) => (
              <li key={h.id}>
                <button type="button" className="of-hit" disabled={creating} onClick={() => create(h.id)}>
                  <span className="of-hit-name">{h.name || h.email}</span>
                  <span className="of-muted">{[h.company, h.email].filter(Boolean).join(" · ")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="dialog-actions">
          <button type="button" className="button-secondary" onClick={onFromCall} disabled={creating}>
            <Mic size={16} aria-hidden="true" />
            {t("fromCall")}
          </button>
          <button type="button" className="button-secondary" onClick={() => create()} disabled={creating}>
            {t("blank")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
