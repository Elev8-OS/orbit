import { groContext } from "@/lib/gro/access";
import { GROUPS } from "@/lib/gro/types";
import { resolve } from "@/lib/gro/render";
import { listConstants, listEscalations, listProcesses } from "@/lib/gro/store";

export const dynamic = "force-dynamic";

export default async function Prozesse() {
  const ctx = await groContext();
  if (!ctx) return null;
  const [procs, constants, esc] = await Promise.all([listProcesses(ctx.tenant.id), listConstants(ctx.tenant.id), listEscalations(ctx.tenant.id)]);
  const groups = Object.keys(GROUPS).filter((g) => procs.some((p) => p.grp === g));
  const other = procs.filter((p) => !GROUPS[p.grp]);
  const block = (title: string, list: typeof procs) => (
    <section className="gr-card" key={title}>
      <h2>{title}</h2>
      <ul className="gr-list">
        {list.map((p) => (
          <li key={p.key}>
            <a href={`/gro/prozesse/${p.key}`} className="gr-strong">
              <span className="gr-key">{p.key}</span> {p.title}
            </a>
            <span className="gr-badges">
              <span className="gr-pill">{p.region}</span>
              <span className={p.status === "freigegeben" ? "gr-pill gr-pill-ok" : "gr-pill gr-pill-warn"}>{p.status === "freigegeben" ? "Freigegeben" : "Entwurf"}</span>
              {p.openPoints.length > 0 && <span className="gr-pill">{p.openPoints.length} offen</span>}
            </span>
            <p className="gr-muted">{resolve(p.trigger, constants)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
  return (
    <div className="gr-page">
      <header className="gr-head">
        <div>
          <h1>Prozesse</h1>
          <p className="gr-sub">{procs.length} Karten · {ctx.tenant.name}</p>
        </div>
      </header>
      {!procs.length && (
        <p className="gr-banner">Noch keine Prozesse. Unter Verwaltung die Vorlage übernehmen.</p>
      )}
      {groups.map((g) => block(GROUPS[g], procs.filter((p) => p.grp === g)))}
      {other.length > 0 && block("Weitere", other)}
      {esc.length > 0 && (
        <section className="gr-card">
          <h2>Eskalation, wer ist zuständig?</h2>
          <table className="gr-table">
            <tbody>
              {esc.map((e) => (
                <tr key={e.id}><td>{e.topic}</td><td>{e.target}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
