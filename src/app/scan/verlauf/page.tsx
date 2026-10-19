import { currentScanUser } from "@/lib/scan/access";
import { recentHistory, countToday } from "@/lib/scan/store";
import { contactUrl, ghlConfigured } from "@/lib/scan/ghl";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("de-CH", { dateStyle: "short", timeStyle: "short" });

export default async function ScanHistoryPage() {
  const user = await currentScanUser();
  if (!user) return null;
  const [history, today] = await Promise.all([recentHistory(200), countToday(user.id)]);
  const ghl = ghlConfigured();

  return (
    <div className="sc-page">
      <header className="sc-head">
        <div>
          <h1>Verlauf</h1>
          <p className="sc-sub">Die letzten Scans des ganzen Teams. Heute: {today.mine} von dir, {today.team} im Team.</p>
        </div>
      </header>
      {history.length === 0 ? (
        <p className="sc-sub">Noch keine Scans.</p>
      ) : (
        <div className="sc-table-wrap">
          <table className="sc-table">
            <thead>
              <tr>
                <th>Zeit</th>
                <th>Kontakt</th>
                <th>Firma</th>
                <th>Tags</th>
                <th>Gescannt von</th>
                <th>GHL</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="sc-nowrap">{fmt.format(new Date(h.createdAt))}</td>
                  <td className="sc-strong">{h.name}</td>
                  <td>{h.company}</td>
                  <td>
                    <div className="sc-chips">
                      {h.tags.slice(0, 6).map((t) => (
                        <span key={t} className="sc-chip">
                          {t}
                        </span>
                      ))}
                      {h.tags.length > 6 && <span className="sc-chip">+{h.tags.length - 6}</span>}
                    </div>
                  </td>
                  <td>{h.userName}</td>
                  <td>
                    {h.contactId && ghl ? (
                      <a href={contactUrl(h.contactId)} target="_blank" rel="noreferrer">
                        {h.isNew ? "neu" : "aktualisiert"}
                      </a>
                    ) : (
                      "–"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
