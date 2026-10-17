import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { currentMessenUser } from "@/lib/messen/access";
import { PrefsListener } from "@/components/offerten/PrefsListener";
import { SideNav } from "@/components/platform/SideNav";
import { StandaloneOnly } from "@/components/platform/StandaloneOnly";
import "./messen.css";

export const dynamic = "force-dynamic";

/** Rahmen des Messen-Moduls, aufgebaut wie Offerten (Seitenleiste nach dem Elev8 Design System). */
export default async function MessenLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const user = await currentMessenUser();

  return (
    <div className="me-shell ap-shell">
      <PrefsListener />
      {user && (
        <aside className="ap-side">
          <SideNav group="Messen" items={[{ href: "/messen", label: "Alle Messen", icon: "events" }]} />
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
              <h1>Kein Zugriff auf Messen</h1>
              <p>Für dieses Modul brauchst du die Rolle App.Messen. Frag sie über „Zugriff anfragen“ in Orbit an.</p>
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
