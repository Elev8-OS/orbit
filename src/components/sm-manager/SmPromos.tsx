"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "./inquiries.css";
import "./promos.css";

export type Promo = {
  id: number;
  property_key: string;
  title: string;
  code: string;
  terms: string;
  stay_from: string | null;
  stay_to: string | null;
  book_until: string | null;
  min_nights: number | null;
  status: "draft" | "active" | "ended";
  source: string;
  suggestion_id: string | null;
  note: string;
  live: boolean;
};

export type Suggestion = {
  id: string;
  type: string;
  benefit: string;
  property_key: string;
  name: string;
  units: number;
  open_nights: number;
  share: number;
  first_gap_date: string | null;
  days: number;
  min_nights: number | null;
  stay_from: string;
  stay_to: string;
  book_until: string;
};

export type PromosData = { today: string; autopilot?: boolean; promos: Promo[] };
export type SuggestionsData = { today: string; days: number; suggestions: Suggestion[]; error?: string };
type Prop = { key: string; name: string };

/** One code can be for several villas: the engine keeps one row per villa. Rows with the same code, source and status are one card. */
type Group = { promo: Promo; keys: string[] };

function groupByCode(list: Promo[]): Group[] {
  const out: Group[] = [];
  const byCode = new Map<string, Group>();
  for (const p of list) {
    const k = p.code ? `${p.source}|${p.status}|${p.code}` : "";
    const g = k ? byCode.get(k) : undefined;
    if (g) {
      if (!g.keys.includes(p.property_key)) g.keys.push(p.property_key);
      if (p.live && !g.promo.live) g.promo = { ...g.promo, live: true };
      continue;
    }
    const fresh: Group = { promo: p, keys: [p.property_key] };
    out.push(fresh);
    if (k) byCode.set(k, fresh);
  }
  return out;
}

async function call(method: string, url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: typeof json.error === "string" ? json.error : undefined };
  } catch {
    return { ok: false };
  }
}

function Card({ locale, promo, villas }: { locale: "de" | "en"; promo: Promo; villas: string[] }) {
  const l = (de: string, en: string) => (locale === "de" ? de : en);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const proposal = promo.source === "engine" && promo.status === "draft";
  const handMade = promo.source !== "elev8" && promo.source !== "engine";
  const many = villas.length > 1;
  const forVillas = many ? l(` für ${villas.length} Villen`, ` for ${villas.length} villas`) : "";

  const badge = promo.status === "ended" ? l("beendet", "ended") : proposal ? l("Vorschlag der Engine", "Engine proposal") : promo.live ? l("läuft", "running") : l("aktiv, ausserhalb des Zeitraums", "active, outside its window");
  const bits = [
    promo.stay_from || promo.stay_to ? l(`Aufenthalt ${promo.stay_from ?? "…"} bis ${promo.stay_to ?? "…"}`, `Stays ${promo.stay_from ?? "…"} to ${promo.stay_to ?? "…"}`) : "",
    promo.book_until ? l(`buchbar bis ${promo.book_until}`, `book by ${promo.book_until}`) : "",
    promo.min_nights ? l(`mind. ${promo.min_nights} Nächte`, `at least ${promo.min_nights} nights`) : ""
  ].filter(Boolean);

  async function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setMsg(label);
    const r = await fn();
    setBusy(false);
    setMsg(r.ok ? l("Erledigt.", "Done.") : `${l("Fehlgeschlagen", "Failed")}${r.error ? `: ${r.error}` : ""}`);
    if (r.ok) router.refresh();
  }

  const activate = () => {
    if (!window.confirm(l(`Den Code ${promo.code}${forVillas} jetzt in Elev8 anlegen? Er ist dort sofort einlösbar und lässt sich nur in Elev8 wieder ausschalten.`, `Create the code ${promo.code}${forVillas} in Elev8 now? It can be redeemed there at once and can only be switched off in Elev8.`))) return;
    run(l("Der Code wird in Elev8 angelegt …", "Creating the code in Elev8 ..."), () => call("PUT", `/api/sm-manager/promos/${promo.id}`, { status: "active" }));
  };
  const reject = () => {
    if (!window.confirm(l(`Diesen Vorschlag${forVillas} ablehnen und entfernen?`, `Reject and remove this proposal${forVillas}?`))) return;
    run(l("Wird entfernt …", "Removing ..."), () => call("DELETE", `/api/sm-manager/promos/${promo.id}`));
  };
  const endIt = () => {
    if (!window.confirm(l("Diese von Hand eingetragene Aktion beenden?", "End this promotion that was entered by hand?"))) return;
    run(l("Wird beendet …", "Ending ..."), () => call("PUT", `/api/sm-manager/promos/${promo.id}`, { status: "ended" }));
  };

  return (
    <article className="inq-card pr-card">
      <div className="pr-card-head">
        <span className={`sm-badge ${promo.live ? "sm-badge-ok" : ""}`}>{badge}</span>
        <span className="sm-muted sm-small">
          {many ? l(`${villas.length} Villen`, `${villas.length} villas`) : villas[0]} · {promo.source === "elev8" ? l("aus Elev8", "from Elev8") : promo.source === "engine" ? l("von der Engine", "by the engine") : l("von Hand eingetragen", "entered by hand")}
        </span>
      </div>
      <h3>
        {promo.title} <code className="pr-code">{promo.code}</code>
      </h3>
      {many ? <p className="sm-muted sm-small">{villas.join(", ")}</p> : null}
      <p>{promo.terms.length > 280 ? `${promo.terms.slice(0, 280).replace(/\s+\S*$/, "")} …` : promo.terms}</p>
      {bits.length ? <p className="sm-muted sm-small">{bits.join(" · ")}</p> : null}
      {promo.note ? <p className="sm-muted sm-small">{proposal ? `${l("Begründung", "Reason")}: ` : ""}{promo.note}</p> : null}
      {promo.source === "elev8" && promo.status !== "ended" ? <p className="sm-muted sm-small">{l("Änderungen oder Ausschalten nur in Elev8.", "Change or switch off in Elev8 only.")}</p> : null}
      <div className="pr-actions">
        {proposal ? (
          <>
            <button type="button" className="sm-btn sm-btn-primary" onClick={activate} disabled={busy}>
              {l("Freigeben (legt den Code in Elev8 an)", "Approve (creates the code in Elev8)")}
            </button>
            <button type="button" className="sm-btn" onClick={reject} disabled={busy}>
              {l("Ablehnen", "Reject")}
            </button>
          </>
        ) : null}
        {handMade && promo.status !== "ended" ? (
          <button type="button" className="sm-btn" onClick={endIt} disabled={busy}>
            {l("Beenden", "End")}
          </button>
        ) : null}
        {msg ? (
          <span className="sm-muted sm-small" role="status">
            {msg}
          </span>
        ) : null}
      </div>
    </article>
  );
}

