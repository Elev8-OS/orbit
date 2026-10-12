"use client";

import { useEffect, useRef } from "react";
import { CX, CY, RX, RY, TILT_DEG, VIEWBOX, ELLIPSE_PATH } from "./orbit-geometry";
import { PlanetDefs } from "./PlanetDefs";

/** Langsam kreisende Umlaufbahn für die Login-Seite. Steht still bei "Bewegung reduzieren". */
export function LiveOrbit({ dots, className = "" }: { dots: string[]; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const duration = 90;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => (media.matches ? ref.current?.pauseAnimations() : ref.current?.unpauseAnimations());
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return (
    <svg ref={ref} className={`orbit-ring ${className}`} viewBox={VIEWBOX} aria-hidden="true" focusable="false">
      <PlanetDefs id="live" />
      <g transform={`rotate(${TILT_DEG} ${CX} ${CY})`}>
        <ellipse cx={CX} cy={CY} rx={RX + 26} ry={RY + 12} className="orbit-path orbit-path-outer" />
        <ellipse cx={CX} cy={CY} rx={RX} ry={RY} className="orbit-path" />
        <circle cx={CX} cy={CY} r={130} fill="url(#live-halo)" className="planet-halo" />
        <circle cx={CX} cy={CY} r={34} fill="url(#live-planet)" />
        {dots.map((color, i) => (
          <circle key={i} r={i % 3 === 0 ? 10 : 7} fill={color} className="orbit-dot">
            <animateMotion
              dur={`${duration}s`}
              repeatCount="indefinite"
              begin={`-${((i / dots.length) * duration).toFixed(2)}s`}
              path={ELLIPSE_PATH}
            />
          </circle>
        ))}
      </g>
    </svg>
  );
}
