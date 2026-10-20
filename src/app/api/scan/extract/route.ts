import { requireScanUser } from "@/lib/scan/access";
import { extractContact } from "@/lib/scan/extract";
import { crmFieldDefs, ghlConfigured } from "@/lib/scan/ghl";
import type { CrmField } from "@/lib/scan/crm";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/** Body: { front: dataUrl, back?: dataUrl }. Prompt und Modell liegen auf dem Server. */
export async function POST(req: Request) {
  const guard = await requireScanUser();
  if ("response" in guard) return guard.response;
  let body: { front?: string; back?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.front) return Response.json({ error: "front_missing", message: "Vorderseite fehlt" }, { status: 400 });
  try {
    // GHL-Felder (Units, PMS, Objektart …): Claude bekommt deren Optionen und wählt passend
    const crmFields = ghlConfigured() ? await crmFieldDefs().catch((): CrmField[] => []) : [];
    const contact = await extractContact(body.front, body.back || null, crmFields);
    return Response.json({ contact });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /zu gross|Data-URL/.test(message) ? 400 : 502;
    console.error(`Scan ${guard.user.email}: Extraktion fehlgeschlagen:`, message);
    return Response.json({ error: "extract_failed", message }, { status });
  }
}
