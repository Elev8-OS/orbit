import { auth } from "@/auth";
import { PASS_COOKIE, PASS_TTL_SECONDS, issuePass, passCookieOptions } from "@/lib/orbit-pass";

export const dynamic = "force-dynamic";

/**
 * Stellt den Orbit-Pass aus bzw. erneuert ihn. Orbit ruft das beim Öffnen und alle 20 Minuten auf,
 * solange die Seite offen ist. Endet die Orbit-Sitzung, wird kein Pass mehr ausgestellt.
 */
export async function POST() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { token, expiresAt } = await issuePass({ id: user.id, email: user.email, name: user.name, roles: user.roles ?? [] });
    const res = Response.json({ ok: true, expiresAt }, { headers: { "Cache-Control": "no-store" } });
    const { domain, path, httpOnly, secure, sameSite, maxAge } = passCookieOptions(PASS_TTL_SECONDS);
    const parts = [
      `${PASS_COOKIE}=${token}`,
      `Path=${path}`,
      `Max-Age=${maxAge}`,
      `SameSite=${sameSite[0].toUpperCase()}${sameSite.slice(1)}`,
      domain ? `Domain=${domain}` : "",
      httpOnly ? "HttpOnly" : "",
      secure ? "Secure" : ""
    ].filter(Boolean);
    res.headers.append("Set-Cookie", parts.join("; "));
    return res;
  } catch (err) {
    console.error("Orbit-Pass konnte nicht ausgestellt werden:", err);
    return Response.json({ error: "pass_unavailable" }, { status: 503 });
  }
}
