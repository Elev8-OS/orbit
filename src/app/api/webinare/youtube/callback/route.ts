import { cookies } from "next/headers";
import { currentWebinarUser } from "@/lib/webinare/access";
import { connect, readCookie, YT_COOKIE } from "@/lib/webinare/youtube";

export const dynamic = "force-dynamic";

const back = (webinarId: string, result: string) => {
  const base = (process.env.AUTH_URL || "").replace(/\/+$/, "");
  const path = webinarId ? `/webinare/${webinarId}/video` : "/webinare";
  return Response.redirect(`${base}${path}?youtube=${encodeURIComponent(result)}`, 302);
};

/** Google schickt die Person hierher zurück. Das Refresh-Token wird verschlüsselt gespeichert. */
export async function GET(req: Request) {
  const user = await currentWebinarUser();
  if (!user?.canEdit) return Response.json({ error: "Kein Zugriff" }, { status: 403 });
  const url = new URL(req.url);
  const jar = await cookies();
  const saved = readCookie(jar.get(YT_COOKIE)?.value);
  jar.delete({ name: YT_COOKIE, path: "/api/webinare/youtube/callback" });
  const id = saved?.webinarId ?? "";
  if (url.searchParams.get("error")) return back(id, url.searchParams.get("error") === "access_denied" ? "abgebrochen" : "fehler");
  if (!saved || saved.state !== url.searchParams.get("state")) return back(id, "abgelaufen");
  try {
    await connect(url.searchParams.get("code") ?? "", user.email);
    return back(id, "ok");
  } catch (err) {
    console.error("YouTube: Verbindung fehlgeschlagen:", err);
    return back(id, err instanceof Error && /keinen YouTube-Kanal/.test(err.message) ? "kein-kanal" : "fehler");
  }
}
