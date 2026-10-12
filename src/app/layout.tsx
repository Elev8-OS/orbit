import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "@fontsource-variable/inter";
import "./globals.css";
import "./mobile.css";
import "./shell.css";
import "./theme.css";
import { cookies } from "next/headers";
import { THEME_COOKIE, isTheme } from "@/lib/prefs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: "Elev8 Orbit", description: t("description") };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#000000" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" }
  ]
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const savedTheme = (await cookies()).get(THEME_COOKIE)?.value;
  return (
    <html lang={locale} data-theme={isTheme(savedTheme) ? savedTheme : "system"}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
