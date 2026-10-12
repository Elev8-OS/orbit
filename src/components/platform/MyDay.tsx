import { getTranslations } from "next-intl/server";
import { AppIcon } from "@/components/AppIcon";
import { loadMyDay } from "@/lib/platform/today";
import type { PlatformUser } from "@/lib/platform/access";
import { MyDayView } from "./MyDayView";

/** „Mein Tag“ auf der Startseite: wird gestreamt, damit die Kacheln nicht warten müssen. */
export async function MyDay({ user, locale }: { user: PlatformUser; locale: "de" | "en" }) {
  const t = await getTranslations("platform.today");
  const cards = await loadMyDay(user, locale).catch((err) => {
    console.error("Mein Tag nicht geladen:", err);
    return [];
  });
  const date = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Zurich" }).format(new Date());
  return (
    <MyDayView
      title={t("title")}
      date={date}
      empty={t("allClear")}
      cards={cards.map((c) => ({ ...c, iconNode: <AppIcon icon={c.icon} /> }))}
      labels={{ hide: t("hide"), show: t("show"), more: t("more") }}
    />
  );
}

export async function MyDaySkeleton() {
  const t = await getTranslations("platform.today");
  return (
    <section className="p-today" aria-busy="true" aria-label={t("title")}>
      <div className="p-today-head">
        <h2>{t("title")}</h2>
      </div>
      <div className="p-today-grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="p-card p-skeleton" />
        ))}
      </div>
    </section>
  );
}
