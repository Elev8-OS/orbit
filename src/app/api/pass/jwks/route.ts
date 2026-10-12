import { publicJwks } from "@/lib/orbit-pass";

export const dynamic = "force-dynamic";

/** Öffentliche Schlüssel, mit denen die Tools den Orbit-Pass prüfen. Öffentlich und unbedenklich. */
export async function GET() {
  try {
    return Response.json(await publicJwks(), {
      headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" }
    });
  } catch (err) {
    console.error("JWKS nicht verfügbar:", err);
    return Response.json({ error: "jwks_unavailable" }, { status: 503 });
  }
}
