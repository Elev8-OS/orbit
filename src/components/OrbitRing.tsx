import { CX, CY, RX, RY, TILT_DEG, VIEWBOX, distribute } from "./orbit-geometry";
import { PlanetDefs } from "./PlanetDefs";

/**
 * Statische Umlaufbahn im Kopfbereich. Jede App des Users ist ein Punkt
 * in ihrer Kategoriefarbe – der Orbit zeigt also wirklich "deine" Apps.
 */
export function OrbitRing({ dots, className = "" }: { dots: string[]; className?: string }) {
  const points = distribute(dots);
  const rotate = `rotate(${TILT_DEG} ${CX} ${CY})`;

  return (
    <svg className={`orbit-ring ${className}`} viewBox={VIEWBOX} aria-hidden="true" focusable="false">
      <PlanetDefs id="ring" />
      <ellipse cx={CX} cy={CY} rx={RX + 26} ry={RY + 12} transform={rotate} className="orbit-path orbit-path-outer" />
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY} transform={rotate} className="orbit-path" />
      {points
        .filter((p) => !p.front)
        .map((p, i) => (
          <circle key={`b${i}`} cx={p.x} cy={p.y} r={6.5} fill={p.item} className="orbit-dot orbit-dot-back" />
        ))}
      <circle cx={CX} cy={CY} r={110} fill="url(#ring-halo)" />
      <circle cx={CX} cy={CY} r={34} fill="url(#ring-planet)" />
      {points
        .filter((p) => p.front)
        .map((p, i) => (
          <circle key={`f${i}`} cx={p.x} cy={p.y} r={10} fill={p.item} className="orbit-dot" />
        ))}
    </svg>
  );
}
