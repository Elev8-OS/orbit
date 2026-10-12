"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, CornerDownLeft, Loader2, RotateCcw, Search, Send, Sparkles, X } from "lucide-react";
import { DynamicIcon } from "./DynamicIcon";
import { PALETTE_EVENT, useOpenTarget, type Target } from "./target";
import { RichText } from "./RichText";

type Hit = { id: string; title: string; meta?: string; icon?: string; target: Target };
type Group = { id: string; title: string; hits: Hit[] };
type Message = { role: "user" | "assistant"; content: string; links?: { label: string; target: Target }[]; error?: boolean };

const CHAT_KEY = "orbit:noah";

/**
 * Globale Suche und Noah (⌘K / Strg+K).
 * Suche: Apps, Kunden, Offerten, E-Mails und Treffer aus angebundenen Apps.
 * Noah: Fragen in normaler Sprache, mit Zugriff auf die Daten, die die Person sehen darf.
 */
export function CommandPalette({ activeApp }: { activeApp: string | null }) {
  const t = useTranslations("platform.palette");
  const openTarget = useOpenTarget();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"search" | "noah">("search");
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [chat, setChat] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  // Verknüpfung aus der installierten App: /?palette=1 öffnet die Suche direkt
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("palette") === "1") {
      url.searchParams.delete("palette");
      window.history.replaceState(window.history.state, "", url.pathname + url.search);
      setOpen(true);
    }
  }, []);

  // Gespräch mit Noah bleibt für diese Browser-Sitzung erhalten
  useEffect(() => {
    try {
      setChat(JSON.parse(sessionStorage.getItem(CHAT_KEY) ?? "[]"));
    } catch {
      /* ignorieren */
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_KEY, JSON.stringify(chat.slice(-30)));
    } catch {
      /* ignorieren */
    }
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [chat]);

  const show = useCallback((m: "search" | "noah") => {
    restoreFocus.current = document.activeElement as HTMLElement | null;
    setMode(m);
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    restoreFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) close();
        else show("search");
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        close();
      }
    };
    const onEvent = (e: Event) => show(((e as CustomEvent).detail?.mode as "search" | "noah") ?? "search");
    // Eingebettete Orbit-Seiten (Kunden, Assistent) können die Suche ebenfalls öffnen
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === "orbit:palette") show(e.data.mode === "noah" ? "noah" : "search");
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_EVENT, onEvent);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_EVENT, onEvent);
      window.removeEventListener("message", onMessage);
    };
  }, [open, show, close]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => (mode === "search" ? inputRef.current : chatInputRef.current)?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open, mode]);

  // Suche mit kurzer Verzögerung
  useEffect(() => {
    if (!open || mode !== "search") return;
    const q = query.trim();
    if (q.length < 2) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal, cache: "no-store" });
        const json = (await res.json()) as { groups?: Group[] };
        setGroups(json.groups ?? []);
        setCursor(0);
      } catch {
        if (!ctrl.signal.aborted) setGroups([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      ctrl.abort();
      window.clearTimeout(id);
    };
  }, [query, open, mode]);

  const flat = useMemo(() => groups.flatMap((g) => g.hits), [groups]);
  const askRow = query.trim().length > 0;
  const total = flat.length + (askRow ? 1 : 0);

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || thinking) return;
      const next: Message[] = [...chat, { role: "user", content: text }];
      setChat(next);
      setDraft("");
      setThinking(true);
      try {
        const res = await fetch("/api/noah", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next.filter((m) => !m.error).map(({ role, content }) => ({ role, content })), app: activeApp })
        });
        const json = (await res.json().catch(() => ({}))) as { answer?: string; links?: Message["links"]; error?: string };
        if (!res.ok || !json.answer) {
          const key = json.error === "not_configured" ? "notConfigured" : json.error === "rate_limited" ? "rateLimited" : "failed";
          setChat([...next, { role: "assistant", content: t(`errors.${key}`), error: true }]);
        } else {
          setChat([...next, { role: "assistant", content: json.answer, links: json.links ?? [] }]);
        }
      } catch {
        setChat([...next, { role: "assistant", content: t("errors.failed"), error: true }]);
      } finally {
        setThinking(false);
      }
    },
    [chat, thinking, activeApp, t]
  );

  const choose = (index: number) => {
    if (askRow && index === flat.length) {
      setMode("noah");
      void ask(query);
      setQuery("");
      return;
    }
    const hit = flat[index];
    if (!hit) return;
    close();
    openTarget(hit.target);
  };

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (total ? (c + 1) % total : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (total ? (c - 1 + total) % total : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(cursor);
    } else if (e.key === "Tab" && !e.shiftKey && query.trim()) {
      e.preventDefault();
      setMode("noah");
      setDraft(query);
    }
  };

  if (!open) return null;
  let index = -1;

  return (
    <div className="p-palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="p-palette" role="dialog" aria-modal="true" aria-label={mode === "search" ? t("searchTitle") : t("noahTitle")}>
        <div className="p-palette-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "search"} onClick={() => setMode("search")}>
            <Search size={15} aria-hidden="true" />
            {t("searchTab")}
          </button>
          <button type="button" role="tab" aria-selected={mode === "noah"} onClick={() => setMode("noah")}>
            <Sparkles size={15} aria-hidden="true" />
            {t("noahTab")}
          </button>
          <span className="p-palette-hint" aria-hidden="true">
            ⌘K
          </span>
          <button type="button" className="p-icon-button" onClick={close} aria-label={t("close")}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {mode === "search" ? (
          <>
            <div className="p-palette-input">
              <Search size={18} aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKey}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchPlaceholder")}
                role="combobox"
                aria-expanded={total > 0}
                aria-controls="p-palette-results"
                aria-activedescendant={total ? `p-hit-${cursor}` : undefined}
                autoComplete="off"
                spellCheck={false}
              />
              {loading && <Loader2 size={16} className="p-spin" aria-hidden="true" />}
            </div>
            <div className="p-palette-results" id="p-palette-results" role="listbox">
              {query.trim().length < 2 ? (
                <p className="p-palette-empty">{t("searchHint")}</p>
              ) : (
                <>
                  {groups.map((g) => (
                    <div key={g.id} className="p-palette-group" role="group" aria-label={g.title}>
                      <p className="p-palette-group-title">{g.title}</p>
                      {g.hits.map((hit) => {
                        index++;
                        const i = index;
                        return (
                          <button
                            key={hit.id}
                            id={`p-hit-${i}`}
                            type="button"
                            role="option"
                            aria-selected={cursor === i}
                            className="p-palette-hit"
                            onMouseEnter={() => setCursor(i)}
                            onClick={() => choose(i)}
                          >
                            <span className="p-palette-hit-icon" aria-hidden="true">
                              <DynamicIcon name={hit.icon} size={16} />
                            </span>
                            <span className="p-palette-hit-text">
                              <span className="p-palette-hit-title">{hit.title}</span>
                              {hit.meta && <span className="p-palette-hit-meta">{hit.meta}</span>}
                            </span>
                            {cursor === i && <CornerDownLeft size={14} aria-hidden="true" className="p-palette-enter" />}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                  {!loading && groups.length === 0 && <p className="p-palette-empty">{t("noResults", { query: query.trim() })}</p>}
                  <button
                    id={`p-hit-${flat.length}`}
                    type="button"
                    role="option"
                    aria-selected={cursor === flat.length}
                    className="p-palette-hit p-palette-ask"
                    onMouseEnter={() => setCursor(flat.length)}
                    onClick={() => choose(flat.length)}
                  >
                    <span className="p-palette-hit-icon" aria-hidden="true">
                      <Sparkles size={16} />
                    </span>
                    <span className="p-palette-hit-text">
                      <span className="p-palette-hit-title">{t("askNoah", { query: query.trim() })}</span>
                    </span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="p-noah">
            <div className="p-noah-log" aria-live="polite">
              {chat.length === 0 && (
                <div className="p-noah-intro">
                  <p className="p-noah-intro-title">{t("noahIntroTitle")}</p>
                  <p>{t("noahIntro")}</p>
                  <div className="p-noah-examples">
                    {(["example1", "example2", "example3"] as const).map((k) => (
                      <button key={k} type="button" className="p-chip" onClick={() => void ask(t(k))}>
                        {t(k)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chat.map((m, i) => (
                <div key={i} className={`p-noah-msg is-${m.role}${m.error ? " is-error" : ""}`}>
                  {m.role === "assistant" ? <RichText text={m.content} /> : <p>{m.content}</p>}
                  {m.links && m.links.length > 0 && (
                    <div className="p-noah-links">
                      {m.links.map((l, j) => (
                        <button
                          key={j}
                          type="button"
                          className="p-chip"
                          onClick={() => {
                            close();
                            openTarget(l.target);
                          }}
                        >
                          {l.label}
                          <ArrowRight size={13} aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {thinking && (
                <div className="p-noah-msg is-assistant is-thinking" role="status">
                  <Loader2 size={15} className="p-spin" aria-hidden="true" /> {t("thinking")}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <form
              className="p-noah-input"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(draft);
              }}
            >
              <textarea
                ref={chatInputRef}
                value={draft}
                rows={2}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void ask(draft);
                  }
                }}
                placeholder={t("noahPlaceholder")}
                aria-label={t("noahPlaceholder")}
                maxLength={4000}
              />
              <div className="p-noah-actions">
                {chat.length > 0 && (
                  <button type="button" className="p-icon-button" onClick={() => setChat([])} aria-label={t("newChat")} title={t("newChat")}>
                    <RotateCcw size={15} aria-hidden="true" />
                  </button>
                )}
                <button type="submit" className="p-button-primary" disabled={!draft.trim() || thinking}>
                  <Send size={15} aria-hidden="true" />
                  {t("send")}
                </button>
              </div>
            </form>
            <p className="p-noah-note">{t("noahNote")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
