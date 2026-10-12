"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { PipelineView } from "@/lib/sales/service";
import { ToastProvider, formatMoney, post, useFormat, useToast, type Locale } from "./shared";

type Props = { view: PipelineView; locale: Locale; currency: string; staleDays: number };

export function PipelineBoard(props: Props) {
  return (
    <ToastProvider>
      <Board {...props} />
    </ToastProvider>
  );
}

type Deal = PipelineView["active"] extends infer A ? (A extends { stages: (infer S)[] } ? (S extends { deals: (infer D)[] } ? D : never) : never) : never;

function Board({ view, locale, currency, staleDays }: Props) {
  const t = useTranslations("sales.pipeline");
  const router = useRouter();
  const toast = useToast();
  const f = useFormat(locale);
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [closed, setClosed] = useState<Set<string>>(new Set());

  if (!view.active) return <p className="sl-empty">{t("empty")}</p>;
  const active = view.active;

  const all: Deal[] = active.stages.flatMap((s) => s.deals).filter((d) => !closed.has(d.id));
  const stageOf = (d: Deal) => moved[d.id] ?? d.stageId;
  const total = all.reduce((s, d) => s + (d.value ?? 0), 0);

  const move = async (deal: Deal, stageId: string) => {
    const before = stageOf(deal);
    setMoved((m) => ({ ...m, [deal.id]: stageId }));
    const { ok } = await post(`/api/sales/opportunities/${encodeURIComponent(deal.id)}`, { stageId });
    if (!ok) {
      setMoved((m) => ({ ...m, [deal.id]: before }));
      toast({ text: t("failed"), tone: "error" });
    } else {
      toast({ text: t("moved", { stage: active.stages.find((s) => s.id === stageId)?.name ?? "" }), tone: "ok" });
    }
  };

  const close = async (deal: Deal, status: "won" | "lost") => {
    setClosed((c) => new Set(c).add(deal.id));
    const { ok } = await post(`/api/sales/opportunities/${encodeURIComponent(deal.id)}`, { status });
    if (!ok) {
      setClosed((c) => {
        const n = new Set(c);
        n.delete(deal.id);
        return n;
      });
      toast({ text: t("failed"), tone: "error" });
    } else {
      toast({
        text: status === "won" ? t("wonToast") : t("lostToast"),
        tone: "ok",
        action: {
          label: t("undo"),
          run: async () => {
            const res = await post(`/api/sales/opportunities/${encodeURIComponent(deal.id)}`, { status: "open" });
            if (res.ok)
              setClosed((c) => {
                const n = new Set(c);
                n.delete(deal.id);
                return n;
              });
          }
        }
      });
    }
  };

  return (
    <div className="sl-pipeline">
      <header className="sl-pipeline-head">
        <div>
          <h1>{active.name}</h1>
          <p className="sl-hero-line">{t("summary", { count: all.length, value: formatMoney(total, currency, locale) })}</p>
        </div>
        {view.pipelines.length > 1 && (
          <nav className="chips" aria-label={t("choose")}>
            {view.pipelines.map((p) => (
              <button
                key={p.id}
                type="button"
                className="chip"
                aria-pressed={p.id === active.id}
                onClick={() => router.push(`/sales/pipeline?p=${encodeURIComponent(p.id)}`)}
              >
                {p.name}
                <span className="sl-chip-count">{p.count}</span>
              </button>
            ))}
          </nav>
        )}
      </header>

      <div className="sl-board" role="list">
        {active.stages.map((stage) => {
          const deals = all.filter((d) => stageOf(d) === stage.id);
          const sum = deals.reduce((s, d) => s + (d.value ?? 0), 0);
          return (
            <section key={stage.id} className="sl-stage" role="listitem" aria-label={stage.name}>
              <header className="sl-stage-head">
                <h2>{stage.name}</h2>
                <span className="sl-muted">
                  {deals.length}
                  {sum > 0 && `, ${formatMoney(sum, currency, locale)}`}
                </span>
              </header>
              {deals.length === 0 ? (
                <p className="sl-stage-empty">{t("stageEmpty")}</p>
              ) : (
                <ul className="sl-deals">
                  {deals.map((d) => (
                    <li key={d.id} className={d.stale ? "sl-deal is-stale" : "sl-deal"}>
                      <a className="sl-deal-main" href={d.contactId ? `/sales/kontakt/${d.contactId}` : undefined}>
                        <strong>{d.company || d.contactName || d.name}</strong>
                        <span className="sl-muted">{d.company && d.contactName ? d.contactName : d.name !== (d.company || d.contactName) ? d.name : ""}</span>
                      </a>
                      <div className="sl-deal-meta">
                        {d.value != null && d.value > 0 && <span className="sl-deal-value">{formatMoney(d.value, currency, locale)}</span>}
                        {d.stale && d.lastActivity && (
                          <span className="sl-stale" title={t("staleHint", { days: staleDays })}>
                            {t("quiet", { since: f.relativeDay(d.lastActivity) })}
                          </span>
                        )}
                      </div>
                      <div className="sl-deal-actions">
                        <label>
                          <span className="sl-sr">{t("stage")}</span>
                          <select value={stageOf(d)} onChange={(e) => move(d, e.target.value)}>
                            {active.stages.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button type="button" className="button-ghost" onClick={() => close(d, "won")}>
                          {t("won")}
                        </button>
                        <button type="button" className="button-ghost" onClick={() => close(d, "lost")}>
                          {t("lost")}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
