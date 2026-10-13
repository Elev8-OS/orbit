import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { currentOffertenUser } from "@/lib/offerten/access";
import { PrefsListener } from "@/components/offerten/PrefsListener";
import { SideNav } from "@/components/platform/SideNav";
import { StandaloneOnly } from "@/components/platform/StandaloneOnly";
import "./offerten.css";

export const dynamic = "force-dynamic";

/**
 * Rahmen von Offerten nach dem Elev8 Design System: Seitenleiste links wie in ERT, Revenue Desk
 * und Sales; kein eigenes Logo und kein App-Name im Band – Orbit zeigt beides im Tab.
 */
export default async function OffertenLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const t = await getTranslations("offerten");
  const user = await currentOffertenUser();

  return (
    <div className="of-shell ap-shell">
      {/* Immer aktiv: übernimmt Sprache und Darstellung aus Orbit, sobald Orbit sie sendet */}
      <PrefsListener />
      {user && (
        <aside className="ap-side">
          <SideNav
            group={t("appName")}
            items={[
              { href: "/offerten", label: t("nav.overview"), icon: "offers" },
              { href: "/offerten/einstellungen", label: t("nav.settings"), icon: "settings" }
            ]}
          />
          <div className="ap-side-foot">
            {/* Nur ausserhalb von Orbit: zurück zur Übersicht (im Tab übernimmt das die Tab-Leiste) */}
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
        <main className="of-main" id="main">
          {user ? (
            children
          ) : (
            <div className="of-empty-state">
              <h1>{t("noAccess.title")}</h1>
              <p>{t("noAccess.body")}</p>
              <a className="button-secondary" href="/">
                {t("back")}
              </a>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
