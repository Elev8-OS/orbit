import "@/components/offerten/public/public.css";
import "./venue-shell.css";
import type { Brand } from "@/lib/venues/brand";

/**
 * Rahmen der Betriebsseite: helles Band mit dem Logo des Betreibers. Keine Elev8-Marke, die Nachricht kommt vom Betreiber.
 * Die Seite ist englisch, auch wenn Orbit selbst auf Deutsch läuft: lang="en" sagt das dem Browser (Übersetzungsangebot, Vorlesen).
 */
export function VenueShell({ brand, label, children }: { brand: Brand; label: string; children: React.ReactNode }) {
  return (
    <div className="pub" lang="en">
      <header className="vp-band">
        <div className="vp-band-inner">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.name} className="vp-logo" />
          ) : (
            <strong className="vp-name">{brand.name}</strong>
          )}
          <span className="vp-label">{label}</span>
        </div>
      </header>
      <main className="pub-main">{children}</main>
      <footer className="pub-footer">{[brand.name, brand.instagram ? `@${brand.instagram}` : ""].filter(Boolean).join(" · ")}</footer>
    </div>
  );
}
