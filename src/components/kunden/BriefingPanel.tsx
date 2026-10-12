"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import type { Briefing } from "@/lib/kunden/service";

type Labels = {
  title: string;
  create: string;
  refresh: string;
  working: string;
  error: string;
  notConfigured: string;
  openPoints: string;
  risks: string;
  nextStep: string;
  created: string;
  intro: string;
  moods: Record<Briefing["mood"], string>;
};

/** Kurzbriefing von Noah: Stand, offene Punkte, Risiken, nächster Schritt. */
export function BriefingPanel({ contactId, initial, labels }: { contactId: string; initial: Briefing | null; labels: Labels }) {
  const [briefing, setBriefing] = useState<Briefing | null>(initial);
  const [state, setState] = useState<"idle" | "working" | "error" | "not_configured">("idle");

  const create = async () => {
    setState("working");
    try {
      const res = await fetch(`/api/kunden/${encodeURIComponent(contactId)}/briefing`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { briefing?: Briefing; error?: string };
      if (!res.ok || !json.briefing) {
        setState(json.error === "not_configured" ? "not_configured" : "error");
        return;
      }
      setBriefing(json.briefing);
      setState("idle");
    } catch {
      setState("error");
    }
  };

  return (
    <section className="p-card p-briefing" aria-labelledby="briefing-title">
      <div className="p-briefing-head">
        <h2 id="briefing-title" className="p-card-title">
          <Sparkles size={16} aria-hidden="true" />
          {labels.title}
        </h2>
        {briefing && <span className={`p-mood is-${briefing.mood}`}>{labels.moods[briefing.mood]}</span>}
        <button type="button" className={briefing ? "button-ghost" : "p-button-primary"} onClick={create} disabled={state === "working"}>
          {state === "working" ? <Loader2 size={15} className="p-spin" aria-hidden="true" /> : briefing ? <RefreshCw size={15} aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
          {state === "working" ? labels.working : briefing ? labels.refresh : labels.create}
        </button>
      </div>
      {state === "error" && <p className="p-error">{labels.error}</p>}
      {state === "not_configured" && <p className="p-error">{labels.notConfigured}</p>}
      {briefing ? (
        <div className="p-briefing-body">
          <p className="p-briefing-headline">{briefing.headline}</p>
          <p>{briefing.status}</p>
          <div className="p-briefing-cols">
            {briefing.openPoints.length > 0 && (
              <div>
                <h3>{labels.openPoints}</h3>
                <ul>
                  {briefing.openPoints.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {briefing.risks.length > 0 && (
              <div>
                <h3>{labels.risks}</h3>
                <ul>
                  {briefing.risks.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <p className="p-briefing-next">
            <strong>{labels.nextStep}:</strong> {briefing.nextStep}
          </p>
          <p className="p-muted">{labels.created.replace("%date%", new Date(briefing.createdAt).toLocaleString())}</p>
        </div>
      ) : (
        state !== "working" && <p className="p-muted">{labels.intro}</p>
      )}
    </section>
  );
}
