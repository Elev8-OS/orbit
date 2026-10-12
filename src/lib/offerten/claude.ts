/**
 * Gemeinsamer Aufruf der Claude-API für Noah, den Sales-Assistenten von Elev8.
 * Liefert strukturierte Antworten über ein Tool. Manche Modelle erlauben kein erzwungenes Tool
 * (tool_choice "tool"), deshalb: Tool anbieten, per Anweisung verlangen und als Rückfall JSON aus dem Text lesen.
 * Benötigt ANTHROPIC_API_KEY. Modell über ANTHROPIC_MODEL überschreibbar.
 */

export function claudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type ToolDef = { name: string; description: string; input_schema: Record<string, unknown> };

type Block = { type: string; name?: string; input?: unknown; text?: string };

/** Liest ein JSON-Objekt aus Freitext (auch mit ```json-Zaun oder Text drumherum). */
function jsonFromText(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function request(body: Record<string, unknown>, timeoutMs: number) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const json = (await res.json().catch(() => null)) as { content?: Block[]; error?: { message?: string } } | null;
  if (!res.ok || !json?.content) throw new Error(`Claude-API: ${json?.error?.message ?? res.status}`);
  return json.content;
}

export async function callClaudeTool(opts: {
  system: string;
  user: string;
  tool: ToolDef;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<unknown> {
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const system = `${opts.system}

Antworte ausschliesslich, indem du das Tool "${opts.tool.name}" genau einmal aufrufst. Kein Text davor oder danach.`;

  const content = await request(
    {
      model,
      max_tokens: opts.maxTokens ?? 2500,
      system,
      tools: [opts.tool],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: opts.user }]
    },
    timeoutMs
  );
  const block = content.find((c) => c.type === "tool_use" && c.name === opts.tool.name);
  if (block?.input) return block.input;

  // Rückfall: Modell hat als Text geantwortet. JSON daraus lesen …
  const fromText = jsonFromText(content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n"));
  if (fromText) return fromText;

  // … oder einmal ausdrücklich als reines JSON nachfragen
  const retry = await request(
    {
      model,
      max_tokens: opts.maxTokens ?? 2500,
      system: `${opts.system}

Antworte ausschliesslich mit einem JSON-Objekt nach diesem Schema, ohne Text und ohne Markdown:
${JSON.stringify(opts.tool.input_schema)}`,
      messages: [{ role: "user", content: opts.user }]
    },
    timeoutMs
  );
  const parsed = jsonFromText(retry.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n"));
  if (parsed) return parsed;
  throw new Error("Claude-API: keine strukturierte Antwort");
}
