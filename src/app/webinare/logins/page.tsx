import { currentWebinarUser } from "@/lib/webinare/access";
import { KEEP_MONTHS, listLogins, loginPeople, loginStats, pruneLogins } from "@/lib/webinare/logins";
import { formatInZone } from "@/lib/messen/time";

export const dynamic = "force-dynamic";
const ZONE = "Europe/Zurich";

export default async function LoginsPage({ searchParams }: { searchParams: Promise<{ q?: string; ansicht?: string }> }) {
  const user = await currentWebinarUser();
  if (!user) return null;
  if (!user.canEdit) {
    return (
      <div className="me-page">
        <div className="me-empty">
          <h1>Logins</h1>
          <p>Das Login-Protokoll sehen nur Personen mit der Rolle App.Webinar.</p>
        </div>
      </div>
    );
  }
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim().slice(0, 100);
  const people = sp.ansicht === "personen";
  await pruneLogins();
  const [stats, logins, persons] = await Promise.all([loginStats(), people ? Promise.resolve([]) : listLogins(q), people ? loginPeople(q) : Promise.resolve([])]);
  const link = (ansicht: string) => `/webinare/logins?${new URLSearchParams({ ...(ansicht ? { ansicht } : {}), ...(q ? { q } : {}) })}`;

  return (
    <div className="me-page">
      <header className="me-head">
        <div>
          <h1>Logins</h1>
          <p className="me-sub">Wer sich wann im Webinar-Portal eingeloggt hat. Gespeichert werden E-Mail, Zeitpunkt und grob das Gerät, keine IP-Adresse. Einträge älter als {KEEP_MONTHS} Monate werden gelöscht.</p>
        </div>
      </header>

      <div className="me-stats" style={{ marginBottom: "1.25rem" }}>
        <div>
          <b>{stats.today}</b>
          <span>heute</span>
        </div>
        <div>
          <b>{stats.week}</b>
          <span>letzte 7 Tage</span>
        </div>
        <div>
          <b>{stats.month}</b>
          <span>letzte 30 Tage</span>
        </div>
        <div>
          <b>{stats.peopleMonth}</b>
          <span>Personen in 30 Tagen</span>
        </div>
      </div>

      <div className="wb-login-bar">
        <nav className="wb-tabs" aria-label="Ansicht">
          <a href={link("")} aria-current={!people ? "page" : undefined}>
            Alle Logins
          </a>
          <a href={link("personen")} aria-current={people ? "page" : undefined}>
            Nach Person
          </a>
        </nav>
        <form method="get" className="wb-login-search" role="search">
          {people && <input type="hidden" name="ansicht" value="personen" />}
          <input type="search" name="q" defaultValue={q} placeholder="Name oder E-Mail" aria-label="Name oder E-Mail suchen" />
          <button className="me-btn me-btn-secondary" type="submit">
            Suchen
          </button>
        </form>
      </div>

      {people ? (
        persons.length === 0 ? (
          <p className="me-sub">{q ? "Niemand gefunden." : "Noch keine Logins."}</p>
        ) : (
          <div className="me-table-wrap">
            <table className="me-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Logins</th>
                  <th>Zuletzt</th>
                  <th>Erstmals</th>
                  <th>Zugang</th>
                </tr>
              </thead>
              <tbody>
                {persons.map((p) => (
                  <tr key={p.email}>
                    <td>
                      <span className="me-strong">{p.name || p.email}</span>
                      {p.name && <div className="me-muted">{p.email}</div>}
                    </td>
                    <td>
                      <a href={`/webinare/logins?q=${encodeURIComponent(p.email)}`}>{p.logins}</a>
                    </td>
                    <td>{formatInZone(p.last, ZONE)}</td>
                    <td className="me-muted">{formatInZone(p.first, ZONE)}</td>
                    <td className="me-muted">{[p.liveEver && "Archiv-Schlüssel", p.isCustomer && "Kunde"].filter(Boolean).join(", ") || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : logins.length === 0 ? (
        <p className="me-sub">{q ? "Keine Logins gefunden." : "Noch keine Logins."}</p>
      ) : (
        <div className="me-table-wrap">
          <table className="me-table">
            <thead>
              <tr>
                <th>Zeitpunkt</th>
                <th>Person</th>
                <th>Gerät</th>
              </tr>
            </thead>
            <tbody>
              {logins.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatInZone(l.at, ZONE)}</td>
                  <td>
                    <span className="me-strong">{l.name || l.email}</span>
                    {l.name && <div className="me-muted">{l.email}</div>}
                  </td>
                  <td className="me-muted">{l.source === "nachgetragen" ? "nachgetragen" : l.device || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logins.length >= 300 && <p className="me-muted" style={{ marginTop: "0.75rem" }}>Die neuesten 300 Logins. Mit der Suche findest du ältere.</p>}
        </div>
      )}
    </div>
  );
}
