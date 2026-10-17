import { notFound } from "next/navigation";
import { ghlConfigured } from "@/lib/offerten/ghl";
import { currentMessenUser } from "@/lib/messen/access";
import { getEvent, listLeads, type MesseLead } from "@/lib/messen/store";
import { TIME_ZONES, dateToLocalInput, formatInZone } from "@/lib/messen/time";
import { embedSnippet, publicUrl, qrImageUrl, withParams } from "@/lib/messen/urls";
import { deleteEventAction, deleteLeadAction, drawWinnerAction, retryGhlAction, saveEventAction } from "../actions";
import { ActionButton, ConfirmForm, CopyCode, CopyLink, StatefulForm } from "@/components/messen/MessenForms";

export const dynamic = "force-dynamic";

const UNITS: Record<string, string> = { "1-4": "1–4", "5-19": "5–19", "20-49": "20–49", "50+": "50+", none: "vermietet nicht" };
const GHL: Record<MesseLead["ghlStatus"], string> = { ok: "In GHL", error: "Fehler", pending: "Wartet", skipped: "Nicht verbunden" };

function Field(props: {
  label: string;
  name: string;
  value?: string;
  hint?: string;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label className="me-field">
      <span>{props.label}</span>
      <input
        name={props.name}
        type={props.type ?? "text"}
        defaultValue={props.value}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        required={props.required}
      />
      {props.hint && <small>{props.hint}</small>}
    </label>
  );
}

