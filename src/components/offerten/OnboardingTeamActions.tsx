"use client";

import { useState } from "react";
import { Copy, ExternalLink, Rocket, RotateCcw } from "lucide-react";

/** Aktionen des Teams auf der Onboarding-Seite: Link für den Kunden kopieren, live markieren, wieder öffnen. */
export function OnboardingTeamActions({
  id,
  customerPath,
  status: initial,
  labels
}: {
  id: string;
  customerPath: string;
  status: "open" | "live";
  labels: { copyLink: string; copied: string; customerView: string; markLive: string; reopen: string; failed: string };
}) {
  const [status, setStatus] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const setLive = async (next: "open" | "live") => {
    setBusy(true);
    setError(false);
    const res = await fetch(`/api/offerten/onboarding/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next })
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) setStatus(next);
    else setError(true);
  };

  return (
    <div className="of-editor-actions" style={{ flexWrap: "wrap" }}>
      <button
        type="button"
        className="button-secondary"
        onClick={async () => {
          await navigator.clipboard?.writeText(`${window.location.origin}${customerPath}`).catch(() => null);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        <Copy size={16} aria-hidden="true" /> {copied ? labels.copied : labels.copyLink}
      </button>
      <a className="button-secondary" href={customerPath} target="_blank" rel="noreferrer">
        <ExternalLink size={16} aria-hidden="true" /> {labels.customerView}
      </a>
      {status === "open" ? (
        <button type="button" className="button-yellow" disabled={busy} onClick={() => setLive("live")}>
          <Rocket size={16} aria-hidden="true" /> {labels.markLive}
        </button>
      ) : (
        <button type="button" className="button-ghost" disabled={busy} onClick={() => setLive("open")}>
          <RotateCcw size={16} aria-hidden="true" /> {labels.reopen}
        </button>
      )}
      {error && <p className="form-error">{labels.failed}</p>}
    </div>
  );
}
