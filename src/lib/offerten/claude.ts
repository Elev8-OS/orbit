/**
 * Gemeinsamer Aufruf der Claude-API mit erzwungenem Tool: liefert strukturierte, geprüfte Antworten.
 * Benötigt ANTHROPIC_API_KEY. Modell über ANTHROPIC_MODEL überschreibbar.
 */

export function claudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type ToolDef = { name: string; description: string; input_schema: Record<string, unknown> };

export async function callClaudeTool(opts: {
  system: string;
  user: string;
  tool: ToolDef;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<unknown> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: opts.maxTokens ?? 2500,
      system: opts.system,
      tools: [opts.tool],
      tool_choice: { type: "tool", name: opts.tool.name },
      messages: [{ role: "user", content: opts.user }]
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000)
  });
  const json = (await res.json().catch(() => null)) as {
    content?: { type: string; name?: string; input?: unknown }[];
    error?: { message?: string };
  } | null;
  if (!res.ok || !json?.content) throw new Error(`Claude-API: ${json?.error?.message ?? res.status}`);
  const block = json.content.find((c) => c.type === "tool_use" && c.name === opts.tool.name);
  if (!block) throw new Error("Claude-API: keine strukturierte Antwort");
  return block.input;
}
