"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import type { TodayCard } from "@/lib/platform/today";
import { useOpenTarget } from "./target";
import { PushPrompt } from "@/components/push/PushPrompt";

type Props = {
  title: string;
  date: string;
  empty: string;
  cards: (TodayCard & { iconNode: ReactNode })[];
  labels: { hide: string; show: string; more: string };
};

const HIDE_KEY = "orbit:today-hidden";
const MAX_ITEMS = 5;

export function MyDayView({ title, date, empty, cards, labels }: Props) {
  const openTarget = useOpenTarget();
  const [hidden, setHidden] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(HIDE_KEY) === "1");
    } catch {
      /* ignorieren */
    }
  }, []);
  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    try {
      localStorage.setItem(HIDE_KEY, next ? "1" : "0");
    } catch {
      /* ignorieren */
    }
  };

  return (
    <section className="p-today" aria-labelledby="p-today-title">
      <div className="p-today-head">
        <h2 id="p-today-title">
          {title} <span className="p-today-date">{date}</span>
        </h2>
        <button type="button" className="button-ghost" onClick={toggle} aria-expanded={!hidden}>
          {hidden ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronUp size={15} aria-hidden="true" />}
          {hidden ? labels.show : labels.hide}
        </button>
      </div>
      {!hidden && <PushPrompt />}
      {!hidden &&
        (cards.length === 0 ? (
          <p className="p-today-clear">{empty}</p>
        ) : (
          <div className="p-today-grid">
            {cards.map((card) => {
              const all = expanded[card.id];
              const items = all ? card.items : card.items.slice(0, MAX_ITEMS);
              return (
                <article key={card.id} className="p-card p-today-card">
                  <header className="p-today-card-head">
                    <span className="p-today-icon" aria-hidden="true">
                      {card.iconNode}
                    </span>
                    <div className="p-today-card-title">
                      <h3>{card.title}</h3>
                      {card.countLabel && <p>{card.countLabel}</p>}
                    </div>
                    {typeof card.count === "number" && card.count > 0 && <span className="p-count">{card.count}</span>}
                  </header>
                  {card.error && <p className="p-today-warn">{card.error}</p>}
                  {items.length > 0 ? (
                    <ul className="p-today-items">
                      {items.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={`p-today-item tone-${item.tone ?? "default"}`}
                            onClick={() => item.target && openTarget(item.target)}
                            disabled={!item.target}
                          >
                            <span className="p-today-item-title">{item.title}</span>
                            {item.meta && <span className="p-today-item-meta">{item.meta}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    !card.error && <p className="p-today-empty">{card.empty}</p>
                  )}
                  <footer className="p-today-card-foot">
                    {card.items.length > MAX_ITEMS && !all && (
                      <button type="button" className="p-link" onClick={() => setExpanded((e) => ({ ...e, [card.id]: true }))}>
                        {labels.more.replace("%count%", String(card.items.length - MAX_ITEMS))}
                      </button>
                    )}
                    {card.action && (
                      <button type="button" className="p-link p-link-strong" onClick={() => openTarget(card.action!.target)}>
                        {card.action.label}
                        <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        ))}
    </section>
  );
}
