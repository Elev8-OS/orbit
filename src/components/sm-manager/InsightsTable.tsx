"use client";

import { useMemo, useState } from "react";
import { insightStrings } from "@/lib/sm-manager/insights-i18n";
import { dateFormatter, nf, pct, postLabel } from "@/lib/sm-manager/insights-format";
import type { PostInsight } from "./SmPostInsights";

type SortKey = "date" | "views" | "reach" | "likes" | "comments" | "saved" | "shares" | "rate" | "clicks";
type Dir = "asc" | "desc";

const VALUE: Record<SortKey, (p: PostInsight) => number | null> = {
  date: (p) => (p.postedAt ? Date.parse(p.postedAt) : null),
  views: (p) => p.views,
  reach: (p) => p.reach,
  likes: (p) => p.likes,
  comments: (p) => p.comments,
  saved: (p) => p.saved,
  shares: (p) => p.shares,
  rate: (p) => p.engagementRate,
  // Klicks gibt es nur für Beiträge aus der Engine, bei den anderen bleibt der Wert leer
  clicks: (p) => (p.postId ? p.clicks : null)
};

export function InsightsTable({ locale, posts, range }: { locale: "de" | "en"; posts: PostInsight[]; range: string }) {
  const s = insightStrings(locale);
  const [key, setKey] = useState<SortKey>("date");
  const [dir, setDir] = useState<Dir>("desc");
  const when = dateFormatter(locale, range === "365" || range === "alle");

  const columns: { key: SortKey; label: string }[] = [
    { key: "date", label: s.colDate },
    { key: "views", label: s.colViews },
    { key: "reach", label: s.colReach },
    { key: "likes", label: s.colLikes },
    { key: "comments", label: s.colComments },
    { key: "saved", label: s.colSaved },
    { key: "shares", label: s.colShares },
    { key: "rate", label: s.colRate },
    { key: "clicks", label: s.colClicks }
  ];

  const sorted = useMemo(
    () =>
      [...posts].sort((a, b) => {
        const x = VALUE[key](a);
        const y = VALUE[key](b);
        // Leere Werte stehen immer am Ende, egal in welche Richtung sortiert wird
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return dir === "asc" ? x - y : y - x;
      }),
    [posts, key, dir]
  );

  function choose(k: SortKey) {
    if (k === key) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setKey(k);
      setDir("desc");
    }
  }

  // Die erste Spalte (Beitrag) sortiert nach Datum.
  const head = (c: { key: SortKey; label: string }) => (
    <th key={c.key} aria-sort={c.key === key ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="ins-sort" onClick={() => choose(c.key)}>
        {c.label}
        <span aria-hidden="true" className={c.key === key ? "ins-arrow ins-arrow-on" : "ins-arrow"}>
          {c.key === key ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );

  return (
    <>
      <div className="ins-sortbar">
        <label>
          <span className="sm-small sm-muted">{s.sortBy}</span>{" "}
          <select value={key} onChange={(e) => setKey(e.target.value as SortKey)}>
            {columns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="sm-btn" onClick={() => setDir((d) => (d === "desc" ? "asc" : "desc"))}>
          {dir === "desc" ? `↓ ${s.sortDesc}` : `↑ ${s.sortAsc}`}
        </button>
      </div>

      <div className="sm-table-wrap">
        <table className="sm-table ins-table">
          <thead>
            <tr>
              {head({ key: "date", label: s.colPost })}
              {columns.slice(1).map((c) => head(c))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.mediaId}>
                <td className="sm-cell-title">
                  {p.permalink ? (
                    <a className="ins-link" href={p.permalink} target="_blank" rel="noopener noreferrer">
                      {postLabel(s, p)} · {p.postedAt ? when.format(new Date(p.postedAt)) : ""}
                    </a>
                  ) : (
                    <>
                      {postLabel(s, p)} · {p.postedAt ? when.format(new Date(p.postedAt)) : ""}
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
      <p className="sm-muted sm-small">{s.sortHint}</p>
    </>
  );
}
