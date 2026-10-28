import { getLocale } from "next-intl/server";
import { currentUser } from "@/lib/platform/access";
import { ensureEmbedded } from "@/lib/platform/embedded";
import { hasRadarAccess, radarEnabled } from "@/lib/radar/access";
import { counts, getSettings, lastRun, listConnections, listItems } from "@/lib/radar/store";
import { DEFAULT_INTERESTS } from "@/lib/radar/types";
import { RadarHome } from "@/components/radar/RadarHome";

export const dynamic = "force-dynamic";

export default async function RadarPage({ searchParams }: { searchParams: Promise<{ ansicht?: string; id?: string }> }) {
  const params = await searchParams;
  await ensureEmbedded("radar", "/radar");
  const user = await currentUser();
  if (!user || !hasRadarAccess(user.roles)) return null;
  const locale = (await getLocale()) === "en" ? "en" : "de";
  const view = params.ansicht === "done" ? "done" : "open";
  const focus = Number(params.id);
  const [settings, connections, items, c, run] = await Promise.all([
    getSettings(user.id),
    listConnections(user.id),
    listItems(user.id, view, 100),
    counts(user.id),
    lastRun(user.id)
  ]);
  return (
    <RadarHome
      locale={locale}
      view={view}
      items={items}
      counts={c}
      connections={connections}
      settings={settings}
      run={run}
      focusId={Number.isInteger(focus) ? focus : null}
      enabled={radarEnabled()}
      defaultInterests={DEFAULT_INTERESTS}
    />
  );
}
