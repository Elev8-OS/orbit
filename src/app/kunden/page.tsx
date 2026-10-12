import { getTranslations } from "next-intl/server";
import { ensureEmbedded } from "@/lib/platform/embedded";
import { CustomerSearch } from "@/components/kunden/CustomerSearch";

export const dynamic = "force-dynamic";

export default async function KundenPage() {
  await ensureEmbedded("kunden", "/kunden");
  const t = await getTranslations("platform.kunden");
  return (
    <div className="p-page p-narrow">
      <h1 className="p-page-title">{t("searchTitle")}</h1>
      <p className="p-page-lead">{t("searchLead")}</p>
      <CustomerSearch
        labels={{ placeholder: t("searchPlaceholder"), recent: t("recent"), none: t("noResults"), error: t("searchError"), hint: t("searchHint") }}
      />
    </div>
  );
}
