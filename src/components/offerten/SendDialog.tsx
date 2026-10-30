"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Paperclip, Send, X } from "lucide-react";
import { formatDate } from "@/lib/offerten/quote";
import { fillTemplate, type QuoteSettings } from "@/lib/offerten/settings-shared";
import type { Quote } from "@/lib/offerten/store";

type Props = {
  open: boolean;
  onClose: () => void;
  quote: Quote;
  settings: QuoteSettings;
  user: { name: string; email: string };
  provider: "graph" | "resend" | null;
  onSent: () => void;
};

const splitEmails = (s: string) =>
  s
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

export function SendDialog({ open, onClose, quote, settings, user, provider, onSent }: Props) {
  const t = useTranslations("offerten.sendDialog");
  const ref = useRef<HTMLDialogElement>(null);
  const lang = quote.language;

  const defaults = useMemo(() => {
    const values = {
      number: quote.number,
      validUntil: formatDate(quote.validUntil, lang),
      firstName: quote.recipient.firstName || quote.recipient.name || (lang === "de" ? "zusammen" : "there"),
      company: quote.recipient.company,
      senderName: user.name
    };
    return {
      subject: quote.texts.emailSubject || fillTemplate(settings.texts.emailSubject[lang], values),
      body: quote.texts.emailBody || fillTemplate(settings.texts.emailBody[lang], values)
    };
  }, [quote, settings, user, lang]);

  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [formats, setFormats] = useState<("pdf" | "xlsx")[]>(["pdf"]);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // Bei jedem Öffnen frisch aus dem aktuellen Entwurf befüllen
      setTo(quote.recipient.email);
      setCc("");
      setSubject(defaults.subject);
      setBody(defaults.body);
      setError(null);
      setState("idle");
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (f: "pdf" | "xlsx") => setFormats((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  const send = async () => {
    const toList = splitEmails(to);
    const ccList = splitEmails(cc);
    if (!toList.length || ![...toList, ...ccList].every(isEmail) || !subject.trim() || !body.trim() || !formats.length) {
      setError(t("errors.invalid"));
      return;
    }
    setState("sending");
    setError(null);
    const res = await fetch(`/api/offerten/${quote.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: toList, cc: ccList, subject, body, formats })
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { error?: string; detail?: string } | null;
    if (res?.ok) {
      setState("sent");
      return;
    }
    setState("idle");
    const code = data?.error ?? "default";
    setError(
      code === "send_failed"
        ? t("errors.send_failed", { detail: data?.detail ?? "" })
        : t.has(`errors.${code}`)
          ? t(`errors.${code}` as "errors.default")
          : t("errors.default")
    );
  };

  return (
    <dialog
      ref={ref}
      className="dialog of-send-dialog"
      onClose={() => (state === "sent" ? onSent() : onClose())}
      aria-labelledby="of-send-title"
    >
      <div className="dialog-head">
        <h2 id="of-send-title">{state === "sent" ? t("successTitle") : t("title")}</h2>
        <button type="button" className="icon-button" onClick={() => ref.current?.close()} aria-label={t("close")}>
          <X size={18} />
        </button>
      </div>
      {state === "sent" ? (
        <div className="dialog-body">
          <p className="dialog-success">
            <CheckCircle2 size={22} aria-hidden="true" className="of-ok-icon" />
            <span>{quote.ghlContactId ? t("ghlHint") : t("ghlNoContact")}</span>
          </p>
          <div className="dialog-actions">
            <button type="button" className="button-dark" onClick={() => ref.current?.close()}>
              {t("close")}
            </button>
          </div>
        </div>
      ) : (
        <div className="dialog-body">
          {!provider && <p className="form-error">{t("notConfigured")}</p>}
          <p className="of-muted of-small">
            {t("from", { email: user.email })} {provider === "graph" ? t("viaGraph") : provider === "resend" ? t("viaResend") : ""}
          </p>
          <label className="field">
            <span className="field-label">{t("to")}</span>
            <input className="of-input" type="email" inputMode="email" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">{t("cc")}</span>
            <input className="of-input" inputMode="email" value={cc} onChange={(e) => setCc(e.target.value)} placeholder={t("ccHint")} />
          </label>
          <label className="field">
            <span className="field-label">{t("subject")}</span>
            <input className="of-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">{t("body")}</span>
            <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <fieldset className="of-formats">
            <legend className="field-label">
              <Paperclip size={14} aria-hidden="true" /> {t("formats")}
            </legend>
            {(["pdf", "xlsx"] as const).map((f) => (
              <label key={f} className="of-check of-format">
                <input type="checkbox" checked={formats.includes(f)} onChange={() => toggle(f)} />
                {t(f)}
              </label>
            ))}
          </fieldset>
          <p className="of-muted of-small">{t("acceptHint")}</p>
          <p className="of-muted of-small">{quote.ghlContactId ? t("ghlHint") : t("ghlNoContact")}</p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button type="button" className="button-secondary" onClick={() => ref.current?.close()}>
              {t("cancel")}
            </button>
            <button type="button" className="button-yellow" onClick={send} disabled={state === "sending" || !provider}>
              <Send size={16} aria-hidden="true" />
              {state === "sending" ? t("sending") : t("send")}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
