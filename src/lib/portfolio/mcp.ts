/**
 * Minimaler MCP-Client (JSON-RPC) für Server-zu-Server-Aufrufe mit Bearer-Token.
 * Unterstützt Streamable HTTP (POST an die URL, Antwort als JSON oder text/event-stream) und als
 * Rückfall den älteren SSE-Transport (GET …/sse nennt die POST-Adresse, Antworten kommen über den Stream).
 */

type JsonRpc = { jsonrpc: "2.0"; id?: number; method?: string; params?: unknown; result?: unknown; error?: { message?: string } };

const PROTOCOL = "2025-06-18";
const CLIENT = { name: "orbit-portfolio", version: "1.0.0" };

function parseBody(text: string, contentType: string): JsonRpc[] {
  if (contentType.includes("text/event-stream")) {
    return text
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .filter(Boolean)
      .flatMap((d) => {
        try {
          return [JSON.parse(d) as JsonRpc];
        } catch {
          return [];
        }
      });
  }
  if (!text.trim()) return [];
  const j = JSON.parse(text);
  return Array.isArray(j) ? j : [j];
}

function toolResult(msg: JsonRpc | undefined, tool: string): unknown {
  if (!msg) throw new Error(`MCP ${tool}: keine Antwort`);
  if (msg.error) throw new Error(`MCP ${tool}: ${msg.error.message ?? "Fehler"}`);
  const r = msg.result as { content?: { type: string; text?: string }[]; isError?: boolean } | undefined;
  const text = (r?.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  if (r?.isError) throw new Error(`MCP ${tool}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function streamableCall(url: string, token: string, tool: string, args: Record<string, unknown>, timeoutMs: number) {
  const base: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": PROTOCOL
  };
  const signal = AbortSignal.timeout(timeoutMs);
  const init = await fetch(url, {
    method: "POST",
    headers: base,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: CLIENT } }),
    signal
  });
  if (!init.ok) throw new HttpError(`MCP initialize: HTTP ${init.status}`, init.status);
  const session = init.headers.get("mcp-session-id");
  await init.text();
  const headers = session ? { ...base, "Mcp-Session-Id": session } : base;
  await fetch(url, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }), signal })
    .then((r) => r.text())
    .catch(() => "");
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: tool, arguments: args } }),
    signal
  });
  const text = await res.text();
  if (!res.ok) throw new HttpError(`MCP ${tool}: HTTP ${res.status} ${text.slice(0, 200)}`, res.status);
  const msgs = parseBody(text, res.headers.get("content-type") ?? "");
  if (session) fetch(url, { method: "DELETE", headers }).catch(() => {});
  return toolResult(msgs.find((m) => m.id === 2), tool);
}

/** Älterer SSE-Transport: GET <basis>/sse öffnet den Stream, das erste "endpoint"-Ereignis nennt die POST-Adresse. */
async function sseCall(sseUrl: string, token: string, tool: string, args: Record<string, unknown>, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(sseUrl, { headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" }, signal: ctrl.signal });
    if (!res.ok || !res.body) throw new HttpError(`MCP SSE: HTTP ${res.status}`, res.status);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let endpoint: string | null = null;
    const waiting = new Map<number, (m: JsonRpc) => void>();
    void (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const block = buf.slice(0, idx).replace(/\r/g, "");
            buf = buf.slice(idx + 2);
            const ev = /^event:\s*(.*)$/m.exec(block)?.[1]?.trim() ?? "message";
            const data = block
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trim())
              .join("\n");
            if (ev === "endpoint") endpoint = new URL(data, sseUrl).toString();
            else if (data) {
              try {
                const m = JSON.parse(data) as JsonRpc;
                if (typeof m.id === "number") waiting.get(m.id)?.(m);
              } catch {
                /* kein JSON – ignorieren */
              }
            }
          }
        }
      } catch {
        /* Stream beendet */
      }
    })();
    for (let i = 0; i < 100 && !endpoint; i++) await new Promise((r) => setTimeout(r, 100));
    if (!endpoint) throw new Error("MCP SSE: keine Endpoint-Adresse erhalten");
    const target = endpoint;
    const send = (body: JsonRpc) =>
      fetch(target, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
    const ask = (id: number, method: string, params: unknown) =>
      new Promise<JsonRpc>((resolve, reject) => {
        waiting.set(id, resolve);
        send({ jsonrpc: "2.0", id, method, params }).then((r) => {
          if (!r.ok) reject(new Error(`MCP ${method}: HTTP ${r.status}`));
        }, reject);
      });
    await ask(1, "initialize", { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: CLIENT });
    await send({ jsonrpc: "2.0", method: "notifications/initialized" });
    return toolResult(await ask(2, "tools/call", { name: tool, arguments: args }), tool);
  } finally {
    clearTimeout(timer);
    ctrl.abort();
  }
}

/** Ruft ein Tool auf einem MCP-Server auf. Fällt auf SSE zurück, wenn Streamable HTTP abgelehnt wird. */
export async function mcpCallTool(url: string, token: string, tool: string, args: Record<string, unknown>, timeoutMs = 120_000): Promise<unknown> {
  const clean = url.replace(/\/+$/, "");
  if (clean.endsWith("/sse")) return sseCall(clean, token, tool, args, timeoutMs);
  try {
    return await streamableCall(clean, token, tool, args, timeoutMs);
  } catch (err) {
    if (err instanceof HttpError && [404, 405, 406].includes(err.status)) {
      return sseCall(clean.replace(/\/mcp$/, "") + "/sse", token, tool, args, timeoutMs);
    }
    throw err;
  }
}
