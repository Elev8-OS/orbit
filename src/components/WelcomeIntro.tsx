"use client";

import { useCallback, useEffect, useState } from "react";
import { CX, CY, RX, RY, TILT_DEG, VIEWBOX, distribute } from "./orbit-geometry";
import { PlanetDefs } from "./PlanetDefs";

export const REVEAL_EVENT = "orbit:reveal";

type Props = { heading: string; subline: string; skipLabel: string; dots: string[] };

/**
 * Einmalige Sequenz direkt nach dem Login: Der Planet geht auf, die Bahn zeichnet sich,
 * die Apps des Users rasten nacheinander ein, dann öffnet sich das Dashboard.
 * Klick, Escape oder "Überspringen" beenden sie sofort. Bei "Bewegung reduzieren" entfällt sie.
 */
export function WelcomeIntro({ heading, subline, skipLabel, dots }: Props) {
  const [phase, setPhase] = useState<"play" | "leave" | "done">("play");

  const reveal = useCallback(() => {
    setPhase((p) => (p === "play" ? "leave" : p));
    window.dispatchEvent(new Event(REVEAL_EVENT));
  }, []);

  useEffect(() => {
    // ?welcome=1 aus der Adresszeile entfernen, damit ein Reload die Sequenz nicht wiederholt
    const url = new URL(window.location.href);
    url.searchParams.delete("welcome");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("done");
      window.dispatchEvent(new Event(REVEAL_EVENT));
      return;
    }
    const total = 1500 + Math.min(dots.length, 40) * 70;
    const t = window.setTimeout(reveal, Math.max(2600, total));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && reveal();
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [dots.length, reveal]);

  useEffect(() => {
    if (phase !== "leave") return;
    const t = window.setTimeout(() => setPhase("done"), 700);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === "done") return null;

  const points = distribute(dots);
  const rotate = `rotate(${TILT_DEG} ${CX} ${CY})`;

  return (
    <div className={`welcome${phase === "leave" ? " is-leaving" : ""}`} onClick={reveal} role="status" aria-live="polite">
      <svg className="welcome-orbit" viewBox={VIEWBOX} aria-hidden="true" focusable="false">
        <PlanetDefs id="welcome" />
        <ellipse cx={CX} cy={CY} rx={RX} ry={RY} transform={rotate} pathLength={1} className="welcome-path" />
        <circle cx={CX} cy={CY} r={130} fill="url(#welcome-halo)" className="welcome-halo" />
        <circle cx={CX} cy={CY} r={34} fill="url(#welcome-planet)" className="welcome-planet" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.front ? 10 : 6.5}
            fill={p.item}
            className={`welcome-dot${p.front ? "" : " is-back"}`}
            style={{ animationDelay: `${1100 + i * 70}ms` }}
          />
        ))}
      </svg>
      <div className="welcome-text">
        <p className="welcome-heading">{heading}</p>
        <p className="welcome-sub">{subline}</p>
      </div>
      <button type="button" className="welcome-skip" onClick={reveal}>
        {skipLabel}
      </button>
    </div>
  );
}
