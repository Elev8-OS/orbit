import { z } from "zod";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/platform/access";
import { loadAppsConfig } from "@/lib/apps";
import { assignRole, roleManagementEnabled } from "@/lib/platform/entra";
import { audit } from "@/lib/platform/audit";
import { sendMail } from "@/lib/mail/send";
import { accessDecisionEmail } from "@/lib/mail/platform-templates";
import { defaultLocale } from "@/i18n/config";
import { notifySafe } from "@/lib/push/service";
import { pushText } from "@/lib/push/texts";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  role: z.string().max(120).optional(),
  note: z.string().trim().max(500).optional()
});

/** Zugriffsanfrage bewilligen (optional mit Rollenzuweisung in Entra) oder ablehnen. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireAdmin();
  if ("response" in r) return r.response;
  const id = Number((await params).id);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });

  const [request] = await sql<{ id: string; user_id: string; user_name: string | null; user_email: string | null; app_id: string; status: string }[]>`
    SELECT id, user_id, user_name, user_email, app_id, status FROM access_requests WHERE id = ${id}`;
  if (!request) return Response.json({ error: "not_found" }, { status: 404 });
  if (request.status !== "open") return Response.json({ error: "already_decided" }, { status: 409 });

  const app = (await loadAppsConfig()).apps.find((a) => a.id === request.app_id);
  const approve = parsed.data.action === "approve";
  const role = approve ? parsed.data.role || app?.roles[0] || null : null;
  if (approve && role && app && !app.roles.includes(role)) return Response.json({ error: "role_not_for_app" }, { status: 400 });

  let assigned = false;
  if (approve && role && roleManagementEnabled()) {
    try {
      await assignRole(request.user_id, role);
      assigned = true;
    } catch (err) {
      console.error("Rolle nicht zugewiesen:", err);
      return Response.json({ error: "assign_failed", detail: err instanceof Error ? err.message : "" }, { status: 502 });
    }
  }

  await sql`
    UPDATE access_requests SET status = ${approve ? "approved" : "rejected"}, decided_by = ${r.user.email}, decided_at = now(),
      granted_role = ${assigned ? role : null}, decision_note = ${parsed.data.note ?? null}
    WHERE id = ${id}`;
  await audit({ id: r.user.id, email: r.user.email }, approve ? "access.approve" : "access.reject", request.user_email ?? request.user_id, {
    app: request.app_id,
    role,
    assigned
  });

  if (request.user_email) {
    await sendMail({
      to: request.user_email,
      tags: [{ name: "type", value: "access_decision" }],
      ...accessDecisionEmail(defaultLocale, request.user_name || request.user_email, app?.name[defaultLocale] ?? request.app_id, approve, parsed.data.note ?? null, assigned)
    });
  }
  await notifySafe([request.user_id], "access", (prefs) => {
    const t = pushText(prefs.locale);
    const name = app?.name[prefs.locale] ?? request.app_id;
    return {
      title: approve ? t.accessApproved(name) : t.accessRejected(name),
      body: parsed.data.note || (approve ? t.accessApprovedBody : ""),
      url: "/",
      tag: `access-${id}`
    };
  });
  return Response.json({ ok: true, assigned, role });
}
