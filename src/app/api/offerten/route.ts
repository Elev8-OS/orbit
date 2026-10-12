import { z } from "zod";
import { requireOffertenUser } from "@/lib/offerten/access";
import { createBlank, createFromMeeting } from "@/lib/offerten/service";
import { listQuotes } from "@/lib/offerten/store";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  const status = new URL(request.url).searchParams.get("status");
  const filter = status === "draft" || status === "sent" ? status : "all";
  return Response.json({ quotes: await listQuotes(filter) });
}

const bodySchema = z.object({
  meetingId: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/).optional(),
  ghlContactId: z.string().max(64).optional()
});

export async function POST(request: Request) {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  const { user } = access;
  try {
    const quote = parsed.data.meetingId
      ? await createFromMeeting(parsed.data.meetingId, user)
      : await createBlank(user, parsed.data.ghlContactId ?? null);
    return Response.json({ id: quote.id });
  } catch (err) {
    const e = err as Error & { quoteId?: string };
    if (e.message === "already_exists") return Response.json({ error: "already_exists", id: e.quoteId }, { status: 409 });
    if (e.message === "transcript_not_found") return Response.json({ error: "transcript_not_found" }, { status: 404 });
    console.error("Offerte nicht erstellt:", err);
    return Response.json({ error: "create_failed" }, { status: 500 });
  }
}
