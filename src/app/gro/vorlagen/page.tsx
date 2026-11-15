import { atLeast, groContext } from "@/lib/gro/access";
import { listTemplates } from "@/lib/gro/store";
import { saveTemplateAction } from "../actions";
import { StatefulForm } from "@/components/gro/GroForms";
import { TemplateFill } from "@/components/gro/Tools";

export const dynamic = "force-dynamic";

export default async function Vorlagen() {
  const ctx = await groContext();
  if (!ctx) return null;
  const list = await listTemplates(ctx.tenant.id);
  const canEdit = atLeast(ctx.role, "editor");
  return (
    <div className="gr-page">
      <header className="gr-head"><div><h1>Vorlagen</h1><p className="gr-sub">Nachrichten an Gäste. Felder ausfüllen, kopieren, im Posteingang einfügen.</p></div></header>
      {!list.length && <p className="gr-banner">Noch keine Vorlagen. Unter Verwaltung die Vorlage übernehmen.</p>}
      {list.map((m) => (
        <section className="gr-card" key={m.id}>
          <h2><span className="gr-key">{m.key}</span> {m.title}</h2>
          <p className="gr-muted">{m.when} · Sprache {m.lang}</p>
          <TemplateFill body={m.body} />
          {canEdit && (
            <details className="gr-edit">
              <summary>Text bearbeiten</summary>
              <StatefulForm action={saveTemplateAction} submit="Speichern" pending="Speichert…" className="gr-form">
                <input type="hidden" name="key" value={m.key} />
                <label className="gr-field"><span>Text mit {"{{vorname}}"}, {"{{link}}"}, {"{{name}}"}</span><textarea name="body" rows={9} defaultValue={m.body} /></label>
              </StatefulForm>
            </details>
          )}
        </section>
      ))}
    </div>
  );
}
