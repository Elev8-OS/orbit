import { groContext } from "@/lib/gro/access";
import { call, type LiveCheckin, type LiveGuest } from "@/lib/gro/elev8";
import { keep, liveContext, liveListings } from "@/lib/gro/live";
import { listConstants, listOverlays, listProcesses, listShortcuts } from "@/lib/gro/store";
import { AutoRefresh, QuickSearch } from "@/components/gro/Tools";
import { Assist } from "@/components/gro/Assist";

export const dynamic = "force-dynamic";

const CHANNEL: Record<string, string> = { BOOKING_COM: "Booking.com", AIRBNB: "Airbnb", AGODA: "Agoda", DIRECT: "Direkt" };
const channel = (c: string) => CHANNEL[c] ?? c.replace(/_/g, " ").toLowerCase();
const day = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("de-CH", { weekday: "short", day: "2-digit", month: "2-digit" });
const todayIso = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Zurich" }).format(new Date());
const short = (n: string) => n.replace(/^The R (Apartments?|Suites?|Villa|Loft)\s*/i, "").split(/[,\-–|]/)[0].trim() || n;

export default async function Heute() {
  const ctx = await groContext();
  if (!ctx) return null;
  const t = ctx.tenant;
  const [{ creds, allowed, problem }, processes, shortcuts, overlays, constants] = await Promise.all([liveContext(t), listProcesses(t.id), listShortcuts(t.id), listOverlays(t.id), listConstants(t.id)]);
  const pruef = constants.find((c) => c.key === "pruefzeit_ch")?.value ?? "14:00";

  const [unver, ins, listings] = await Promise.all([
    call<LiveGuest>(t, creds, "get_unverified_guests", { days_ahead: 3 }),
    call<LiveCheckin>(t, creds, "get_upcoming_checkins", { days_ahead: 2 }),
    liveListings(t, creds)
  ]);

  const byName = new Map((listings.ok ? listings.rows : []).map((l) => [l.listing_name, l]));
  const idOf = (name: string) => byName.get(name)?.listing_id;
  const unverRows = unver.ok ? keep(unver.rows, allowed).sort((a, b) => a.check_in_date.localeCompare(b.check_in_date)) : [];
  const unverKeys = new Set(unverRows.map((r) => `${r.listing_name}|${r.guest_name}|${r.check_in_date}`));
  const inRows = ins.ok ? keep(ins.rows, allowed).sort((a, b) => a.check_in_date.localeCompare(b.check_in_date) || a.listing_name.localeCompare(b.listing_name)) : [];
  const today = todayIso();
  const stamp = [unver, ins].flatMap((r) => (r.ok ? [r.at] : []));
  const at = stamp.length ? Math.min(...stamp) : null;

  const quick = shortcuts.flatMap((s) => {
    const p = processes.find((x) => x.key === s.processKey);
    return p ? [{ phrase: s.phrase, key: p.key, title: p.title }] : [];
  });
  const err = [!creds ? (problem ? `Elev8-Zugang nicht lesbar: ${problem}` : "Für diesen Mandanten ist noch kein Elev8-Zugang hinterlegt (Verwaltung).") : null, creds && !unver.ok ? (unver as { error: string }).error : null].filter(Boolean)[0];

  return (
    <div className="gr-page">
      <header className="gr-head">
        <div>
          <h1>Heute</h1>
          <p className="gr-sub">{t.name} · {new Date().toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        {creds && <AutoRefresh at={at} />}
      </header>

      <Assist />
      <QuickSearch items={quick} />

      {err && <p className="gr-banner">{err}</p>}

      <section className="gr-stats" aria-label="Übersicht">
        <div><b>{unverRows.length}</b><span>Unverifiziert (3 Tage)</span></div>
        <div><b>{inRows.filter((r) => r.check_in_date === today).length}</b><span>Check-ins heute</span></div>
        <div><b>{inRows.filter((r) => r.check_in_date !== today).length}</b><span>Check-ins morgen</span></div>
        <div><b>{inRows.filter((r) => overlays.get(idOf(r.listing_name) ?? "")?.citytaxPortal).length}</b><span>mit Citytax-Meldung</span></div>
      </section>

      <section className="gr-card">
        <div className="gr-card-head">
          <h2>Unverifizierte Check-ins</h2>
          <a className="gr-btn gr-btn-secondary" href="/gro/prozesse/P-2.1">Ablauf P-2.1</a>
        </div>
        <p className="gr-muted">Prüfzeit Schweiz {pruef}. Jede Zeile bekommt die Nachricht mit dem Gästeführer-Link genau dieser Buchung (Vorlagen).</p>
        {unverRows.length ? (
          <div className="gr-table-wrap">
            <table className="gr-table">
              <thead><tr><th>Anreise</th><th>Gast</th><th>Objekt</th><th>Kanal</th><th>Verifiziert</th></tr></thead>
              <tbody>
                {unverRows.map((r) => (
                  <tr key={r.reservation_id}>
                    <td className="gr-nowrap">{day(r.check_in_date)}{r.check_in_date === today && <span className="gr-pill gr-pill-warn">heute</span>}</td>
                    <td>{r.guest_name}{r.language && <span className="gr-muted"> · {r.language}</span>}</td>
                    <td>{short(r.listing_name)}</td>
                    <td>{channel(r.channel)}</td>
                    <td className="gr-nowrap">{r.total_verified_guest} von {r.number_of_guests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="gr-muted">{unver.ok ? "Alle Anreisen der nächsten 3 Tage sind verifiziert." : "Keine Daten."}</p>
        )}
      </section>

      <section className="gr-card">
        <div className="gr-card-head">
          <h2>Check-ins heute und morgen</h2>
          <a className="gr-btn gr-btn-secondary" href="/gro/prozesse/P-3.1">Citytax P-3.1</a>
        </div>
        {inRows.length ? (
          <div className="gr-table-wrap">
            <table className="gr-table">
              <thead><tr><th>Anreise</th><th>Gast</th><th>Objekt</th><th>Gäste</th><th>Nächte</th><th>Hinweise</th></tr></thead>
              <tbody>
                {inRows.map((r) => {
                  const l = byName.get(r.listing_name);
                  const ov = l ? overlays.get(l.listing_id) : undefined;
                  const isUnver = unverKeys.has(`${r.listing_name}|${r.guest_name}|${r.check_in_date}`);
                  const over = l?.maximum_capacity != null && r.number_of_guests > l.maximum_capacity;
                  const extra = r.number_of_guests > t.baseGuests;
                  return (
                    <tr key={r.pms_reservation_id}>
                      <td className="gr-nowrap">{day(r.check_in_date)}<span className="gr-muted"> {(r.estimated_check_in_time || r.check_in_time).slice(0, 5)}</span></td>
                      <td>{r.guest_name}<span className="gr-muted"> · {channel(r.channel)}</span></td>
                      <td>{short(r.listing_name)}</td>
                      <td className="gr-nowrap">{r.number_of_guests}{l?.maximum_capacity != null && <span className="gr-muted"> von {l.maximum_capacity}</span>}</td>
                      <td>{r.nights}</td>
                      <td className="gr-badges">
                        {isUnver && <a className="gr-pill gr-pill-warn" href="/gro/prozesse/P-2.1">Unverifiziert</a>}
                        {ov?.citytaxPortal && <a className="gr-pill" href="/gro/prozesse/P-3.1">Citytax {ov.citytaxPortal}</a>}
                        {over && <span className="gr-pill gr-pill-danger">Über Kapazität</span>}
                        {extra && !over && <a className="gr-pill" href="/gro/prozesse/P-4.1">Zusatzperson prüfen</a>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="gr-muted">{ins.ok ? "Keine Anreisen heute oder morgen." : "Keine Daten."}</p>
        )}
      </section>
    </div>
  );
}
