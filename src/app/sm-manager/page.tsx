import { getLocale } from "next-intl/server";
import { Notice } from "@/components/platform/AppFrame";
import { currentUser } from "@/lib/platform/access";
import { ensureEmbedded } from "@/lib/platform/embedded";
import { hasSmAccess, smConfigured } from "@/lib/sm-manager/access";
import { engine, engineHealth } from "@/lib/sm-manager/client";
import { smStrings } from "@/lib/sm-manager/i18n";
import type { Post, Property } from "@/lib/sm-manager/types";
import { resolveBrand } from "@/lib/venues/brand";
import { storageConfigured } from "@/lib/venues/s3";
import { listVenues } from "@/lib/venues/store";
import { SmHome } from "@/components/sm-manager/SmHome";
import type { ClickStats, SocialStats } from "@/components/sm-manager/SmStats";
import type { Inquiry } from "@/components/sm-manager/SmInquiries";
import { SmPostInsights, type PostInsights } from "@/components/sm-manager/SmPostInsights";
import { SmSourceCompare, type SourceCompare } from "@/components/sm-manager/SmSourceCompare";
import { SmDrafting, type DraftingData } from "@/components/sm-manager/SmDrafting";
import { SmAudience, type AudiencePlan } from "@/components/sm-manager/SmAudience";
import { SmCompetitors, type CompetitorsData } from "@/components/sm-manager/SmCompetitors";
import { SmMusic, type MusicData } from "@/components/sm-manager/SmMusic";
import { SmVenues, type VenuesData } from "@/components/sm-manager/SmVenues";
import { SmLearnings, type LearningsData } from "@/components/sm-manager/SmLearnings";
import { SmPromos, type PromosData } from "@/components/sm-manager/SmPromos";
import "@/components/sm-manager/responsive.css";

export const dynamic = "force-dynamic";

const REVIEW = ["rendered", "draft_created"];
const DONE = ["approved", "scheduled", "published", "rejected", "failed"];
const INQUIRY_OPEN = ["draft_ready", "failed"];
const RANGES = ["30", "90", "365", "alle"];

