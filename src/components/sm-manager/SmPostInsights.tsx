import { insightStrings } from "@/lib/sm-manager/insights-i18n";
import { dateFormatter, nf, pct, postLabel } from "@/lib/sm-manager/insights-format";
import { tipStrings } from "@/lib/sm-manager/tips-i18n";
import { InsightsTable } from "./InsightsTable";
import { Tip } from "./Tip";
import "./insights.css";

export type PostInsight = {
  mediaId: string;
  permalink: string | null;
  type: string | null;
  caption: string | null;
  postedAt: string | null;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  avgWatchSeconds: number | null;
  engagementRate: number | null;
  postId: number | null;
  format: string | null;
  villa: string | null;
  clicks: number;
};

export type PostInsights = {
  configured: boolean;
  syncedAt?: string | null;
  refreshing?: boolean;
  total?: number;
  error?: { message: string; code: number | null; tokenExpired: boolean } | null;
  posts: PostInsight[];
};

const RANGES = ["30", "90", "365", "alle"] as const;

export function SmPostInsights({ locale, data, range = "90" }: { locale: "de" | "en"; data: PostInsights | null; range?: string }) {
  const s = insightStrings(locale);
  const tp = tipStrings(locale);
  const when = dateFormatter(locale, range === "365" || range === "alle");

  if (!data || !data.configured) {
    return (
      <section className="sm">
        <h2>{s.title}</h2>
        <p className="sm-warn">
          <strong>{s.notConfiguredTitle}.</strong> {s.notConfigured}
        </p>
      </section>
    );
  }

  const posts = data.posts;
  const withReach = posts.filter((p) => typeof p.reach === "number");
  const best = [...withReach].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))[0];

  // Durchschnitt je Format (Reel, Karussell, ...)
  const groups = new Map<string, PostInsight[]>();
  for (const p of withReach) {
    const key = postLabel(s, p) || "–";
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  return (
    <section className="sm" style={{ gap: "1rem" }}>
      <div>
        <h2>{s.title}</h2>
        <p className="sm-muted sm-small">{s.intro}</p>
        {data.syncedAt ? (
          <p className="sm-muted sm-small">
            {s.syncedAt}: {new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(data.syncedAt))}
          </p>
        ) : null}
      </div>

      <nav className="ins-range" aria-label={s.rangeTitle}>
        {RANGES.map((r) => (
          <a key={r} href={`/sm-manager?ansicht=kennzahlen&zeitraum=${r}`} aria-current={r === range ? "true" : undefined}>
            {s.ranges[r]}
          </a>
        ))}
        {typeof data.total === "number" ? <span className="sm-muted sm-small">{s.total(data.total)}</span> : null}
      </nav>

      {data.error ? (
        <p className="sm-warn">{data.error.tokenExpired ? s.tokenExpired : `${s.metaError}: ${data.error.message}`}</p>
      ) : null}
      {data.refreshing ? <p className="sm-muted sm-small">{s.refreshing}</p> : null}

      {posts.length === 0 ? <p className="sm-empty">{s.empty}</p> : null}

      {best ? (
        <div className="ins-best">
          <span className="sm-kpi-label">
            {s.best}
            <Tip text={tp.best} label={tp.label} />
          </span>
          <strong>
            {postLabel(s, best)} · {best.postedAt ? when.format(new Date(best.postedAt)) : ""} · {nf(best.reach, locale)}
          </strong>
          {best.caption ? <span className="ins-caption">{best.caption.slice(0, 110)}</span> : null}
          {best.permalink ? (
            <a className="ins-link sm-small" href={best.permalink} target="_blank" rel="noopener noreferrer">
              {s.open}
            </a>
          ) : null}
        </div>
      ) : null}

      {groups.size > 1 ? (
        <div>
          <h3>
            {s.byFormat}
            <Tip text={tp.byFormat} label={tp.label} />
          </h3>
          <div className="ins-formats">
            {[...groups.entries()].map(([name, xs]) => (
              <div className="ins-format" key={name}>
                <strong>
                  {name} <span className="sm-muted sm-small">({xs.length} {s.posts})</span>
                </strong>
                <span className="sm-small">
                  {s.avgReach}: <strong>{nf(Math.round(avg(xs.map((x) => x.reach ?? 0)) ?? 0), locale)}</strong>
                </span>
                <span className="sm-small">
                  {s.avgRate}: <strong>{pct(avg(xs.filter((x) => typeof x.engagementRate === "number").map((x) => x.engagementRate as number)), locale)}</strong>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {posts.length ? <InsightsTable locale={locale} posts={posts} range={range} /> : null}
      <p className="sm-muted sm-small">{s.rateHelp}</p>
    </section>
  );
}
