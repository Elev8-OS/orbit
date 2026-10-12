import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/platform/access";
import { search } from "@/lib/platform/search";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const locale = (await getLocale()) === "en" ? "en" : "de";
  const t = await getTranslations("platform.search.groups");
  const labels = Object.fromEntries(["apps", "customers", "quotes", "mail", "quote_draft", "quote_sent"].map((k) => [k, t(k)]));
  const groups = await search(r.user, q.slice(0, 100), locale, labels);
  return Response.json({ groups }, { headers: { "Cache-Control": "no-store" } });
}
