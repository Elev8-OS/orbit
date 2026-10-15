import { redirect } from "next/navigation";
import { AppFrame, Notice } from "@/components/platform/AppFrame";
import { currentUser } from "@/lib/platform/access";
import { isEmbedded } from "@/lib/platform/embedded";
import { hasPortfolioAccess } from "@/lib/portfolio/access";

export const dynamic = "force-dynamic";

export default async function PortfolioLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/signin");
  const body = hasPortfolioAccess(user.roles) ? (
    children
  ) : (
    <Notice title="Kein Zugriff" text="Für das Portfolio Monitoring Schweiz brauchst du die Rolle App.PortfolioCH. Du kannst sie in Orbit über „Zugriff anfragen“ anfordern." />
  );
  return (
    <AppFrame title="Portfolio Monitoring Schweiz" href="/portfolio" embedded={await isEmbedded()} backLabel="Zurück zu Orbit" searchLabel="Suchen">
      {body}
    </AppFrame>
  );
}
