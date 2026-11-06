import { z } from 'zod';
import { requireUser } from '@/lib/platform/access';
import { hasSmAccess } from '@/lib/sm-manager/access';
import { engine } from '@/lib/sm-manager/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Stand des WhatsApp-Katalogs: Einrichtung, Katalog, letzter Abgleich, Ergebnis. */
export async function GET() {
  const gate = await requireUser(hasSmAccess);
  if ('response' in gate) return gate.response;
  try {
    return Response.json(await engine('/wa-catalog'));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 502 });
  }
}

const body = z.object({ action: z.enum(['create', 'connect', 'preview', 'sync']) });

/**
 * create: Katalog bei Meta anlegen. connect: mit dem WhatsApp-Konto verbinden. preview: zeigen, was gesendet würde (schreibt nichts).
 * sync: an den Katalog senden. Der Abgleich läuft in der Engine im Hintergrund; die Seite fragt den Stand ab.
 */
export async function POST(req: Request) {
  const gate = await requireUser(hasSmAccess);
  if ('response' in gate) return gate.response;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
  try {
    return Response.json(await engine(`/wa-catalog/${parsed.data.action}`, { method: 'POST' }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 502 });
  }
}
