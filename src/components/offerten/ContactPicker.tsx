"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import type { ContactPerson, Recipient } from "@/lib/offerten/quote";
import { useGhlSearch } from "./useGhlSearch";

export type Prefill = {
  recipient: Recipient;
  language: "de" | "en" | null;
  units: number | null;
  ghlContactId: string;
  ghlOpportunityId: string | null;
  ghlPipelineId: string | null;
  contactPerson: ContactPerson | null;
};

/** GHL-Kontakt suchen und übernehmen (Empfängerdaten, Land, Opportunity, Owner). */
export function ContactPicker({ label, onPick }: { label: string; onPick: (p: Prefill) => void }) {
  const t = useTranslations("offerten.newDialog");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const { hits, searching, error } = useGhlSearch(q, open);

  const pick = async (id: string) => {
    setBusy(true);
    const res = await fetch(`/api/offerten/ghl/contacts/${encodeURIComponent(id)}`).catch(() => null);
    setBusy(false);
    if (!res?.ok) return;
    onPick(((await res.json()) as { prefill: Prefill }).prefill);
    setOpen(false);
    setQ("");
  };

  if (!open) {
    return (
      <button type="button" className="button-ghost" onClick={() => setOpen(true)}>
        <Search size={16} aria-hidden="true" /> {label}
      </button>
    );
  }
  return (
    <div className="of-picker">
      <span className="of-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          autoFocus
          value={q}
          placeholder={t("searchPlaceholder")}
          aria-label={t("search")}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        />
      </span>
      {searching && <p className="of-muted of-small">{t("searching")}</p>}
      {error && <p className="form-error">{t(error === "wrong_location" ? "ghlWrongLocation" : "ghlFailed")}</p>}
      {hits && hits.length === 0 && !searching && <p className="of-muted of-small">{t("noResults")}</p>}
      {hits && hits.length > 0 && (
        <ul className="of-hits">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" className="of-hit" disabled={busy} onClick={() => pick(h.id)}>
                <span className="of-hit-name">{h.name || h.email}</span>
                <span className="of-muted">{[h.company, h.email].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="button-ghost" onClick={() => setOpen(false)}>
        {t("cancel")}
      </button>
    </div>
  );
}
