import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { groContext, atLeast } from "@/lib/gro/access";
import { PrefsListener } from "@/components/offerten/PrefsListener";
import { SideNav } from "@/components/platform/SideNav";
import { StandaloneOnly } from "@/components/platform/StandaloneOnly";
import { TenantSwitch } from "@/components/gro/Tools";
import "./gro.css";

export const dynamic = "force-dynamic";

/** Rahmen des GRO-Moduls: Seitenleiste nach dem Elev8 Design System, Mandantenwahl unten. */
export default async function GroLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const ctx = await groContext();

  const items = [
    { href: "/gro", label: "Heute", icon: "today" },
    { href: "/gro/prozesse", label: "Prozesse", icon: "processes" },
    { href: "/gro/objekte", label: "Objekte", icon: "objects" },
    { href: "/gro/vorlagen", label: "Vorlagen", icon: "templates" },
    { href: "/gro/regeln", label: "Regeln", icon: "rules" },
    { href: "/gro/entscheide", label: "Entscheide", icon: "decisions" }
  ];
  if (ctx && atLeast(ctx.role, "admin")) items.push({ href: "/gro/admin", label: "Verwaltung", icon: "settings" });

  return (
    <div className="gr-shell ap-shell">
      <PrefsListener />
      {ctx && (
        <aside className="ap-side">
          <SideNav group="GRO Service" items={items} />
          <div className="ap-side-foot">
            <TenantSwitch tenants={ctx.tenants.map((t) => ({ slug: t.slug, name: t.name }))} current={ctx.tenant.slug} />
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
        <main className="gr-main" id="main">
          {ctx ? (
            children
          ) : (
            <div className="gr-empty">
              <h1>Kein Zugriff auf den GRO Service</h1>
              <p>Du brauchst die Rolle App.GRO, oder dein Unternehmen muss dich als Mitglied eintragen. Frag über „Zugriff anfragen“ in Orbit an.</p>
              <a className="gr-btn gr-btn-secondary" href="/">
                Zurück zu Orbit
              </a>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
