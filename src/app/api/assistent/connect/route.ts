import { cookies } from "next/headers";
import { hasAssistentAccess, requireUser } from "@/lib/platform/access";
import { newLoginRequest, OAUTH_COOKIE, oauthConfigured } from "@/lib/assistant/oauth";
import { encrypt } from "@/lib/platform/crypto";

export const dynamic = "force-dynamic";

/** Startet die Microsoft-Anmeldung, mit der die Person ihr Postfach verbindet. Muss im ganzen Fenster laufen. */
export async function GET() {
  const r = await requireUser(hasAssistentAccess);
  if ("response" in r) return r.response;
  if (!oauthConfigured()) return Response.json({ error: "not_configured" }, { status: 503 });
  const login = newLoginRequest(r.user.email || undefined);
  (await cookies()).set(OAUTH_COOKIE, encrypt(JSON.stringify({ state: login.state, verifier: login.verifier, uid: r.user.id, at: Date.now() })), {
    httpOnly: true,
    secure: (process.env.AUTH_URL ?? "").startsWith("https://"),
    sameSite: "lax",
    path: "/api/assistent/callback",
    maxAge: 600
  });
  return Response.redirect(login.url, 302);
}
