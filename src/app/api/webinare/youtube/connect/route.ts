import { cookies } from "next/headers";
import { currentWebinarUser } from "@/lib/webinare/access";
import { loginUrl, YT_COOKIE, youtubeConfigured } from "@/lib/webinare/youtube";

export const dynamic = "force-dynamic";

/** Startet die Google-Anmeldung, mit der der YouTube-Kanal von Elev8 verbunden wird. ?w= ist das Webinar, zu dem es danach zurückgeht. */
export async function GET(req: Request) {
  const user = await currentWebinarUser();
  if (!user?.canEdit) return Response.json({ error: "Kein Zugriff" }, { status: 403 });
  if (!youtubeConfigured()) return Response.json({ error: "YOUTUBE_CLIENT_ID und YOUTUBE_CLIENT_SECRET fehlen" }, { status: 503 });
  const w = new URL(req.url).searchParams.get("w") ?? "";
  const login = loginUrl(/^[0-9a-f-]{36}$/i.test(w) ? w : "");
  (await cookies()).set(YT_COOKIE, login.cookie, {
    httpOnly: true,
    secure: (process.env.AUTH_URL ?? "").startsWith("https://"),
    sameSite: "lax",
    path: "/api/webinare/youtube/callback",
    maxAge: 600
  });
  return Response.redirect(login.url, 302);
}
