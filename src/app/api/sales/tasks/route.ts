import { z } from "zod";
import * as ghl from "@/lib/sales/ghl";
import { apiViewer, bad, dateString, forbidden, ghlError, readJson, requestTimeZone } from "@/lib/sales/api";
import { canUseCall, canUseContact, dueDateIso, markCall } from "@/lib/sales/service";

const schema = z.object({
  contactId: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(4000).default(""),
  dueDate: dateString,
  meetingId: z.string().max(200).nullish(),
  noteFromCall: z.boolean().default(false),
  as: z.string().max(100).nullish()
});

/** Legt ein Follow-up in GHL an (dem angezeigten Sales-User zugewiesen). Mit meetingId gilt der Call als erledigt. */
export async function POST(req: Request) {
  const input = await readJson(req, schema);
  if (!input) return bad();
  const ctx = await apiViewer(input.as);
  if ("response" in ctx) return ctx.response;
  const { viewer } = ctx;

  const call = input.meetingId ? await canUseCall(viewer, input.meetingId) : null;
  if (input.meetingId && !call) return forbidden();
  try {
    // Aus einem eigenen Call darf auch ein noch nicht zugewiesener Interessent ein Follow-up bekommen
    const contact = await ghl.getContact(input.contactId, true);
    if (!contact) return Response.json({ error: "not_found" }, { status: 404 });
    const unassignedFromCall = Boolean(call) && !contact.assignedTo;
    if (!unassignedFromCall && !(await canUseContact(viewer, input.contactId))) return forbidden();
    const task = await ghl.createTask(input.contactId, {
      title: input.title,
      body: input.body,
      dueDate: dueDateIso(input.dueDate, await requestTimeZone()),
      assignedTo: viewer.ghlUser.id
    });
    let noteOk = true;
    if (call && input.noteFromCall && call.analysis?.summary) {
      const when = call.meeting_date ? new Date(call.meeting_date).toISOString().slice(0, 10) : "";
      await ghl
        .addNote(input.contactId, `Call ${when} (${call.title ?? "Fireflies"}):\n${call.analysis.summary}`.trim())
        .catch(() => {
          noteOk = false;
        });
    }
    if (input.meetingId) {
      await markCall(input.meetingId, "followup_set", viewer.user.email, { taskId: task.id, contactId: input.contactId });
    }
    return Response.json({ ok: true, task, noteOk });
  } catch (err) {
    return ghlError(err);
  }
}
