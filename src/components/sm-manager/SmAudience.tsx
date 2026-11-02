import { audienceStrings } from "@/lib/sm-manager/audience-i18n";
import "./audience.css";

export type AudienceWindow = { name: string; start: string; end: string; adsStart: string; daysUntil: number; status: "now" | "soon" | "running" | "later"; inHorizon: boolean };
export type AudienceMarket = {
  code: string;
  languages: string[];
  bookings: number;
  bookingShare: number;
  nightsShare: number;
  avgStay: number;
  avgGroup: number;
  angle: string;
  adsPossible: boolean;
  budgetShare: number;
  window: AudienceWindow | null;
};
export type AudienceReason = { key: string; params: Record<string, string | number> };
export type AudienceVillaMarket = { code: string; share: number; angle: string; languages: string[]; reasons: AudienceReason[] };
export type AudienceVilla = { key: string; name: string; guests: number | null; freeNights: number; freeRatio: number; firstGap: string | null; priority: "high" | "medium" | "low"; topMarkets: AudienceVillaMarket[] };
export type AudiencePlan = {
  generatedAt: string;
  horizonDays: number;
  basis: { bookings: number; unknownShare: number; leadP25: number | null; leadMedian: number | null; leadP75: number | null; familyShare: number; medianNights: number | null };
  markets: AudienceMarket[];
  villas: AudienceVilla[];
  notes: string[];
};

