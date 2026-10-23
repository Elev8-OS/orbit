import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { currentOnboardingUser, ONBOARDING_ROLE } from "@/lib/onboarding/access";
import { PrefsListener } from "@/components/offerten/PrefsListener";
import { SideNav } from "@/components/platform/SideNav";
import { StandaloneOnly } from "@/components/platform/StandaloneOnly";
import "./onboarding.css";

export const dynamic = "force-dynamic";

/** Rahmen der Onboarding-App, aufgebaut wie Scan, Messen und Offerten. */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const user = await currentOnboardingUser();

  return (
    <div className="ob-shell ap-shell">
      <PrefsListener />
      {user && (
        <aside className="ap-side">
          <SideNav group="Onboarding" items={[{ href: "/onboarding", label: "Entwürfe", icon: "onboarding" }]} />
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
        <main className="ob-main" id="main">
          {user ? (
            children
          ) : (
            <div className="ob-empty">
              <h1>Kein Zugriff auf Onboarding</h1>
              <p>Für dieses Modul brauchst du die Rolle {ONBOARDING_ROLE}. Frag sie über „Zugriff anfragen“ in Orbit an.</p>
              <a className="ob-btn ob-btn-secondary" href="/">
                Zurück zu Orbit
              </a>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
