import { requireUser } from "@/lib/platform/access";
import { vapidKeys } from "@/lib/push/webpush";

export const dynamic = "force-dynamic";

/** Öffentlicher Schlüssel, mit dem der Browser das Gerät für Mitteilungen anmeldet. */
export async function GET() {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { publicKey } = await vapidKeys();
  return Response.json({ publicKey });
}
