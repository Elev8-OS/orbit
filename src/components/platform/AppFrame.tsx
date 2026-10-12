import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Elev8Logo } from "@/components/Elev8Logo";
import { PrefsListener } from "@/components/sales/PrefsListener";
import { PaletteButton } from "./PaletteButton";

/** Rahmen für Orbits eigene Apps im Tab: schmale Kopfleiste mit Titel, Navigation und Suche. */
export function AppFrame({
  title,
  href,
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
    <div className={`p-app${embedded ? " is-embedded" : ""}`}>
      {embedded && <PrefsListener />}
      <header className="p-app-bar">
        <div className="p-app-bar-inner">
          {!embedded && (
            <>
              <a href="/" className="p-app-back" aria-label={backLabel}>
                <ArrowLeft size={18} aria-hidden="true" />
                <Elev8Logo height={22} />
              </a>
              <span className="p-app-divider" aria-hidden="true" />
            </>
          )}
          <a href={href} className="p-app-title">
            {title}
          </a>
          {nav}
          <PaletteButton label={searchLabel} />
        </div>
      </header>
      <main className="p-app-main" id="main">
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
