import { getLocale } from "next-intl/server";
import { pageContext } from "@/lib/sales/page";
import { loadToday, staleDays } from "@/lib/sales/service";
import { TodayView } from "@/components/sales/TodayView";

export const dynamic = "force-dynamic";

export default async function SalesTodayPage() {
  const ctx = await pageContext();
  if (!ctx.user || !ctx.result.ok) return null; // Layout zeigt den Hinweis
  const [data, locale] = await Promise.all([loadToday(ctx.result.viewer, ctx.timeZone), getLocale()]);
  return (
    <TodayView
      data={data}
      locale={locale === "en" ? "en" : "de"}
      currency={process.env.SALES_CURRENCY || "USD"}
      canOffer={ctx.canOffer && !ctx.result.viewer.other}
      staleDays={staleDays()}
    />
  );
}
