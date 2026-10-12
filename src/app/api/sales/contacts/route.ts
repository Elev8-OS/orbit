import * as ghl from "@/lib/sales/ghl";
import { apiViewer, ghlError } from "@/lib/sales/api";

/**
 * Kontaktsuche für die Zuordnung eines Calls. Sales-User sehen nur eigene und noch nicht zugewiesene Kontakte,
 * Manager alle.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return Response.json({ contacts: [] });
  const ctx = await apiViewer(url.searchParams.get("als"));
  if ("response" in ctx) return ctx.response;
  const { viewer } = ctx;
  try {
    const list = await ghl.searchContacts(q.slice(0, 100));
    const visible = viewer.user.isManager ? list : list.filter((c) => !c.assignedTo || c.assignedTo === viewer.ghlUser.id);
    return Response.json({ contacts: visible.map(({ id, name, company, email }) => ({ id, name, company, email })) });
  } catch (err) {
    return ghlError(err);
  }
}
