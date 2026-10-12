"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Send, Sparkles, X } from "lucide-react";

type Props = {
  quoteId: string | null;
  title: string;
  onClose: () => void;
  onSent: (quoteId: string) => void;
};

const splitEmails = (s: string) =>
  s
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

/** Nachfass-Mail: Claude schlägt einen persönlichen Text vor, gesendet wird aus dem eigenen Postfach. */
export function FollowUpDialog({ quoteId, title, onClose, onSent }: Props) {
  const t = useTranslations("offerten.followUp");
  const ref = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(false);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachPdf, setAttachPdf] = useState(false);
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!quoteId) {
      if (dialog.open) dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
    setLoading(true);
    setError(null);
    setTo("");
    setCc("");
    setSubject("");
    setBody("");
    setAttachPdf(false);
    fetch(`/api/offerten/${quoteId}/follow-up`)
      .then((r) => r.json())
      .then((d: { to?: string[]; subject?: string; body?: string; error?: string }) => {
        setTo((d.to ?? []).join(", "));
        setSubject(d.subject ?? "");
        setBody(d.body ?? "");
        if (d.error || !d.body) setError(t("draftFailed"));
      })
      .catch(() => setError(t("draftFailed")))
      .finally(() => setLoading(false));
  }, [quoteId, t]);

  const send = async () => {
    const toList = splitEmails(to);
    const ccList = splitEmails(cc);
    if (!quoteId || !toList.length || ![...toList, ...ccList].every(isEmail) || !subject.trim() || !body.trim()) {
      setError(t("invalid"));
      return;
    }
    setState("sending");
    setError(null);
    const res = await fetch(`/api/offerten/${quoteId}/follow-up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: toList, cc: ccList, subject, body, attachPdf })
    }).catch(() => null);
    setState("idle");
    if (res?.ok) {
      onSent(quoteId);
      ref.current?.close();
      return;
    }
    const data = (await res?.json().catch(() => null)) as { detail?: string } | null;
    setError(t("sendFailed", { detail: data?.detail ?? "" }));
  };

  return (
    <dialog ref={ref} className="dialog of-send-dialog" onClose={onClose} aria-labelledby="of-fu-title">
      <div className="dialog-head">
        <h2 id="of-fu-title">{t("title", { name: title })}</h2>
        <button type="button" className="icon-button" onClick={() => ref.current?.close()} aria-label={t("cancel")}>
          <X size={18} />
        </button>
      </div>
      <div className="dialog-body">
        {loading ? (
          <p className="of-ai-loading">
            <Sparkles size={18} aria-hidden="true" /> {t("drafting")}
          </p>
        ) : (
          <>
            <label className="field">
              <span className="field-label">{t("to")}</span>
              <input className="of-input" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">{t("cc")}</span>
              <input className="of-input" value={cc} onChange={(e) => setCc(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">{t("subject")}</span>
              <input className="of-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">{t("body")}</span>
              <textarea rows={9} value={body} onChange={(e) => setBody(e.target.value)} />
            </label>
            <label className="of-check">
              <input type="checkbox" checked={attachPdf} onChange={(e) => setAttachPdf(e.target.checked)} />
              {t("attachPdf")}
            </label>
            <p className="of-muted of-small">{t("hint")}</p>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button-secondary" onClick={() => ref.current?.close()}>
            {t("cancel")}
          </button>
          <button type="button" className="button-yellow" disabled={loading || state === "sending"} onClick={send}>
            <Send size={16} aria-hidden="true" />
            {state === "sending" ? t("sending") : t("send")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
