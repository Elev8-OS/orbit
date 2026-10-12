import { z } from "zod";
import * as ghl from "@/lib/sales/ghl";
import { apiViewer, bad, dateString, forbidden, ghlError, readJson, requestTimeZone } from "@/lib/sales/api";
import { dueDateIso } from "@/lib/sales/service";

const schema = z.object({
  contactId: z.string().min(1).max(100),
  action: z.enum(["complete", "reschedule"]),
  dueDate: dateString.optional(),
  as: z.string().max(100).nullish()
});

/** Follow-up erledigen oder verschieben. Nur eigene Tasks, Manager alle. */
export async function POST(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const input = await readJson(req, schema);
  if (!input || (input.action === "reschedule" && !input.dueDate)) return bad();
  const ctx = await apiViewer(input.as);
  if ("response" in ctx) return ctx.response;
  const { viewer } = ctx;
  try {
    const task = (await ghl.tasksForContact(input.contactId)).find((t) => t.id === taskId);
    if (!task) return Response.json({ error: "not_found" }, { status: 404 });
    if (!viewer.user.isManager && task.assignedTo !== viewer.ghlUser.id) return forbidden();
    if (input.action === "complete") await ghl.completeTask(input.contactId, taskId);
    else await ghl.rescheduleTask(input.contactId, taskId, dueDateIso(input.dueDate!, await requestTimeZone()));
    return Response.json({ ok: true });
  } catch (err) {
    return ghlError(err);
  }
}
