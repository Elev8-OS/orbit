"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Post, Property } from "@/lib/sm-manager/types";
import { smStrings, type SmStrings } from "@/lib/sm-manager/i18n";
import { statsStrings } from "@/lib/sm-manager/stats-i18n";
import { inquiryStrings } from "@/lib/sm-manager/inquiries-i18n";
import { audienceStrings } from "@/lib/sm-manager/audience-i18n";
import { learningStrings } from "@/lib/sm-manager/learnings-i18n";
import { promoStrings } from "@/lib/sm-manager/promos-i18n";
import { tipStrings } from "@/lib/sm-manager/tips-i18n";
import { SmStats, type ClickStats, type SocialStats } from "./SmStats";
import { SmInquiries, type Inquiry } from "./SmInquiries";
import { Tip } from "./Tip";
import "./sm.css";

type Props = {
  locale: "de" | "en";
  view: "review" | "done" | "properties" | "stats" | "inquiries" | "audience" | "learnings" | "promos";
  posts: Post[];
  properties: Property[];
  reviewCount: number;
  ghlReady: boolean;
  social?: SocialStats | null;
  clicks?: ClickStats | null;
  bioLink?: string;
  inquiries?: Inquiry[];
  inquiryCount?: number;
  agentEnabled?: boolean;
  audience?: ReactNode;
  learnings?: ReactNode;
  promos?: ReactNode;
  learningCount?: number;
  postHour?: number | null;
};

