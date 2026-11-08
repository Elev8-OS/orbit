import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { currentWebinarUser } from "@/lib/webinare/access";
import { PrefsListener } from "@/components/offerten/PrefsListener";
import { SideNav } from "@/components/platform/SideNav";
import { StandaloneOnly } from "@/components/platform/StandaloneOnly";
import "../messen/messen.css";
import "./webinare.css";

export const dynamic = "force-dynamic";

/** Rahmen des Webinar-Moduls. Inhalte für webinar.elev8-suite.com pflegen. */
export default async function WebinareLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const user = await currentWebinarUser();

  return (
    <div className="me-shell ap-shell">
      <PrefsListener />
      {user && (
        <aside className="ap-side">
          <SideNav
            group="Webinare"
            items={[
              { href: "/webinare", label: "Alle Webinare", icon: "events" },
              { href: "/webinare/umfragen", label: "Abstimmungen", icon: "pipeline" }
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
        <main className="me-main" id="main">
          {user ? (
            children
          ) : (
            <div className="me-empty">
              <h1>Kein Zugriff auf Webinare</h1>
              <p>Für dieses Modul brauchst du die Rolle App.Webinar oder App.Webinar.Moderation. Frag sie über „Zugriff anfragen“ in Orbit an.</p>
              <a className="me-btn me-btn-secondary" href="/">
                Zurück zu Orbit
              </a>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
