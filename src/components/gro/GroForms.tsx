"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { FormState } from "@/app/gro/actions";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

function Submit({ label, pending: pendingLabel, variant = "primary" }: { label: string; pending: string; variant?: "primary" | "secondary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`gr-btn gr-btn-${variant}`} disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function Message({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p className={state.error ? "gr-msg gr-msg-error" : "gr-msg gr-msg-ok"} role={state.error ? "alert" : "status"}>
      {state.error ?? state.ok}
    </p>
  );
}

/** Formular mit Rückmeldung */
export function StatefulForm({ action, children, submit, pending, className, variant }: { action: Action; children: React.ReactNode; submit: string; pending: string; className?: string; variant?: "primary" | "secondary" | "danger" }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="gr-form-foot">
        <Submit label={submit} pending={pending} variant={variant} />
        <Message state={state} />
      </div>
    </form>
  );
}

/** Button ohne Felder, optional mit Rückfrage */
export function ActionButton({ action, label, pending, confirm, variant = "secondary" }: { action: () => Promise<FormState>; label: string; pending: string; confirm?: string; variant?: "primary" | "secondary" | "danger" }) {
  const [state, setState] = useState<FormState>(null);
  const [busy, start] = useTransition();
  const router = useRouter();
  return (
    <span className="gr-inline">
      <button
        type="button"
        className={`gr-btn gr-btn-${variant}`}
        disabled={busy}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            setState(await action());
            router.refresh();
          });
        }}
      >
        {busy ? pending : label}
      </button>
      <Message state={state} />
    </span>
  );
}