async function send(method: string, url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: typeof json.error === "string" ? json.error : undefined };
  } catch {
    return { ok: false };
  }
}

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
// baliHour: preferred posting hour in Bali time (UTC+8), set by an accepted learning. Without it 18:00 local time.
function defaultWhen(baliHour?: number | null) {
  const d = new Date();
  if (typeof baliHour === "number") {
    d.setUTCHours(baliHour - 8, 0, 0, 0);
    if (d.getTime() < Date.now()) d.setUTCDate(d.getUTCDate() + 1);
    return toLocalInput(d);
  }
  d.setHours(18, 0, 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return toLocalInput(d);
}

export function SmHome({ locale, view, posts, properties, reviewCount, ghlReady, social = null, clicks = null, bioLink = "", inquiries = [], inquiryCount = 0, agentEnabled = false, audience = null, learnings = null, promos = null, learningCount = 0, postHour = null }: Props) {
  const s = smStrings(locale);
  const tp = tipStrings(locale);
  const navRef = useRef<HTMLElement>(null);

  // Auf dem Handy den aktiven Tab ins Bild scrollen, damit er nicht hinter dem Rand verschwindet.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [view]);

  return (
    <div className="p-page sm" lang={locale}>
      <header className="sm-head">
        <div>
          <h1>{s.title}</h1>
          <p className="sm-muted">{s.intro}</p>
        </div>
        <span>
          <span className={`sm-badge ${ghlReady ? "sm-badge-ok" : ""}`}>
            {s.ghlTitle}: {ghlReady ? s.ghlReady : s.ghlMissing}
          </span>
          <Tip text={tp.ghl} label={tp.label} />
        </span>
      </header>

      <nav ref={navRef} className="sm-tabs" aria-label={s.title}>
        <a href="/sm-manager" aria-current={view === "review" ? "page" : undefined}>
          {s.tabReview}
          {reviewCount ? <span className="sm-count">{reviewCount}</span> : null}
        </a>
        <a href="/sm-manager?ansicht=anfragen" aria-current={view === "inquiries" ? "page" : undefined}>
          {inquiryStrings(locale).tabInquiries}
          {inquiryCount ? <span className="sm-count">{inquiryCount}</span> : null}
        </a>
        <a href="/sm-manager?ansicht=done" aria-current={view === "done" ? "page" : undefined}>
          {s.tabDone}
        </a>
        <a href="/sm-manager?ansicht=kennzahlen" aria-current={view === "stats" ? "page" : undefined}>
          {statsStrings(locale).tabStats}
        </a>
        <a href="/sm-manager?ansicht=learnings" aria-current={view === "learnings" ? "page" : undefined}>
          {learningStrings(locale).tabLearnings}
          {learningCount ? <span className="sm-count">{learningCount}</span> : null}
        </a>
        <a href="/sm-manager?ansicht=aktionen" aria-current={view === "promos" ? "page" : undefined}>
          {promoStrings(locale).tabPromos}
        </a>
        <a href="/sm-manager?ansicht=zielgruppen" aria-current={view === "audience" ? "page" : undefined}>
          {audienceStrings(locale).tabAudience}
        </a>
        <a href="/sm-manager?ansicht=objekte" aria-current={view === "properties" ? "page" : undefined}>
          {s.tabProperties}
        </a>
      </nav>

      {view === "inquiries" ? (
        <SmInquiries locale={locale} inquiries={inquiries} agentEnabled={agentEnabled} />
      ) : view === "audience" ? (
        audience
      ) : view === "learnings" ? (
        learnings
      ) : view === "promos" ? (
        promos
      ) : view === "stats" ? (
        <SmStats locale={locale} social={social} clicks={clicks} bioLink={bioLink} />
      ) : view === "properties" ? (
        <Properties s={s} locale={locale} properties={properties} />
      ) : posts.length === 0 ? (
        <p className="sm-empty">{view === "review" ? s.emptyReview : s.emptyDone}</p>
      ) : (
        <ul className="sm-list">
          {posts.map((p) => (
            <li key={p.id}>
              <PostCard s={s} locale={locale} post={p} ghlReady={ghlReady} actionable={view === "review"} postHour={postHour} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PostCard({ s, locale, post, ghlReady, actionable, postHour }: { s: SmStrings; locale: "de" | "en"; post: Post; ghlReady: boolean; actionable: boolean; postHour: number | null }) {
  const router = useRouter();
  const tp = tipStrings(locale);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [when, setWhen] = useState(() => defaultWhen(postHour));
  const [comment, setComment] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const hasDraft = Boolean(post.ghl && Object.values(post.ghl).some((g) => g && g.id));
  const urls = post.mediaUrls ?? [];
  const date = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(post.plan_date));
  const names = (post.plan?.properties ?? []).map((p) => p.name).join(", ");

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setMsg(s.working);
    const r = await fn();
    setBusy(false);
    setMsg(r.ok ? s.saved : `${s.failed}${r.error ? `: ${r.error}` : ""}`);
    if (r.ok) router.refresh();
  }
  const approve = () =>
    act(() =>
      ghlReady && hasDraft
        ? send("POST", `/api/sm-manager/posts/${post.id}/status`, { status: "scheduled", scheduledFor: new Date(when).toISOString() })
        : send("POST", `/api/sm-manager/posts/${post.id}/status`, { status: "approved" })
    );
  const reject = () => act(() => send("POST", `/api/sm-manager/posts/${post.id}/status`, { status: "rejected", feedback: comment.trim() || undefined }));
  const reopen = () => act(() => send("POST", `/api/sm-manager/posts/${post.id}/status`, { status: "rendered" }));
  const retry = () => act(() => send("POST", `/api/sm-manager/posts/${post.id}/draft`));

  return (
    <article className="sm-card">
      <div className="sm-media">
        {urls.length === 0 ? (
          <p className="sm-muted sm-small">{s.notRendered}</p>
        ) : post.media?.type === "video" ? (
          // #t=0.5 makes the browser show a real frame as the poster instead of a black box
          <video src={`${urls[0]}#t=0.5`} controls playsInline preload="metadata" />
        ) : (
          <div className="sm-strip">
            {urls.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={u} src={u} alt={`${i + 1}`} loading="lazy" />
            ))}
          </div>
        )}
      </div>

      <div className="sm-body">
        <div className="sm-top">
          <span className="sm-badge">{s.formats[post.format ?? ""] ?? post.format}</span>
          <span className="sm-badge">{s.pillars[post.pillar ?? ""] ?? post.pillar}</span>
          <span className={`sm-badge sm-status-${post.status}`}>{s.statuses[post.status] ?? post.status}</span>
          <span className="sm-muted sm-small">{[names, date].filter(Boolean).join(" · ")}</span>
        </div>

        {post.copy?.hook ? <h2>{post.copy.hook}</h2> : null}
        <h3>{s.caption}</h3>
        <p className="sm-caption">{post.copy?.captions?.instagram}</p>
        {post.copy?.hashtags?.length ? (
          <p className="sm-muted sm-small">
            <strong>{s.hashtags}:</strong> {post.copy.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
          </p>
        ) : null}
        {post.copy?.warnings?.length ? (
          <p className="sm-warn">
            <strong>{s.warnings}:</strong>
            <Tip text={tp.warnings} label={tp.label} /> {post.copy.warnings.join("; ")}
          </p>
        ) : null}
        {post.error && !post.copy?.warnings?.length ? <p className="sm-warn">{post.error}</p> : null}
        {post.feedback ? <p className="sm-muted sm-small">“{post.feedback}”</p> : null}

        {actionable ? (
          <div className="sm-actions">
            {ghlReady && hasDraft ? (
              <>
                <label className="sm-when">
                  {s.approveAt}
                  <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                </label>
                <Tip text={tp.approveAt} label={tp.label} />
              </>
            ) : (
              <span className="sm-muted sm-small">{s.approveNoGhl}</span>
            )}
            <button type="button" className="sm-btn sm-btn-primary" onClick={approve} disabled={busy || urls.length === 0}>
              {s.approve}
            </button>
            <Tip text={tp.approve} label={tp.label} />
            {!hasDraft && ghlReady && urls.length > 0 ? (
              <>
                <button type="button" className="sm-btn" onClick={retry} disabled={busy}>
                  {s.retryDraft}
                </button>
                <Tip text={tp.retryDraft} label={tp.label} />
              </>
            ) : null}
            <button type="button" className="sm-btn" onClick={() => setRejecting((v) => !v)} disabled={busy}>
              {s.reject}
            </button>
            <Tip text={tp.reject} label={tp.label} />
            {rejecting ? (
              <div className="sm-reject">
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={s.rejectComment} rows={2} maxLength={1000} />
                <button type="button" className="sm-btn" onClick={reject} disabled={busy}>
                  {s.reject}
                </button>
              </div>
            ) : null}
          </div>
        ) : post.status === "rejected" || post.status === "approved" ? (
          <div className="sm-actions">
            <button type="button" className="sm-btn" onClick={reopen} disabled={busy}>
              {s.reopen}
            </button>
          </div>
        ) : null}
        {msg ? <p className="sm-muted sm-small" role="status">{msg}</p> : null}
      </div>
    </article>
  );
}

function Properties({ s, locale, properties }: { s: SmStrings; locale: "de" | "en"; properties: Property[] }) {
  const router = useRouter();
  const tp = tipStrings(locale);
  const [busy, setBusy] = useState<string | null>(null);
  const fmt = (iso: string | null) => (iso ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { day: "numeric", month: "short" }).format(new Date(iso)) : s.never);

  async function toggle(p: Property) {
    setBusy(p.key);
    await send("PATCH", `/api/sm-manager/properties/${p.key}`, { active: !p.active });
    setBusy(null);
    router.refresh();
  }

  return (
    <section>
      <p className="sm-muted">{s.propsIntro}</p>
      <div className="sm-table-wrap">
        <table className="sm-table">
          <thead>
            <tr>
              <th>{s.colName}</th>
              <th>{s.colArea}</th>
              <th>
                {s.colPhotos}
                <Tip text={tp.colPhotos} label={tp.label} />
              </th>
              <th>
                {s.colLast}
                <Tip text={tp.colLast} label={tp.label} />
              </th>
              <th>
                {s.colActive}
                <Tip text={tp.colActive} label={tp.label} />
              </th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => (
              <tr key={p.key}>
                <td className="sm-cell-title">
                  {p.name}
                  {p.open_questions ? <div className="sm-muted sm-small">{s.openQuestions}: {p.open_questions}</div> : null}
                </td>
                <td data-label={s.colArea}>{p.area ?? "–"}</td>
                <td data-label={s.colPhotos} className={p.good_photos < 5 ? "sm-low" : undefined}>
                  {p.good_photos} / {p.photos}
                </td>
                <td data-label={s.colLast}>{fmt(p.last_posted_at)}</td>
                <td data-label={s.colActive}>
                  <label className="sm-switch">
                    <input type="checkbox" checked={p.active} disabled={busy === p.key} onChange={() => toggle(p)} aria-label={`${p.name}: ${s.colActive}`} />
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
