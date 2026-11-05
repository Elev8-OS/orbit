import { z } from 'zod';
import { requireUser } from '@/lib/platform/access';
import { hasSmAccess } from '@/lib/sm-manager/access';
import { engine } from '@/lib/sm-manager/client';
import { ghlInfoMap, syncToGhl, type GhlStatus } from '@/lib/venues/ghl';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Zustand der GHL-Verbindung (welches Konto, sind die Felder da) und was pro Ort in GHL steht. */
export async function GET() {
  const gate = await requireUser(hasSmAccess);
  if ('response' in gate) return gate.response;
  const [status, infos] = await Promise.all([engine<GhlStatus>('/outreach/status').catch(() => ({ configured: false }) as GhlStatus), ghlInfoMap().catch(() => ({}))]);
  return Response.json({ status, infos });
}

const body = z.object({ action: z.literal('sync'), ids: z.array(z.number().int().positive()).max(60).optional() });

/** Alle Orte (oder einzelne) als Kontakte in GHL anlegen oder aktualisieren. */
export async function POST(req: Request) {
  const gate = await requireUser(hasSmAccess);
  if ('response' in gate) return gate.response;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
  try {
    return Response.json(await syncToGhl(parsed.data.ids));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 502 });
  }
}
