import { z } from "zod";
import { issuePass, PASS_COOKIE } from "@/lib/orbit-pass";
import type { OrbitApp } from "@/lib/apps";
import type { PlatformUser } from "./access";

/**
 * Schnittstelle für eingebettete Apps, damit sie in „Mein Tag“, in der Suche und in Kunden-360 erscheinen.
 * Eine App gibt dafür in config/apps.yaml unter "integrations" Adressen an. Orbit ruft sie serverseitig
 * mit dem Orbit-Pass der angemeldeten Person auf (Cookie orbit_pass) und zeigt das Ergebnis an.
 * Die App prüft den Pass wie bei jedem anderen Aufruf. Beschreibung: docs/INTEGRATION.md
 */
export const itemSchema = z.object({
  id: z.string().max(200).optional(),
  title: z.string().min(1).max(300),
  meta: z.string().max(300).optional(),
  // Pfad innerhalb der App, der beim Klick im Tab geöffnet wird
  path: z.string().max(500).optional(),
  tone: z.enum(["default", "warning", "danger", "success"]).optional(),
  at: z.string().max(40).optional()
});
export type IntegrationItem = z.infer<typeof itemSchema>;

const listSchema = z.object({
  title: z.string().max(120).optional(),
  count: z.number().int().nonnegative().optional(),
  items: z.array(itemSchema).max(50).default([])
});
export type IntegrationList = z.infer<typeof listSchema>;

type Kind = "today" | "customer" | "search";

/** Ruft die Schnittstelle einer App auf. Liefert null, wenn die App sie nicht anbietet oder nicht antwortet. */
export async function callIntegration(
  app: OrbitApp,
  kind: Kind,
  user: PlatformUser,
  params: Record<string, string> = {},
  timeoutMs = 4000
): Promise<IntegrationList | null> {
  const base = app.integrations?.[kind];
  if (!base) return null;
  try {
    const url = new URL(base);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const { token } = await issuePass({ id: user.id, email: user.email, name: user.name, roles: user.roles });
    const res = await fetch(url, {
      headers: { Cookie: `${PASS_COOKIE}=${token}`, Accept: "application/json", "X-Orbit-Request": kind },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store"
    });
    if (!res.ok) return null;
    const parsed = listSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch (err) {
    console.warn(`Integration ${app.id}/${kind} nicht erreichbar:`, err instanceof Error ? err.message : err);
    return null;
  }
}
