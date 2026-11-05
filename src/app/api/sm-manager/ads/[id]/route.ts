import { z } from 'zod';
import { requireUser } from '@/lib/platform/access';
import { hasSmAccess } from '@/lib/sm-manager/access';
import { EngineError, engine } from '@/lib/sm-manager/client';

export const dynamic = 'force-dynamic';

const edit = z.object({
  name: z.string().max(150).optional(),
  dailyBudgetUsd: z.number().optional(),
  startDate: z.string().max(10).optional(),
  endDate: z.string().max(10).optional(),
  maxCpaUsd: z.number().optional(),
  stopNoCheckoutUsd: z.number().optional(),
  optimizeFor: z.enum(['INITIATE_CHECKOUT', 'PURCHASE', 'VIEW_CONTENT']).optional(),
  audience: z
    .object({
      countries: z.array(z.string().max(2)).max(10).optional(),
      ageMin: z.number().optional(),
      ageMax: z.number().optional(),
      placements: z.enum(['automatic', 'instagram']).optional()
    })
    .optional(),
  creative: z
    .object({
      primaryText: z.string().max(2000).optional(),
      headline: z.string().max(80).optional(),
      description: z.string().max(100).optional(),
      cta: z.enum(['BOOK_TRAVEL', 'LEARN_MORE', 'SIGN_UP']).optional()
    })
    .optional()
});

const action = z.object({ action: z.enum(['approve', 'reopen', 'reject', 'push', 'activate', 'pause']), feedback: z.string().max(500).optional() });

async function forward(fn: () => Promise<unknown>) {
  try {
    return Response.json(await fn());
  } catch (e) {
    const status = e instanceof EngineError ? e.status : 502;
    return Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: status >= 400 && status < 600 ? status : 502 });
  }
}

/** Entwurf ändern (nur solange er ein Entwurf ist; die Engine prüft jedes Feld). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireUser(hasSmAccess);
  if ('response' in gate) return gate.response;
  const id = Number((await params).id);
  const parsed = edit.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
  return forward(() => engine(`/ads/${id}`, { method: 'PUT', body: parsed.data }));
}

/** Schritte einer Anzeige: freigeben, wieder öffnen, ablehnen, an Meta senden, einschalten, pausieren. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireUser(hasSmAccess);
  if ('response' in gate) return gate.response;
  const id = Number((await params).id);
  const parsed = action.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
  const { action: step, feedback } = parsed.data;
  return forward(() => engine(`/ads/${id}/${step}`, { method: 'POST', body: step === 'reject' ? { feedback } : {} }));
}
