import type { CSSProperties } from "react";
import { statsStrings, type StatsStrings } from "@/lib/sm-manager/stats-i18n";
import { tipStrings } from "@/lib/sm-manager/tips-i18n";
import { Tip } from "./Tip";
import "./stats.css";

export type SocialStats = {
  ok: boolean;
  status?: number;
  // Wo es hakt (accounts, no_accounts, statistics) und was GHL gemeldet hat
  where?: string;
  message?: string | null;
  data?: {
    results?: {
      dayRange?: string[];
      totals?: { posts?: number; likes?: number; followers?: number; impressions?: number; comments?: number };
      postPerformance?: { impressions?: number[]; likes?: number[] };
      breakdowns?: {
        posts?: { totalChange?: string };
        impressions?: { totalChange?: string };
        reach?: { total?: number; totalChange?: string };
        engagement?: { instagram?: { shares?: number; change?: string } };
      };
    };
  };
};

export type ClickStats = {
  days: number;
  total: number;
  withoutPost: number;
  perPost: { id: number; plan_date: string; format: string | null; property_key: string | null; clicks: number }[];
};

type Props = { locale: "de" | "en"; social: SocialStats | null; clicks: ClickStats | null; bioLink: string };

const num = (n: number | undefined, locale: string) => (typeof n === "number" ? new Intl.NumberFormat(locale === "en" ? "en-GB" : "de-CH").format(n) : "–");

function Change({ value, text }: { value?: string; text: string }) {
  const n = value === undefined ? NaN : Number(value);
  if (Number.isNaN(n)) return <span className="sm-kpi-change">{text}</span>;
  const cls = n > 0 ? "up" : n < 0 ? "down" : "";
  return (
    <span className={`sm-kpi-change ${cls}`}>
      {n > 0 ? "+" : ""}
      {Math.round(n)} % · {text}
    </span>
  );
}

