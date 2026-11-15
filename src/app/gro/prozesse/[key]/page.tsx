import { notFound } from "next/navigation";
import { atLeast, groContext } from "@/lib/gro/access";
import { GROUPS } from "@/lib/gro/types";
import { num, resolve } from "@/lib/gro/render";
import { getProcess, listConstants, processVersions } from "@/lib/gro/store";
import { saveProcessAction } from "../../actions";
import { StatefulForm } from "@/components/gro/GroForms";
import { ZusatzRechner } from "@/components/gro/Tools";

export const dynamic = "force-dynamic";

export default async function ProzessKarte({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ edit?: string }> }) {
  const ctx = await groContext();
  if (!ctx) return null;
  const { key } = await params;
  const { edit } = await searchParams;
  const p = await getProcess(ctx.tenant.id, decodeURIComponent(key));
  if (!p) notFound();
  const constants = await listConstants(ctx.tenant.id);
  const r = (s: string) => resolve(s, constants);
  const canEdit = atLeast(ctx.role, "editor");
  const versions = canEdit ? await processVersions(p.id) : [];

  if (edit && canEdit) {
    return (
      <div className="gr-page">
        <header className="gr-head">
          <div>
            <a className="gr-back" href={`/gro/prozesse/${p.key}`}>← {p.key}</a>
            <h1>{p.key} bearbeiten</h1>
            <p className="gr-sub">Jede Speicherung legt eine neue Version an. Mit {"{{k:schluessel}}"} setzt du Werte aus den Regeln ein, zum Beispiel {"{{k:zusatz_total}}"}.</p>
          </div>
        </header>
        <StatefulForm action={saveProcessAction} submit="Speichern" pending="Speichert…" className="gr-card gr-form">
          <input type="hidden" name="key" value={p.key} />
          <label className="gr-field"><span>Titel</span><input name="title" defaultValue={p.title} required /></label>
          <div className="gr-row">
            <label className="gr-field"><span>Gruppe</span>
              <select name="grp" defaultValue={p.grp}>{Object.entries(GROUPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <label className="gr-field"><span>Region</span>
              <select name="region" defaultValue={p.region}><option>CH</option><option>Bali</option><option>alle</option></select>
            </label>
            <label className="gr-field"><span>Status</span>
              <select name="status" defaultValue={p.status}><option value="entwurf">Entwurf</option><option value="freigegeben">Freigegeben</option></select>
            </label>
            <label className="gr-field"><span>Verantwortlich</span><input name="owner" defaultValue={p.owner} /></label>
          </div>
          <label className="gr-field"><span>Rolle</span><input name="role" defaultValue={p.role} /></label>
          <label className="gr-field"><span>Auslöser</span><textarea name="trigger" rows={2} defaultValue={p.trigger} /></label>
          <label className="gr-field"><span>Ziel</span><textarea name="goal" rows={2} defaultValue={p.goal} /></label>
          <label className="gr-field"><span>Schritte <em>(eine Zeile pro Schritt)</em></span><textarea name="steps" rows={10} defaultValue={p.steps.join("\n")} /></label>
          <label className="gr-field"><span>Regeln und Hinweise <em>(eine Zeile pro Regel)</em></span><textarea name="rules" rows={5} defaultValue={p.rules.join("\n")} /></label>
          <label className="gr-field"><span>Eskalation</span><textarea name="escalation" rows={2} defaultValue={p.escalation} /></label>
          <label className="gr-field"><span>Offene Punkte <em>(eine Zeile pro Punkt)</em></span><textarea name="open" rows={4} defaultValue={p.openPoints.join("\n")} /></label>
        </StatefulForm>
      </div>
    );
  }

  return (
    <div className="gr-page">
      <header className="gr-head">
        <div>
          <a className="gr-back" href="/gro/prozesse">← Alle Prozesse</a>
          <h1><span className="gr-key">{p.key}</span> {p.title}</h1>
          <p className="gr-sub">
            <span className="gr-pill">{p.region}</span>
            <span className={p.status === "freigegeben" ? "gr-pill gr-pill-ok" : "gr-pill gr-pill-warn"}>{p.status === "freigegeben" ? "Freigegeben" : "Entwurf"}</span>
            {p.origin === "entwurf" && <span className="gr-pill">Neu im Entwurf</span>}
            <span>Version {p.version}</span>
          </p>
        </div>
        {canEdit && <a className="gr-btn gr-btn-secondary" href={`/gro/prozesse/${p.key}?edit=1`}>Bearbeiten</a>}
      </header>

      <section className="gr-card">
        <dl className="gr-dl">
          <dt>Auslöser</dt><dd>{r(p.trigger)}</dd>
          <dt>Ziel</dt><dd>{r(p.goal)}</dd>
          <dt>Rolle</dt><dd>{p.role}</dd>
        </dl>
      </section>

      <section className="gr-card">
        <h2>Schritte</h2>
        <ol className="gr-steps">{p.steps.map((s, i) => <li key={i}>{r(s)}</li>)}</ol>
      </section>

      {p.rules.length > 0 && (
        <section className="gr-card gr-card-rules">
          <h2>Regeln und Hinweise</h2>
          <ul className="gr-bullets">{p.rules.map((s, i) => <li key={i}>{r(s)}</li>)}</ul>
        </section>
      )}

      {p.key === "P-4.1" && (
        <section className="gr-card">
          <ZusatzRechner gebuehr={num(constants, "zusatzgebuehr", 25)} citytax={num(constants, "citytax", 2.5)} karte={num(constants, "kartengebuehr", 3)} grund={num(constants, "grundgaeste", ctx.tenant.baseGuests)} />
        </section>
      )}

      {p.escalation && (
        <section className="gr-card"><h2>Eskalation</h2><p>{r(p.escalation)}</p></section>
      )}

      {p.openPoints.length > 0 && (
        <section className="gr-card gr-card-open">
          <h2>Offene Punkte</h2>
          <ul className="gr-bullets">{p.openPoints.map((s, i) => <li key={i}>{r(s)}</li>)}</ul>
          <p className="gr-muted">Entscheide werden unter <a href="/gro/entscheide">Entscheide</a> festgehalten.</p>
        </section>
      )}

      {canEdit && versions.length > 0 && (
        <section className="gr-card">
          <h2>Versionen</h2>
          <ul className="gr-list">
            {versions.map((v) => (
              <li key={v.version}>Version {v.version} · {new Date(v.at).toLocaleString("de-CH")} · {v.by ?? "unbekannt"}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
