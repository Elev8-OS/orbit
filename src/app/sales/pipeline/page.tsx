import { getLocale, getTranslations } from "next-intl/server";
import { pageContext } from "@/lib/sales/page";
import { loadPipeline, staleDays } from "@/lib/sales/service";
import { PipelineBoard } from "@/components/sales/PipelineBoard";

export const dynamic = "force-dynamic";

export default async function SalesPipelinePage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const ctx = await pageContext();
  if (!ctx.user || !ctx.result.ok) return null;
  const t = await getTranslations("sales.pipeline");
  const { p } = await searchParams;
  const view = await loadPipeline(ctx.result.viewer, p).catch((err) => {
    console.error("Sales: Pipeline nicht geladen:", err);
    return null;
  });
  if (!view) {
    return (
      <p className="sl-error" role="alert">
        {t("loadFailed")}
      </p>
    );
  }
  const locale = await getLocale();
  return <PipelineBoard view={view} locale={locale === "en" ? "en" : "de"} currency={process.env.SALES_CURRENCY || "USD"} staleDays={staleDays()} />;
}
