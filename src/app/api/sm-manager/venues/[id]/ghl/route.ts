import { z } from 'zod';
import { requireUser } from '@/lib/platform/access';
import { hasSmAccess } from '@/lib/sm-manager/access';
import { EngineError } from '@/lib/sm-manager/client';
import { GhlError, sendWhatsapp, setOptIn } from '@/lib/venues/ghl';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const body = z.discriminatedUnion('action', [z.object({ action: z.literal('optin'), value: z.boolean() }), z.object({ action: z.literal('send') })]);

/** Zustimmung zu WhatsApp setzen oder die Business-Nachricht (GHL-Workflow) für diesen Ort starten. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireUser(hasSmAccess);
  if ('response' in gate) return gate.response;
  const id = Number((await params).id);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
  try {
    if (parsed.data.action === 'optin') await setOptIn(id, parsed.data.value);
    else await sendWhatsapp(id);
    return Response.json({ ok: true });
  } catch (e) {
    const status = e instanceof GhlError || e instanceof EngineError ? e.status : 502;
    return Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: status >= 400 && status < 600 ? status : 502 });
  }
}
