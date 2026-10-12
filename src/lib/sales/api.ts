import { cookies } from "next/headers";
import { z } from "zod";
import { requireSalesUser } from "./access";
import { resolveViewer, validTimeZone, type Viewer } from "./service";

/** Zeitzone des Browsers (Cookie SALES_TZ), sonst SALES_TIMEZONE. */
export async function requestTimeZone(): Promise<string> {
  return validTimeZone((await cookies()).get("SALES_TZ")?.value);
}

/** Gemeinsamer Einstieg der Sales-APIs: Login, Rolle und GHL-User prüfen. `as` = Ansicht eines anderen (nur Manager). */
export async function apiViewer(as?: string | null): Promise<{ viewer: Viewer } | { response: Response }> {
  const auth = await requireSalesUser();
  if ("response" in auth) return auth;
  const fromCookie = auth.user.isManager ? (await cookies()).get("SALES_VIEW_AS")?.value : null;
  const result = await resolveViewer(auth.user, as ?? fromCookie).catch(() => ({ ok: false as const, reason: "ghl_failed" as const }));
  if (!result.ok) return { response: Response.json({ error: result.reason }, { status: 409 }) };
  return { viewer: result.viewer };
}

export async function readJson<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T> | null> {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

export const bad = (error = "invalid_request") => Response.json({ error }, { status: 400 });
export const forbidden = () => Response.json({ error: "forbidden" }, { status: 403 });

export function ghlError(err: unknown) {
  const message = err instanceof Error ? err.message : "Unbekannter Fehler";
  console.error("Sales:", message);
  return Response.json({ error: "ghl_failed", detail: message.slice(0, 300) }, { status: 502 });
}

export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
