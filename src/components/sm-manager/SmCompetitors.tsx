"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tipStrings } from "@/lib/sm-manager/tips-i18n";
import { Tip } from "./Tip";
import "./competitors.css";

type Top = { permalink: string | null; likes: number | null; comments: number | null; reel: boolean; caption: string };
export type Competitor = {
  handle: string;
  name: string | null;
  status: "new" | "ok" | "not_readable" | "error";
  error: string | null;
  checkedAt: string | null;
  followers: number | null;
  mediaCount: number | null;
  posts30d: number | null;
  postsPerWeek: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  engagementPct: number | null;
  reelSharePct: number | null;
  top: Top[];
};
export type Own = {
  handle?: string | null;
  error?: string;
  followers?: number | null;
  posts_30d?: number | null;
  posts_per_week?: number | null;
  avg_likes?: number | null;
  avg_comments?: number | null;
  engagement_pct?: number | null;
  reel_share_pct?: number | null;
  top?: Top[];
};
type Verdict = "better" | "worse" | "similar" | "unknown";
export type CompareRow = { key: string; ours: number | null; median: number | null; best: number | null; bestHandle: string | null; rank: number | null; of: number; diffPct: number | null; verdict: Verdict };
export type CompetitorsData = {
  configured: boolean;
  checking: boolean;
  competitors: Competitor[];
  self: Own | null;
  comparison: { readable: number; rows: CompareRow[]; summary: { better: number; worse: number; similar: number } };
};

type Strings = typeof de;

