import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { hasAssistentAccess, requireUser } from "@/lib/platform/access";
import { exchangeCode, OAUTH_COOKIE } from "@/lib/assistant/oauth";
import { me } from "@/lib/assistant/graph";
import { saveConnection } from "@/lib/assistant/store";
import { forgetToken } from "@/lib/assistant/worker";
import { decrypt } from "@/lib/platform/crypto";
import { audit } from "@/lib/platform/audit";

export const dynamic = "force-dynamic";

const back = (result: string) => {
  const base = (process.env.AUTH_URL || "").replace(/\/+$/, "");
  return Response.redirect(`${base}/?app=assistent&path=${encodeURIComponent(`/assistent?verbunden=${result}`)}`, 302);
};

/** Microsoft schickt die Person hierher zurück. Das Refresh-Token wird verschlüsselt gespeichert. */
export async function GET(req: Request) {
  const r = await requireUser(hasAssistentAccess);
  if ("response" in r) return r.response;
  const url = new URL(req.url);
  const jar = await cookies();
  const raw = jar.get(OAUTH_COOKIE)?.value;
  jar.delete({ name: OAUTH_COOKIE, path: "/api/assistent/callback" });
  if (url.searchParams.get("error")) return back(url.searchParams.get("error") === "access_denied" ? "abgebrochen" : "fehler");

  let saved: { state: string; verifier: string; uid: string; at: number };
  try {
    saved = JSON.parse(decrypt(raw ?? ""));
  } catch {
    return back("abgelaufen");
  }
  if (saved.state !== url.searchParams.get("state") || saved.uid !== r.user.id || Date.now() - saved.at > 600_000) return back("abgelaufen");

  try {
    const tokens = await exchangeCode(url.searchParams.get("code") ?? "", saved.verifier);
    if (!tokens.refreshToken) return back("fehler");
    const profile = await me(tokens.accessToken);
    // Nur das eigene Postfach: das Microsoft-Konto muss dasselbe sein wie die Orbit-Anmeldung
    if (profile.id !== r.user.id) return back("falsches-konto");
    forgetToken(r.user.id);
    await saveConnection({
      userId: r.user.id,
      email: (profile.mail || profile.userPrincipalName).toLowerCase(),
      name: profile.displayName || r.user.name,
      refreshToken: tokens.refreshToken,
      locale: (await getLocale()) === "en" ? "en" : "de"
    });
    await audit({ id: r.user.id, email: r.user.email }, "assistant.connect", r.user.email);
    return back("ok");
  } catch (err) {
    console.error("Assistent: Verbindung fehlgeschlagen:", err);
    return back("fehler");
  }
}
