import { z } from "zod";
import * as ghl from "@/lib/sales/ghl";
import { apiViewer, bad, forbidden, ghlError, readJson } from "@/lib/sales/api";
import { canUseContact } from "@/lib/sales/service";

const schema = z.object({
  contactId: z.string().min(1).max(100),
  body: z.string().trim().min(1).max(5000),
  as: z.string().max(100).nullish()
});

export async function POST(req: Request) {
  const input = await readJson(req, schema);
  if (!input) return bad();
  const ctx = await apiViewer(input.as);
  if ("response" in ctx) return ctx.response;
  try {
    if (!(await canUseContact(ctx.viewer, input.contactId))) return forbidden();
    await ghl.addNote(input.contactId, `${input.body}\n\n– ${ctx.viewer.user.name} (Orbit)`);
    return Response.json({ ok: true });
  } catch (err) {
    return ghlError(err);
  }
}
