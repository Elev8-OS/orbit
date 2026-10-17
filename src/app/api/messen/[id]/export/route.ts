import { requireMessenUser } from "@/lib/messen/access";
import { getEvent, listLeads } from "@/lib/messen/store";

export const dynamic = "force-dynamic";

/**
 * CSV-Export der Leads einer Messe.
 * ?typ=alle         alle Leads mit allen Angaben
 * ?typ=retargeting  nur Leads mit Werbe-Einwilligung, im Format für Custom Audiences (Meta, Google, LinkedIn)
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMessenUser();
  if ("response" in guard) return guard.response;
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return Response.json({ error: "not_found" }, { status: 404 });
  const type = new URL(req.url).searchParams.get("typ") === "retargeting" ? "retargeting" : "alle";
  const leads = await listLeads(event.id);

  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  let rows: unknown[][];
  if (type === "retargeting") {
    rows = [["email", "phone", "fn", "ln"]];
    for (const l of leads.filter((x) => x.consentMarketing)) {
      const [fn, ...ln] = l.name.trim().split(/\s+/);
      rows.push([l.email, l.whatsapp.replace(/^\+/, ""), fn ?? "", ln.join(" ")]);
    }
  } else {
    rows = [
      ["Losnummer", "Zeit", "Name", "Kanal", "WhatsApp", "E-Mail", "Units", "Einstufung", "Score", "Airbnb", "Inserat-ID",
        "Werbung erlaubt", "Fertig ausgefüllt", "Quelle", "UTM Source", "UTM Medium", "UTM Campaign", "GHL", "Gewinner"]
    ];
    for (const l of leads) {
      rows.push([
        l.ticket, l.createdAt.toISOString(), l.name, l.preferredChannel, l.whatsapp, l.email, l.units, l.tier, l.score,
        l.airbnbUrl, l.airbnbListingId, l.consentMarketing ? "ja" : "nein", l.completed ? "ja" : "nein", l.source, l.utm.source ?? "", l.utm.medium ?? "",
        l.utm.campaign ?? "", l.ghlStatus, l.winnerAt ? l.winnerAt.toISOString() : ""
      ]);
    }
  }
  const csv = "\ufeff" + rows.map((r) => r.map(q).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="elev8-${event.slug}-${type}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}
