import { currentWebinarUser, portalUrl } from "@/lib/webinare/access";
import { listPolls, type Poll } from "@/lib/webinare/store";
import { formatInZone } from "@/lib/messen/time";
import { ActionButton, CopyCode, StatefulForm } from "@/components/messen/MessenForms";
import { createPollAction, optionAction, pollStatusAction, webinarFromOptionAction } from "../actions";

export const dynamic = "force-dynamic";
const ZONE = "Europe/Zurich";

function optionLabel(p: Poll, o: Poll["options"][number]) {
  return p.kind === "date" && o.startsAt ? formatInZone(o.startsAt, ZONE) : o.labelDe;
}

export default async function UmfragenPage() {
  const user = await currentWebinarUser();
  if (!user) return null;
  const polls = await listPolls();

  return (
    <div className="me-page">
      <header className="me-head">
        <div>
          <h1>Abstimmungen</h1>
          <p className="me-sub">Themen und Termine abstimmen lassen. Der Link funktioniert ohne Login, z. B. im Newsletter.</p>
        </div>
      </header>

      {user.canEdit && (
        <section className="me-card">
          <h2>Neue Abstimmung</h2>
          <StatefulForm action={createPollAction} submit="Abstimmung starten" pending="Startet …" className="me-form">
            <div className="me-row">
              <label className="me-field">
                <span>Art</span>
                <select name="kind" defaultValue="date">
                  <option value="date">Terminwahl (mehrere Termine ankreuzen)</option>
                  <option value="topic">Themenwahl (Upvotes, eigene Vorschläge)</option>
                </select>
              </label>
              <span />
            </div>
            <div className="me-row">
              <label className="me-field">
                <span>Titel Deutsch</span>
                <input name="titleDe" required maxLength={200} placeholder="Wann passt dir das nächste Webinar?" />
              </label>
              <label className="me-field">
                <span>Titel Englisch</span>
                <input name="titleEn" maxLength={200} placeholder="When suits you for the next webinar?" />
              </label>
            </div>
            <div className="me-row">
              <label className="me-field wb-field">
                <span>
                  Beschreibung Deutsch <em>optional</em>
                </span>
                <textarea name="descriptionDe" rows={2} />
              </label>
              <label className="me-field wb-field">
                <span>
                  Beschreibung Englisch <em>optional</em>
                </span>
                <textarea name="descriptionEn" rows={2} />
              </label>
            </div>
            <label className="me-field wb-field">
              <span>Optionen, eine pro Zeile</span>
              <textarea name="options" rows={5} placeholder={"Terminwahl: 2026-12-01 16:00\nThemenwahl: Preise mit PriceLabs | Pricing with PriceLabs"} />
              <small>Termine in Schweizer Zeit als JJJJ-MM-TT HH:MM. Themen als „Deutsch | Englisch“.</small>
            </label>
            <label className="me-switch">
              <input type="checkbox" name="allowSuggestions" defaultChecked /> Eigene Themen vorschlagen erlauben (nur Themenwahl, mit Freigabe)
            </label>
            <label className="me-switch" style={{ marginTop: "0.5rem" }}>
              <input type="checkbox" name="showResults" defaultChecked /> Ergebnisse nach der eigenen Stimme zeigen
            </label>
          </StatefulForm>
        </section>
      )}

      {polls.length === 0 && <p className="me-sub">Noch keine Abstimmungen.</p>}

      {polls.map((p) => {
        const active = p.options.filter((o) => o.status === "active").sort((a, b) => b.votes - a.votes);
        const pending = p.options.filter((o) => o.status === "pending");
        const max = Math.max(1, ...active.map((o) => o.votes));
        const link = portalUrl(`/abstimmung/${p.slug}`);
        return (
          <section className="me-card" key={p.id}>
            <div className="wb-step-head">
              <h2>{p.titleDe}</h2>
              <span className={p.status === "open" ? "me-badge me-badge-live" : "me-badge"}>{p.status === "open" ? "Läuft" : "Beendet"}</span>
            </div>
            <p className="me-muted" style={{ marginBottom: "0.75rem" }}>
              {p.kind === "date" ? "Terminwahl" : "Themenwahl"}, {p.voters} Teilnehmende, {p.contacts} möchten informiert werden
            </p>
            <div>
              {active.map((o) => (
                <div className="wb-poll-option" key={o.id}>
                  <div className="wb-poll-row">
                    <span>{optionLabel(p, o)}</span>
                    <span className="me-nowrap">
                      {o.votes} Stimmen
                      {user.canEdit && (
                        <>
                          {" "}
                          <ActionButton
                            action={webinarFromOptionAction}
                            fields={{ title: p.kind === "topic" ? o.labelDe : p.titleDe, startsAt: o.startsAt ? o.startsAt.toISOString() : "" }}
                            label="Als Webinar anlegen"
                            pending="…"
                          />
                        </>
                      )}
                    </span>
                  </div>
                  <div className="wb-bar">
                    <span style={{ width: `${(o.votes / max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {pending.length > 0 && (
              <>
                <h3>Vorschläge zur Freigabe</h3>
                {pending.map((o) => (
                  <div className="wb-q" key={o.id}>
                    <p className="wb-q-body">{o.labelDe}</p>
                    {o.suggestedBy && <p className="me-muted">von {o.suggestedBy}</p>}
                    <StatefulForm action={optionAction} submit="Freigeben" pending="…">
                      <input type="hidden" name="optionId" value={o.id} />
                      <input type="hidden" name="status" value="active" />
                      <input name="labelEn" placeholder="Englischer Text" aria-label="Englischer Text" style={{ width: "16rem" }} />
                    </StatefulForm>
                    <ActionButton action={optionAction} fields={{ optionId: o.id, status: "rejected" }} label="Ablehnen" pending="…" variant="danger" />
                  </div>
                ))}
              </>
            )}
            <h3>Link für Newsletter</h3>
            <CopyCode code={link} />
            {user.canEdit && (
              <div className="wb-actions" style={{ marginTop: "0.75rem" }}>
                <ActionButton
                  action={pollStatusAction}
                  fields={{ pollId: p.id, status: p.status === "open" ? "closed" : "open" }}
                  label={p.status === "open" ? "Abstimmung beenden" : "Wieder öffnen"}
                  pending="…"
                />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
