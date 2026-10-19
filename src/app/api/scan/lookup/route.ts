import { requireScanUser } from "@/lib/scan/access";
import { findDuplicate, ghlConfigured } from "@/lib/scan/ghl";

export const dynamic = "force-dynamic";

/** Dublettenprüfung vor dem Senden: ?email=…&phone=… */
export async function GET(req: Request) {
  const guard = await requireScanUser();
  if ("response" in guard) return guard.response;
  if (!ghlConfigured()) return Response.json({ found: false });
  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase() || null;
  const phone = url.searchParams.get("phone")?.trim() || null;
  if (!email && !phone) return Response.json({ found: false });
  try {
    return Response.json(await findDuplicate(email, phone));
  } catch (err) {
    console.warn("Scan: Dublettenprüfung fehlgeschlagen:", err instanceof Error ? err.message : err);
    return Response.json({ found: false });
  }
}
