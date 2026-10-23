import { listDrafts, listMeetings, type DraftFilter, type MeetingStatus } from "@/lib/onboarding/store";
import { NewDraft } from "@/components/onboarding/NewDraft";

export const dynamic = "force-dynamic";

const when = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("de-CH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "–";

const TABS: { id: DraftFilter; label: string }[] = [
  { id: "open", label: "Offen" },
  { id: "sent", label: "Gesendet" },
  { id: "discarded", label: "Verworfen" }
];

const MEETING_LABEL: Record<MeetingStatus, string> = {
  processing: "wird geprüft",
  no_onboarding: "kein Startwunsch",
  uncertain: "unsicher, kein Entwurf",
  draft_created: "Entwurf angelegt",
  internal: "intern",
  error: "Fehler"
};

/** Entwürfe aus Calls oder von Hand. Gesendet wird nur auf Klick auf der Prüfseite. */
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter: DraftFilter = status === "sent" || status === "discarded" ? status : "open";
  const [drafts, meetings] = await Promise.all([listDrafts(filter), listMeetings(15)]);

  return (
    <div className="ob-page">
      <div className="ob-head">
        <div>
          <h1>Onboarding</h1>
          <p className="ob-sub">Nach einem Call mit Startwunsch legt Orbit einen Entwurf an. Es geht nichts raus, bevor du auf „Senden“ drückst.</p>
        </div>
      </div>

      <nav className="ob-tabs" aria-label="Status">
        {TABS.map((t) => (
          <a key={t.id} href={t.id === "open" ? "/onboarding" : `/onboarding?status=${t.id}`} aria-current={t.id === filter ? "page" : undefined}>
            {t.label}
          </a>
        ))}
      </nav>

      <div className="ob-table-wrap">
        {drafts.length === 0 ? (
          <p className="ob-empty-row">{filter === "open" ? "Keine offenen Entwürfe." : "Nichts in dieser Liste."}</p>
        ) : (
          <table className="ob-table">
            <thead>
              <tr>
                <th>Empfänger</th>
                <th>Quelle</th>
                <th>Zuständig</th>
                <th>{filter === "sent" ? "Gesendet" : "Angelegt"}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => (
                <tr key={d.id}>
                  <td>
                    <span className="ob-strong">{d.recipient.company || d.recipient.name || d.recipient.email || "Ohne Namen"}</span>
                    <div className="ob-muted">{[d.recipient.company ? d.recipient.name : null, d.recipient.email].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td>{d.source === "fireflies" ? d.meetingTitle || "Call" : "von Hand"}</td>
                  <td>{d.partnerName || d.partnerEmail || "–"}</td>
                  <td className="ob-nowrap">
                    {when(filter === "sent" ? d.sentAt : d.createdAt)}
                    {d.status === "sending" && <div className="ob-muted">wird gesendet …</div>}
                    {d.error && d.status === "draft" && <div className="ob-err">letzter Versuch fehlgeschlagen</div>}
                  </td>
                  <td className="ob-nowrap">
                    <a className="ob-btn ob-btn-secondary ob-btn-sm" href={`/onboarding/${d.id}`}>
                      {filter === "open" ? "Prüfen" : "Öffnen"}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="ob-grid">
        <section className="ob-card">
          <h2>Von Hand anlegen</h2>
          <p className="ob-muted">Gibt es zur E-Mail einen GHL-Kontakt, füllt Orbit die Angaben daraus vor.</p>
          <NewDraft />
        </section>

        <section className="ob-card">
          <h2>Zuletzt geprüfte Calls</h2>
          {meetings.length === 0 ? (
            <p className="ob-muted">Noch kein Call geprüft.</p>
          ) : (
            <ul className="ob-list">
              {meetings.map((m) => (
                <li key={m.meetingId}>
                  <span className="ob-strong">{m.title || "Call"}</span>
                  <span className="ob-muted">
                    {when(m.meetingDate ?? m.receivedAt)} · <span className={m.status === "error" ? "ob-err" : undefined}>{MEETING_LABEL[m.status]}</span>
                    {m.draftId && (
                      <>
                        {" · "}
                        <a href={`/onboarding/${m.draftId}`}>Entwurf</a>
                      </>
                    )}
                  </span>
                  {m.reason && m.status !== "draft_created" && <span className="ob-muted">{m.reason}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