export default async function SmManagerPage({ searchParams }: { searchParams: Promise<{ ansicht?: string; zeitraum?: string }> }) {
  const params = await searchParams;
  await ensureEmbedded("sm-manager", "/sm-manager");
  const user = await currentUser();
  if (!user || !hasSmAccess(user.roles)) return null;
  const locale = (await getLocale()) === "en" ? "en" : "de";
  const s = smStrings(locale);
  if (!smConfigured()) return <Notice title={s.notConfiguredTitle} text={s.notConfiguredBody} />;

  const view =
    params.ansicht === "done"
      ? "done"
      : params.ansicht === "objekte"
        ? "properties"
        : params.ansicht === "kennzahlen"
          ? "stats"
          : params.ansicht === "anfragen"
            ? "inquiries"
            : params.ansicht === "zielgruppen"
              ? "audience"
              : params.ansicht === "aktionen"
                ? "promos"
                : params.ansicht === "konkurrenz"
                  ? "competitors"
                  : params.ansicht === "musik"
                    ? "music"
                    : params.ansicht === "orte"
                      ? "venues"
                      : params.ansicht === "learnings"
                        ? "learnings"
                        : "review";
  const range = RANGES.includes(params.zeitraum ?? "") ? (params.zeitraum as string) : "90";
  try {
    const [health, list, props, social, clicks, inq, agent, insights, audiencePlan, learningsData, promoData, competitorData, musicData, compareData, draftingData] = await Promise.all([
      engineHealth(),
      engine<{ posts: Post[] }>("/posts?limit=80"),
      view === "properties" || view === "promos" ? engine<{ properties: Property[] }>("/properties") : Promise.resolve({ properties: [] as Property[] }),
      view === "stats" ? engine<SocialStats>("/stats/social").catch(() => null) : Promise.resolve(null),
      view === "stats" ? engine<ClickStats>("/stats/clicks?days=30").catch(() => null) : Promise.resolve(null),
      engine<{ inquiries: Inquiry[] }>("/agent/inquiries?limit=60").catch(() => ({ inquiries: [] as Inquiry[] })),
      view === "inquiries" ? engine<{ enabled: boolean }>("/agent/status").catch(() => null) : Promise.resolve(null),
      view === "stats" ? engine<PostInsights>(`/stats/posts?days=${range}&limit=100`).catch(() => null) : Promise.resolve(null),
      view === "audience" ? engine<AudiencePlan>("/audience/plan?days=60").catch(() => null) : Promise.resolve(null),
      engine<LearningsData>("/learnings").catch(() => null),
      view === "promos" ? engine<PromosData>("/promos").catch(() => null) : Promise.resolve(null),
      view === "competitors" ? engine<CompetitorsData>("/competitors").catch(() => null) : Promise.resolve(null),
      view === "music" ? engine<MusicData>("/music").catch(() => null) : Promise.resolve(null),
      view === "stats" ? engine<SourceCompare>(`/stats/compare?days=${range}`).catch(() => null) : Promise.resolve(null),
      view === "review" ? engine<DraftingData>("/drafting").catch(() => null) : Promise.resolve(null)
    ]);
    const reviewCount = list.posts.filter((p) => REVIEW.includes(p.status)).length;
    const inquiryCount = inq.inquiries.filter((i) => INQUIRY_OPEN.includes(i.status)).length;
    const learningCount = learningsData?.proposed.length ?? 0;
    // Uhrzeit aus einem übernommenen Learning (Bali-Zeit), sonst gilt 18 Uhr
    const postHour = learningsData?.accepted.find((l) => l.action.type === "post_hour")?.action.hour ?? null;

    // Betriebe und ihre Fotos liegen in der Orbit-Datenbank, nicht in der Engine.
    // Die Marke (Instagram-Name, Logo) kommt aus den Einstellungen, sonst aus Elev8.
    let venueData: VenuesData | null = null;
    if (view === "venues") {
      try {
        const base = (process.env.AUTH_URL ?? "https://myorbit.elev8-suite.com").replace(/\/$/, "");
        const brand = await resolveBrand();
        venueData = {
          venues: (await listVenues()).map((v) => ({ ...v, link: `${base}/contribute/${v.token}` })),
          storage: storageConfigured(),
          brand: { name: brand.name, instagram: brand.instagram, sender: brand.sender, hasLogo: Boolean(brand.logoUrl) }
        };
      } catch (e) {
        console.error("Orte konnten nicht geladen werden:", e);
      }
    }

    let posts: Post[] = [];
    if (view === "review" || view === "done") {
      const wanted = list.posts.filter((p) => (view === "review" ? REVIEW : DONE).includes(p.status)).slice(0, view === "review" ? 20 : 30);
      // Die Liste kennt die Vorschau-Adressen nicht; jede wird frisch signiert nachgeladen.
      posts = await Promise.all(wanted.map((p) => engine<Post>(`/posts/${p.id}`).catch(() => p)));
    }
    // Der Bio-Link ist die kurze Adresse auf der eigenen Domain. Sie leitet (Cloudflare) über die Engine auf die Hauptseite und zählt den Klick.
    const bioLink = process.env.SM_BIO_LINK || "https://elevate-villas.com/IG";
    return (
      <>
        <SmHome
          locale={locale}
          view={view}
          posts={posts}
          properties={props.properties}
          reviewCount={reviewCount}
          ghlReady={Boolean(health?.ghl)}
          social={social}
          clicks={clicks}
          bioLink={bioLink}
          inquiries={inq.inquiries}
          inquiryCount={inquiryCount}
          agentEnabled={Boolean(agent?.enabled)}
          audience={view === "audience" ? <SmAudience locale={locale} plan={audiencePlan} /> : null}
          learnings={view === "learnings" ? <SmLearnings locale={locale} data={learningsData} /> : null}
          promos={view === "promos" ? <SmPromos locale={locale} promos={promoData} properties={props.properties.map((p) => ({ key: p.key, name: p.name }))} /> : null}
          competitors={view === "competitors" ? <SmCompetitors locale={locale} data={competitorData} /> : null}
          music={view === "music" ? <SmMusic locale={locale} data={musicData} /> : null}
          venues={view === "venues" ? <SmVenues locale={locale} data={venueData} /> : null}
          drafting={view === "review" ? <SmDrafting locale={locale} data={draftingData} /> : null}
          learningCount={learningCount}
          postHour={typeof postHour === "number" ? postHour : null}
        />
        {view === "stats" ? (
          <div className="p-page sm" style={{ paddingTop: 0 }}>
            <SmPostInsights locale={locale} data={insights} range={range} />
            <SmSourceCompare locale={locale} data={compareData} />
          </div>
        ) : null}
      </>
    );
  } catch {
    return <Notice title={s.title} text={s.unreachable} />;
  }
}
