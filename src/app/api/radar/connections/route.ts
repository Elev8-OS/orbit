import { z } from "zod";
import { requireUser } from "@/lib/platform/access";
import { hasRadarAccess } from "@/lib/radar/access";
import { connectSlack } from "@/lib/radar/connectors/slack";
import { createConnection } from "@/lib/radar/store";

export const dynamic = "force-dynamic";

const body = z.object({
  kind: z.literal("slack"),
  token: z.string().trim().min(10).max(300),
  channels: z.array(z.string().max(120)).min(1).max(30),
  label: z.string().max(80).optional()
});

/** Neue Quelle verbinden. Das Token wird geprüft, verschlüsselt gespeichert und nie wieder ausgegeben. */
export async function POST(req: Request) {
  const gate = await requireUser(hasRadarAccess);
  if ("response" in gate) return gate.response;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Eingabe unvollständig" }, { status: 400 });
  try {
    const config = await connectSlack(parsed.data.token, parsed.data.channels);
    const label = parsed.data.label?.trim() || `Slack · ${config.team || "Workspace"}`;
    const id = await createConnection({ userId: gate.user.id, kind: "slack", label, config, token: parsed.data.token });
    return Response.json({ ok: true, id });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Verbindung fehlgeschlagen" }, { status: 400 });
  }
}
