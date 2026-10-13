import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { PrefsListener } from "@/components/sales/PrefsListener";
import { PaletteButton } from "./PaletteButton";
import "./app-frame.css";

/**
 * Rahmen für Orbits eigene Apps im Tab, nach dem Elev8 Design System ("Wer was zeigt"):
 * kein eigenes Logo, kein App-Name, kein schwarzes Band – Orbit zeigt das im Tab, und die Suche
 * sitzt in Orbits Tab-Leiste. Die Seite beginnt direkt mit ihrem Inhalt und eigenem Seitentitel.
 * Apps mit mehreren Bereichen bekommen eine Seitenleiste links (Vorbild: src/app/sales/layout.tsx).
 * Nur ausserhalb von Orbit gibt es oben einen dezenten Rückweg und die Suche.
 */
export function AppFrame({
  title,
  embedded,
  nav,
  backLabel,
  searchLabel,
  children
}: {
  title: string;
  href: string;
  embedded: boolean;
  nav?: ReactNode;
  backLabel: string;
  searchLabel: string;
  children: ReactNode;
}) {
  return (
    <div className={`p-app p-app-v2${embedded ? " is-embedded" : ""}`}>
      {embedded && <PrefsListener />}
      {!embedded && (
        <div className="p-app-top">
          <a href="/" className="p-app-orbit" aria-label={backLabel}>
            <ArrowLeft size={14} aria-hidden="true" />
            Orbit
          </a>
          <PaletteButton label={searchLabel} />
        </div>
      )}
      {nav}
      <main className="p-app-main" id="main" aria-label={title}>
        {children}
      </main>
    </div>
  );
}

export function Notice({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="p-notice">
      <h1>{title}</h1>
      <p>{text}</p>
      {children}
    </div>
  );
}
