import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db";
import { AppFrame, Notice } from "@/components/platform/AppFrame";
import { AdminNav } from "@/components/admin/AdminNav";
import { currentUser } from "@/lib/platform/access";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/signin");
  const t = await getTranslations("platform.admin");
  const tc = await getTranslations("platform.common");
  if (!user.admin) {
    return (
      <AppFrame title={t("title")} href="/admin" embedded={false} backLabel={tc("back")} searchLabel={tc("searchAll")}>
        <Notice title={t("noAccess.title")} text={t("noAccess.body")} />
      </AppFrame>
    );
  }
  const [open] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM access_requests WHERE status = 'open'`.catch(() => [{ n: 0 }]);
  const [down] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM service_incidents WHERE ended_at IS NULL`.catch(() => [{ n: 0 }]);
  const nav = (
    <AdminNav
      items={[
        { href: "/admin", label: t("nav.overview") },
        { href: "/admin/zugriffe", label: t("nav.requests"), badge: open?.n },
        { href: "/admin/benutzer", label: t("nav.users") },
        { href: "/admin/apps", label: t("nav.apps") },
        { href: "/admin/status", label: t("nav.status"), badge: down?.n },
        { href: "/admin/protokoll", label: t("nav.audit") }
      ]}
    />
  );
  return (
    <AppFrame title={t("title")} href="/admin" embedded={false} nav={nav} backLabel={tc("back")} searchLabel={tc("searchAll")}>
      {children}
    </AppFrame>
  );
}
