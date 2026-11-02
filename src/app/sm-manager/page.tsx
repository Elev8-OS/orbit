import { getLocale } from "next-intl/server";
import { Notice } from "@/components/platform/AppFrame";
import { currentUser } from "@/lib/platform/access";
import { ensureEmbedded } from "@/lib/platform/embedded";
import { hasSmAccess, smConfigured } from "@/lib/sm-manager/access";
import { engine, engineHealth } from "@/lib/sm-manager/client";
import { smStrings } from "@/lib/sm-manager/i18n";
import type { Post, Property } from "@/lib/sm-manager/types";
import { SmHome } from "@/components/sm-manager/SmHome";
import type { ClickStats, SocialStats } from "@/components/sm-manager/SmStats";

export const dynamic = "force-dynamic";

const REVIEW = ["rendered", "draft_created"];
const DONE = ["approved", "scheduled", "published", "rejected", "failed"];

export default async function SmManagerPage({ searchParams }: { searchParams: Promise<{ ansicht?: string }> }) {
  const params = await searchParams;
  await ensureEmbedded("sm-manager", "/sm-manager");
  const user = await currentUser();
  if (!user || !hasSmAccess(user.roles)) return null;
  const locale = (await getLocale()) === "en" ? "en" : "de";
  const s = smStrings(locale);
  if (!smConfigured()) return <Notice title={s.notConfiguredTitle} text={s.notConfiguredBody} />;

  const view = params.ansicht === "done" ? "done" : params.ansicht === "objekte" ? "properties" : params.ansicht === "kennzahlen" ? "stats" : "review";
  try {
    const [health, list, props, social, clicks] = await Promise.all([
      engineHealth(),
      engine<{ posts: Post[] }>("/posts?limit=80"),
      view === "properties" ? engine<{ properties: Property[] }>("/properties") : Promise.resolve({ properties: [] as Property[] }),
      view === "stats" ? engine<SocialStats>("/stats/social").catch(() => null) : Promise.resolve(null),
      view === "stats" ? engine<ClickStats>("/stats/clicks?days=30").catch(() => null) : Promise.resolve(null)
    ]);
    const reviewCount = list.posts.filter((p) => REVIEW.includes(p.status)).length;
    let posts: Post[] = [];
    if (view === "review" || view === "done") {
      const wanted = list.posts.filter((p) => (view === "review" ? REVIEW : DONE).includes(p.status)).slice(0, view === "review" ? 20 : 30);
      // Die Liste kennt die Vorschau-Adressen nicht; jede wird frisch signiert nachgeladen.
      posts = await Promise.all(wanted.map((p) => engine<Post>(`/posts/${p.id}`).catch(() => p)));
    }
    const bioLink = `${(process.env.SM_ENGINE_URL ?? "").replace(/\/+$/, "")}/go/latest`;
    return <SmHome locale={locale} view={view} posts={posts} properties={props.properties} reviewCount={reviewCount} ghlReady={Boolean(health?.ghl)} social={social} clicks={clicks} bioLink={bioLink} />;
  } catch {
    return <Notice title={s.title} text={s.unreachable} />;
  }
}