function Bars({ labels, values, s, title }: { labels: string[]; values: number[]; s: StatsStrings; title: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="sm-chart" role="img" aria-label={title}>
      <h3>{title}</h3>
      <div className="sm-bars">
        {values.map((v, i) => (
          <div className="sm-bar-col" key={i}>
            <span className="sm-bar-value">{v}</span>
            <div className="sm-bar">
              <div className="sm-bar-fill" style={{ height: `${Math.round((v / max) * 100)}%` } as CSSProperties} />
            </div>
            <span className="sm-bar-day">{s.days[labels[i]] ?? labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Technischer Hinweis hinter der Meldung: Statuscode, Stelle und die Antwort von GHL
function reason(social: SocialStats | null): string {
  if (!social) return "";
  const parts = [social.status ? String(social.status) : "", social.where ?? ""].filter(Boolean).join(", ");
  const msg = social.message ? `${parts ? ": " : ""}${social.message}` : "";
  return parts || msg ? ` (${parts}${msg})` : "";
}

export function SmStats({ locale, social, clicks, bioLink }: Props) {
  const s = statsStrings(locale);
  const tp = tipStrings(locale);
  const r = social?.ok ? social.data?.results : undefined;
  const days = r?.dayRange ?? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const b = r?.breakdowns;
  return (
    <section className="sm" style={{ gap: "1.25rem" }}>
      <p className="sm-muted">{s.statsIntro}</p>

      <div>
        <h2>
          {s.socialTitle}
          <Tip text={tp.social} label={tp.label} />
        </h2>
        {!r ? (
          <p className="sm-warn">
            {s.socialUnavailable}
            {reason(social)}.
          </p>
        ) : (
          <>
            <div className="sm-kpis">
              <div className="sm-kpi">
                <span className="sm-kpi-label">
                  {s.kpiPosts}
                  <Tip text={tp.kpiPosts} label={tp.label} />
                </span>
                <span className="sm-kpi-value">{num(r.totals?.posts, locale)}</span>
                <Change value={b?.posts?.totalChange} text={s.vsPrevious} />
              </div>
              <div className="sm-kpi">
                <span className="sm-kpi-label">
                  {s.kpiImpressions}
                  <Tip text={tp.kpiImpressions} label={tp.label} />
                </span>
                <span className="sm-kpi-value">{num(r.totals?.impressions, locale)}</span>
                <Change value={b?.impressions?.totalChange} text={s.vsPrevious} />
              </div>
              <div className="sm-kpi">
                <span className="sm-kpi-label">
                  {s.kpiReach}
                  <Tip text={tp.kpiReach} label={tp.label} />
                </span>
                <span className="sm-kpi-value">{num(b?.reach?.total, locale)}</span>
                <Change value={b?.reach?.totalChange} text={s.vsPrevious} />
              </div>
              <div className="sm-kpi">
                <span className="sm-kpi-label">
                  {s.kpiLikes}
                  <Tip text={tp.kpiLikes} label={tp.label} />
                </span>
                <span className="sm-kpi-value">{num(r.totals?.likes, locale)}</span>
                <Change value={b?.engagement?.instagram?.change} text={s.vsPrevious} />
              </div>
              <div className="sm-kpi">
                <span className="sm-kpi-label">
                  {s.kpiComments}
                  <Tip text={tp.kpiComments} label={tp.label} />
                </span>
                <span className="sm-kpi-value">{num(r.totals?.comments, locale)}</span>
              </div>
              <div className="sm-kpi">
                <span className="sm-kpi-label">
                  {s.kpiShares}
                  <Tip text={tp.kpiShares} label={tp.label} />
                </span>
                <span className="sm-kpi-value">{num(b?.engagement?.instagram?.shares, locale)}</span>
              </div>
              <div className="sm-kpi">
                <span className="sm-kpi-label">
                  {s.kpiFollowers}
                  <Tip text={tp.kpiFollowers} label={tp.label} />
                </span>
                <span className="sm-kpi-value">{num(r.totals?.followers, locale)}</span>
              </div>
            </div>
            {r.postPerformance?.impressions?.length ? <Bars labels={days} values={r.postPerformance.impressions} s={s} title={s.perDay} /> : null}
            {r.postPerformance?.likes?.length ? <Bars labels={days} values={r.postPerformance.likes} s={s} title={s.likesPerDay} /> : null}
          </>
        )}
      </div>

      <div>
        <h2>{s.clicksTitle}</h2>
        <p className="sm-muted sm-small">{s.clicksIntro}</p>
        <div className="sm-copy">
          <strong className="sm-small">{s.bioLink}:</strong>
          <code>{bioLink}</code>
          <Tip text={tp.bioLink} label={tp.label} />
        </div>
        <p className="sm-muted sm-small">{s.bioHint}</p>
        {clicks ? (
          <>
            <div className="sm-kpis" style={{ marginTop: "0.5rem" }}>
              <div className="sm-kpi">
                <span className="sm-kpi-label">
                  {s.clicksTotal}
                  <Tip text={tp.clicks} label={tp.label} />
                </span>
                <span className="sm-kpi-value">{num(clicks.total, locale)}</span>
                <span className="sm-kpi-change">
                  {num(clicks.withoutPost, locale)} {s.clicksNoPost}
                  <Tip text={tp.clicksNoPost} label={tp.label} />
                </span>
              </div>
            </div>
            {clicks.total === 0 ? (
              <p className="sm-empty">{s.noClicks}</p>
            ) : (
              <div className="sm-table-wrap">
                <table className="sm-table">
                  <thead>
                    <tr>
                      <th>{s.colPost}</th>
                      <th>{s.colDate}</th>
                      <th>{s.colFormat}</th>
                      <th>{s.colVilla}</th>
                      <th>{s.colClicks}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clicks.perPost
                      .filter((p) => p.clicks > 0)
                      .slice(0, 10)
                      .map((p) => (
                        <tr key={p.id}>
                          <td className="sm-cell-title">#{p.id}</td>
                          <td data-label={s.colDate}>{new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { day: "numeric", month: "short" }).format(new Date(p.plan_date))}</td>
                          <td data-label={s.colFormat}>{s.formats[p.format ?? ""] ?? p.format ?? "–"}</td>
                          <td data-label={s.colVilla}>{p.property_key ?? "–"}</td>
                          <td data-label={s.colClicks}>{p.clicks}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