const de = {
  tab: "Konkurrenz",
  title: "Konkurrenz im Vergleich",
  intro: "Oben siehst du, wo wir im Vergleich zu den anderen Konten stehen. Darunter die Zahlen aller Konten. Alles wird täglich neu gelesen.",
  notConfigured: "Meta ist in der Engine nicht verbunden, deshalb kann nichts gelesen werden.",
  unavailable: "Die Konkurrenz-Konten konnten gerade nicht geladen werden.",
  ownError: "Unser eigenes Konto konnte nicht gelesen werden",
  ownMissing: "Ohne Zahlen unseres eigenen Kontos ist kein Vergleich möglich.",
  noneReadable: "Noch kein Konto der Konkurrenz ist lesbar. Starte unten die Prüfung.",
  summary: (better: number, worse: number, similar: number) => `Bei ${better} der 4 Wirkungskennzahlen liegen wir über dem Median der Konkurrenz, bei ${worse} darunter, bei ${similar} etwa gleichauf (innerhalb von 10 %).`,
  scoreTitle: "Wo wir besser oder schlechter sind",
  metric: "Kennzahl",
  ours: "Wir",
  median: "Median der anderen",
  best: "Bester",
  rank: "Platz",
  gap: "Abstand zum Median",
  metrics: { engagementPct: "Interaktion", avgLikes: "Ø Likes pro Post", avgComments: "Ø Kommentare pro Post", followers: "Follower", postsPerWeek: "Posts pro Woche", reelSharePct: "Reel-Anteil" } as Record<string, string>,
  metricTips: {
    engagementPct: "Likes plus Kommentare der letzten 12 Posts im Verhältnis zu den Followern. Der fairste Vergleich zwischen kleinen und großen Konten.",
    avgLikes: "Durchschnittliche Likes der letzten 12 Posts.",
    avgComments: "Durchschnittliche Kommentare der letzten 12 Posts. Kommentare zeigen echtes Interesse.",
    followers: "Grösse des Publikums.",
    postsPerWeek: "Posts der letzten 30 Tage, auf eine Woche umgerechnet. Mehr ist nicht automatisch besser, aber ein Hebel für Reichweite.",
    reelSharePct: "Anteil der Videos und Reels an den letzten 30 Posts. Reels erreichen meist mehr neue Leute."
  } as Record<string, string>,
  more: "mehr",
  less: "weniger",
  leversTitle: "Daraus folgt",
  leverPosts: (pct: number) => `Wir posten ${pct} % seltener als der Median. Mehr Rhythmus ist ein Hebel für Reichweite.`,
  leverReels: (pct: number) => `Unser Reel-Anteil liegt ${pct} % unter dem Median. Mehr Reels bringen meist mehr neue Zuschauer.`,
  leverEngagement: "Die Interaktion liegt unter dem Median: Fragen in der Bildunterschrift und ein klarer nächster Schritt (DM-Stichwort) können helfen.",
  leverNone: "Kein klarer Rückstand bei den Wirkungskennzahlen.",
  caveat: "Einordnung: Die Konten sind Vermittler und Verwalter, keine einzelnen Villenmarken. Kleine Konten erreichen meist eine höhere Interaktion als große. Vergleiche deshalb Interaktion und Rhythmus, nicht nur die Follower.",
  detailTitle: "Alle Konten",
  account: "Konto",
  status: "Status",
  followersCol: "Follower",
  best1: "Bester Post",
  statuses: { new: "Noch nicht geprüft", ok: "Lesbar", not_readable: "Nicht lesbar", error: "Fehler" } as Record<string, string>,
  notReadableHelp: "Das Konto ist privat oder kein Business- oder Creator-Konto. Meta gibt dann keine Zahlen frei.",
  checked: "Geprüft",
  weSelf: "Wir",
  postsTitle: "Was bei den anderen gut läuft",
  postsHelp: "Der stärkste Post jedes Kontos unter den letzten 30.",
  comments: "Kommentare",
  reel: "Reel",
  refresh: "Jetzt prüfen",
  started: "Die Prüfung läuft. Lade die Seite in etwa einer Minute neu.",
  reload: "Neu laden",
  addPlaceholder: "Instagram-Name oder Link",
  add: "Hinzufügen",
  adding: "Wird geprüft …",
  remove: "Entfernen",
  confirmRemove: "Dieses Konto aus der Liste entfernen?",
  failed: "Das hat nicht geklappt"
};
const en: Strings = {
  tab: "Competitors",
  title: "Competitors compared",
  intro: "At the top you see where we stand against the other accounts. Below are the numbers of all accounts. Everything is read again daily.",
  notConfigured: "Meta is not connected in the engine, so nothing can be read.",
  unavailable: "The competitor accounts could not be loaded right now.",
  ownError: "Our own account could not be read",
  ownMissing: "Without the numbers of our own account there is nothing to compare.",
  noneReadable: "No competitor account is readable yet. Start the check below.",
  summary: (better, worse, similar) => `On ${better} of the 4 performance metrics we are above the competitors' median, on ${worse} below, on ${similar} about level (within 10%).`,
  scoreTitle: "Where we are better or worse",
  metric: "Metric",
  ours: "Us",
  median: "Median of the others",
  best: "Best",
  rank: "Rank",
  gap: "Gap to the median",
  metrics: { engagementPct: "Engagement", avgLikes: "Avg likes per post", avgComments: "Avg comments per post", followers: "Followers", postsPerWeek: "Posts per week", reelSharePct: "Reel share" },
  metricTips: {
    engagementPct: "Likes plus comments of the last 12 posts relative to the followers. The fairest comparison between small and large accounts.",
    avgLikes: "Average likes of the last 12 posts.",
    avgComments: "Average comments of the last 12 posts. Comments show real interest.",
    followers: "Size of the audience.",
    postsPerWeek: "Posts of the last 30 days, converted to a week. More is not automatically better, but it is a lever for reach.",
    reelSharePct: "Share of videos and reels among the last 30 posts. Reels usually reach more new people."
  },
  more: "more",
  less: "less",
  leversTitle: "What follows",
  leverPosts: (pct) => `We post ${pct}% less often than the median. A steadier rhythm is a lever for reach.`,
  leverReels: (pct) => `Our reel share is ${pct}% below the median. More reels usually bring more new viewers.`,
  leverEngagement: "Engagement is below the median: questions in the caption and a clear next step (DM keyword) can help.",
  leverNone: "No clear gap on the performance metrics.",
  caveat: "Please note: the accounts are agents and managers, not single villa brands. Small accounts usually reach higher engagement than large ones. So compare engagement and rhythm, not just followers.",
  detailTitle: "All accounts",
  account: "Account",
  status: "Status",
  followersCol: "Followers",
  best1: "Best post",
  statuses: { new: "Not checked yet", ok: "Readable", not_readable: "Not readable", error: "Error" },
  notReadableHelp: "The account is private or not a business or creator account. Meta then shares no numbers.",
  checked: "Checked",
  weSelf: "Us",
  postsTitle: "What works for the others",
  postsHelp: "The strongest post of each account among the last 30.",
  comments: "comments",
  reel: "Reel",
  refresh: "Check now",
  started: "The check is running. Reload the page in about a minute.",
  reload: "Reload",
  addPlaceholder: "Instagram name or link",
  add: "Add",
  adding: "Checking ...",
  remove: "Remove",
  confirmRemove: "Remove this account from the list?",
  failed: "That did not work"
};

