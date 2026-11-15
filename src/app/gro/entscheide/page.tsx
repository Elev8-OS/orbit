import { atLeast, groContext } from "@/lib/gro/access";
import { listOpenItems } from "@/lib/gro/store";
import { decideAction } from "../actions";
import { StatefulForm } from "@/components/gro/GroForms";

export const dynamic = "force-dynamic";

export default async function Entscheide() {
  const ctx = await groContext();
  if (!ctx) return null;
  const items = await listOpenItems(ctx.tenant.id);
  const canEdit = atLeast(ctx.role, "editor");
  const open = items.filter((i) => i.status === "offen").length;
  return (
    <div className="gr-page">
      <header className="gr-head"><div><h1>Entscheide</h1><p className="gr-sub">{open} offen, {items.length - open} entschieden</p></div></header>
      <p className="gr-muted">Diese Punkte sind aus dem Prüfbericht offen. Bis zum Entscheid gelten die Prozesse mit Warnhinweis. Ein festgehaltener Entscheid wird mit Name und Datum gespeichert, die Prozesskarte passt du danach an.</p>
      {items.map((i) => (
        <section className="gr-card" key={i.id}>
          <h2><span className="gr-key">{i.key}</span> {i.title} <span className={i.status === "offen" ? "gr-pill gr-pill-warn" : "gr-pill gr-pill-ok"}>{i.status === "offen" ? "Offen" : "Entschieden"}</span></h2>
          <p>{i.question}</p>
          {i.proposal && <p className="gr-muted"><b>Vorschlag:</b> {i.proposal}</p>}
          {i.status === "entschieden" && <p className="gr-muted">Entscheid: {i.decision} ({i.decidedBy}, {i.decidedAt ? new Date(i.decidedAt).toLocaleDateString("de-CH") : ""})</p>}
          {canEdit && (
            <StatefulForm action={decideAction} submit="Festhalten" pending="Speichert…" className="gr-form">
              <input type="hidden" name="id" value={i.id} />
              <input type="hidden" name="key" value={i.key} />
              <label className="gr-field"><span>Entscheid</span><textarea name="decision" rows={2} defaultValue={i.decision} /></label>
              <label className="gr-field"><span>Status</span>
                <select name="status" defaultValue={i.status}><option value="offen">Offen</option><option value="entschieden">Entschieden</option></select>
              </label>
            </StatefulForm>
          )}
        </section>
      ))}
    </div>
  );
}
