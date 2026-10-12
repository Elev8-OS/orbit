import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppFrame, Notice } from "@/components/platform/AppFrame";
import { currentUser, hasAssistentAccess } from "@/lib/platform/access";
import { isEmbedded } from "@/lib/platform/embedded";

export const dynamic = "force-dynamic";

export default async function AssistentLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/signin");
  const t = await getTranslations("platform.assistent");
  const tc = await getTranslations("platform.common");
  return (
    <AppFrame title={t("appName")} href="/assistent" embedded={await isEmbedded()} backLabel={tc("back")} searchLabel={tc("searchAll")}>
      {hasAssistentAccess(user.roles) ? children : <Notice title={t("noAccess.title")} text={t("noAccess.body")} />}
    </AppFrame>
  );
}