export const competitorTabLabel = (locale: "de" | "en") => (locale === "en" ? en : de).tab;

const ORDER = ["engagementPct", "avgLikes", "avgComments", "followers", "postsPerWeek", "reelSharePct"];
const PERFORMANCE = new Set(["engagementPct", "avgLikes", "avgComments", "followers"]);
const UNIT: Record<string, string> = { engagementPct: " %", reelSharePct: " %" };

async function call(method: string, url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: typeof json.error === "string" ? json.error : undefined };
  } catch {
    return { ok: false };
  }
}

/** Tab Konkurrenz: Scorecard (wir gegen den Median der anderen), alle Konten und die stärksten Posts der anderen. */
export function SmCompetitors({ locale, data }: { locale: "de" | "en"; data: CompetitorsData | null }) {
  const s = locale === "en" ? en : de;
  const tp = tipStrings(locale);
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const num = new Intl.NumberFormat(locale === "en" ? "en-GB" : "de-CH", { maximumFractionDigits: 1 });
  const n = (v: number | null | undefined, suffix = "") => (v == null ? "–" : `${num.format(v)}${suffix}`);
  const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { day: "numeric", month: "short" }).format(new Date(iso)) : "–");

  if (!data) {
    return (
      <section className="cmp">
        <h2>{s.title}</h2>
        <p className="sm-warn">{s.unavailable}</p>
      </section>
    );
  }

  async function add() {
    if (!handle.trim()) return;
    setBusy(true);
    setMsg(s.adding);
    const r = await call("POST", "/api/sm-manager/competitors", { handle });
    setBusy(false);
    setMsg(r.ok ? null : `${s.failed}${r.error ? `: ${r.error}` : ""}`);
    if (r.ok) {
      setHandle("");
      router.refresh();
    }
  }
  async function refresh() {
    setBusy(true);
    const r = await call("POST", "/api/sm-manager/competitors", { action: "refresh" });
    setBusy(false);
    setMsg(r.ok ? s.started : `${s.failed}${r.error ? `: ${r.error}` : ""}`);
  }
  async function remove(h: string) {
    if (!window.confirm(s.confirmRemove)) return;
    const r = await call("DELETE", `/api/sm-manager/competitors?handle=${encodeURIComponent(h)}`);
    if (r.ok) router.refresh();
    else setMsg(`${s.failed}${r.error ? `: ${r.error}` : ""}`);
  }

  const self = data.self;
  const ownOk = Boolean(self && !self.error);
  const rows = ORDER.map((k) => data.comparison.rows.find((r) => r.key === k)).filter((r): r is CompareRow => Boolean(r));
  const perf = rows.filter((r) => PERFORMANCE.has(r.key) && r.verdict !== "unknown");
  const better = perf.filter((r) => r.verdict === "better").length;
  const worse = perf.filter((r) => r.verdict === "worse").length;
  const similar = perf.filter((r) => r.verdict === "similar").length;
  const by = (k: string) => rows.find((r) => r.key === k);
  const levers: string[] = [];
  const posts = by("postsPerWeek");
  const reels = by("reelSharePct");
  const eng = by("engagementPct");
  if (posts?.verdict === "worse" && posts.diffPct != null) levers.push(s.leverPosts(Math.abs(posts.diffPct)));
  if (reels?.verdict === "worse" && reels.diffPct != null) levers.push(s.leverReels(Math.abs(reels.diffPct)));
  if (eng?.verdict === "worse") levers.push(s.leverEngagement);
  const canCompare = ownOk && data.comparison.readable > 0;

  const chip = (r: CompareRow) => {
    if (r.verdict === "unknown" || r.diffPct == null) return <span className="cmp-chip cmp-unknown">–</span>;
    const sign = r.diffPct > 0 ? "+" : "";
    const text = `${r.diffPct > 0 ? "▲" : r.diffPct < 0 ? "▼" : "="} ${sign}${r.diffPct} %`;
    // Mehr Posts oder Reels sind nicht automatisch besser: dort nur neutral einfärben
    const cls = PERFORMANCE.has(r.key) ? `cmp-${r.verdict}` : "cmp-neutral";
    return <span className={`cmp-chip ${cls}`}>{text}</span>;
  };

  const readable = data.competitors.filter((c) => c.status === "ok");
  const bestPosts = readable
    .map((c) => ({ c, p: c.top[0] }))
    .filter((x) => x.p)
    .sort((a, b) => (b.p?.likes ?? 0) - (a.p?.likes ?? 0));

  return (
    <section className="cmp">
      <div>
        <h2>{s.title}</h2>
        <p className="sm-muted">{s.intro}</p>
      </div>
      {!data.configured ? <p className="sm-warn">{s.notConfigured}</p> : null}
      {data.checking ? <p className="sm-muted sm-small">{s.started}</p> : null}
      {self?.error ? (
        <p className="sm-warn">
          {s.ownError}: {self.error}
        </p>
      ) : null}

      {canCompare ? (
        <>
          <p className="cmp-summary">{s.summary(better, worse, similar)}</p>
          <div>
            <h2>{s.scoreTitle}</h2>
            <div className="sm-table-wrap">
              <table className="sm-table">
                <thead>
                  <tr>
                    <th>{s.metric}</th>
                    <th>{s.ours}</th>
                    <th>{s.median}</th>
                    <th>{s.best}</th>
                    <th>{s.rank}</th>
                    <th>{s.gap}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td className="sm-cell-title">
                        {s.metrics[r.key] ?? r.key}
                        <Tip text={s.metricTips[r.key] ?? ""} label={tp.label} />
                      </td>
                      <td data-label={s.ours}>
                        <strong>{n(r.ours, UNIT[r.key] ?? "")}</strong>
                      </td>
                      <td data-label={s.median}>{n(r.median, UNIT[r.key] ?? "")}</td>
                      <td data-label={s.best}>
                        {n(r.best, UNIT[r.key] ?? "")}
                        {r.bestHandle ? <div className="sm-muted sm-small">@{r.bestHandle}</div> : null}
                      </td>
                      <td data-label={s.rank}>{r.rank ? `${r.rank} / ${r.of}` : "–"}</td>
                      <td data-label={s.gap}>{chip(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h2>{s.leversTitle}</h2>
            {levers.length ? (
              <ul>
                {levers.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ) : (
              <p className="sm-muted">{s.leverNone}</p>
            )}
          </div>
        </>
      ) : data.configured ? (
        <p className="sm-muted">{!ownOk ? s.ownMissing : s.noneReadable}</p>
      ) : null}
      <p className="sm-muted sm-small">{s.caveat}</p>

      <div>
        <h2>{s.detailTitle}</h2>
        <div className="sm-table-wrap">
          <table className="sm-table">
            <thead>
              <tr>
                <th>{s.account}</th>
                <th>{s.status}</th>
                <th>{s.followersCol}</th>
                <th>{s.metrics.postsPerWeek}</th>
                <th>{s.metrics.avgLikes}</th>
                <th>{s.metrics.engagementPct}</th>
                <th>{s.metrics.reelSharePct}</th>
                <th>{s.best1}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ownOk && self ? (
                <tr className="cmp-self">
                  <td className="sm-cell-title">
                    {s.weSelf}
                    {self.handle ? <div className="sm-muted sm-small">@{self.handle}</div> : null}
                  </td>
                  <td data-label={s.status}>–</td>
                  <td data-label={s.followersCol}>{n(self.followers)}</td>
                  <td data-label={s.metrics.postsPerWeek}>{n(self.posts_per_week)}</td>
                  <td data-label={s.metrics.avgLikes}>{n(self.avg_likes)}</td>
                  <td data-label={s.metrics.engagementPct}>{n(self.engagement_pct, " %")}</td>
                  <td data-label={s.metrics.reelSharePct}>{n(self.reel_share_pct, " %")}</td>
                  <td data-label={s.best1}>
                    {self.top?.[0]?.permalink ? (
                      <a href={self.top[0].permalink} target="_blank" rel="noreferrer">
                        {n(self.top[0].likes)} ♥ · {n(self.top[0].comments)}
                      </a>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td />
                </tr>
              ) : null}
              {data.competitors.map((c) => (
                <tr key={c.handle}>
                  <td className="sm-cell-title">
                    <a href={`https://www.instagram.com/${c.handle}/`} target="_blank" rel="noreferrer">
                      @{c.handle}
                    </a>
                    {c.name ? <div className="sm-muted sm-small">{c.name}</div> : null}
                  </td>
                  <td data-label={s.status}>
                    <span className={`sm-badge ${c.status === "ok" ? "sm-badge-ok" : ""}`}>{s.statuses[c.status] ?? c.status}</span>
                    {c.status === "not_readable" ? <Tip text={s.notReadableHelp} label={tp.label} /> : null}
                    {c.status === "error" && c.error ? <div className="sm-muted sm-small">{c.error}</div> : null}
                    <div className="sm-muted sm-small">
                      {s.checked}: {day(c.checkedAt)}
                    </div>
                  </td>
                  <td data-label={s.followersCol}>{n(c.followers)}</td>
                  <td data-label={s.metrics.postsPerWeek}>{n(c.postsPerWeek)}</td>
                  <td data-label={s.metrics.avgLikes}>{n(c.avgLikes)}</td>
                  <td data-label={s.metrics.engagementPct}>{n(c.engagementPct, " %")}</td>
                  <td data-label={s.metrics.reelSharePct}>{n(c.reelSharePct, " %")}</td>
                  <td data-label={s.best1}>
                    {c.top[0]?.permalink ? (
                      <a href={c.top[0].permalink} target="_blank" rel="noreferrer">
                        {n(c.top[0].likes)} ♥ · {n(c.top[0].comments)}
                      </a>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td>
                    <button type="button" className="sm-btn" onClick={() => remove(c.handle)}>
                      {s.remove}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sm-actions" style={{ marginTop: "0.75rem" }}>
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={s.addPlaceholder} maxLength={200} aria-label={s.addPlaceholder} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button type="button" className="sm-btn sm-btn-primary" onClick={add} disabled={busy || !handle.trim()}>
            {s.add}
          </button>
          {data.configured ? (
            <button type="button" className="sm-btn" onClick={refresh} disabled={busy}>
              {s.refresh}
            </button>
          ) : null}
          <button type="button" className="sm-btn" onClick={() => router.refresh()}>
            {s.reload}
          </button>
          {msg ? (
            <span className="sm-muted sm-small" role="status">
              {msg}
            </span>
          ) : null}
        </div>
      </div>

      {bestPosts.length ? (
        <div>
          <h2>{s.postsTitle}</h2>
          <p className="sm-muted sm-small">{s.postsHelp}</p>
          <ul className="cmp-posts">
            {bestPosts.map(({ c, p }) => (
              <li key={c.handle}>
                <strong>@{c.handle}</strong> · {n(p?.likes)} ♥ · {n(p?.comments)} {s.comments}
                {p?.reel ? ` · ${s.reel}` : ""}
                {p?.caption ? <div className="sm-muted sm-small">{p.caption}</div> : null}
                {p?.permalink ? (
                  <a href={p.permalink} target="_blank" rel="noreferrer" className="sm-small">
                    Instagram
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
