import { currentUser } from "@/lib/platform/access";
import { ensureEmbedded } from "@/lib/platform/embedded";
import { canEditPortfolio, hasPortfolioAccess } from "@/lib/portfolio/access";
import { PortfolioApp } from "@/components/portfolio/PortfolioApp";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  await ensureEmbedded("portfolio-ch", "/portfolio");
  const user = await currentUser();
  if (!user || !hasPortfolioAccess(user.roles)) return null;
  const version = (process.env.RAILWAY_GIT_COMMIT_SHA || "dev").slice(0, 12);
  return <PortfolioApp canEdit={canEditPortfolio(user.roles)} version={version} />;
}
