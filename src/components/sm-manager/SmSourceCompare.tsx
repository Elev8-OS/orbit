"use client";

import { useState } from "react";
import "./source-compare.css";

type Verdict = "too_few" | "auto_better" | "manual_better" | "no_clear_difference";
type Metric = { key: string; auto: number | null; manual: number | null; nAuto: number; nManual: number; diffPct: number | null; p: number | null; verdict: Verdict };
type Group = {
  nAuto: number;
  nManual: number;
  medianAgeAuto: number | null;
  medianAgeManual: number | null;
  autoFrom: string | null;
  autoTo: string | null;
  manualFrom: string | null;
  manualTo: string | null;
  overlapDays: number | null;
  enough: boolean;
  mixed: boolean;
  metrics: Metric[];
};
export type SourceCompare = {
  days: number;
  minPerGroup: number;
  minAgeDays: number;
  groups: { reel: Group; post: Group; all: Group };
  process: { drafts: number; approved: number; rejected: number; failed: number; waiting: number; approvalRate: number | null };
};

const de = {
  title: "Automatisch gegen von Hand",
  intro: "Automatisch heisst: vom Tool erstellt und von euch freigegeben. Von Hand heisst: in Instagram selbst gepostet. Verglichen werden die Zahlen im gleichen Format.",
  unavailable: "Der Vergleich konnte gerade nicht geladen werden.",
  groups: { reel: "Reels", post: "Karussell und Bild", all: "Alle zusammen" } as Record<string, string>,
  mixedNote: "Alle zusammen mischt die Formate und ist nur zur Orientierung. Für ein Urteil zählen Reels und Karussell/Bild einzeln.",
  counts: (a: number, m: number) => `${a} automatisch, ${m} von Hand`,
  missing: (a: number, m: number, min: number) => {
    const parts = [];
    if (a < min) parts.push(`${min - a} automatische`);
    if (m < min) parts.push(`${min - m} von Hand`);
    return `Noch nicht aussagekräftig: Es fehlen mindestens ${parts.join(" und ")} Beiträge (je ${min} pro Gruppe nötig).`;
  },
  enough: (better: number, worse: number) => `Bei den Wirkungskennzahlen liegt automatisch bei ${better} vorn und von Hand bei ${worse}. Alles andere ist ohne klaren Unterschied.`,
  metric: "Kennzahl",
  auto: "Automatisch",
  manual: "Von Hand",
  gap: "Abstand",
  verdict: "Urteil",
  metrics: { reach: "Reichweite", views: "Aufrufe", engagementRate: "Interaktionsrate (%)", savesPer1000: "Gespeichert pro 1000 Reichweite", sharesPer1000: "Geteilt pro 1000 Reichweite", profileVisitsPer1000: "Profilbesuche pro 1000 Reichweite", followsPer1000: "Neue Follower pro 1000 Reichweite" } as Record<string, string>,
  verdicts: { too_few: "Zu wenige Beiträge", auto_better: "Automatisch besser", manual_better: "Von Hand besser", no_clear_difference: "Kein klarer Unterschied" } as Record<string, string>,
  period: "Zeiträume",
  autoPeriod: "Automatisch",
  manualPeriod: "Von Hand",
  age: (a: number | null, m: number | null) => `Typisches Alter der Beiträge: ${a ?? "–"} Tage automatisch, ${m ?? "–"} Tage von Hand.`,
  noOverlap: "Die Zeiträume beider Gruppen überschneiden sich kaum. Dann vergleicht ihr auch Jahreszeiten und das Wachstum des Kontos. Ein Urteil ist nur mit Vorsicht zu lesen. Am saubersten ist der Vergleich, wenn beide Gruppen im selben Zeitraum posten.",
  ageGap: "Die Beiträge sind unterschiedlich alt. Ältere hatten mehr Zeit, Reichweite zu sammeln.",
  processTitle: "Was aus den Entwürfen wird (letzte 60 Tage)",
  drafts: "Entwürfe erstellt",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
  waiting: "Warten auf Freigabe",
  rate: "Freigabequote",
  processHelp: "Je höher die Quote, desto weniger Arbeit macht das Tool. Eine niedrige Quote heißt, dass viele Entwürfe nicht gut genug sind.",
  fairTitle: "So ist der Vergleich fair",
  fair: [
    "Es zählen nur Beiträge, die mindestens 7 Tage alt sind. So haben die Zahlen sich gesetzt.",
    "Reels und Karussell/Bild werden einzeln verglichen, weil Reels meist mehr Reichweite haben.",
    "Verglichen wird der Median, also der mittlere Beitrag, nicht der Durchschnitt. Ein einzelner Ausreißer verfälscht ihn kaum.",
    "Zahlen wie Gespeichert oder Geteilt werden auf 1000 Reichweite umgerechnet. So zählt nicht, wie groß das Konto zu dem Zeitpunkt war.",
    "Ein Urteil gibt es erst ab 8 Beiträgen pro Gruppe, bei mindestens 20 % Abstand und einem Test (Mann-Whitney), der Zufall unwahrscheinlich macht.",
    "Beiträge, die ihr vor der Freigabe in GHL am Text geändert habt, können als „von Hand“ gezählt werden, weil die Zuordnung über den Textanfang läuft."
  ],
  clicksNote: "Klicks auf den Link sind hier nicht dabei: Beiträge von Hand haben keinen verfolgten Link, ein Vergleich wäre unfair."
};
const en: typeof de = {
  title: "Automatic against by hand",
  intro: "Automatic means: created by the tool and approved by you. By hand means: posted in Instagram yourself. The numbers are compared within the same format.",
  unavailable: "The comparison could not be loaded right now.",
  groups: { reel: "Reels", post: "Carousel and image", all: "All together" },
  mixedNote: "All together mixes the formats and is for orientation only. For a verdict, reels and carousel/image count separately.",
  counts: (a, m) => `${a} automatic, ${m} by hand`,
  missing: (a, m, min) => {
    const parts = [];
    if (a < min) parts.push(`${min - a} automatic`);
    if (m < min) parts.push(`${min - m} by hand`);
    return `Not conclusive yet: at least ${parts.join(" and ")} posts are missing (${min} per group needed).`;
  },
  enough: (better, worse) => `On the performance metrics automatic leads on ${better} and by hand on ${worse}. Everything else shows no clear difference.`,
  metric: "Metric",
  auto: "Automatic",
  manual: "By hand",
  gap: "Gap",
  verdict: "Verdict",
  metrics: { reach: "Reach", views: "Views", engagementRate: "Engagement rate (%)", savesPer1000: "Saves per 1000 reach", sharesPer1000: "Shares per 1000 reach", profileVisitsPer1000: "Profile visits per 1000 reach", followsPer1000: "New followers per 1000 reach" },
  verdicts: { too_few: "Too few posts", auto_better: "Automatic better", manual_better: "By hand better", no_clear_difference: "No clear difference" },
  period: "Periods",
  autoPeriod: "Automatic",
  manualPeriod: "By hand",
  age: (a, m) => `Typical age of the posts: ${a ?? "–"} days automatic, ${m ?? "–"} days by hand.`,
  noOverlap: "The periods of both groups barely overlap. Then you are also comparing seasons and the growth of the account, so read any verdict with care. The comparison is cleanest when both groups post in the same period.",
  ageGap: "The posts have different ages. Older ones had more time to collect reach.",
  processTitle: "What becomes of the drafts (last 60 days)",
  drafts: "Drafts created",
  approved: "Approved",
  rejected: "Rejected",
  waiting: "Waiting for approval",
  rate: "Approval rate",
  processHelp: "The higher the rate, the less work the tool makes. A low rate means many drafts are not good enough.",
  fairTitle: "Why the comparison is fair",
  fair: [
    "Only posts that are at least 7 days old count. That way the numbers have settled.",
    "Reels and carousel/image are compared separately, because reels usually reach more people.",
    "The median is compared, the middle post, not the average. A single outlier hardly distorts it.",
    "Numbers like saves or shares are converted to 1000 reach, so the size of the account at that time does not count.",
    "A verdict needs 8 posts per group, a gap of at least 20% and a test (Mann-Whitney) that makes chance unlikely.",
    "Posts whose text you changed in GHL before approving may count as \"by hand\", because the match works through the start of the text."
  ],
  clicksNote: "Link clicks are not included: posts by hand have no tracked link, so a comparison would be unfair."
};

