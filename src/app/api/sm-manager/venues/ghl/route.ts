import { z } from 'zod';
import { requireUser } from '@/lib/platform/access';
import { hasSmAccess } from '@/lib/sm-manager/access';
import { engine } from '@/lib/sm-manager/client';
import { checkDelivery, ghlInfoMap, syncToGhl, type GhlStatus } from '@/lib/venues/ghl';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Adresse der GHL-App für die Direktlinks auf Kontakte. Mit eigener Domain (White Label) per GHL_APP_URL überschreiben. */
const appUrl = () => (process.env.GHL_APP_URL ?? 'https://app.gohighlevel.com').replace(/\/$/, '');

/** Zustand der GHL-Verbindung (welches Konto, sind die Felder da) und was pro Ort in GHL steht. */
export async function GET() {
  const gate = await requireUser(hasSmAccess);
  if ('response' in gate) return gate.response;
  const [status, infos] = await Promise.all([engine<GhlStatus>('/outreach/status').catch(() => ({ configured: false }) as GhlStatus), ghlInfoMap().catch(() => ({}))]);
  return Response.json({ status, infos, appUrl: appUrl() });
}

const ids = z.array(z.number().int().positive()).max(60).optional();
const body = z.discriminatedUnion('action', [z.object({ action: z.literal('sync'), ids }), z.object({ action: z.literal('delivery'), ids })]);

/** Alle Orte (oder einzelne) in GHL anlegen oder aktualisieren; oder den Zustellstatus der WhatsApp-Nachrichten abfragen. */
export async function POST(req: Request) {
  const gate = await requireUser(hasSmAccess);
  if ('response' in gate) return gate.response;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
  try {
    if (parsed.data.action === 'delivery') return Response.json(await checkDelivery(parsed.data.ids));
    return Response.json(await syncToGhl(parsed.data.ids));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 502 });
  }
}
