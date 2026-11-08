import { currentWebinarUser, portalUrl } from "@/lib/webinare/access";
import { listWebinars } from "@/lib/webinare/store";
import { formatInZone } from "@/lib/messen/time";
import { StatefulForm } from "@/components/messen/MessenForms";
import { createWebinarAction } from "./actions";

export const dynamic = "force-dynamic";

function phase(w: { startsAt: Date; published: boolean; attendanceFinalizedAt: Date | null; recordingPublishedAt: Date | null }) {
  if (w.recordingPublishedAt) return { label: "Aufzeichnung online", cls: "me-badge me-badge-done" };
  if (w.attendanceFinalizedAt) return { label: "Abgeschlossen", cls: "me-badge" };
  if (w.startsAt.getTime() < Date.now()) return { label: "Vorbei, Teilnahme offen", cls: "me-badge me-badge-live" };
  if (w.published) return { label: "Anmeldung offen", cls: "me-badge me-badge-live" };
  return { label: "Entwurf", cls: "me-badge" };
}

export default async function WebinarePage() {
  const user = await currentWebinarUser();
  if (!user) return null;
  const webinars = await listWebinars();

  return (
    <div className="me-page">
      <header className="me-head">
        <div>
          <h1>Webinare</h1>
          <p className="me-sub">
            Inhalte für <a href={portalUrl()} target="_blank" rel="noreferrer">webinar.elev8-suite.com</a>: Termine, Teilnahme, Aufzeichnungen und Fragen.
          </p>
        </div>
      </header>

      {user.canEdit && (
        <section className="me-card">
          <h2>Neues Webinar</h2>
          <StatefulForm action={createWebinarAction} submit="Webinar anlegen" pending="Wird angelegt …" className="me-new">
            <label className="me-field">
              <span>Titel</span>
              <input name="titleDe" required maxLength={200} placeholder="z. B. Gästekommunikation mit Elev8 Journey" />
            </label>
            <label className="me-field">
              <span>Datum und Uhrzeit (Schweizer Zeit)</span>
              <input name="startsAt" type="datetime-local" required />
            </label>
            <label className="me-field">
              <span>
                Kurzthema für den GHL-Tag <em>optional</em>
              </span>
              <input name="tagTopic" maxLength={40} placeholder="z. B. journey" />
              <small>Ergibt Tags wie webinar-2026-11-02-journey-angemeldet.</small>
            </label>
          </StatefulForm>
        </section>
      )}

      {webinars.length === 0 ? (
        <p className="me-sub">Noch keine Webinare angelegt.</p>
      ) : (
        <div className="me-table-wrap">
          <table className="me-table">
            <thead>
              <tr>
                <th>Webinar</th>
                <th>Termin</th>
                <th>Status</th>
                <th className="num">Angemeldet</th>
                <th className="num">Live</th>
                <th className="num">Offene Fragen</th>
              </tr>
            </thead>
            <tbody>
              {webinars.map((w) => {
                const p = phase(w);
                return (
                  <tr key={w.id}>
                    <td>
                      <a href={`/webinare/${w.id}`} className="me-strong">
                        {w.titleDe}
                      </a>
                      <div className="me-muted">{w.ghlTagBase}</div>
                    </td>
                    <td className="me-nowrap">{formatInZone(w.startsAt, "Europe/Zurich")}</td>
                    <td>
                      <span className={p.cls}>{p.label}</span>
                    </td>
                    <td className="num">{w.registered}</td>
                    <td className="num">{w.attended}</td>
                    <td className="num">{w.openQuestions}</td>
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
