"use client";

import { useTransition } from "react";
import { setLocaleAction } from "@/app/actions";
import { locales, type Locale } from "@/i18n/config";
import { PREFS_EVENT, type PrefsDetail } from "@/lib/prefs";

const NAMES: Record<Locale, string> = { de: "Deutsch", en: "English" };

export function LanguageSwitch({ current, label }: { current: Locale; label: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="lang-switch" role="group" aria-label={label} aria-busy={pending}>
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={locale === current}
          aria-label={NAMES[locale]}
          disabled={pending}
          onClick={() =>
            locale !== current &&
            startTransition(async () => {
              await setLocaleAction(locale);
              // Eingebettete Tools übernehmen die neue Sprache
              window.dispatchEvent(new CustomEvent<PrefsDetail>(PREFS_EVENT, { detail: { locale } }));
            })
          }
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