export function SmAudience({ locale, plan }: { locale: "de" | "en"; plan: AudiencePlan | null }) {
  const s = audienceStrings(locale);
  const loc = locale === "en" ? "en-GB" : "de-CH";
  const region = new Intl.DisplayNames([loc], { type: "region" });
  const language = new Intl.DisplayNames([loc], { type: "language" });
  const country = (code: string) => {
    try {
      return region.of(code) ?? code;
    } catch {
      return code;
    }
  };
  const lang = (code: string) => {
    try {
      return language.of(code) ?? code;
    } catch {
      return code;
    }
  };
  const day = new Intl.DateTimeFormat(loc, { day: "numeric", month: "short" });
  const d = (iso: string) => day.format(new Date(iso));

  if (!plan) {
    return (
      <section className="aud">
        <h2>{s.unavailableTitle}</h2>
        <p className="sm-warn">{s.unavailable}</p>
      </section>
    );
  }

  const b = plan.basis;
  const reasonText = (r: AudienceReason) => {
    const fn = s.reasons[r.key];
    if (!fn) return null;
    const params = { ...r.params };
    for (const k of ["start", "end", "adsStart"]) if (typeof params[k] === "string") params[k] = d(params[k] as string);
    if (typeof params.name === "string") params.name = s.windows[params.name] ?? params.name;
    return fn(params);
  };
  const windowStatus = (w: AudienceWindow) => (w.inHorizon || w.status === "running" ? w.status : "beyond");

  return (
    <section className="aud">
      <div>
        <h2>{s.title}</h2>
        <p className="sm-muted sm-small">{s.intro}</p>
        <p className="sm-muted sm-small">
          {s.asOf}: {new Intl.DateTimeFormat(loc, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(plan.generatedAt))}
        </p>
      </div>

      <div>
        <h3>{s.basisTitle}</h3>
        <div className="aud-kpis">
          <div className="aud-kpi">
            <span className="aud-kpi-label">{s.kBookings}</span>
            <strong>{b.bookings}</strong>
          </div>
          <div className="aud-kpi">
            <span className="aud-kpi-label">{s.kLead}</span>
            <strong>{b.leadMedian ?? "–"} {s.days}</strong>
            {b.leadP25 != null && b.leadP75 != null ? <span className="sm-muted sm-small">{s.kLeadSub(b.leadP25, b.leadP75)}</span> : null}
          </div>
          <div className="aud-kpi">
            <span className="aud-kpi-label">{s.kFamily}</span>
            <strong>{b.familyShare} %</strong>
          </div>
          <div className="aud-kpi">
            <span className="aud-kpi-label">{s.kStay}</span>
            <strong>{b.medianNights ?? "–"} {s.nights}</strong>
          </div>
        </div>
      </div>

      <div>
        <h3>{s.marketsTitle}</h3>
        <p className="sm-muted sm-small">{s.marketsIntro}</p>
        <div className="sm-table-wrap">
          <table className="sm-table">
            <thead>
              <tr>
                <th>{s.colMarket}</th>
                <th>{s.colShare}</th>
                <th>{s.colNights}</th>
                <th>{s.colStay}</th>
                <th>{s.colGroup}</th>
                <th>{s.colWindow}</th>
                <th>{s.colAds}</th>
                <th>{s.colBudget}</th>
              </tr>
            </thead>
            <tbody>
              {plan.markets.map((m) => (
                <tr key={m.code}>
                  <td className="sm-cell-title">
                    {country(m.code)}
                    <span className="sm-muted sm-small"> · {m.languages.map(lang).join(", ")}</span>
                  </td>
                  <td className="aud-num" data-label={s.colShare}>{m.bookingShare} %</td>
                  <td className="aud-num" data-label={s.colNights}>{m.nightsShare} %</td>
                  <td className="aud-num" data-label={s.colStay}>{m.avgStay}</td>
                  <td className="aud-num" data-label={s.colGroup}>{m.avgGroup}</td>
                  <td data-label={s.colWindow}>
                    {m.window ? (
                      <>
                        {s.windows[m.window.name] ?? m.window.name} {d(m.window.start)} – {d(m.window.end)}{" "}
                        <span className={`aud-chip aud-chip-${windowStatus(m.window)}`}>{s.status[windowStatus(m.window)]}</span>
                      </>
                    ) : (
                      <span className="sm-muted">{s.noWindow}</span>
                    )}
                  </td>
                  <td data-label={s.colAds}>{m.window && m.adsPossible ? d(m.window.adsStart) : "–"}</td>
                  <td className="aud-num" data-label={s.colBudget}>{m.adsPossible ? (m.budgetShare ? `${m.budgetShare} %` : "–") : s.noAds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3>{s.villasTitle}</h3>
        <p className="sm-muted sm-small">{s.villasIntro}</p>
        <div className="aud-villas">
          {plan.villas.map((v) => (
            <article className="aud-villa" key={v.key}>
              <header>
                <h3>{v.name}</h3>
                <span className={`aud-chip aud-chip-${v.priority}`}>{s.priority[v.priority]}</span>
              </header>
              <p className="sm-small">
                {s.free(v.freeNights, plan.horizonDays, v.freeRatio)}
                {v.firstGap ? <span className="sm-muted"> · {s.firstFree}: {d(v.firstGap)}</span> : null}
              </p>
              {v.topMarkets.map((m) => (
                <div className="aud-mk" key={m.code}>
                  <div className="aud-mk-head">
                    <strong>{country(m.code)}</strong>
                    <span className="aud-num"><strong>{m.share} %</strong> <span className="sm-muted sm-small">{m.languages.length ? `· ${s.languages}: ${m.languages.map(lang).join(", ")}` : ""}</span></span>
                  </div>
                  <span className="sm-small">{s.motif}: {s.angles[m.angle] ?? m.angle}</span>
                  <ul>
                    {m.reasons.map((r, i) => {
                      const t = reasonText(r);
                      return t ? <li key={i}>{t}</li> : null;
                    })}
                  </ul>
                </div>
              ))}
            </article>
          ))}
        </div>
      </div>

      <div>
        <h3>{s.notesTitle}</h3>
        <ul className="aud-notes sm-small">
          {plan.notes.map((n) => (
            <li key={n}>{s.notes[n] ? s.notes[n](b.unknownShare) : n}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
