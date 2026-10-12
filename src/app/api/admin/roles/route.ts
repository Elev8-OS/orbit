import { z } from "zod";
import { requireAdmin } from "@/lib/platform/access";
import { assignRole, listAssignments, removeAssignment, roleManagementEnabled } from "@/lib/platform/entra";
import { audit } from "@/lib/platform/audit";

export const dynamic = "force-dynamic";

const addSchema = z.object({ userId: z.string().uuid(), role: z.string().min(1).max(120) });

/** Rolle in Entra zuweisen. */
export async function POST(req: Request) {
  const r = await requireAdmin();
  if ("response" in r) return r.response;
  if (!roleManagementEnabled()) return Response.json({ error: "not_configured" }, { status: 503 });
  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  try {
    await assignRole(parsed.data.userId, parsed.data.role);
    await audit({ id: r.user.id, email: r.user.email }, "role.assign", parsed.data.userId, { role: parsed.data.role });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: "failed", detail: err instanceof Error ? err.message : "" }, { status: 502 });
  }
}

/** Rollenzuweisung entfernen (?assignment=<id>). */
export async function DELETE(req: Request) {
  const r = await requireAdmin();
  if ("response" in r) return r.response;
  if (!roleManagementEnabled()) return Response.json({ error: "not_configured" }, { status: 503 });
  const id = new URL(req.url).searchParams.get("assignment") ?? "";
  if (!id || id.length > 200) return Response.json({ error: "invalid_body" }, { status: 400 });
  try {
    const assignment = (await listAssignments()).find((a) => a.id === id);
    if (!assignment) return Response.json({ error: "not_found" }, { status: 404 });
    if (assignment.principalId === r.user.id && assignment.role === (process.env.ORBIT_ADMIN_ROLE || "Orbit.Admin")) {
      return Response.json({ error: "self_admin" }, { status: 409 });
    }
    await removeAssignment(id);
    await audit({ id: r.user.id, email: r.user.email }, "role.remove", assignment.principalName, { role: assignment.role, principalId: assignment.principalId });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: "failed", detail: err instanceof Error ? err.message : "" }, { status: 502 });
  }
}
