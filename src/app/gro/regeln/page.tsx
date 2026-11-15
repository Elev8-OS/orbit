import { atLeast, groContext } from "@/lib/gro/access";
import { listConstants } from "@/lib/gro/store";
import { saveConstantAction } from "../actions";
import { StatefulForm } from "@/components/gro/GroForms";

export const dynamic = "force-dynamic";

export default async function Regeln() {
  const ctx = await groContext();
  if (!ctx) return null;
  const list = await listConstants(ctx.tenant.id);
  const canEdit = atLeast(ctx.role, "editor");
  return (
    <div className="gr-page">
      <header className="gr-head"><div><h1>Regeln</h1><p className="gr-sub">Zentrale Werte. Eine Änderung gilt sofort in allen Prozessen und im Rechner.</p></div></header>
      {!list.length && <p className="gr-banner">Noch keine Regeln. Unter Verwaltung die Vorlage übernehmen.</p>}
      {list.map((c) => (
        <section className="gr-card" key={c.key}>
          {canEdit ? (
            <StatefulForm action={saveConstantAction} submit="Speichern" pending="Speichert…" className="gr-form">
              <input type="hidden" name="key" value={c.key} />
              <div className="gr-row">
                <label className="gr-field"><span>Bezeichnung <em>({c.key})</em></span><input name="label" defaultValue={c.label} /></label>
                <label className="gr-field"><span>Anzeige</span><input name="value" defaultValue={c.value} /></label>
                <label className="gr-field"><span>Zahl für Rechner</span><input name="num" defaultValue={c.num ?? ""} inputMode="decimal" /></label>
                <label className="gr-field"><span>Einheit</span><input name="unit" defaultValue={c.unit} /></label>
              </div>
              <label className="gr-field"><span>Notiz</span><input name="note" defaultValue={c.note} /></label>
            </StatefulForm>
          ) : (
            <dl className="gr-dl"><dt>{c.label}</dt><dd>{c.value} {c.unit}<span className="gr-muted"> {c.note}</span></dd></dl>
          )}
        </section>
      ))}
    </div>
  );
}
