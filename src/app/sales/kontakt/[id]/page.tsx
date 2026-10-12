import { getLocale, getTranslations } from "next-intl/server";
import { pageContext } from "@/lib/sales/page";
import { canUseContact, loadContact } from "@/lib/sales/service";
import { ContactPage } from "@/components/sales/ContactPage";

export const dynamic = "force-dynamic";

export default async function SalesContactPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await pageContext();
  if (!ctx.user || !ctx.result.ok) return null;
  const t = await getTranslations("sales.contact");
  const { id } = await params;
  const viewer = ctx.result.viewer;

  const allowed = await canUseContact(viewer, id).catch(() => false);
  const view = allowed ? await loadContact(id).catch(() => null) : null;
  if (!view) {
    return (
      <div className="sl-notice">
        <h1>{t("notFound.title")}</h1>
        <p>{t("notFound.body")}</p>
        <a className="button-secondary" href="/sales">
          {t("notFound.back")}
        </a>
      </div>
    );
  }
  const locale = await getLocale();
  return (
    <ContactPage
      view={view}
      locale={locale === "en" ? "en" : "de"}
      currency={process.env.SALES_CURRENCY || "USD"}
      canOffer={ctx.canOffer && !viewer.other}
      viewerGhlId={viewer.ghlUser.id}
    />
  );
}
