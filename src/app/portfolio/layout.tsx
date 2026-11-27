import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppFrame, Notice } from "@/components/platform/AppFrame";
import { currentUser } from "@/lib/platform/access";
import { isEmbedded } from "@/lib/platform/embedded";
import { hasPortfolioAccess } from "@/lib/portfolio/access";

export const dynamic = "force-dynamic";

export default async function PortfolioLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/signin");
  const t = await getTranslations("platform.portfolio");
  const tc = await getTranslations("platform.common");
  const body = hasPortfolioAccess(user.roles) ? (
    children
  ) : (
    <Notice title={t("noAccess.title")} text={t("noAccess.body")} />
  );
  return (
    <AppFrame title={t("appName")} href="/portfolio" embedded={await isEmbedded()} backLabel={tc("back")} searchLabel={tc("searchAll")}>
      {body}
    </AppFrame>
  );
}
