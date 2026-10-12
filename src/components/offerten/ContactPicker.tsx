"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import type { Recipient } from "@/lib/offerten/quote";

export type Prefill = {
  recipient: Recipient;
  language: "de" | "en" | null;
  units: number | null;
  ghlContactId: string;
  ghlOpportunityId: string | null;
  ghlPipelineId: string | null;
};

type Hit = { id: string; name: string; email: string; company: string };

/** GHL-Kontakt suchen und übernehmen (Empfängerdaten, Opportunity, Pipeline). */
export function ContactPicker({ label, onPick }: { label: string; onPick: (p: Prefill) => void }) {
  const t = useTranslations("offerten.newDialog");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits(null);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/offerten/ghl/contacts?q=${encodeURIComponent(q.trim())}`).catch(() => null);
      setHits(res?.ok ? ((await res.json()) as { contacts: Hit[] }).contacts : []);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

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
      {hits && hits.length === 0 && <p className="of-muted of-small">{t("noResults")}</p>}
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
