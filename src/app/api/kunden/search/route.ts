import { hasKundenAccess, requireUser } from "@/lib/platform/access";
import { searchCustomers } from "@/lib/kunden/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const r = await requireUser(hasKundenAccess);
  if ("response" in r) return r.response;
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    const contacts = await searchCustomers(q.slice(0, 100));
    return Response.json({ contacts: contacts.map((c) => ({ id: c.id, name: c.name, company: c.company, email: c.email, phone: c.phone, tags: c.tags })) });
  } catch (err) {
    console.error("Kundensuche:", err);
    return Response.json({ error: "ghl_failed" }, { status: 502 });
  }
}
