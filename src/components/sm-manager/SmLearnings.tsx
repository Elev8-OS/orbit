"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { learningStrings } from "@/lib/sm-manager/learnings-i18n";
import { tipStrings } from "@/lib/sm-manager/tips-i18n";
import { Tip } from "./Tip";
import "./learnings.css";

export type Learning = {
  id: number;
  dimension: string;
  value: string;
  direction: "more" | "less";
  confidence: "solid" | "tentative";
  stats: { n: number; nRest: number; median: number; medianRest: number; ratio: number; p: number; tests?: number };
  action: { type: string; key?: string; hour?: number };
  status: string;
  decidedAt: string | null;
};

export type LearningsData = {
  run: { ranAt: string; eligible: number; needMore: number; enough: boolean; tested: number; found: number; clicksMode: boolean; totalClicks: number; minAgeDays: number } | null;
  proposed: Learning[];
  accepted: Learning[];
  dismissed: Learning[];
};

async function post(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: typeof json.error === "string" ? json.error : undefined };
  } catch {
    return { ok: false };
  }
}

export function SmLearnings({ locale, data }: { locale: "de" | "en"; data: LearningsData | null }) {
  const s = learningStrings(locale);
  const tp = tipStrings(locale);
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const loc = locale === "en" ? "en-GB" : "de-CH";

  async function act(key: string, url: string) {
    setBusy(key);
    setMsg(null);
    const r = await post(url);
    setBusy(null);
    if (r.ok) router.refresh();
    else setMsg(`${s.failed}${r.error ? `: ${r.error}` : ""}`);
  }

  const run = data?.run ?? null;
  const card = (l: Learning, kind: "proposed" | "accepted" | "dismissed") => (
    <li className="lrn-card" key={l.id}>
      <span style={{ display: "inline-flex", alignItems: "center" }}>
        <span className={`lrn-chip lrn-chip-${l.confidence}`}>{l.confidence === "solid" ? s.solid : s.tentative}</span>
        <Tip text={l.confidence === "solid" ? s.solidHelp : s.tentativeHelp} label={tp.label} />
      </span>
      <p>{s.describe(l)}</p>
      <p className="sm-muted sm-small">{s.effect(l.action) || (l.action.type === "info" ? s.info : "")}</p>
      <p className="sm-muted sm-small">{l.action.type === "info" ? "" : kind === "proposed" ? s.auto : ""}</p>
      <div className="lrn-btns">
        {kind === "proposed" ? (
          <>
            <button type="button" className="sm-btn sm-btn-primary" disabled={busy !== null} onClick={() => act(`a${l.id}`, `/api/sm-manager/learnings/${l.id}/accept`)}>
              {s.accept}
            </button>
            <Tip text={tp.accept} label={tp.label} />
            <button type="button" className="sm-btn" disabled={busy !== null} onClick={() => act(`d${l.id}`, `/api/sm-manager/learnings/${l.id}/dismiss`)}>
              {s.dismiss}
            </button>
            <Tip text={tp.dismiss} label={tp.label} />
          </>
        ) : kind === "accepted" ? (
          <button type="button" className="sm-btn" disabled={busy !== null} onClick={() => act(`d${l.id}`, `/api/sm-manager/learnings/${l.id}/dismiss`)}>
            {s.revoke}
          </button>
        ) : (
          <button type="button" className="sm-btn" disabled={busy !== null} onClick={() => act(`a${l.id}`, `/api/sm-manager/learnings/${l.id}/accept`)}>
            {s.reconsider}
          </button>
        )}
      </div>
    </li>
  );

  return (
    <section className="lrn">
      <div>
        <h2>{s.title}</h2>
        <p className="sm-muted sm-small">{s.intro}</p>
      </div>

      <div className="lrn-actions">
        <button type="button" className="sm-btn" disabled={busy !== null} onClick={() => act("run", "/api/sm-manager/learnings/run")}>
          {busy === "run" ? s.running : s.runNow}
        </button>
        <Tip text={tp.runNow} label={tp.label} />
        {run ? <span className="sm-muted sm-small">{s.lastRun(new Intl.DateTimeFormat(loc, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(run.ranAt)), run.eligible, run.tested)}</span> : null}
      </div>
      {msg ? <p className="sm-warn" role="status">{msg}</p> : null}

      {!data ? <p className="sm-warn">{s.failed}</p> : null}
      {data && !run ? <p className="sm-muted">{s.noRun}</p> : null}
      {run && !run.enough ? <p className="sm-warn">{s.notEnough(run.needMore, run.minAgeDays)}</p> : null}
      {run && run.enough && data && data.proposed.length === 0 && data.accepted.length === 0 ? <p className="sm-muted">{s.noFinding}</p> : null}

      {data && data.proposed.length ? (
        <div>
          <h3>{s.proposedTitle}</h3>
          <ul className="lrn-list">{data.proposed.map((l) => card(l, "proposed"))}</ul>
        </div>
      ) : null}
      {data && data.accepted.length ? (
        <div>
          <h3>{s.acceptedTitle}</h3>
          <ul className="lrn-list">{data.accepted.map((l) => card(l, "accepted"))}</ul>
        </div>
      ) : null}
      {data && data.dismissed.length ? (
        <div>
          <h3>{s.dismissedTitle}</h3>
          <ul className="lrn-list">{data.dismissed.map((l) => card(l, "dismissed"))}</ul>
        </div>
      ) : null}

      <details>
        <summary>{s.scoreTitle}</summary>
        <p className="sm-small">{s.score}</p>
        {run ? <p className="sm-muted sm-small">{run.clicksMode ? s.clicksOn : s.clicksOff}</p> : null}
      </details>
    </section>
  );
}
