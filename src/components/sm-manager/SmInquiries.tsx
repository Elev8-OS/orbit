"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { inquiryStrings, type InquiryStrings } from "@/lib/sm-manager/inquiries-i18n";
import { tipStrings } from "@/lib/sm-manager/tips-i18n";
import { Tip } from "./Tip";
import "./inquiries.css";

export type Inquiry = {
  id: number;
  created_at: string;
  updated_at: string;
  contact_name: string | null;
  guest_message: string | null;
  draft: string | null;
  needs_human: boolean;
  reason: string | null;
  intent: string | null;
  language: string | null;
  status: string;
  error: string | null;
};

type Props = { locale: "de" | "en"; inquiries: Inquiry[]; agentEnabled: boolean };

const OPEN = ["new", "draft_ready", "failed"];

async function call(url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: typeof json.error === "string" ? json.error : undefined };
  } catch {
    return { ok: false };
  }
}

export function SmInquiries({ locale, inquiries, agentEnabled }: Props) {
  const s = inquiryStrings(locale);
  const router = useRouter();

  // New messages arrive on their own, so the list refreshes every 30 seconds.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(t);
  }, [router]);

  const open = inquiries.filter((i) => OPEN.includes(i.status));
  const rest = inquiries.filter((i) => !OPEN.includes(i.status)).slice(0, 15);

  return (
    <section className="sm" style={{ gap: "1rem" }}>
      <p className="sm-muted">{s.inquiriesIntro}</p>
      {!agentEnabled ? <p className="sm-warn">{s.agentOff}</p> : null}
      {inquiries.length === 0 ? <p className="sm-empty">{s.empty}</p> : null}
      {open.length ? (
        <ul className="sm-list">
          {open.map((i) => (
            <li key={`${i.id}-${i.status}`}>
              <InquiryCard s={s} locale={locale} item={i} />
            </li>
          ))}
        </ul>
      ) : null}
      {rest.length ? (
        <ul className="sm-list">
          {rest.map((i) => (
            <li key={`${i.id}-${i.status}`}>
              <InquiryCard s={s} locale={locale} item={i} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function InquiryCard({ s, locale, item }: { s: InquiryStrings; locale: "de" | "en"; item: Inquiry }) {
  const router = useRouter();
  const tp = tipStrings(locale);
  const isOpen = OPEN.includes(item.status);
  const [text, setText] = useState(item.draft ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const when = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.created_at));

  async function act(url: string, body?: unknown) {
    setBusy(true);
    setMsg(s.working);
    const r = await call(url, body);
    setBusy(false);
    setMsg(r.ok ? s.saved : `${s.failed}${r.error ? `: ${r.error}` : ""}`);
    if (r.ok) router.refresh();
  }
  const base = `/api/sm-manager/inquiries/${item.id}`;
  const send = () => {
    if (item.needs_human && !window.confirm(s.confirmSend)) return;
    void act(`${base}/send`, { message: text });
  };

  return (
    <article className="inq-card">
      <div className="sm-top">
        <strong>{item.contact_name || s.anonymous}</strong>
        <span className={`sm-badge sm-status-${item.status === "sent" ? "published" : item.status}`}>{s.statuses[item.status] ?? item.status}</span>
        {item.intent ? <span className="sm-badge">{s.intents[item.intent] ?? item.intent}</span> : null}
        {item.needs_human ? (
          <span>
            <span className="sm-badge inq-flag">{s.needsHuman}</span>
            <Tip text={tp.needsHuman} label={tp.label} />
          </span>
        ) : null}
        <span className="sm-muted sm-small">{when}</span>
      </div>

      <h3>{s.guestSaid}</h3>
      <blockquote className="inq-guest">{item.guest_message || "–"}</blockquote>

      {item.needs_human && item.reason ? <p className="sm-warn">{item.reason}</p> : null}
      {item.error ? <p className="sm-warn">{item.error}</p> : null}

      {isOpen && item.status !== "new" ? (
        <>
          <h3>
            {s.draftLabel}
            <Tip text={tp.draft} label={tp.label} />
          </h3>
          <textarea className="inq-draft" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} aria-label={s.draftLabel} />
          <div className="sm-actions">
            <button type="button" className="sm-btn sm-btn-primary" onClick={send} disabled={busy || !text.trim()}>
              {s.send}
            </button>
            <Tip text={tp.send} label={tp.label} />
            <button type="button" className="sm-btn" onClick={() => void act(`${base}/redraft`)} disabled={busy}>
              {s.redraft}
            </button>
            <Tip text={tp.redraft} label={tp.label} />
            <button type="button" className="sm-btn" onClick={() => void act(`${base}/dismiss`)} disabled={busy}>
              {s.dismiss}
            </button>
            <Tip text={tp.inqDismiss} label={tp.label} />
          </div>
        </>
      ) : item.status === "sent" ? (
        <>
          <h3>{s.sentLabel}</h3>
          <p className="sm-caption">{item.draft}</p>
        </>
      ) : item.status === "new" ? (
        <p className="sm-muted sm-small">{s.noDraft}</p>
      ) : item.status === "ignored" ? (
        // Ignorierte Anfragen können erneut gelesen werden, zum Beispiel wenn der Text beim ersten Mal noch nicht da war.
        <div className="sm-actions">
          <button type="button" className="sm-btn" onClick={() => void act(`${base}/redraft`)} disabled={busy}>
            {s.redraft}
          </button>
          <Tip text={tp.redraft} label={tp.label} />
        </div>
      ) : null}
      {msg ? (
        <p className="sm-muted sm-small" role="status">
          {msg}
        </p>
      ) : null}
    </article>
  );
}
