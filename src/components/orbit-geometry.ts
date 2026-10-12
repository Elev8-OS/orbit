/** Gemeinsame Geometrie der Umlaufbahn (viewBox 800 × 280). */
export const VIEWBOX = "0 0 800 280";
export const CX = 400;
export const CY = 140;
export const RX = 360;
export const RY = 78;
export const TILT_DEG = -9;
const TILT = (TILT_DEG * Math.PI) / 180;

export function pointOnOrbit(angle: number) {
  const x = RX * Math.cos(angle);
  const y = RY * Math.sin(angle);
  return {
    x: CX + x * Math.cos(TILT) - y * Math.sin(TILT),
    y: CY + x * Math.sin(TILT) + y * Math.cos(TILT)
  };
}

/** Punkte gleichmässig auf der Bahn verteilen. "front" = vor dem Planeten. */
export function distribute<T>(items: T[], max = 40) {
  const shown = items.slice(0, max);
  return shown.map((item, i) => {
    const angle = Math.PI * 0.15 + (i / Math.max(shown.length, 1)) * Math.PI * 2;
    return { item, ...pointOnOrbit(angle), front: Math.sin(angle) > 0 };
  });
}

/** Ellipse als Pfad (ungedreht) – für animateMotion innerhalb einer gedrehten Gruppe. */
export const ELLIPSE_PATH = `M ${CX + RX} ${CY} A ${RX} ${RY} 0 1 1 ${CX - RX} ${CY} A ${RX} ${RY} 0 1 1 ${CX + RX} ${CY} Z`;
