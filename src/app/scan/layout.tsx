import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { currentScanUser, SCAN_ROLES } from "@/lib/scan/access";
import { PrefsListener } from "@/components/offerten/PrefsListener";
import { SideNav } from "@/components/platform/SideNav";
import { StandaloneOnly } from "@/components/platform/StandaloneOnly";
import "./scan.css";

export const dynamic = "force-dynamic";

/** Rahmen des Scan-Moduls, aufgebaut wie Messen und Offerten. */
export default async function ScanLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const user = await currentScanUser();

  return (
    <div className="sc-shell ap-shell">
      <PrefsListener />
      {user && (
        <aside className="ap-side">
          <SideNav
            group="Scan"
            items={[
              { href: "/scan", label: "Scannen", icon: "scan" },
              { href: "/scan/verlauf", label: "Verlauf", icon: "history" }
            ]}
          />
          <div className="ap-side-foot">
            <StandaloneOnly>
              <a href="/" className="ap-side-back">
                <ArrowLeft size={14} aria-hidden="true" />
                Orbit
              </a>
            </StandaloneOnly>
          </div>
        </aside>
      )}
      <div className="ap-content">
        <main className="sc-main" id="main">
          {user ? (
            children
          ) : (
            <div className="sc-empty">
              <h1>Kein Zugriff auf den Scanner</h1>
              <p>Für dieses Modul brauchst du eine dieser Rollen: {SCAN_ROLES.join(", ")}. Frag sie über „Zugriff anfragen“ in Orbit an.</p>
              <a className="sc-btn sc-btn-secondary" href="/">
                Zurück zu Orbit
              </a>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
