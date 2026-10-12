"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Check, KeyRound, X } from "lucide-react";

export type RequestableApp = { id: string; name: string; description: string; color: string };

type Status = "idle" | "sending" | "success" | "error";
const KNOWN_ERRORS = new Set(["rate_limited", "already_requested", "mail_not_configured"]);

type Props = {
  apps: RequestableApp[];
  initialPending: string[];
  variant?: "ghost" | "primary";
};

export function AccessRequestDialog({ apps, initialPending, variant = "ghost" }: Props) {
  const t = useTranslations("request");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(() => new Set(initialPending));
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorKey, setErrorKey] = useState("default");

  const open = () => {
    setStatus("idle");
    setSelected(apps.find((a) => !pending.has(a.id))?.id ?? null);
    setMessage("");
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  // Klick auf den Hintergrund schliesst den Dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClick = (e: MouseEvent) => e.target === dialog && dialog.close();
    dialog.addEventListener("click", onClick);
    return () => dialog.removeEventListener("click", onClick);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId: selected, message: message.trim() || undefined })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorKey(KNOWN_ERRORS.has(body.error) ? body.error : "default");
        if (body.error === "already_requested") setPending((p) => new Set(p).add(selected));
        setStatus("error");
        return;
      }
      setPending((p) => new Set(p).add(selected));
      setStatus("success");
    } catch {
      setErrorKey("default");
      setStatus("error");
    }
  };

  if (apps.length === 0) return null;

  return (
    <>
      <button type="button" className={variant === "primary" ? "button-yellow" : "button-ghost"} onClick={open}>
        <KeyRound size={variant === "primary" ? 18 : 15} aria-hidden="true" />
        {t("button")}
      </button>

      <dialog ref={dialogRef} className="dialog" aria-labelledby="request-title">
        <div className="dialog-head">
          <h2 id="request-title">{status === "success" ? t("successTitle") : t("title")}</h2>
          <button type="button" className="icon-button" onClick={close} aria-label={t("close")}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {status === "success" ? (
          <div className="dialog-body">
            <p className="dialog-success">
              <span className="success-mark" aria-hidden="true">
                <Check size={18} />
              </span>
              {t("successBody")}
            </p>
            <div className="dialog-actions">
              <button type="button" className="button-dark" onClick={close}>
                {t("close")}
              </button>
            </div>
          </div>
        ) : (
          <form className="dialog-body" onSubmit={submit}>
            <p className="dialog-intro">{t("intro")}</p>
            <fieldset className="request-apps">
              <legend className="sr-only">{t("app")}</legend>
              {apps.map((app) => {
                const isPending = pending.has(app.id);
                return (
                  <label
                    key={app.id}
                    className={`request-app${isPending ? " is-pending" : ""}`}
                    style={{ "--tile-color": app.color } as CSSProperties}
                  >
                    <input
                      type="radio"
                      name="app"
                      value={app.id}
                      checked={selected === app.id}
                      disabled={isPending}
                      onChange={() => setSelected(app.id)}
                    />
                    <span className="request-app-text">
                      <span className="request-app-name">
                        <span className="tile-category-dot" aria-hidden="true" />
                        {app.name}
                        {isPending && <span className="request-pending">{t("pending")}</span>}
                      </span>
                      <span className="request-app-desc">{app.description}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <label className="field">
              <span className="field-label">{t("message")}</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder={t("messagePlaceholder")}
              />
            </label>

            {status === "error" && (
              <p className="form-error" role="alert">
                {t(`errors.${errorKey}`)}
              </p>
            )}

            <div className="dialog-actions">
              <button type="button" className="button-secondary" onClick={close}>
                {t("cancel")}
              </button>
              <button type="submit" className="button-yellow" disabled={!selected || status === "sending"}>
                {status === "sending" ? t("sending") : t("submit")}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
