import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { Brand } from "./Brand";
import { LanguageSwitch } from "./LanguageSwitch";
import { OrbitRing } from "./OrbitRing";
import { UserMenu } from "./UserMenu";

type Props = {
  name: string | null;
  email: string | null;
  admin: boolean;
  locale: Locale;
  dots: string[];
};

export async function Header({ name, email, admin, locale, dots }: Props) {
  const t = await getTranslations("header");
  const firstName = name?.split(/[\s,]+/).find(Boolean);

  return (
    <header className="sky">
      <a href="#main" className="skip-link">
        {t("skip")}
      </a>
      <OrbitRing dots={dots} className="sky-ring" />
      <div className="sky-inner">
        <div className="topbar">
          <Brand />
          <div className="topbar-actions">
            <LanguageSwitch current={locale} label={t("language")} />
            <UserMenu
              name={name}
              email={email}
              admin={admin}
              labels={{ account: t("account"), signOut: t("signOut"), admin: t("admin") }}
            />
          </div>
        </div>
        <div className="hero">
          <h1 className="greeting">{firstName ? t("greeting", { name: firstName }) : t("greetingFallback")}</h1>
          <p className="app-count">{t("appCount", { count: dots.length })}</p>
        </div>
      </div>
    </header>
  );
}
