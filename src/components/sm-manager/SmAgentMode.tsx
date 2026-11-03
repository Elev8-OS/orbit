"use client";

import { useCallback, useEffect, useState } from "react";
import { leaStrings } from "@/lib/sm-manager/lea-i18n";
import { tipStrings } from "@/lib/sm-manager/tips-i18n";
import { Tip } from "./Tip";
import "./inquiries.css";
import "./agentmode.css";

type Mode = "review" | "auto" | "window";
type Settings = { mode: Mode; from: number; to: number; tz: string; zones: Record<string, string>; autoNow: boolean; hourNow: number };

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const hh = (n: number) => `${String(n).padStart(2, "0")}:00`;

// Uhrzeit in einer Zeitzone, direkt im Browser berechnet (gilt für die gewählte Zone, nicht nur für die gespeicherte)
const clock = (tz: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(new Date());
const hourOf = (tz: string) => Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(new Date()));
// Gleiche Regel wie in der Engine: [von, bis), über Mitternacht möglich
const inWindow = (h: number, from: number, to: number) => (from === to ? false : from < to ? h >= from && h < to : h >= from || h < to);

/** Schalter für Lea: immer freigeben, immer automatisch oder automatisch in einem Zeitfenster. */
export function SmAgentMode({ locale }: { locale: "de" | "en" }) {
  const s = leaStrings(locale);
  const tp = tipStrings(locale);
  const [data, setData] = useState<Settings | null>(null);
  const [mode, setMode] = useState<Mode>("review");
  const [from, setFrom] = useState(22);
  const [to, setTo] = useState(8);
  const [tz, setTz] = useState("Europe/Zurich");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [, setTick] = useState(0);

  const load = useCallback(async (intoForm: boolean) => {
    try {
      const res = await fetch("/api/sm-manager/agent-settings", { cache: "no-store" });
      if (!res.ok) throw new Error("load");
      const j = (await res.json()) as Settings;
      setData(j);
      setLoadFailed(false);
      if (intoForm) {
        setMode(j.mode);
        setFrom(j.from);
        setTo(j.to);
        setTz(j.tz);
      }
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void load(true);
    // Ob Lea gerade automatisch antwortet, ändert sich mit der Uhrzeit
    const t = setInterval(() => void load(false), 60_000);
    // Die angezeigte Uhrzeit läuft mit
    const c = setInterval(() => setTick((n) => n + 1), 20_000);
    return () => {
      clearInterval(t);
      clearInterval(c);
    };
  }, [load]);

  if (loadFailed && !data) {
    return (
      <article className="inq-card agm">
        <h3>{s.title}</h3>
        <p className="sm-warn">{s.loadFailed}</p>
      </article>
    );
  }
  if (!data) return null;

  const zones = data.zones;
  const sameHours = mode === "window" && from === to;
  const dirty = mode !== data.mode || (mode === "window" && (from !== data.from || to !== data.to || tz !== data.tz));
  // Was die aktuelle Auswahl (noch nicht gespeichert) jetzt bewirken würde
  const previewAuto = mode === "auto" || (mode === "window" && inWindow(hourOf(tz), from, to));

  async function save() {
    if (mode === "auto" && !window.confirm(s.confirmAuto)) return;
    if (mode === "window" && !window.confirm(s.confirmWindow(from, to, zones[tz] ?? tz))) return;
    setBusy(true);
    setMsg(s.saving);
    try {
      const res = await fetch("/api/sm-manager/agent-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, from, to, tz }) });
      const json = (await res.json().catch(() => ({}))) as Settings & { error?: string };
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "");
      setData(json);
      setMsg(s.saved);
    } catch (e) {
      setMsg(`${s.failed}${e instanceof Error && e.message ? `: ${e.message}` : ""}`);
    }
    setBusy(false);
  }

  const option = (value: Mode, label: string, help: string) => (
    <label className="agm-opt" data-on={mode === value}>
      <input type="radio" name="lea-mode" value={value} checked={mode === value} onChange={() => setMode(value)} />
      <span>
        <strong>{label}</strong>
        <span className="sm-muted sm-small">{help}</span>
      </span>
    </label>
  );

  return (
    <article className="inq-card agm">
      <h3>
        {s.title}
        <Tip text={s.titleTip} label={tp.label} />
      </h3>
      <p className={`agm-state ${data.autoNow ? "agm-state-on" : ""}`}>{data.autoNow ? s.nowAuto : s.nowReview}</p>

      <fieldset className="agm-opts">
        {option("review", s.modeReview, s.modeReviewHelp)}
        {option("auto", s.modeAuto, s.modeAutoHelp)}
        {option("window", s.modeWindow, s.modeWindowHelp)}
      </fieldset>

      {mode === "window" ? (
        <>
          <div className="agm-window">
            <label>
              {s.from}
              <select value={from} onChange={(e) => setFrom(Number(e.target.value))}>
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hh(h)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {s.to}
              <select value={to} onChange={(e) => setTo(Number(e.target.value))}>
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hh(h)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {s.zone}
              <select value={tz} onChange={(e) => setTz(e.target.value)}>
                {Object.entries(zones).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <Tip text={s.windowTip} label={tp.label} />
          </div>
          {sameHours ? <p className="sm-warn">{s.sameHours}</p> : <p className="sm-muted sm-small">{s.windowSummary(from, to, zones[tz] ?? tz, clock(tz))}</p>}
        </>
      ) : null}

      {dirty && !sameHours ? <p className="sm-muted sm-small">{previewAuto ? s.previewAuto : s.previewReview}</p> : null}

      {mode !== "review" ? <p className="sm-muted sm-small">{s.safety}</p> : null}

      <div className="agm-actions">
        <button type="button" className="sm-btn sm-btn-primary" onClick={save} disabled={busy || !dirty || sameHours}>
          {s.save}
        </button>
        {msg ? (
          <span className="sm-muted sm-small" role="status">
            {msg}
          </span>
        ) : null}
      </div>
    </article>
  );
}
