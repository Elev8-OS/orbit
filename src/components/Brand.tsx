import { Elev8Logo } from "./Elev8Logo";

/** Elev8-Logo + Produktname. Auf dunklem Grund weiss, auf hellem schwarz (über currentColor). */
export function Brand({ href = "/", logoHeight = 30 }: { href?: string; logoHeight?: number }) {
  return (
    <a href={href} className="brand" aria-label="Elev8 Orbit">
      <Elev8Logo height={logoHeight} />
      <span className="brand-divider" aria-hidden="true" />
      <span className="brand-product">Orbit</span>
    </a>
  );
}
