import { notFound } from "next/navigation";
import { currentWebinarUser, portalUrl } from "@/lib/webinare/access";
import { getWebinar, listQuestions, listRegistrations } from "@/lib/webinare/store";
import { countByStatus } from "@/lib/webinare/attendance";
import { firefliesReady, findFireflies, mmss, type FirefliesHit } from "@/lib/webinare/content";
import { BUNNY_STATUS, bunnyConfigured, bunnyVideo } from "@/lib/webinare/bunny";
import { teamsConfigured } from "@/lib/webinare/teams";
import { tagFor } from "@/lib/webinare/ghl";
import { dateToLocalInput, formatInZone } from "@/lib/messen/time";
import { ActionButton, ConfirmForm, StatefulForm } from "@/components/messen/MessenForms";
import {
  deleteWebinarAction,
  dubbingAction,
  finalizeAction,
  generateAction,
  importReportAction,
  loadTeamsAction,
  loadTranscriptAction,
  publishAction,
  questionAction,
  saveContentAction,
  saveDetailsAction,
  saveMediaAction,
  setStatusAction,
  teamsAttendanceAction,
  translateAction,
  uploadTranscriptAction
} from "../actions";

export const dynamic = "force-dynamic";
const ZONE = "Europe/Zurich";
const STATUS_LABEL = { attended: "anwesend", missed: "verpasst", registered: "angemeldet" } as const;

async function videoState(id: string | null) {
  if (!id || !bunnyConfigured()) return null;
  try {
    const v = await bunnyVideo(id);
    return `${BUNNY_STATUS[v.status] ?? v.status}${v.length ? `, ${mmss(v.length)}` : ""}`;
  } catch (err) {
    return err instanceof Error ? err.message : "nicht erreichbar";
  }
}