export default async function MessePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentMessenUser();
  if (!user) return null;
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  const leads = await listLeads(event.id);

  // Mit Website-Seite zeigt der QR-Code dorthin, damit Besuche bei den Pixeln der Website zählen
  const utm = { utm_source: event.slug, utm_medium: "qr" };
  const qrLink = event.websiteUrl ? withParams(event.websiteUrl, utm) : publicUrl(event.slug, utm);
  const kioskLink = publicUrl(event.slug, { kiosk: "1", utm_source: event.slug, utm_medium: "tablet" });
  const previewLink = publicUrl(event.slug, event.active ? {} : { vorschau: "1" });
  const count = (f: (l: MesseLead) => boolean) => leads.filter(f).length;
  const winners = leads.filter((l) => l.winnerAt).sort((a, b) => a.winnerAt!.getTime() - b.winnerAt!.getTime());
  const ghlProblems = count((l) => l.ghlStatus === "error" || l.ghlStatus === "pending");
  const ended = Boolean(event.drawAt && event.drawAt.getTime() <= Date.now());

  return (
    <div className="me-page">
      <header className="me-head">
        <div>
          <a href="/messen" className="me-back">
            ← Alle Messen
          </a>
          <h1>{event.name}</h1>
          <p className="me-sub">
            <span className={event.active ? (ended ? "me-badge me-badge-done" : "me-badge me-badge-live") : "me-badge"}>
              {event.active ? (ended ? "Beendet" : "Online") : "Entwurf"}
            </span>{" "}
            Ziehung {formatInZone(event.drawAt, event.timeZone)}
          </p>
        </div>
        <a className="me-btn me-btn-secondary" href={previewLink} target="_blank" rel="noopener">
          {event.active ? "Seite öffnen" : "Vorschau öffnen"}
        </a>
      </header>

      <div className="me-stats">
        <div><b>{leads.length}</b><span>Leads</span></div>
        <div><b>{count((l) => l.tier === "hot")}</b><span>Hot (20+ Units)</span></div>
        <div><b>{count((l) => l.tier === "warm")}</b><span>Warm (5–19)</span></div>
        <div><b>{count((l) => Boolean(l.airbnbUrl))}</b><span>mit Airbnb-Link</span></div>
        <div><b>{count((l) => !l.completed)}</b><span>nicht fertig ausgefüllt</span></div>
        <div><b>{count((l) => l.consentMarketing)}</b><span>Retargeting erlaubt</span></div>
      </div>

      <div className="me-grid">
        <section className="me-card">
          <h2>Seite und Gewinn</h2>
          <StatefulForm action={saveEventAction} submit="Speichern" pending="Wird gespeichert …" className="me-form">
            <input type="hidden" name="id" value={event.id} />
            <label className="me-switch">
              <input type="checkbox" name="active" defaultChecked={event.active} />
              <span>Seite ist online und nimmt Teilnahmen an</span>
            </label>

            <fieldset>
              <legend>Messe</legend>
              <Field label="Name" name="name" value={event.name} required maxLength={120} />
              <div className="me-row">
                <Field label="Datum (Anzeige)" name="datesLabel" value={event.datesLabel} placeholder="12.–14. November 2026" maxLength={80} />
                <Field label="Stand" name="booth" value={event.booth} placeholder="Halle B, Stand 24" maxLength={80} />
              </div>
              <div className="me-row">
                <Field label="Kurzadresse" name="slug" value={event.slug} hint={`Öffentlich unter /m/${event.slug}`} maxLength={60} required />
                <label className="me-field">
                  <span>Sprache der Seite</span>
                  <select name="lang" defaultValue={event.lang}>
                    <option value="de">Deutsch</option>
                    <option value="en">Englisch</option>
                  </select>
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Gewinn und Ziehung</legend>
              <Field label="Gewinn" name="prizeTitle" value={event.prizeTitle} placeholder="12 Monate Elev8 kostenlos" maxLength={80} />
              <Field label="Details zum Gewinn" name="prizeDetail" value={event.prizeDetail} placeholder="Für bis zu 20 Properties. Inklusive Onboarding." maxLength={200} />
              <div className="me-row">
                <Field label="Ziehung" name="drawAt" type="datetime-local" value={dateToLocalInput(event.drawAt, event.timeZone)} hint="Danach schliesst das Formular." />
                <label className="me-field">
                  <span>Zeitzone der Messe</span>
                  <select name="timeZone" defaultValue={event.timeZone}>
                    {TIME_ZONES.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Links</legend>
              <Field label="Demo buchen" name="demoUrl" type="url" value={event.demoUrl} placeholder="https://…" />
              <Field label="Teilnahmebedingungen" name="termsUrl" type="url" value={event.termsUrl} placeholder="https://…" />
              <Field label="Datenschutz" name="privacyUrl" type="url" value={event.privacyUrl} placeholder="https://…" />
              <Field
                label="Seite auf der Website"
                name="websiteUrl"
                type="url"
                value={event.websiteUrl}
                placeholder="https://elev8-suite.com/messe-bali"
                hint="WordPress-Seite, in die das Gewinnspiel eingebettet ist. Der QR-Code zeigt dann dorthin."
              />
            </fieldset>

            <fieldset>
              <legend>Retargeting und GHL</legend>
              <p className="me-muted">
                Nur nötig, wenn die Seite direkt unter /m/… läuft. Eingebettet in WordPress gelten Cookie-Banner und Pixel der Website,
                diese Felder bleiben dann leer. Pixel laden erst nach Zustimmung, auf dem Stand-Tablet nie.
              </p>
              <div className="me-row">
                <Field label="Meta Pixel-ID" name="metaPixelId" value={event.metaPixelId} placeholder="123456789012345" />
                <Field label="Google-Tag-ID" name="googleTagId" value={event.googleTagId} placeholder="AW-… oder G-…" />
              </div>
              <div className="me-row">
                <Field label="LinkedIn Partner-ID" name="linkedinPartnerId" value={event.linkedinPartnerId} placeholder="1234567" />
                <Field
                  label="Zusätzliche GHL-Tags"
                  name="ghlTags"
                  value={event.ghlTags.join(", ")}
                  placeholder="bali-2026, q4"
                  hint="Kommagetrennt. messe-lead, messe-…, tier-… und retargeting-ok setzt Orbit selbst."
                />
              </div>
            </fieldset>
          </StatefulForm>
        </section>

        <aside className="me-side">
          <section className="me-card">
            <h2>QR-Code für den Stand</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="me-qr" src={qrImageUrl(qrLink, 480)} alt={`QR-Code zu ${qrLink}`} width={240} height={240} />
            <CopyLink url={qrLink} />
            <a className="me-btn me-btn-secondary me-full" href={qrImageUrl(qrLink, 1200)} target="_blank" rel="noopener" download>
              QR-Code als PNG
            </a>
            <h3>Stand-Tablet</h3>
            <p className="me-muted">Grössere Buttons, setzt sich nach jeder Teilnahme selbst zurück.</p>
            <CopyLink url={kioskLink} />
          </section>

          <section className="me-card">
            <h2>Auf der Website einbinden</h2>
            <p className="me-muted">
              In WordPress eine Seite anlegen, einen Block „Individuelles HTML“ einfügen und diesen Code hineinkopieren. Die Seite
              passt ihre Höhe selbst an und meldet jede Teilnahme als „Lead“ an Meta, Google und den Google Tag Manager der Website.
            </p>
            <CopyCode code={embedSnippet(event.slug, event.name)} />
            {!event.websiteUrl && <p className="me-muted">Danach die Adresse der WordPress-Seite oben unter „Seite auf der Website“ eintragen.</p>}
          </section>

          <section className="me-card">
            <h2>Ziehung</h2>
            {winners.length > 0 && (
              <ol className="me-winners">
                {winners.map((w) => (
                  <li key={w.id}>
                    <b>{w.name}</b> · {w.ticket}
                    <div className="me-muted">{w.whatsapp || w.email}</div>
                  </li>
                ))}
              </ol>
            )}
            <ActionButton
              action={drawWinnerAction}
              fields={{ id: event.id }}
              label={winners.length ? "Weiteren Gewinner ziehen" : "Gewinner ziehen"}
              pending="Wird gezogen …"
              variant="primary"
              confirm={`Jetzt zufällig unter ${leads.length - winners.length} Teilnehmenden ziehen?`}
            />
          </section>

          <section className="me-card">
            <h2>Export</h2>
            <a className="me-btn me-btn-secondary me-full" href={`/api/messen/${event.id}/export?typ=alle`}>
              Alle Leads (CSV)
            </a>
            <a className="me-btn me-btn-secondary me-full" href={`/api/messen/${event.id}/export?typ=retargeting`}>
              Retargeting-Liste (CSV)
            </a>
            <p className="me-muted">
              Die Retargeting-Liste enthält nur Leads mit Werbe-Einwilligung, im Format für Custom Audiences bei Meta, Google und LinkedIn.
            </p>
          </section>
        </aside>
      </div>

      <section className="me-card">
        <div className="me-card-head">
          <h2>Leads</h2>
          {ghlConfigured() && ghlProblems > 0 && (
            <ActionButton action={retryGhlAction} fields={{ id: event.id }} label={`${ghlProblems} erneut an GHL senden`} pending="Wird gesendet …" />
          )}
        </div>
        {!ghlConfigured() && <p className="me-msg me-msg-error">GHL ist nicht verbunden (GHL_API_TOKEN, GHL_LOCATION_ID). Leads werden nur in Orbit gespeichert.</p>}
        {leads.length === 0 ? (
          <p className="me-muted">Noch keine Teilnahmen.</p>
        ) : (
          <div className="me-table-wrap">
            <table className="me-table">
              <thead>
                <tr>
                  <th>Zeit</th>
                  <th>Name</th>
                  <th>Kontakt</th>
                  <th>Units</th>
                  <th>Einstufung</th>
                  <th>Airbnb</th>
                  <th>GHL</th>
                  <th aria-label="Aktionen" />
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td className="me-nowrap">{formatInZone(l.createdAt, event.timeZone)}</td>
                    <td>
                      <span className="me-strong">{l.name}</span>
                      <div className="me-muted">
                        {l.ticket}
                        {l.winnerAt ? " · Gewinner" : ""}
                        {l.completed ? "" : " · nicht fertig ausgefüllt"}
                      </div>
                    </td>
                    <td>
                      {l.preferredChannel === "whatsapp" ? (
                        <a href={`https://wa.me/${l.whatsapp.replace(/^\+/, "")}`} target="_blank" rel="noopener">
                          {l.whatsapp}
                        </a>
                      ) : (
                        <a href={`mailto:${l.email}`}>{l.email}</a>
                      )}
                      <div className="me-muted">{l.consentMarketing ? "Werbung erlaubt" : "keine Werbung"}</div>
                    </td>
                    <td>{l.units ? (UNITS[l.units] ?? l.units) : "–"}</td>
                    <td>
                      <span className={`me-tier me-tier-${l.tier}`}>{l.tier === "open" ? "offen" : l.tier}</span>
                    </td>
                    <td>
                      {l.airbnbUrl ? (
                        <a href={l.airbnbUrl} target="_blank" rel="noopener">
                          Inserat
                        </a>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td title={l.ghlError ?? undefined}>{GHL[l.ghlStatus]}</td>
                    <td>
                      <ConfirmForm action={deleteLeadAction} fields={{ leadId: l.id }} label="Löschen" variant="link" confirm={`Lead von ${l.name} löschen?`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="me-card me-danger">
        <h2>Messe löschen</h2>
        <p className="me-muted">Löscht die Seite und alle {leads.length} Leads in Orbit. Kontakte in GHL bleiben bestehen.</p>
        <ConfirmForm
          action={deleteEventAction}
          fields={{ id: event.id }}
          label="Messe endgültig löschen"
          confirm={`„${event.name}“ und alle Leads endgültig löschen?`}
        />
      </section>
    </div>
  );
}
