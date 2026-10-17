import { currentMessenUser } from "@/lib/messen/access";
import { listEvents } from "@/lib/messen/store";
import { formatInZone } from "@/lib/messen/time";
import { createEventAction } from "./actions";
import { StatefulForm } from "@/components/messen/MessenForms";

export const dynamic = "force-dynamic";

function status(e: { active: boolean; drawAt: Date | null }) {
  if (!e.active) return { label: "Entwurf", cls: "me-badge" };
  if (e.drawAt && e.drawAt.getTime() <= Date.now()) return { label: "Beendet", cls: "me-badge me-badge-done" };
  return { label: "Online", cls: "me-badge me-badge-live" };
}

export default async function MessenPage() {
  const user = await currentMessenUser();
  if (!user) return null; // Layout zeigt den Hinweis
  const events = await listEvents();

  return (
    <div className="me-page">
      <header className="me-head">
        <div>
          <h1>Messen</h1>
          <p className="me-sub">Gewinnspiel-Seiten für Messen anlegen, Leads sammeln und an GHL übergeben.</p>
        </div>
      </header>

      <section className="me-card">
        <h2>Neue Messe</h2>
        <StatefulForm action={createEventAction} submit="Messe anlegen" pending="Wird angelegt …" className="me-new">
          <label className="me-field">
            <span>Name</span>
            <input name="name" required maxLength={120} placeholder="z. B. Hospitality Expo Bali 2026" />
          </label>
          <label className="me-field">
            <span>
              Kurzadresse <em>optional</em>
            </span>
            <input name="slug" maxLength={60} placeholder="wird aus dem Namen erzeugt" pattern="[a-zA-Z0-9-]*" />
          </label>
        </StatefulForm>
      </section>

      {events.length === 0 ? (
        <p className="me-sub">Noch keine Messen angelegt.</p>
      ) : (
        <div className="me-table-wrap">
          <table className="me-table">
            <thead>
              <tr>
                <th>Messe</th>
                <th>Status</th>
                <th>Ziehung</th>
                <th className="num">Leads</th>
                <th className="num">Hot</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const s = status(e);
                return (
                  <tr key={e.id}>
                    <td>
                      <a href={`/messen/${e.id}`} className="me-strong">
                        {e.name}
                      </a>
                      <div className="me-muted">/m/{e.slug}</div>
                    </td>
                    <td>
                      <span className={s.cls}>{s.label}</span>
                    </td>
                    <td>{formatInZone(e.drawAt, e.timeZone)}</td>
                    <td className="num">{e.leads}</td>
                    <td className="num">{e.hot}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
