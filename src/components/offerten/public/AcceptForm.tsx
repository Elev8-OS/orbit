"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { PublicTexts } from "@/lib/offerten/public-texts";

type Prefill = { name: string; email: string; company: string; addressLines: string[]; country: string; vatId: string };

/** Formular zur Annahme. Nach Erfolg: Danke mit Link zur Onboarding-Checkliste. */
export function AcceptForm({
  token,
  tx,
  prefill,
  askVatId,
  termsText
}: {
  token: string;
  tx: PublicTexts;
  prefill: Prefill;
  askVatId: boolean;
  termsText: string;
}) {
  const [form, setForm] = useState({
    name: prefill.name,
    role: "",
    email: prefill.email,
    company: prefill.company,
    address: prefill.addressLines.join("\n"),
    country: prefill.country,
    vatId: prefill.vatId,
    note: "",
    terms: false
  });
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const addressLines = form.address.split("\n").map((l) => l.trim()).filter(Boolean);
    if (form.name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()) || !form.company.trim() || !addressLines.length || !form.terms) {
      setError(tx.invalid);
      return;
    }
    setState("sending");
    setError(null);
    const res = await fetch(`/api/offerten/public/angebot/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        role: form.role,
        email: form.email,
        company: form.company,
        addressLines,
        country: form.country,
        vatId: form.vatId,
        note: form.note,
        terms: true
      })
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { onboardingUrl?: string; error?: string } | null;
    if (res?.ok && data?.onboardingUrl) {
      setOnboardingUrl(data.onboardingUrl);
      setState("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setState("idle");
    if (data?.error === "already_accepted") window.location.reload();
    else setError(tx.failed);
  };

  if (state === "done") {
    return (
      <section className="pub-card pub-thanks" role="status">
        <span className="pub-check" aria-hidden="true">
          <Check size={28} />
        </span>
        <h2>{tx.thanksTitle}</h2>
        <p>
          {tx.thanksBody} <strong>{form.email}</strong>.
        </p>
        {onboardingUrl && (
          <a className="pub-button" href={onboardingUrl}>
            {tx.toOnboarding} →
          </a>
        )}
      </section>
    );
  }

  return (
    <form className="pub-card pub-form" onSubmit={submit} noValidate>
      <h2>{tx.accept}</h2>
      <p className="pub-muted">{tx.acceptLead}</p>
      <div className="pub-grid">
        <label>
          <span>{tx.name}</span>
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" required />
        </label>
        <label>
          <span>{tx.role}</span>
          <input value={form.role} onChange={(e) => set({ role: e.target.value })} autoComplete="organization-title" />
        </label>
        <label>
          <span>{tx.email}</span>
          <input type="email" inputMode="email" value={form.email} onChange={(e) => set({ email: e.target.value })} autoComplete="email" required />
        </label>
        <label>
          <span>{tx.company}</span>
          <input value={form.company} onChange={(e) => set({ company: e.target.value })} autoComplete="organization" required />
        </label>
        <label className="pub-wide">
          <span>{tx.address}</span>
          <textarea rows={3} value={form.address} onChange={(e) => set({ address: e.target.value })} autoComplete="street-address" required />
          <small>{tx.addressHint}</small>
        </label>
        <label>
          <span>{tx.country}</span>
          <input value={form.country} onChange={(e) => set({ country: e.target.value })} autoComplete="country-name" />
        </label>
        <label>
          <span>{tx.vatId}</span>
          <input value={form.vatId} onChange={(e) => set({ vatId: e.target.value })} />
          {askVatId && <small>{tx.vatIdHint}</small>}
        </label>
        <label className="pub-wide">
          <span>{tx.note}</span>
          <textarea rows={2} value={form.note} onChange={(e) => set({ note: e.target.value })} />
        </label>
      </div>
      <div className="pub-terms">
        <h3>{tx.terms}</h3>
        <p>{termsText}</p>
      </div>
      <label className="pub-agree">
        <input type="checkbox" checked={form.terms} onChange={(e) => set({ terms: e.target.checked })} />
        <span>{tx.agree}</span>
      </label>
      {error && (
        <p className="pub-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="pub-button pub-submit" disabled={state === "sending"}>
        {state === "sending" ? (
          <>
            <Loader2 size={18} className="pub-spin" aria-hidden="true" /> {tx.submitting}
          </>
        ) : (
          tx.submit
        )}
      </button>
    </form>
  );
}
