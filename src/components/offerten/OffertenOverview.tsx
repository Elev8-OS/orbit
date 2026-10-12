"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, FileText, Mic, Plus, Search, X } from "lucide-react";
import { formatMoney } from "@/lib/offerten/quote";
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
};

type Tab = "drafts" | "sent" | "calls";

type Meeting = {
  id: string;
  title: string;
  date: string | null;
  organizer: string | null;
  external: string[];
  status: string | null;
  reason: string | null;
  quoteId: string | null;
};

type Props = { quotes: QuoteRow[]; initialTab: Tab; ghlEnabled: boolean; locale: "de" | "en" };

export function OffertenOverview({ quotes, initialTab, ghlEnabled, locale }: Props) {
  const t = useTranslations("offerten");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [dialogOpen, setDialogOpen] = useState(false);
  const drafts = quotes.filter((q) => q.status === "draft");
  const sent = quotes.filter((q) => q.status === "sent");

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
            ["drafts", t("overview.tabs.drafts"), drafts.length],
            ["sent", t("overview.tabs.sent"), sent.length],
            ["calls", t("overview.tabs.calls"), null]
          ] as [Tab, string, number | null][]
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className="of-tab"
            onClick={() => selectTab(id)}
          >
            {label}
            {count !== null && <span className="of-tab-count">{count}</span>}
          </button>
        ))}
      </div>

      {tab === "drafts" && <QuoteList rows={drafts} empty={t("overview.empty.drafts")} locale={locale} />}
      {tab === "sent" && <QuoteList rows={sent} empty={t("overview.empty.sent")} locale={locale} />}
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

function CallList({ locale }: { locale: "de" | "en" }) {
  const t = useTranslations("offerten.calls");
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/offerten/meetings")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setMeetings(((await res.json()) as { meetings: Meeting[] }).meetings);
      })
      .catch(() => setError(true));
  }, []);

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

  return (
    <div className="of-calls">
      <p className="of-muted">{t("lead")}</p>
      {error && <p className="form-error">{t("error")}</p>}
      {!meetings && !error && <p className="of-empty">{t("loading")}</p>}
      {meetings && !meetings.length && <p className="of-empty">{t("empty")}</p>}
      {meetings && meetings.length > 0 && (
        <ul className="of-list">
          {meetings.map((m) => {
            const status = m.status ?? "none";
            return (
              <li key={m.id} className="of-row of-row-static">
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
                  {m.reason && status !== "quote_created" && <span className="of-row-reason">{m.reason}</span>}
                </span>
                <span className="of-row-side">
                  {m.quoteId ? (
                    <a className="button-secondary" href={`/offerten/${m.quoteId}`}>
                      {t("open")}
                    </a>
                  ) : (
                    <button type="button" className="button-secondary" disabled={busy !== null} onClick={() => create(m.id)}>
                      {busy === m.id ? t("creating") : t("create")}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type ContactHit = { id: string; name: string; email: string; company: string };

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
  const [hits, setHits] = useState<ContactHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!ghlEnabled || q.trim().length < 2) {
      setHits(null);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/offerten/ghl/contacts?q=${encodeURIComponent(q.trim())}`).catch(() => null);
      const data = res?.ok ? ((await res.json()) as { contacts: ContactHit[] }) : { contacts: [] };
      setHits(data.contacts);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [q, ghlEnabled]);

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
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("searchPlaceholder")}
                autoFocus
              />
            </span>
          </label>
        )}
        {searching && <p className="of-muted">{t("searching")}</p>}
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
