"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/messen/actions";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

function Submit({ label, pending: pendingLabel, variant = "primary" }: { label: string; pending: string; variant?: "primary" | "secondary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`me-btn me-btn-${variant}`} disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function Message({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p className={state.error ? "me-msg me-msg-error" : "me-msg me-msg-ok"} role={state.error ? "alert" : "status"}>
      {state.error ?? state.ok}
    </p>
  );
}

/** Formular mit Rückmeldung, z. B. Speichern der Messe */
export function StatefulForm({
  action,
  children,
  submit,
  pending,
  className
}: {
  action: Action;
  children: React.ReactNode;
  submit: string;
  pending: string;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="me-form-foot">
        <Submit label={submit} pending={pending} />
        <Message state={state} />
      </div>
    </form>
  );
}

/** Einzelner Button mit Rückfrage, z. B. Gewinner ziehen */
export function ActionButton({
  action,
  fields,
  label,
  pending,
  confirm,
  variant = "secondary"
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  pending: string;
  confirm?: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className="me-inline-form"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Submit label={label} pending={pending} variant={variant} />
      <Message state={state} />
    </form>
  );
}

/** Button ohne Rückmeldung mit Rückfrage, z. B. Löschen */
export function ConfirmForm({
  action,
  fields,
  label,
  confirm,
  variant = "danger"
}: {
  action: (form: FormData) => Promise<void>;
  fields: Record<string, string>;
  label: string;
  confirm: string;
  variant?: "secondary" | "danger" | "link";
}) {
  return (
    <form
      action={action}
      className="me-inline-form"
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={`me-btn me-btn-${variant}`}>
        {label}
      </button>
    </form>
  );
}

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="me-code">
      <textarea readOnly value={code} rows={6} aria-label="Code zum Einbetten" onFocus={(e) => e.currentTarget.select()} spellCheck={false} />
      <button
        type="button"
        className="me-btn me-btn-secondary me-full"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {
            /* Feld ist markierbar */
          }
        }}
      >
        {copied ? "Kopiert" : "Code kopieren"}
      </button>
    </div>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="me-copy">
      <input readOnly value={url} aria-label="Öffentlicher Link" onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="me-btn me-btn-secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {
            /* Feld ist markierbar */
          }
        }}
      >
        {copied ? "Kopiert" : "Kopieren"}
      </button>
    </div>
  );
}
