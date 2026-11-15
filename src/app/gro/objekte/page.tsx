import { atLeast, groContext } from "@/lib/gro/access";
import { countryCode } from "@/lib/gro/elev8";
import { keep, liveContext, liveListings } from "@/lib/gro/live";
import { listOverlays } from "@/lib/gro/store";
import { saveOverlayAction } from "../actions";
import { StatefulForm } from "@/components/gro/GroForms";
import { AutoRefresh, RevealCodes } from "@/components/gro/Tools";

export const dynamic = "force-dynamic";

export default async function Objekte() {
  const ctx = await groContext();
  if (!ctx) return null;
  const t = ctx.tenant;
  const { creds, allowed, problem } = await liveContext(t);
  const [live, overlays] = await Promise.all([liveListings(t, creds), listOverlays(t.id)]);
  const rows = live.ok ? keep(live.rows, allowed).sort((a, b) => a.listing_name.localeCompare(b.listing_name)) : [];
  const canEdit = atLeast(ctx.role, "editor");
  return (
    <div className="gr-page">
      <header className="gr-head">
        <div>
          <h1>Objekte</h1>
          <p className="gr-sub">{rows.length} Listings live aus Elev8 · {t.name}</p>
        </div>
        {creds && live.ok && <AutoRefresh at={live.at} seconds={300} />}
      </header>
      {!creds && <p className="gr-banner">{problem ? `Elev8-Zugang nicht lesbar: ${problem}` : "Für diesen Mandanten ist noch kein Elev8-Zugang hinterlegt (Verwaltung)."}</p>}
      {creds && !live.ok && <p className="gr-banner">{live.error}</p>}
      <p className="gr-muted">Stammdaten (Name, Kapazität, Land) kommen live aus Elev8. Hier pflegst du nur, was Elev8 nicht kennt: Citytax-Portal, Hinweise und geschützte Zugangscodes. Codes sehen nur Personen mit Sichtrecht, jeder Abruf wird protokolliert.</p>
      {rows.map((l) => {
        const ov = overlays.get(l.listing_id);
        const cc = countryCode(l.country);
        return (
          <details className="gr-card gr-obj" key={l.listing_id}>
            <summary>
              <span className="gr-strong">{l.listing_name}</span>
              <span className="gr-badges">
                {l.city && <span className="gr-pill">{l.city}{cc ? `, ${cc}` : ""}</span>}
                {l.maximum_capacity != null && <span className="gr-pill">max. {l.maximum_capacity} Gäste</span>}
                {ov?.citytaxPortal && <span className="gr-pill">Citytax {ov.citytaxPortal}</span>}
                {ov?.hasCodes && <span className="gr-pill">Codes hinterlegt</span>}
              </span>
            </summary>
            <p className="gr-muted">{[l.address, l.city].filter(Boolean).join(", ") || "Keine Adresse in Elev8"}</p>
            {ctx.canSeeCodes && ov?.hasCodes && <p><RevealCodes listingId={l.listing_id} /></p>}
            {canEdit ? (
              <StatefulForm action={saveOverlayAction} submit="Speichern" pending="Speichert…" className="gr-form">
                <input type="hidden" name="listing_id" value={l.listing_id} />
                <div className="gr-row">
                  <label className="gr-field"><span>Citytax-Portal</span><input name="portal" defaultValue={ov?.citytaxPortal ?? ""} placeholder="zum Beispiel Schaffhausen" /></label>
                  <label className="gr-field"><span>Hinweise</span><input name="notes" defaultValue={ov?.notes ?? ""} /></label>
                </div>
                {ctx.canSeeCodes && (
                  <label className="gr-field"><span>Zugangscodes und Notfallzugang <em>(wird verschlüsselt, leer lassen = unverändert)</em></span><textarea name="codes" rows={3} autoComplete="off" /></label>
                )}
              </StatefulForm>
            ) : (
              ov?.notes && <p>{ov.notes}</p>
            )}
          </details>
        );
      })}
    </div>
  );
}
