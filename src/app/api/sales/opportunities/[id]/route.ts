import { z } from "zod";
import * as ghl from "@/lib/sales/ghl";
import { apiViewer, bad, forbidden, ghlError, readJson } from "@/lib/sales/api";

const schema = z
  .object({
    stageId: z.string().max(100).optional(),
    status: z.enum(["won", "lost", "open"]).optional(),
    as: z.string().max(100).nullish()
  })
  .refine((v) => v.stageId || v.status);

/** Stage wechseln oder als gewonnen/verloren markieren. Nur eigene Opportunities, Manager alle. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const input = await readJson(req, schema);
  if (!input) return bad();
  const ctx = await apiViewer(input.as);
  if ("response" in ctx) return ctx.response;
  const { viewer } = ctx;
  try {
    const opp = await ghl.getOpportunity(id);
    if (!opp) return Response.json({ error: "not_found" }, { status: 404 });
    if (!viewer.user.isManager && opp.assignedTo !== viewer.ghlUser.id) return forbidden();
    if (input.stageId) {
      const pipeline = (await ghl.listPipelines()).find((p) => p.id === opp.pipelineId);
      if (!pipeline?.stages.some((s) => s.id === input.stageId)) return bad("unknown_stage");
    }
    await ghl.moveOpportunity(id, { pipelineStageId: input.stageId, status: input.status });
    return Response.json({ ok: true });
  } catch (err) {
    return ghlError(err);
  }
}