/** Tab Aktionen: Vorschläge der Engine zum Freigeben und die Codes aus Elev8. Ein Code für mehrere Villen ist eine Karte. Codes werden hier nicht von Hand angelegt. */
export function SmPromos({ locale, promos, properties }: { locale: "de" | "en"; promos: PromosData | null; properties: Prop[] }) {
  const l = (de: string, en: string) => (locale === "de" ? de : en);
  const list = promos?.promos ?? [];
  const villa = (key: string) => (key === "all" ? l("alle Villen", "all villas") : properties.find((p) => p.key === key)?.name ?? key);
  const villasOf = (g: Group) => (g.keys.includes("all") ? [villa("all")] : g.keys.map(villa));
  const proposals = groupByCode(list.filter((p) => p.source === "engine" && p.status === "draft"));
  const rest = groupByCode(list.filter((p) => !(p.source === "engine" && p.status === "draft")));

  return (
    <section className="pr">
      <div>
        <p className="sm-muted">
          {l(
            "Codes entstehen nur an zwei Orten: Du legst sie in Elev8 an, dann erscheinen sie hier innerhalb weniger Minuten und gelten sofort für den Assistenten, den Katalog und die Posts. Oder die Engine schlägt selbst eine Aktion vor, passend zur Villa und zu den freien Nächten, und legt den Code nach deiner Freigabe in Elev8 an. Ein Code kann für mehrere Villen gelten. Von Hand lassen sich hier keine Codes anlegen.",
            "Codes come from two places only: you create them in Elev8, then they appear here within a few minutes and apply at once to the assistant, the catalog and the posts. Or the engine proposes a promotion itself, fitted to the villa and its open nights, and creates the code in Elev8 once you approve it. One code can apply to several villas. Codes cannot be created by hand here."
          )}
        </p>
        <p className="sm-muted sm-small">
          {promos?.autopilot
            ? l("Autopilot ist AN: Die Engine gibt ihre Vorschläge selbst frei, innerhalb ihrer Grenzen.", "Autopilot is ON: the engine approves its own proposals, within its limits.")
            : l("Autopilot ist AUS: Vorschläge warten auf deine Freigabe.", "Autopilot is OFF: proposals wait for your approval.")}
        </p>
      </div>

      <div>
        <h2>{l("Vorschläge der Engine", "Proposals of the engine")}</h2>
        {proposals.length === 0 ? <p className="sm-muted">{l("Im Moment gibt es keinen Vorschlag. Die Engine prüft die freien Nächte mehrmals täglich.", "There is no proposal right now. The engine checks the open nights several times a day.")}</p> : null}
        <div className="pr-cards">
          {proposals.map((g) => (
            <Card key={g.promo.id} locale={locale} promo={g.promo} villas={villasOf(g)} />
          ))}
        </div>
      </div>

      <div>
        <h2>{l("Codes", "Codes")}</h2>
        {rest.length === 0 ? <p className="sm-muted">{l("Noch keine Codes.", "No codes yet.")}</p> : null}
        <div className="pr-cards">
          {rest.map((g) => (
            <Card key={g.promo.id} locale={locale} promo={g.promo} villas={villasOf(g)} />
          ))}
        </div>
      </div>
    </section>
  );
}
