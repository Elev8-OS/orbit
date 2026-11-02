
export class EngineError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

const base = () => (process.env.SM_ENGINE_URL || "").replace(/\/+$/, "");

/** Aufruf des SM_engine-Dienstes. Der API-Schlüssel bleibt auf dem Server. */
export async function engine<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method: init?.method ?? "GET",
    headers: { "x-api-key": process.env.SM_ENGINE_API_KEY || "", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(60_000)
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>;
  if (!res.ok) throw new EngineError(res.status, typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
  return json as T;
}

export async function engineHealth(): Promise<{ ok: boolean; storage: boolean; database: boolean; ghl: boolean } | null> {
  try {
    const res = await fetch(`${base()}/health`, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
