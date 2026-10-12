import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppFrame, Notice } from "@/components/platform/AppFrame";
import { currentUser, hasKundenAccess } from "@/lib/platform/access";
import { isEmbedded } from "@/lib/platform/embedded";
import { ghlConfigured } from "@/lib/sales/ghl";

export const dynamic = "force-dynamic";

export default async function KundenLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/signin");
  const t = await getTranslations("platform.kunden");
  const tc = await getTranslations("platform.common");
  let body: React.ReactNode = children;
  if (!hasKundenAccess(user.roles)) body = <Notice title={t("noAccess.title")} text={t("noAccess.body")} />;
  else if (!ghlConfigured()) body = <Notice title={t("noGhl.title")} text={t("noGhl.body")} />;
  return (
    <AppFrame title={t("appName")} href="/kunden" embedded={await isEmbedded()} backLabel={tc("back")} searchLabel={tc("searchAll")}>
      {body}
    </AppFrame>
  );
}