export default async function WebinarPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentWebinarUser();
  if (!user) return null;
  const { id } = await params;
  const w = await getWebinar(id);
  if (!w) notFound();
  const [regs, questions] = await Promise.all([listRegistrations(id), listQuestions(id)]);
  const counts = countByStatus(regs);
  const past = w.startsAt.getTime() < Date.now();
  let hits: FirefliesHit[] = [];
  let hitsError = "";
  if (user.canEdit && !w.transcript.length && past && firefliesReady()) {
    try {
      hits = await findFireflies(w.startsAt);
    } catch (err) {
      hitsError = err instanceof Error ? err.message : String(err);
    }
  }
  const [stateDe, stateEn] = await Promise.all([videoState(w.bunnyVideoDe), videoState(w.bunnyVideoEn)]);
  const translated = w.transcript.filter((s) => s.en).length;
  const chaptersText = w.chapters.map((c) => `${mmss(c.start)} | ${c.de}`).join("\n");
  const ro = !user.canEdit;

  return (
    <div className="me-page">
      <header className="me-head">
        <div>
          <a href="/webinare" className="me-back">
            ← Alle Webinare
          </a>
          <h1>{w.titleDe}</h1>
          <p className="me-sub">
            {formatInZone(w.startsAt, ZONE)} · {counts.registered} angemeldet · {counts.attended} live
            {w.published && (
              <a href={portalUrl(`/kalender#${w.slug}`)} target="_blank" rel="noreferrer">
                Im Portal ansehen
              </a>
            )}
          </p>
        </div>
      </header>

      <div className="wb-steps">
        {/* 1 · Details */}
        <section className="me-card">
          <div className="wb-step-head">
            <h2>Details und Anmeldung</h2>
            <span className={w.published ? "wb-state wb-state-ok" : "wb-state"}>{w.published ? "Anmeldung im Portal offen" : "Noch nicht im Kalender"}</span>
          </div>
          <StatefulForm action={saveDetailsAction} submit="Speichern" pending="Speichert …" className="me-form">
            <input type="hidden" name="id" value={w.id} />
            <fieldset disabled={ro} style={{ border: 0, margin: 0, padding: 0 }}>
              <p className="wb-hint">Du schreibst Deutsch. Die englische Fassung fürs Portal entsteht beim Speichern automatisch.</p>
              <label className="me-field">
                <span>Titel</span>
                <input name="titleDe" defaultValue={w.titleDe} required maxLength={200} />
                <EnPreview text={w.titleEn} />
              </label>
              <label className="me-field wb-field">
                <span>Beschreibung</span>
                <textarea name="descriptionDe" rows={3} defaultValue={w.descriptionDe} />
                <EnPreview text={w.descriptionEn} />
              </label>
              <div className="me-row">
                <label className="me-field">
                  <span>Datum und Uhrzeit (Schweizer Zeit)</span>
                  <input name="startsAt" type="datetime-local" defaultValue={dateToLocalInput(w.startsAt, ZONE)} required />
                </label>
                <label className="me-field">
                  <span>Dauer in Minuten</span>
                  <input name="durationMin" type="number" min={15} max={480} defaultValue={w.durationMin} />
                </label>
              </div>
              <div className="me-row">
                <label className="me-field">
                  <span>Referent</span>
                  <input name="speaker" defaultValue={w.speaker} maxLength={200} />
                </label>
                <label className="me-field">
                  <span>Adresse im Portal</span>
                  <input name="slug" defaultValue={w.slug} maxLength={80} pattern="[a-z0-9-]+" />
                </label>
              </div>
              <div className="me-row">
                <label className="me-field">
                  <span>Teams-Webinar-ID</span>
                  <input name="teamsWebinarId" defaultValue={w.teamsWebinarId ?? ""} maxLength={200} />
                  <small>Aus Teams: Webinar öffnen, die ID steht in der Adresse. Damit meldet das Portal Personen direkt bei Teams an.</small>
                </label>
                <label className="me-field">
                  <span>Teilnahmelink (Rückfall)</span>
                  <input name="teamsJoinUrl" defaultValue={w.teamsJoinUrl ?? ""} maxLength={1000} />
                  <small>Wird über „Mit Teams verbinden“ gefüllt. Referenten treten über genau diesen Link bei.</small>
                </label>
              </div>
              <label className="me-field">
                <span>GHL-Tag-Basis</span>
                <input name="ghlTagBase" defaultValue={w.ghlTagBase} maxLength={80} pattern="[a-z0-9-]+" />
                <small>
                  Tags: {tagFor(w, "angemeldet")}, {tagFor(w, "anwesend")}, {tagFor(w, "verpasst")}
                </small>
              </label>
              <label className="me-switch">
                <input type="checkbox" name="published" defaultChecked={w.published} /> Im Kalender zeigen und Anmeldung öffnen
              </label>
            </fieldset>
          </StatefulForm>
          {user.canEdit && (
            <div className="wb-actions" style={{ marginTop: "1rem" }}>
              <ActionButton action={loadTeamsAction} fields={{ id: w.id }} label="Mit Teams verbinden" pending="Verbinde …" />
              {!teamsConfigured() && <span className="me-muted">Microsoft-Zugang in Orbit fehlt noch.</span>}
            </div>
          )}
        </section>

        {/* 2 · Teilnahme */}
        <section className="me-card">
          <div className="wb-step-head">
            <h2>Teilnahme</h2>
            <span className={w.attendanceFinalizedAt ? "wb-state wb-state-ok" : "wb-state"}>
              {w.attendanceFinalizedAt ? `Abgeschlossen am ${formatInZone(w.attendanceFinalizedAt, ZONE)}` : past ? "Nach dem Webinar prüfen und abschliessen" : "Läuft nach dem Webinar"}
            </span>
          </div>
          {w.attendanceNote && <p className={w.attendanceNote.startsWith("Ausnahme") ? "wb-note" : "wb-warn"}>{w.attendanceNote}</p>}
          <div className="me-stats" style={{ marginBottom: "1rem" }}>
            <div>
              <b>{counts.registered}</b>
              <span>angemeldet</span>
            </div>
            <div>
              <b>{counts.attended}</b>
              <span>live dabei</span>
            </div>
            <div>
              <b>{counts.missed}</b>
              <span>verpasst</span>
            </div>
            <div>
              <b>{counts.open}</b>
              <span>noch offen</span>
            </div>
          </div>
          {user.canEdit && past && (
            <>
              <div className="wb-actions" style={{ marginBottom: "1rem" }}>
                {w.teamsWebinarId && <ActionButton action={teamsAttendanceAction} fields={{ id: w.id }} label="Teilnahme aus Teams holen" pending="Lädt …" />}
              </div>
              <StatefulForm action={importReportAction} submit="Bericht importieren" pending="Importiert …" className="me-form">
                <input type="hidden" name="id" value={w.id} />
                <label className="me-field">
                  <span>Oder: Teams-Anwesenheitsbericht (CSV)</span>
                  <input name="file" type="file" accept=".csv,text/csv" />
                </label>
                <label className="me-switch">
                  <input type="checkbox" name="allAttended" /> Ausnahme: alle Angemeldeten als anwesend übernehmen
                </label>
              </StatefulForm>
            </>
          )}
          {regs.length > 0 && (
            <StatefulForm action={setStatusAction} submit="Status setzen" pending="Speichert …">
              <input type="hidden" name="id" value={w.id} />
              <div className="me-table-wrap" style={{ margin: "1rem 0 0.75rem" }}>
                <table className="me-table">
                  <thead>
                    <tr>
                      <th aria-label="Auswahl" />
                      <th>Person</th>
                      <th>Firma, PMS, Einheiten</th>
                      <th>Status</th>
                      <th>GHL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regs.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <input className="wb-check" type="checkbox" name="reg" value={r.id} aria-label={`${r.email} auswählen`} disabled={ro} />
                        </td>
                        <td>
                          <span className="me-strong">{[r.firstName, r.lastName].filter(Boolean).join(" ") || r.email}</span>
                          <div className="me-muted">{r.email}</div>
                        </td>
                        <td>
                          {[r.organization, r.pms, r.units && `${r.units} Einheiten`].filter(Boolean).join(" · ") || "–"}
                          {r.newsletter && <div className="me-muted">Newsletter: ja</div>}
                        </td>
                        <td>
                          <span className={`wb-status wb-status-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                          {r.attendedSeconds ? <div className="me-muted">{mmss(r.attendedSeconds)}</div> : null}
                        </td>
                        <td className="me-muted">{r.ghlError ? <span style={{ color: "var(--danger)" }}>{r.ghlError}</span> : r.ghlStatus ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!ro && (
                <label className="me-field" style={{ maxWidth: "16rem" }}>
                  <span>Ausgewählte setzen auf</span>
                  <select name="status" defaultValue="attended">
                    <option value="attended">anwesend</option>
                    <option value="missed">verpasst</option>
                    <option value="registered">angemeldet</option>
                  </select>
                </label>
              )}
            </StatefulForm>
          )}
          {user.canEdit && past && regs.length > 0 && (
            <StatefulForm action={finalizeAction} submit="Teilnahme abschliessen und Tags setzen" pending="Setzt Tags …" className="me-form">
              <input type="hidden" name="id" value={w.id} />
              <p className="me-muted" style={{ margin: "1rem 0 0.5rem" }}>
                Ersetzt in GHL {tagFor(w, "angemeldet")} durch {tagFor(w, "anwesend")} oder {tagFor(w, "verpasst")}. Noch offene gelten als verpasst. Anwesende erhalten den
                Archiv-Schlüssel.
              </p>
              {w.attendanceNote && !w.attendanceNote.startsWith("Ausnahme") && (
                <label className="me-switch">
                  <input type="checkbox" name="confirm" /> Ich habe die Warnung geprüft. Trotzdem abschliessen.
                </label>
              )}
            </StatefulForm>
          )}
        </section>

        {/* 3 · Aufzeichnung */}
        <section className="me-card">
          <div className="wb-step-head">
            <h2>Aufzeichnung</h2>
            <span className={w.recordingPublishedAt ? "wb-state wb-state-ok" : "wb-state"}>
              {w.recordingPublishedAt ? `Online seit ${formatInZone(w.recordingPublishedAt, ZONE)}` : "Noch nicht veröffentlicht"}
            </span>
          </div>
          <StatefulForm action={saveMediaAction} submit="Speichern" pending="Speichert …" className="me-form">
            <input type="hidden" name="id" value={w.id} />
            <fieldset disabled={ro} style={{ border: 0, margin: 0, padding: 0 }}>
              <div className="me-row">
                <label className="me-field">
                  <span>Bunny-Video-ID Deutsch</span>
                  <input name="bunnyVideoDe" defaultValue={w.bunnyVideoDe ?? ""} maxLength={80} />
                  <small>{stateDe ?? "Video in Bunny Stream hochladen und die Video-ID hier eintragen."}</small>
                </label>
                <label className="me-field">
                  <span>Bunny-Video-ID Englisch</span>
                  <input name="bunnyVideoEn" defaultValue={w.bunnyVideoEn ?? ""} maxLength={80} />
                  <small>{stateEn ?? "Wird über „Englische Tonspur“ gefüllt."}</small>
                </label>
              </div>
              <div className="me-row">
                <label className="me-field">
                  <span>Versatz Transkript (Sekunden)</span>
                  <input name="offset" defaultValue={String(w.transcriptOffsetSec)} inputMode="decimal" />
                  <small>Positiv, wenn das Transkript zu früh ist (Fireflies trat später bei als die Teams-Aufzeichnung).</small>
                </label>
                <div className="me-row">
                  <label className="me-field">
                    <span>Vorschau von</span>
                    <input name="teaserStart" defaultValue={w.teaserStartSec != null ? mmss(w.teaserStartSec) : ""} placeholder="12:30" />
                  </label>
                  <label className="me-field">
                    <span>bis</span>
                    <input name="teaserEnd" defaultValue={w.teaserEndSec != null ? mmss(w.teaserEndSec) : ""} placeholder="13:45" />
                  </label>
                </div>
              </div>
            </fieldset>
          </StatefulForm>

          <h3>Transkript</h3>
          {w.transcript.length ? (
            <>
              <p className="me-muted">
                {w.transcript.length} Abschnitte{w.firefliesId ? " aus Fireflies" : ""}, {translated} übersetzt.
              </p>
              <div className="wb-transcript">
                {w.transcript.slice(0, 40).map((s, i) => (
                  <p key={i}>
                    <b>{mmss(s.start)}</b>
                    {s.speaker && <strong>{s.speaker}: </strong>}
                    {s.de}
                  </p>
                ))}
                {w.transcript.length > 40 && <p className="me-muted">… {w.transcript.length - 40} weitere</p>}
              </div>
            </>
          ) : (
            <p className="me-muted">Noch kein Transkript. Übernimm es aus Fireflies oder lade das Teams-Transkript hoch.</p>
          )}
          {user.canEdit && (
            <StatefulForm action={loadTranscriptAction} submit={w.transcript.length ? "Neu laden" : "Transkript übernehmen"} pending="Lädt …" className="me-form">
              <input type="hidden" name="id" value={w.id} />
              {hits.length > 0 ? (
                <label className="me-field">
                  <span>Fireflies-Aufnahme</span>
                  <select name="firefliesId" defaultValue={w.firefliesId ?? ""}>
                    <option value="">Bitte wählen</option>
                    {hits.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.title} {h.date ? `· ${new Date(h.date).toLocaleDateString("de-CH")}` : ""} {h.durationMin ? `· ${h.durationMin} Min.` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="me-field">
                  <span>Fireflies-ID</span>
                  <input name="firefliesId" defaultValue={w.firefliesId ?? ""} maxLength={100} placeholder="aus der Adresse in Fireflies" />
                  {hitsError && <small>{hitsError}</small>}
                </label>
              )}
            </StatefulForm>
          )}

          {user.canEdit && (
            <StatefulForm action={uploadTranscriptAction} submit="Teams-Transkript übernehmen" pending="Liest …" className="me-form">
              <input type="hidden" name="id" value={w.id} />
              <label className="me-field">
                <span>Oder: Transkript aus Teams (.docx oder .vtt)</span>
                <input name="file" type="file" accept=".docx,.vtt,text/vtt" />
                <small>In Teams: Besprechung, Aufzeichnungen und Transkripte, Transkript herunterladen.</small>
              </label>
            </StatefulForm>
          )}

          {user.canEdit && w.transcript.length > 0 && (
            <div className="wb-actions" style={{ marginTop: "1rem" }}>
              <ActionButton action={generateAction} fields={{ id: w.id }} label="Kapitel und Zusammenfassung erzeugen" pending="Claude arbeitet …" />
              <ActionButton action={translateAction} fields={{ id: w.id }} label={translated ? "Restliches Transkript übersetzen" : "Transkript übersetzen"} pending="Übersetzt …" />
              <ActionButton
                action={dubbingAction}
                fields={{ id: w.id }}
                label={w.dubbingId ? "Englische Tonspur prüfen" : "Englische Tonspur erstellen"}
                pending="Fragt ElevenLabs …"
              />
              {w.dubbingStatus && <span className="me-muted">Tonspur: {w.dubbingStatus}</span>}
            </div>
          )}
        </section>

        {/* 4 · Inhalte */}
        <section className="me-card">
          <div className="wb-step-head">
            <h2>Inhalte für die Aufzeichnungsseite</h2>
          </div>
          <StatefulForm action={saveContentAction} submit="Inhalte speichern" pending="Speichert …" className="me-form">
            <input type="hidden" name="id" value={w.id} />
            <fieldset disabled={ro} style={{ border: 0, margin: 0, padding: 0 }}>
              <p className="wb-hint">Du bearbeitest Deutsch. Was sich ändert, wird beim Speichern automatisch ins Englische übersetzt.</p>
              <label className="me-field wb-field">
                <span>Kapitel (Zeit | Titel, eines pro Zeile)</span>
                <textarea name="chapters" rows={6} defaultValue={chaptersText} placeholder="0:00 | Begrüssung" />
              </label>
              <label className="me-field wb-field">
                <span>Zusammenfassung</span>
                <textarea name="summaryDe" rows={6} defaultValue={w.summaryDe} />
              </label>
              <div className="me-row">
                <label className="me-field wb-field">
                  <span>3 Kernaussagen (eine pro Zeile)</span>
                  <textarea name="takeawaysDe" rows={4} defaultValue={w.takeaways.de.join("\n")} />
                </label>
                <label className="me-field wb-field">
                  <span>Checkliste «So setzt du das um» (ein Punkt pro Zeile)</span>
                  <textarea name="checklistDe" rows={4} defaultValue={w.checklist.de.join("\n")} />
                </label>
              </div>
              {(w.summaryEn || w.takeaways.en.length > 0) && (
                <details className="wb-en">
                  <summary>Englische Fassung ansehen</summary>
                  {w.chapters.some((c) => c.en) && (
                    <ul>
                      {w.chapters.map((c, i) => (
                        <li key={i}>
                          {mmss(c.start)} {c.en}
                        </li>
                      ))}
                    </ul>
                  )}
                  {w.summaryEn && <p>{w.summaryEn}</p>}
                  {w.takeaways.en.length > 0 && (
                    <ul>
                      {w.takeaways.en.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  )}
                  {w.checklist.en.length > 0 && (
                    <ul>
                      {w.checklist.en.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  )}
                </details>
              )}
            </fieldset>
          </StatefulForm>
          {user.canEdit && (
            <div className="wb-actions" style={{ marginTop: "1rem" }}>
              {w.recordingPublishedAt ? (
                <ActionButton action={publishAction} fields={{ id: w.id, on: "0" }} label="Aufzeichnung verstecken" pending="…" />
              ) : (
                <ActionButton action={publishAction} fields={{ id: w.id, on: "1" }} label="Aufzeichnung veröffentlichen" pending="…" variant="primary" />
              )}
              {w.recordingPublishedAt && (
                <a className="me-btn me-btn-secondary" href={portalUrl(`/aufzeichnung/${w.slug}`)} target="_blank" rel="noreferrer">
                  Im Portal öffnen
                </a>
              )}
            </div>
          )}
        </section>

        {/* 5 · Fragen */}
        <section className="me-card">
          <div className="wb-step-head">
            <h2>Vorab-Fragen</h2>
            <span className="wb-state">{questions.filter((q) => q.status === "open").length} offen</span>
          </div>
          {questions.length === 0 ? (
            <p className="me-muted">Noch keine Fragen. Angemeldete stellen sie im Kalender des Portals.</p>
          ) : (
            questions.map((q) => (
              <div className="wb-q" key={q.id}>
                <div>
                  <span className="me-strong">{q.name || q.email}</span> <span className="me-muted">{q.email}</span>
                </div>
                <p className="wb-q-body">{q.body}</p>
                <StatefulForm action={questionAction} submit="Speichern" pending="…">
                  <input type="hidden" name="id" value={w.id} />
                  <input type="hidden" name="qid" value={q.id} />
                  <select name="status" defaultValue={q.status} aria-label="Status">
                    <option value="open">offen</option>
                    <option value="answered">live beantwortet</option>
                    <option value="faq">in die FAQ</option>
                    <option value="rejected">abgelehnt</option>
                  </select>
                  <input name="at" defaultValue={q.answerAtSec != null ? mmss(q.answerAtSec) : ""} placeholder="23:40" aria-label="Antwort bei Minute" />
                </StatefulForm>
              </div>
            ))
          )}
        </section>

        {user.canEdit && (
          <section className="me-card me-danger">
            <h2>Webinar löschen</h2>
            <p className="me-muted" style={{ marginBottom: "0.75rem" }}>
              Löscht Anmeldungen, Fragen und Inhalte. Videos in Bunny und Tags in GHL bleiben.
            </p>
            <ConfirmForm action={deleteWebinarAction} fields={{ id: w.id }} label="Endgültig löschen" confirm={`„${w.titleDe}“ mit allen Anmeldungen löschen?`} />
          </section>
        )}
      </div>
    </div>
  );
}

function EnPreview({ text }: { text: string }) {
  if (!text) return null;
  return (
    <small className="wb-en-line">
      <span>EN</span> {text}
    </small>
  );
}
