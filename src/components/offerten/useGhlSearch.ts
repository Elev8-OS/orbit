"use client";

import { useEffect, useState } from "react";

export type ContactHit = { id: string; name: string; email: string; company: string };
export type SearchError = "wrong_location" | "failed" | null;

/** GHL-Kontaktsuche mit Verzögerung beim Tippen. Verbindungsfehler werden gemeldet, nicht als "kein Treffer" versteckt. */
export function useGhlSearch(q: string, enabled = true) {
  const [hits, setHits] = useState<ContactHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<SearchError>(null);

  useEffect(() => {
    if (!enabled || q.trim().length < 2) {
      setHits(null);
      setError(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/offerten/ghl/contacts?q=${encodeURIComponent(q.trim())}`).catch(() => null);
      const data = (await res?.json().catch(() => null)) as { contacts?: ContactHit[]; error?: string } | null;
      if (res?.ok && data?.contacts) {
        setHits(data.contacts);
        setError(null);
      } else {
        setHits(null);
        setError(data?.error === "ghl_wrong_location" ? "wrong_location" : "failed");
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [q, enabled]);

  return { hits, searching, error };
}
