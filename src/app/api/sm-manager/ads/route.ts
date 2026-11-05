import { z } from 'zod';
import { requireUser } from '@/lib/platform/access';
import { hasSmAccess } from '@/lib/sm-manager/access';
import { EngineError, engine } from '@/lib/sm-manager/client';

export const dynamic = 'force-dynamic';

const body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('draft-all') }),
  z.object({ action: z.literal('draft'), propertyKey: z.string().min(1).max(60), postId: z.number().int().positive().optional() })
]);

/** Entwürfe anlegen: für alle eingestellten Villen oder für eine einzelne. */
export async function POST(req: Request) {
  const gate = await requireUser(hasSmAccess);
  if ('response' in gate) return gate.response;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
  try {
    const out = parsed.data.action === 'draft-all' ? await engine('/ads/draft-all', { method: 'POST', body: {} }) : await engine('/ads/draft', { method: 'POST', body: { propertyKey: parsed.data.propertyKey, postId: parsed.data.postId } });
    return Response.json(out);
  } catch (e) {
    const status = e instanceof EngineError ? e.status : 502;
    return Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: status >= 400 && status < 600 ? status : 502 });
  }
}
