import { requireUser } from "@/lib/platform/access";
import { hasSmAccess } from "@/lib/sm-manager/access";
import { EngineError, engine } from "@/lib/sm-manager/client";

export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;

function fail(e: unknown) {
  const status = e instanceof EngineError ? e.status : 502;
  return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: status >= 400 && status < 600 ? status : 502 });
}

// Musikbibliothek der Reels
export async function GET() {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  try {
    return Response.json(await engine("/music"));
  } catch (e) {
    return fail(e);
  }
}

// Titel hochladen: Formular mit Datei (file) und den Feldern title, provider, mood, license_ref, license_ok, note
export async function POST(req: Request) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "invalid form" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "There is no file" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "The file is larger than 15 MB" }, { status: 400 });
  const text = (k: string) => String(form.get(k) ?? "");
  try {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const created = await engine("/music", {
      method: "POST",
      body: { title: text("title"), provider: text("provider"), mood: text("mood") || "any", license_ref: text("license_ref"), license_ok: text("license_ok") === "true", note: text("note"), data }
    });
    return Response.json(created, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
