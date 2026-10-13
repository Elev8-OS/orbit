import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { sql } from "@/lib/db";
import { AppFrame, Notice } from "@/components/platform/AppFrame";
import { AdminNav } from "@/components/admin/AdminNav";
import { PaletteButton } from "@/components/platform/PaletteButton";
import { PrefsListener } from "@/components/sales/PrefsListener";
import { currentUser } from "@/lib/platform/access";
import "@/components/admin/admin-shell.css";

export const dynamic = "force-dynamic";

/**
 * Rahmen der Administration nach dem Elev8 Design System: Seitenleiste links wie Sales, ERT und Revenue Desk.
 * Die Administration öffnet als eigene Seite (nicht als Tab), deshalb sitzen Suche und Rückweg in der Seitenleiste.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/signin");
  const t = await getTranslations("platform.admin");
  const tc = await getTranslations("platform.common");
  const tpush = await getTranslations("push.admin");
  if (!user.admin) {
    return (
      <AppFrame title={t("title")} href="/admin" embedded={false} backLabel={tc("back")} searchLabel={tc("searchAll")}>
        <Notice title={t("noAccess.title")} text={t("noAccess.body")} />
      </AppFrame>
    );
  }
  const [open] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM access_requests WHERE status = 'open'`.catch(() => [{ n: 0 }]);
  const [down] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM service_incidents WHERE ended_at IS NULL`.catch(() => [{ n: 0 }]);
  return (
    <div className="ad-shell">
      <PrefsListener />
      <aside className="ad-side">
        <AdminNav
          group={t("title")}
          items={[
            { href: "/admin", label: t("nav.overview"), icon: "overview" },
            { href: "/admin/zugriffe", label: t("nav.requests"), icon: "requests", badge: open?.n },
            { href: "/admin/benutzer", label: t("nav.users"), icon: "users" },
            { href: "/admin/apps", label: t("nav.apps"), icon: "apps" },
            { href: "/admin/status", label: t("nav.status"), icon: "status", badge: down?.n },
            { href: "/admin/mitteilungen", label: tpush("nav"), icon: "push" },
            { href: "/admin/protokoll", label: t("nav.audit"), icon: "audit" }
          ]}
        />
        <div className="ad-side-foot">
          <PaletteButton label={tc("searchAll")} />
          <a href="/" className="ad-side-back">
            <ArrowLeft size={14} aria-hidden="true" />
            Orbit
          </a>
        </div>
      </aside>
      <div className="ad-content">
        <main className="ad-main" id="main" aria-label={t("title")}>
          {children}
        </main>
      </div>
    </div>
  );
}
