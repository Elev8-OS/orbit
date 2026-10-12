import { z } from "zod";
import { requireOffertenUser } from "@/lib/offerten/access";
import { dismissMeeting, restoreMeeting } from "@/lib/offerten/store";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ action: z.enum(["dismiss", "restore"]), title: z.string().max(300).optional() });

/** Call von Hand als "kein Angebot nötig" markieren oder wieder öffnen. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  const id = (await params).id;
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) return Response.json({ error: "invalid_meeting" }, { status: 400 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  if (parsed.data.action === "dismiss") await dismissMeeting(id, access.user.name, parsed.data.title);
  else await restoreMeeting(id);
  return Response.json({ ok: true });
}
