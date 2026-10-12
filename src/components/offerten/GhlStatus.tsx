"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, RefreshCw, X } from "lucide-react";
import type { GhlSyncResult, Quote } from "@/lib/offerten/store";
import { ContactPicker, type Prefill } from "./ContactPicker";

/** Ergebnis der GHL-Ablage einer versendeten Offerte, mit erneutem Ablegen und nachträglicher Kontaktzuordnung. */
export function GhlStatus({ quote, ghlEnabled, onUpdated }: { quote: Quote; ghlEnabled: boolean; onUpdated: (q: Quote) => void }) {
  const t = useTranslations("offerten.editor.ghl");
  const tr = useTranslations("offerten.editor.recipient");
  const [busy, setBusy] = useState(false);
  const sync = quote.ghlSync;

  const retry = async (link?: Prefill) => {
    setBusy(true);
    const res = await fetch(`/api/offerten/${quote.id}/ghl-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        link ? { ghlContactId: link.ghlContactId, ghlOpportunityId: link.ghlOpportunityId, ghlPipelineId: link.ghlPipelineId } : {}
      )
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return;
    const data = (await res.json()) as { ghl: GhlSyncResult };
    onUpdated({
      ...quote,
      ghlSync: data.ghl,
      ...(link ? { ghlContactId: link.ghlContactId, ghlOpportunityId: link.ghlOpportunityId, ghlPipelineId: link.ghlPipelineId } : {})
    });
  };

  if (!ghlEnabled) return null;
  const step = (label: string, s?: { ok: boolean; error?: string; skipped?: string }, extra?: string) => {
    if (!s) return null;
    const state = s.skipped ? "skipped" : s.ok ? "ok" : "failed";
    return (
      <li className={`of-step of-step-${state}`}>
        {state === "ok" ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
        <span>
          <strong>{label}</strong> {t(state)}
          {extra && state === "ok" ? ` · ${extra}` : ""}
          {s.error ? ` · ${s.error}` : ""}
          {s.skipped ? ` · ${s.skipped}` : ""}
        </span>
      </li>
    );
  };
  const failed = !sync || [sync.file, sync.note, sync.opportunity].some((s) => s && !s.ok);

  return (
    <div className="of-ghl-status">
      <h3 className="of-h3">{t("title")}</h3>
      {sync && (
        <ul className="of-steps">
          {step(t("file"), sync.file, sync.file?.target === "contact_field" ? t("contactField") : t("media"))}
          {step(t("note"), sync.note)}
          {step(t("opportunity"), sync.opportunity, sync.opportunity?.stage ? t("stage", { stage: sync.opportunity.stage }) : undefined)}
        </ul>
      )}
      <div className="of-ghl-actions">
        {!quote.ghlContactId ? (
          <ContactPicker label={tr("link")} onPick={(p) => retry(p)} />
        ) : (
          failed && (
            <button type="button" className="button-secondary" disabled={busy} onClick={() => retry()}>
              <RefreshCw size={16} aria-hidden="true" />
              {busy ? t("retrying") : t("retry")}
            </button>
          )
        )}
      </div>
    </div>
  );
}
