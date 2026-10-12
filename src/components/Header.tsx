import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { Elev8Logo } from "./Elev8Logo";
import { LanguageSwitch } from "./LanguageSwitch";
import { ThemeSwitch } from "./ThemeSwitch";
import type { Theme } from "@/lib/prefs";
import { OrbitRing } from "./OrbitRing";
import { UserMenu } from "./UserMenu";
import { Pulse } from "./Pulse";
import "./hero.css";

type Props = {
  name: string | null;
  email: string | null;
  admin: boolean;
  locale: Locale;
  theme: Theme;
  dots: string[];
};

// Kopf der Übersicht: Elev8 | Orbit als Hauptträger, darunter Begrüssung, Puls und "Für dich".
export async function Header({ name, email, admin, locale, theme, dots }: Props) {
  const t = await getTranslations("header");
  const firstName = name?.split(/[\s,]+/).find(Boolean);
  const today = new Date().toLocaleDateString(locale === "en" ? "en-GB" : "de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Zurich"
  });

  return (
    <header className="sky sky-v2">
      <a href="#main" className="skip-link">
        {t("skip")}
      </a>
      <OrbitRing dots={dots} className="sky-ring" />
      <div className="sky-inner">
        <div className="topbar">
          <div className="topbar-actions">
            <ThemeSwitch
              current={theme}
              labels={{ group: t("theme"), system: t("themeSystem"), light: t("themeLight"), dark: t("themeDark") }}
            />
            <LanguageSwitch current={locale} label={t("language")} />
            <UserMenu
              name={name}
              email={email}
              admin={admin}
              labels={{ account: t("account"), signOut: t("signOut"), admin: t("admin") }}
            />
          </div>
        </div>
        <div className="hero hero-v2">
          <h1 className="hero-brand">
            <Elev8Logo height={60} title="Elev8" />
            <span className="hero-divider" aria-hidden="true" />
            <span className="hero-product">Orbit</span>
          </h1>
          <p className="hero-greeting">
            <strong>{firstName ? t("greeting", { name: firstName }) : t("greetingFallback")}</strong> · {today}
          </p>
          <Pulse locale={locale} />
        </div>
      </div>
    </header>
  );
}
