"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Connection, Item, RunInfo, Settings } from "@/lib/radar/store";
import { radarStrings } from "@/lib/radar/i18n";
import "./radar.css";

type Props = {
  locale: "de" | "en";
  view: "open" | "done";
  items: Item[];
  counts: { open: number; high: number };
  connections: Connection[];
  settings: Settings;
  run: RunInfo | null;
  focusId: number | null;
  enabled: boolean;
  defaultInterests: string;
};

async function send(method: string, url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: typeof json.error === "string" ? json.error : undefined };
  } catch {
    return { ok: false };
  }
}

const KIND_LABEL: Record<string, string> = { slack: "Slack" };

export function RadarHome({ locale, view, items, counts, connections, settings, run, focusId, enabled, defaultInterests }: Props) {
  const s = radarStrings(locale);
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const running = starting || Boolean(run?.running);
  const focusRef = useRef<HTMLElement | null>(null);

  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { timeZone: settings.timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  // Während ein Lauf geht, alle 5 Sekunden neu laden (höchstens 5 Minuten)
  useEffect(() => {
    if (!running) return;
    let n = 0;
    const t = setInterval(() => {
      router.refresh();
      if (++n >= 60) clearInterval(t);
    }, 5000);
    return () => clearInterval(t);
  }, [running, router]);
  useEffect(() => {
    if (starting && run && !run.running && run.finishedAt) setStarting(false);
  }, [starting, run]);
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "center" });
  }, [focusId]);

  async function runNow() {
    setStarting(true);
    const r = await send("POST", "/api/radar/run");
    if (!r.ok) setStarting(false);
    router.refresh();
  }
  async function setStatus(id: number, status: Item["status"]) {
    await send("PATCH", `/api/radar/items/${id}`, { status });
    router.refresh();
  }

  return (
    <div className="p-page radar" lang={locale}>
      <header className="radar-head">
        <div>
          <h1>{s.title}</h1>
          <p className="radar-muted">{s.intro}</p>
          <p className="radar-muted radar-small">
            {!enabled ? s.notConfigured : run?.finishedAt ? s.lastRun(when(run.finishedAt), run.relevant) : s.neverRun}
            {run?.error ? <span className="radar-err"> · {s.runError}: {run.error}</span> : null}
          </p>
        </div>
        <button type="button" className="radar-btn radar-btn-primary" onClick={runNow} disabled={running || !connections.length}>
          {running ? s.running : s.runNow}
        </button>
      </header>

      <nav className="radar-tabs" aria-label={s.title}>
        <a href="/radar" aria-current={view === "open" ? "page" : undefined}>
          {s.tabOpen}
          {counts.open ? <span className="radar-count">{counts.open}</span> : null}
        </a>
        <a href="/radar?ansicht=done" aria-current={view === "done" ? "page" : undefined}>
          {s.tabDone}
        </a>
      </nav>

      {items.length === 0 ? (
        <p className="radar-empty">{view === "open" ? s.emptyOpen : s.emptyDone}</p>
      ) : (
        <ul className="radar-list">
          {items.map((it) => (
            <li
              key={it.id}
              ref={(el) => {
                if (it.id === focusId) focusRef.current = el;
              }}
              className={`radar-item radar-${it.relevance}${it.id === focusId ? " radar-focus" : ""}`}
            >
              <div className="radar-item-top">
                <span className={`radar-badge radar-badge-${it.relevance}`}>{it.relevance === "high" ? s.high : it.relevance === "low" ? s.low : s.normal}</span>
                <span className="radar-badge radar-badge-cat">{s.categories[it.category] ?? s.categories.other}</span>
                <span className="radar-muted radar-small">
                  {[KIND_LABEL[it.kind] ?? it.kind, it.channel, it.author, when(it.postedAt)].filter(Boolean).join(" · ")}
                </span>
              </div>
              <h2>{it.title || it.summary}</h2>
              {it.title && it.summary ? <p>{it.summary}</p> : null}
              {it.recommendation ? (
                <p className="radar-reco">
                  <strong>{s.recommendation}:</strong> {it.recommendation}
                </p>
              ) : null}
              {it.reason ? (
                <p className="radar-muted radar-small">
                  {s.reasonLabel}: {it.reason}
                </p>
              ) : null}
              <details className="radar-original">
                <summary>{s.original}</summary>
                <blockquote>{it.excerpt}</blockquote>
              </details>
              <div className="radar-actions">
                {it.url ? (
                  <a className="radar-btn radar-btn-primary" href={it.url} target="_blank" rel="noopener noreferrer">
                    {s.openInSource(KIND_LABEL[it.kind] ?? it.kind)} ↗
                  </a>
                ) : null}
                {it.status === "open" ? (
                  <>
                    <button type="button" className="radar-btn" onClick={() => setStatus(it.id, "done")}>
                      {s.markDone}
                    </button>
                    <button type="button" className="radar-btn" onClick={() => setStatus(it.id, "discarded")}>
                      {s.discard}
                    </button>
                  </>
                ) : (
                  <button type="button" className="radar-btn" onClick={() => setStatus(it.id, "open")}>
                    {s.reopen}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <SettingsPanel s={s} connections={connections} settings={settings} defaultInterests={defaultInterests} when={when} onChanged={() => router.refresh()} />
    </div>
  );
}

function SettingsPanel({
  s,
  connections,
  settings,
  defaultInterests,
  when,
  onChanged
}: {
  s: ReturnType<typeof radarStrings>;
  connections: Connection[];
  settings: Settings;
  defaultInterests: string;
  when: (iso: string) => string;
  onChanged: () => void;
}) {
  const [token, setToken] = useState("");
  const [channels, setChannels] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [hour, setHour] = useState(settings.runHour);
  const [active, setActive] = useState(settings.enabled);
  const [interests, setInterests] = useState(settings.interests);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const list = channels.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
    const r = await send("POST", "/api/radar/connections", { kind: "slack", token: token.trim(), channels: list });
    setBusy(false);
    if (r.ok) {
      setToken("");
      setChannels("");
      setMessage({ ok: true, text: s.saved });
      onChanged();
    } else setMessage({ ok: false, text: r.error || s.error });
  }
  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await send("PUT", "/api/radar/settings", { enabled: active, runHour: hour, interests });
    setBusy(false);
    setMessage(r.ok ? { ok: true, text: s.saved } : { ok: false, text: r.error || s.error });
    if (r.ok) onChanged();
  }
  async function toggle(c: Connection) {
    await send("PATCH", `/api/radar/connections/${c.id}`, { enabled: !c.enabled });
    onChanged();
  }
  async function remove(c: Connection) {
    if (!window.confirm(s.removeConfirm)) return;
    await send("DELETE", `/api/radar/connections/${c.id}`);
    onChanged();
  }

  return (
    <details className="radar-settings" open={connections.length === 0}>
      <summary>{s.settings}</summary>

      <section>
        <h3>{s.sources}</h3>
        {connections.length === 0 ? <p className="radar-muted">{s.noSources}</p> : null}
        <ul className="radar-conns">
          {connections.map((c) => {
            const list = (c.config as { channels?: { name: string }[] }).channels;
            const chans = Array.isArray(list) ? list.map((x) => `#${x.name}`).join(", ") : "";
            return (
              <li key={c.id}>
                <div>
                  <strong>{c.label}</strong> {!c.enabled ? <span className="radar-badge">{s.paused}</span> : null}
                  <div className="radar-muted radar-small">
                    {chans}
                    {c.lastRunAt ? ` · ${s.lastOk(when(c.lastRunAt))}` : ""}
                  </div>
                  {c.lastError ? <div className="radar-err radar-small">{c.lastError}</div> : null}
                </div>
                <div className="radar-actions">
                  <button type="button" className="radar-btn" onClick={() => toggle(c)}>
                    {c.enabled ? s.pause : s.resume}
                  </button>
                  <button type="button" className="radar-btn" onClick={() => remove(c)}>
                    {s.remove}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <form onSubmit={connect} className="radar-form">
          <h4>{s.addSlack}</h4>
          <label>
            {s.slackToken}
            <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} required />
            <small>{s.slackTokenHelp}</small>
          </label>
          <label>
            {s.slackChannels}
            <textarea rows={2} value={channels} onChange={(e) => setChannels(e.target.value)} placeholder="boostly-collab" required />
            <small>{s.slackChannelsHelp}</small>
          </label>
          <button type="submit" className="radar-btn radar-btn-primary" disabled={busy}>
            {busy ? s.connecting : s.connect}
          </button>
        </form>
        <p className="radar-muted radar-small">{s.soon}</p>
      </section>

      <section>
        <h3>{s.schedule}</h3>
        <form onSubmit={saveSettings} className="radar-form">
          <label className="radar-inline">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> {s.enabled}
          </label>
          <label>
            {s.hour}
            <select value={hour} onChange={(e) => setHour(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
            <small>{s.scheduleHelp(settings.timezone)}</small>
          </label>
          <label>
            {s.interests}
            <textarea rows={6} value={interests} onChange={(e) => setInterests(e.target.value)} placeholder={defaultInterests} />
            <small>{s.interestsHelp}</small>
          </label>
          <button type="submit" className="radar-btn radar-btn-primary" disabled={busy}>
            {s.save}
          </button>
        </form>
      </section>

      {message ? (
        <p className={message.ok ? "radar-ok" : "radar-err"} role="status">
          {message.text}
        </p>
      ) : null}
    </details>
  );
}
