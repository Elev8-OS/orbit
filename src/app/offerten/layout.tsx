import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { currentOffertenUser } from "@/lib/offerten/access";
import { Elev8Logo } from "@/components/Elev8Logo";
import { OffertenNav } from "@/components/offerten/OffertenNav";
import "./offerten.css";

export const dynamic = "force-dynamic";

export default async function OffertenLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const t = await getTranslations("offerten");
  const user = await currentOffertenUser();
  // Als Tab in Orbit eingebettet: Orbit zeigt bereits Logo und Tab-Leiste, deshalb nur die App-Navigation
  const embedded = (await headers()).get("sec-fetch-dest") === "iframe";

  return (
    <div className={embedded ? "of-shell is-embedded" : "of-shell"}>
      <header className="of-bar">
        <div className="of-bar-inner">
          {!embedded && (
            <>
              <a href="/" className="of-back" aria-label={t("back")}>
                <ArrowLeft size={18} aria-hidden="true" />
                <Elev8Logo height={22} />
              </a>
              <span className="of-bar-divider" aria-hidden="true" />
            </>
          )}
          <a href="/offerten" className="of-bar-title">
            {t("appName")}
          </a>
          {user && (
            <OffertenNav
              items={[
                { href: "/offerten", label: t("nav.overview") },
                { href: "/offerten/einstellungen", label: t("nav.settings"), short: t("nav.settingsShort") }
              ]}
            />
          )}
        </div>
      </header>
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
  );
}
