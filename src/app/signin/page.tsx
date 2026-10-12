import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { signInAction } from "@/app/actions";
import { isLocale, defaultLocale } from "@/i18n/config";
import { Brand } from "@/components/Brand";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { LiveOrbit } from "@/components/LiveOrbit";

const KNOWN_ERRORS = new Set(["AccessDenied", "Configuration"]);
const DEMO_DOTS = ["#F6BB12", "#FFFFFF", "#C8A84B", "#A3A3A3", "#F6BB12", "#6B6B6B", "#FFFFFF", "#C8A84B", "#F6BB12", "#A3A3A3"];

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { callbackUrl, error } = await searchParams;
  const t = await getTranslations("signin");
  const tHeader = await getTranslations("header");
  const rawLocale = await getLocale();
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const errorKey = error ? (KNOWN_ERRORS.has(error) ? error : "default") : null;

  return (
    <div className="login">
      <LiveOrbit className="login-orbit" dots={DEMO_DOTS} />
      <header className="login-top">
        <Brand href="/signin" logoHeight={36} />
        <LanguageSwitch current={locale} label={tHeader("language")} />
      </header>

      <main className="login-main">
        <h1 className="login-headline">
          {t("headline")
            .split("\n")
            .map((line, i) => (
              <span key={i} className="login-line" style={{ animationDelay: `${150 + i * 140}ms` }}>
                {line}
              </span>
            ))}
        </h1>
        <p className="login-lead">{t("lead")}</p>

        {errorKey && (
          <p className="login-error" role="alert">
            {t(`errors.${errorKey}`)}
          </p>
        )}

        <form action={signInAction} className="login-form">
          <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/"} />
          <button type="submit" className="button-yellow button-large">
            <MicrosoftLogo />
            {t("button")}
          </button>
        </form>
        <p className="login-hint">{t("hint")}</p>
      </main>
    </div>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}
