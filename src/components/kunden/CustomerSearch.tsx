"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, Search } from "lucide-react";

type Contact = { id: string; name: string; company: string; email: string; phone: string; tags: string[] };
export type Recent = { id: string; name: string; company: string };
export const RECENT_KEY = "orbit:kunden-recent";

export function CustomerSearch({ labels }: { labels: { placeholder: string; recent: string; none: string; error: string; hint: string } }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Contact[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [recent, setRecent] = useState<Recent[]>([]);

  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"));
    } catch {
      /* ignorieren */
    }
  }, []);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setState("idle");
      return;
    }
    setState("loading");
    const ctrl = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/kunden/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error();
        setResults(((await res.json()) as { contacts: Contact[] }).contacts);
        setState("idle");
      } catch {
        if (!ctrl.signal.aborted) setState("error");
      }
    }, 250);
    return () => {
      ctrl.abort();
      window.clearTimeout(id);
    };
  }, [q]);

  const showRecent = q.trim().length < 2 && recent.length > 0;
  return (
    <div className="p-customer-search">
      <label className="p-search-field">
        <Search size={18} aria-hidden="true" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.placeholder} aria-label={labels.placeholder} type="search" />
        {state === "loading" && <Loader2 size={16} className="p-spin" aria-hidden="true" />}
      </label>
      {q.trim().length < 2 && !showRecent && <p className="p-muted">{labels.hint}</p>}
      {state === "error" && <p className="p-error">{labels.error}</p>}
      {showRecent && <p className="p-list-title">{labels.recent}</p>}
      <ul className="p-list">
        {(showRecent ? recent.map((r) => ({ ...r, email: "", phone: "", tags: [] as string[] })) : results).map((c) => (
          <li key={c.id}>
            <a className="p-list-row" href={`/kunden/${c.id}`}>
              <span className="p-avatar" aria-hidden="true">
                <Building2 size={16} />
              </span>
              <span className="p-list-text">
                <span className="p-list-name">{c.company || c.name || c.email}</span>
                <span className="p-list-meta">{[c.company ? c.name : "", c.email, c.phone].filter(Boolean).join(" · ")}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {!showRecent && q.trim().length >= 2 && state === "idle" && results.length === 0 && <p className="p-muted">{labels.none}</p>}
    </div>
  );
}
