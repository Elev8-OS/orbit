import { insightStrings } from "@/lib/sm-manager/insights-i18n";
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
  error?: { message: string; code: number | null; tokenExpired: boolean } | null;
  posts: PostInsight[];
};

const nf = (n: number | null | undefined, locale: string) => (typeof n === "number" ? new Intl.NumberFormat(locale === "en" ? "en-GB" : "de-CH").format(n) : "–");
const pct = (n: number | null | undefined, locale: string) => (typeof n === "number" ? `${new Intl.NumberFormat(locale === "en" ? "en-GB" : "de-CH", { maximumFractionDigits: 1 }).format(n)} %` : "–");

export function SmPostInsights({ locale, data }: { locale: "de" | "en"; data: PostInsights | null }) {
  const s = insightStrings(locale);
  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { day: "numeric", month: "short" });
  const when = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "");
  const label = (p: PostInsight) => s.types[p.format ?? ""] ?? s.types[p.type ?? ""] ?? p.type ?? "";

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

  const posts = data.posts.slice(0, 20);
  const withReach = posts.filter((p) => typeof p.reach === "number");
  const best = [...withReach].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))[0];

  // Durchschnitt je Format (Reel, Karussell, ...)
  const groups = new Map<string, PostInsight[]>();
  for (const p of withReach) {
    const key = label(p) || "–";
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

      {data.error ? (
        <p className="sm-warn">{data.error.tokenExpired ? s.tokenExpired : `${s.metaError}: ${data.error.message}`}</p>
      ) : null}

      {posts.length === 0 ? <p className="sm-empty">{s.empty}</p> : null}

      {best ? (
        <div className="ins-best">
          <span className="sm-kpi-label">{s.best}</span>
          <strong>
            {label(best)} · {when(best.postedAt)} · {nf(best.reach, locale)}
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
          <h3>{s.byFormat}</h3>
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

      {posts.length ? (
        <div className="sm-table-wrap">
          <table className="sm-table">
            <thead>
              <tr>
                <th>{s.colPost}</th>
                <th>{s.colViews}</th>
                <th>{s.colReach}</th>
                <th>{s.colLikes}</th>
                <th>{s.colComments}</th>
                <th>{s.colSaved}</th>
                <th>{s.colShares}</th>
                <th>{s.colRate}</th>
                <th>{s.colClicks}</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.mediaId}>
                  <td className="sm-cell-title">
                    {p.permalink ? (
                      <a className="ins-link" href={p.permalink} target="_blank" rel="noopener noreferrer">
                        {label(p)} · {when(p.postedAt)}
                      </a>
                    ) : (
                      <>
                        {label(p)} · {when(p.postedAt)}
                      </>
                    )}
                    {p.villa ? <span className="sm-muted sm-small"> · {p.villa}</span> : null}
                    {p.caption ? <span className="ins-caption">{p.caption.slice(0, 80)}</span> : null}
                  </td>
                  <td className="ins-num" data-label={s.colViews}>{nf(p.views, locale)}</td>
                  <td className="ins-num" data-label={s.colReach}>{nf(p.reach, locale)}</td>
                  <td className="ins-num" data-label={s.colLikes}>{nf(p.likes, locale)}</td>
                  <td className="ins-num" data-label={s.colComments}>{nf(p.comments, locale)}</td>
                  <td className="ins-num" data-label={s.colSaved}>{nf(p.saved, locale)}</td>
                  <td className="ins-num" data-label={s.colShares}>{nf(p.shares, locale)}</td>
                  <td className="ins-num" data-label={s.colRate}>{pct(p.engagementRate, locale)}</td>
                  <td className="ins-num" data-label={s.colClicks}>{p.postId ? nf(p.clicks, locale) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="sm-muted sm-small">{s.rateHelp}</p>
    </section>
  );
}
