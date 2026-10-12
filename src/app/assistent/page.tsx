import { getTranslations } from "next-intl/server";
import { currentUser, hasAssistentAccess } from "@/lib/platform/access";
import { ensureEmbedded } from "@/lib/platform/embedded";
import { oauthConfigured, redirectUri } from "@/lib/assistant/oauth";
import { counts, getAccount, listItems } from "@/lib/assistant/store";
import { Notice } from "@/components/platform/AppFrame";
import { ConnectCard } from "@/components/assistent/ConnectCard";
import { AssistantHome } from "@/components/assistent/AssistantHome";

export const dynamic = "force-dynamic";

const VIEWS = ["open", "info", "skip", "done"] as const;
type View = (typeof VIEWS)[number];

export default async function AssistentPage({ searchParams }: { searchParams: Promise<{ ansicht?: string; verbunden?: string }> }) {
  const params = await searchParams;
  await ensureEmbedded("assistent", "/assistent");
  const user = await currentUser();
  if (!user || !hasAssistentAccess(user.roles)) return null;
  const t = await getTranslations("platform.assistent");

  if (!oauthConfigured()) {
    return (
      <div className="p-page p-narrow">
        <Notice title={t("setup.title")} text={t("setup.body", { uri: redirectUri() })} />
      </div>
    );
  }

  const account = await getAccount(user.id);
  if (!account) {
    return (
      <div className="p-page p-narrow">
        <ConnectCard result={params.verbunden ?? null} />
      </div>
    );
  }

  const view: View = (VIEWS as readonly string[]).includes(params.ansicht ?? "") ? (params.ansicht as View) : "open";
  const [items, c] = await Promise.all([listItems(user.id, view, 100), counts(user.id)]);
  return <AssistantHome account={account} items={items} view={view} counts={c} justConnected={params.verbunden === "ok"} />;
}
