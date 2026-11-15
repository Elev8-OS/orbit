import { redirect } from "next/navigation";
import { atLeast, groContext } from "@/lib/gro/access";
import { listAllTenants, listMembers } from "@/lib/gro/store";
import { adoptTemplateAction, addMemberAction, createTenantAction, loadLibraryAction, removeMemberAction, saveConnectionAction, testConnectionAction } from "../actions";
import { ActionButton, StatefulForm } from "@/components/gro/GroForms";

export const dynamic = "force-dynamic";

export default async function Verwaltung() {
  const ctx = await groContext();
  if (!ctx || !atLeast(ctx.role, "admin")) redirect("/gro");
  const t = ctx.tenant;
  const [members, all] = await Promise.all([listMembers(t.id), ctx.platformAdmin ? listAllTenants() : Promise.resolve([])]);
  return (
    <div className="gr-page">
      <header className="gr-head"><div><h1>Verwaltung</h1><p className="gr-sub">Mandant {t.name}</p></div></header>

      <section className="gr-card">
        <h2>Verbindung zu Elev8</h2>
        <p className="gr-muted">Jeder Mandant hat seinen eigenen Zugang. Der Schlüssel wird verschlüsselt gespeichert und nie angezeigt. {t.hasToken ? "Ein Schlüssel ist hinterlegt." : "Es ist kein eigener Schlüssel hinterlegt."}</p>
        <StatefulForm action={saveConnectionAction} submit="Speichern und testen" pending="Prüft…" className="gr-form">
          <label className="gr-field"><span>Adresse der Elev8-Schnittstelle</span><input name="url" defaultValue={t.elev8Url ?? ""} placeholder="https://mcp.elev8-suite.com/sse" /></label>
          <label className="gr-field"><span>Zugangsschlüssel <em>(leer lassen = unverändert)</em></span><input name="token" type="password" autoComplete="off" /></label>
          <div className="gr-row">
            <label className="gr-field"><span>Nur Listings mit diesen Tags <em>(kommagetrennt, leer = alle)</em></span><input name="tags" defaultValue={t.listingTags.join(", ")} /></label>
            <label className="gr-field"><span>Grundpreis gilt für Gäste</span><input name="base_guests" type="number" min={1} max={20} defaultValue={t.baseGuests} /></label>
          </div>
        </StatefulForm>
        <ActionButton action={testConnectionAction} label="Verbindung testen" pending="Prüft…" />
      </section>

      <section className="gr-card">
        <h2>Inhalte aus der Vorlage</h2>
        <p className="gr-muted">Kopiert Prozesse, Regeln, Vorlagen und Entscheide in diesen Mandanten. Bereits vorhandene Einträge bleiben unverändert.</p>
        <ActionButton action={adoptTemplateAction} label="Vorlage übernehmen" pending="Übernimmt…" variant="primary" />
      </section>

      <section className="gr-card">
        <h2>Mitglieder</h2>
        <p className="gr-muted">Wer nicht über eine Orbit-Rolle Zugriff hat, kommt hier hinein. Das Sichtrecht für Codes gibst du einzeln.</p>
        <table className="gr-table"><tbody>
          {members.map((m) => (
            <tr key={m.email}>
              <td>{m.email}</td><td>{m.role}</td><td>{m.canSeeCodes ? "Codes sichtbar" : ""}</td>
              <td><StatefulForm action={removeMemberAction} submit="Entfernen" pending="…" variant="danger"><input type="hidden" name="email" value={m.email} /></StatefulForm></td>
            </tr>
          ))}
          {!members.length && <tr><td className="gr-muted">Keine Mitglieder eingetragen.</td></tr>}
        </tbody></table>
        <StatefulForm action={addMemberAction} submit="Hinzufügen" pending="Speichert…" className="gr-form">
          <div className="gr-row">
            <label className="gr-field"><span>E-Mail</span><input name="email" type="email" required /></label>
            <label className="gr-field"><span>Rolle</span><select name="role" defaultValue="viewer"><option value="viewer">Lesen</option><option value="editor">Bearbeiten</option><option value="admin">Verwalten</option></select></label>
          </div>
          <label className="gr-check"><input type="checkbox" name="codes" /> Darf Zugangscodes sehen</label>
        </StatefulForm>
      </section>

      {ctx.platformAdmin && (
        <>
          <section className="gr-card">
            <h2>Neuer Mandant (Kunde)</h2>
            <StatefulForm action={createTenantAction} submit="Mandant anlegen" pending="Legt an…" className="gr-form">
              <div className="gr-row">
                <label className="gr-field"><span>Kürzel</span><input name="slug" required pattern="[a-z0-9-]{2,40}" /></label>
                <label className="gr-field"><span>Name</span><input name="name" required /></label>
              </div>
            </StatefulForm>
            <p className="gr-muted">Mandanten: {all.filter((x) => !x.isTemplate).map((x) => x.name).join(", ")}</p>
          </section>
          <section className="gr-card">
            <h2>Vorlagen-Bibliothek</h2>
            <p className="gr-muted">Schreibt den Start-Inhalt aus der Software neu in den Vorlagen-Mandanten. Mandanten, die ihn schon übernommen haben, bleiben unberührt.</p>
            <ActionButton action={loadLibraryAction} label="Bibliothek aktualisieren" pending="Lädt…" confirm="Vorlagen-Bibliothek überschreiben?" />
          </section>
        </>
      )}
    </div>
  );
}
