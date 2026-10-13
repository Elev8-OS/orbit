import { requireUser } from "@/lib/platform/access";
import { getPrefs, notify } from "@/lib/push/service";
import { myDayDigest } from "@/lib/push/jobs";
import { pushText } from "@/lib/push/texts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Testmitteilung an alle eigenen Geräte. ?art=myday schickt die heutige Zusammenfassung sofort. */
export async function POST(req: Request) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const prefs = await getPrefs(r.user.id);
  const t = pushText(prefs.locale);
  let payload = { title: t.test, body: t.testBody, url: "/mitteilungen", tag: "test" };
  if (new URL(req.url).searchParams.get("art") === "myday") {
    const digest = await myDayDigest(r.user, prefs);
    payload = { ...(digest ?? { title: t.mydayTitle(""), body: prefs.locale === "en" ? "Nothing on for today." : "Heute steht nichts an." }), url: "/", tag: "myday" };
  }
  const result = await notify([r.user.id], "test", payload);
  return Response.json(result, { status: result.devices ? 200 : 404 });
}
