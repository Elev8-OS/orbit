"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tipStrings } from "@/lib/sm-manager/tips-i18n";
import { Tip } from "./Tip";

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
  top: { permalink: string | null; likes: number | null; comments: number | null; reel: boolean; caption: string }[];
};
export type CompetitorsData = { configured: boolean; checking: boolean; competitors: Competitor[] };

const de = {
  title: "Konkurrenz-Konten",
  intro: "Öffentliche Zahlen anderer Anbieter auf Instagram, gelesen über Meta. Lesbar sind nur Business- und Creator-Konten. Die Zahlen werden täglich aktualisiert.",
  notConfigured: "Meta ist in der Engine nicht verbunden, deshalb kann nichts gelesen werden.",
  unavailable: "Die Konkurrenz-Konten konnten gerade nicht geladen werden.",
  empty: "Noch kein Konto eingetragen.",
  account: "Konto",
  status: "Status",
  followers: "Follower",
  perWeek: "Posts pro Woche",
  likes: "Ø Likes",
  engagement: "Interaktion",
  reels: "Reel-Anteil",
  best: "Bester Post",
  statuses: { new: "Noch nicht geprüft", ok: "Lesbar", not_readable: "Nicht lesbar", error: "Fehler" } as Record<string, string>,
  notReadableHelp: "Das Konto ist privat oder kein Business- oder Creator-Konto. Meta gibt dann keine Zahlen frei.",
  checked: "Geprüft",
  refresh: "Jetzt prüfen",
  started: "Die Prüfung läuft. Lade die Seite in etwa einer Minute neu.",
  reload: "Neu laden",
  addPlaceholder: "Instagram-Name oder Link",
  add: "Hinzufügen",
  adding: "Wird geprüft …",
  remove: "Entfernen",
  confirmRemove: "Dieses Konto aus der Liste entfernen?",
  failed: "Das hat nicht geklappt",
  tipEngagement: "Durchschnitt aus Likes und Kommentaren der letzten 12 Posts im Verhältnis zu den Followern. Je höher, desto stärker reagiert das Publikum.",
  tipPerWeek: "Wie oft das Konto in den letzten 30 Tagen gepostet hat, umgerechnet auf eine Woche. Bei mehr als 30 Posts im Monat ist die Zahl etwas zu niedrig.",
  tipReels: "Anteil der Videos und Reels an den letzten 30 Posts.",
  tipBest: "Der Post mit der stärksten Reaktion unter den letzten 30. Kommentare zählen dreifach."
};
const en: typeof de = {
  title: "Competitor accounts",
  intro: "Public numbers of other providers on Instagram, read through Meta. Only business and creator accounts can be read. The numbers update daily.",
  notConfigured: "Meta is not connected in the engine, so nothing can be read.",
  unavailable: "The competitor accounts could not be loaded right now.",
  empty: "No account added yet.",
  account: "Account",
  status: "Status",
  followers: "Followers",
  perWeek: "Posts per week",
  likes: "Avg likes",
  engagement: "Engagement",
  reels: "Reel share",
  best: "Best post",
  statuses: { new: "Not checked yet", ok: "Readable", not_readable: "Not readable", error: "Error" },
  notReadableHelp: "The account is private or not a business or creator account. Meta then shares no numbers.",
  checked: "Checked",
  refresh: "Check now",
  started: "The check is running. Reload the page in about a minute.",
  reload: "Reload",
  addPlaceholder: "Instagram name or link",
  add: "Add",
  adding: "Checking ...",
  remove: "Remove",
  confirmRemove: "Remove this account from the list?",
  failed: "That did not work",
  tipEngagement: "Average of likes and comments of the last 12 posts relative to the followers. The higher, the more the audience reacts.",
  tipPerWeek: "How often the account posted in the last 30 days, converted to a week. With more than 30 posts a month the number is a little low.",
  tipReels: "Share of videos and reels among the last 30 posts.",
  tipBest: "The post with the strongest reaction among the last 30. Comments count three times."
};

async function call(method: string, url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: typeof json.error === "string" ? json.error : undefined };
  } catch {
    return { ok: false };
  }
}

/** Zahlen der Konkurrenz-Konten, unter dem Tab Zielgruppen. */
export function SmCompetitors({ locale, data }: { locale: "de" | "en"; data: CompetitorsData | null }) {
  const s = locale === "en" ? en : de;
  const tp = tipStrings(locale);
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const num = new Intl.NumberFormat(locale === "en" ? "en-GB" : "de-CH", { maximumFractionDigits: 1 });
  const n = (v: number | null, suffix = "") => (v == null ? "–" : `${num.format(v)}${suffix}`);
  const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { day: "numeric", month: "short" }).format(new Date(iso)) : "–");

  if (!data) {
    return (
      <section style={{ marginTop: "1.5rem" }}>
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

  return (
    <section style={{ marginTop: "1.5rem" }}>
      <h2>{s.title}</h2>
      <p className="sm-muted">{s.intro}</p>
      {!data.configured ? <p className="sm-warn">{s.notConfigured}</p> : null}
      {data.checking ? <p className="sm-muted sm-small">{s.started}</p> : null}
      <div className="sm-table-wrap">
        <table className="sm-table">
          <thead>
            <tr>
              <th>{s.account}</th>
              <th>{s.status}</th>
              <th>{s.followers}</th>
              <th>
                {s.perWeek}
                <Tip text={s.tipPerWeek} label={tp.label} />
              </th>
              <th>{s.likes}</th>
              <th>
                {s.engagement}
                <Tip text={s.tipEngagement} label={tp.label} />
              </th>
              <th>
                {s.reels}
                <Tip text={s.tipReels} label={tp.label} />
              </th>
              <th>
                {s.best}
                <Tip text={s.tipBest} label={tp.label} />
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.competitors.length === 0 ? (
              <tr>
                <td colSpan={9}>{s.empty}</td>
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
                  {c.status === "not_readable" ? (
                    <>
                      <Tip text={s.notReadableHelp} label={tp.label} />
                    </>
                  ) : null}
                  {c.status === "error" && c.error ? <div className="sm-muted sm-small">{c.error}</div> : null}
                  <div className="sm-muted sm-small">
                    {s.checked}: {day(c.checkedAt)}
                  </div>
                </td>
                <td data-label={s.followers}>{n(c.followers)}</td>
                <td data-label={s.perWeek}>{n(c.postsPerWeek)}</td>
                <td data-label={s.likes}>{n(c.avgLikes)}</td>
                <td data-label={s.engagement}>{n(c.engagementPct, " %")}</td>
                <td data-label={s.reels}>{n(c.reelSharePct, " %")}</td>
                <td data-label={s.best}>
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
    </section>
  );
}
