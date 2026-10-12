import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { Elev8Logo } from "./Elev8Logo";
import { LanguageSwitch } from "./LanguageSwitch";
import { ThemeSwitch } from "./ThemeSwitch";
import type { Theme } from "@/lib/prefs";
import { OrbitRing } from "./OrbitRing";
import { UserMenu } from "./UserMenu";
import { SearchButton } from "./platform/SearchButton";
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

// Kopf der Übersicht: eine Achse mit den Kacheln darunter. Oben Elev8 | Orbit mit der Umlaufbahn,
// darunter Begrüssung, drei wählbare Kennzahlen und "Für dich" als ruhige Typografie ohne Boxen.
export async function Header({ name, email, admin, locale, theme, dots }: Props) {
  const t = await getTranslations("header");
  const tp = await getTranslations("platform.header");
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
      <div className="sky-inner">
        <div className="topbar">
          <h1 className="hero-brand">
            <Elev8Logo height={60} title="Elev8" />
            <span className="hero-divider" aria-hidden="true" />
            <span className="hero-product">Orbit</span>
          </h1>
          {/* Die Umlaufbahn als Teil der Markenzeile: jede App des Users ist ein Punkt */}
          <div className="hero-orbit" aria-hidden="true">
            <OrbitRing dots={dots} />
          </div>
          <div className="topbar-actions">
            <SearchButton label={tp("search")} noahLabel={tp("noah")} />
            <ThemeSwitch
              current={theme}
              labels={{ group: t("theme"), system: t("themeSystem"), light: t("themeLight"), dark: t("themeDark") }}
            />
            <LanguageSwitch current={locale} label={t("language")} />
            <UserMenu
              name={name}
              email={email}
              admin={admin}
              labels={{ account: t("account"), signOut: t("signOut"), admin: t("admin"), adminArea: tp("adminArea"), install: tp("install") }}
            />
          </div>
        </div>
        <div className="hero hero-v2">
          <p className="hero-greeting">
            <strong>{firstName ? t("greeting", { name: firstName }) : t("greetingFallback")}</strong> · {today}
          </p>
          <Pulse locale={locale} />
        </div>
      </div>
    </header>
  );
}