const ORDER = ["engagementRate", "reach", "views", "savesPer1000", "sharesPer1000", "profileVisitsPer1000", "followsPer1000"];
const PERFORMANCE = new Set(["engagementRate", "reach", "savesPer1000", "sharesPer1000", "followsPer1000"]);
const CHIP: Record<Verdict, string> = { too_few: "src-few", auto_better: "src-auto", manual_better: "src-manual", no_clear_difference: "src-none" };

/** Vergleich der vom Tool erstellten Beiträge mit den von Hand gepostetenen, unter „Kennzahlen“. */
export function SmSourceCompare({ locale, data }: { locale: "de" | "en"; data: SourceCompare | null }) {
  const s = locale === "en" ? en : de;
  const [fmt, setFmt] = useState<"reel" | "post" | "all">("reel");
  const num = new Intl.NumberFormat(locale === "en" ? "en-GB" : "de-CH", { maximumFractionDigits: 1 });
  const n = (v: number | null) => (v === null ? "–" : num.format(v));
  const date = (iso: string | null) => (iso ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "–");

  if (!data) {
    return (
      <section className="src">
        <h2>{s.title}</h2>
        <p className="sm-warn">{s.unavailable}</p>
      </section>
    );
  }

  const g = data.groups[fmt];
  const rows = ORDER.map((k) => g.metrics.find((m) => m.key === k)).filter((m): m is Metric => Boolean(m));
  const perf = rows.filter((m) => PERFORMANCE.has(m.key));
  const better = perf.filter((m) => m.verdict === "auto_better").length;
  const worse = perf.filter((m) => m.verdict === "manual_better").length;
  const min = data.minPerGroup;
  const noOverlap = g.nAuto > 0 && g.nManual > 0 && (g.overlapDays ?? 0) < 14;
  const ageGap = g.medianAgeAuto !== null && g.medianAgeManual !== null && Math.abs(g.medianAgeAuto - g.medianAgeManual) > 30;
  const p = data.process;

  return (
    <section className="src">
      <div>
        <h2>{s.title}</h2>
        <p className="sm-muted">{s.intro}</p>
      </div>

      <div className="src-seg" role="group" aria-label={s.title}>
        {(["reel", "post", "all"] as const).map((k) => (
          <button key={k} type="button" className="sm-btn" aria-pressed={fmt === k} onClick={() => setFmt(k)}>
            {s.groups[k]}
          </button>
        ))}
      </div>

      <p className="src-box">
        <strong>{s.counts(g.nAuto, g.nManual)}.</strong> {g.mixed ? s.mixedNote : g.enough ? s.enough(better, worse) : s.missing(g.nAuto, g.nManual, min)}
      </p>

      <div className="sm-table-wrap">
        <table className="sm-table">
          <thead>
            <tr>
              <th>{s.metric}</th>
              <th>{s.auto}</th>
              <th>{s.manual}</th>
              <th>{s.gap}</th>
              <th>{s.verdict}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.key}>
                <td className="sm-cell-title">{s.metrics[m.key] ?? m.key}</td>
                <td data-label={s.auto}>{n(m.auto)}</td>
                <td data-label={s.manual}>{n(m.manual)}</td>
                <td data-label={s.gap}>{m.diffPct === null ? "–" : `${m.diffPct > 0 ? "+" : ""}${m.diffPct} %`}</td>
                <td data-label={s.verdict}>
                  <span className={`src-chip ${CHIP[m.verdict]}`}>{s.verdicts[m.verdict]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {noOverlap ? <p className="sm-warn">{s.noOverlap}</p> : null}
      {ageGap ? <p className="sm-warn">{s.ageGap}</p> : null}
      <p className="sm-muted sm-small">
        {s.period}: {s.autoPeriod} {date(g.autoFrom)} – {date(g.autoTo)}, {s.manualPeriod} {date(g.manualFrom)} – {date(g.manualTo)}. {s.age(g.medianAgeAuto, g.medianAgeManual)} {s.clicksNote}
      </p>

      <div>
        <h2>{s.processTitle}</h2>
        <dl className="src-stats">
          <div>
            <dt className="sm-muted sm-small">{s.drafts}</dt>
            <dd>
              <strong>{p.drafts}</strong>
            </dd>
          </div>
          <div>
            <dt className="sm-muted sm-small">{s.approved}</dt>
            <dd>
              <strong>{p.approved}</strong>
            </dd>
          </div>
          <div>
            <dt className="sm-muted sm-small">{s.rejected}</dt>
            <dd>
              <strong>{p.rejected}</strong>
            </dd>
          </div>
          <div>
            <dt className="sm-muted sm-small">{s.waiting}</dt>
            <dd>
              <strong>{p.waiting}</strong>
            </dd>
          </div>
          <div>
            <dt className="sm-muted sm-small">{s.rate}</dt>
            <dd>
              <strong>{p.approvalRate === null ? "–" : `${p.approvalRate} %`}</strong>
            </dd>
          </div>
        </dl>
        <p className="sm-muted sm-small">{s.processHelp}</p>
      </div>

      <details>
        <summary>{s.fairTitle}</summary>
        <ul>
          {s.fair.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
