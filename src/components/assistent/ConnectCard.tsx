"use client";

import { useTranslations } from "next-intl";
import { Mail, ShieldCheck } from "lucide-react";

/** Postfach noch nicht verbunden: Erklärung und Anmeldung (läuft im ganzen Fenster, Microsoft erlaubt keine Einbettung). */
export function ConnectCard({ result }: { result: string | null }) {
  const t = useTranslations("platform.assistent.connect");
  const connect = () => {
    const target = "/api/assistent/connect";
    if (window.top && window.top !== window) window.top.location.href = target;
    else window.location.href = target;
  };
  const known = ["abgebrochen", "fehler", "abgelaufen", "falsches-konto"];
  return (
    <section className="p-card p-connect">
      <span className="p-connect-icon" aria-hidden="true">
        <Mail size={26} />
      </span>
      <h1>{t("title")}</h1>
      <p className="p-page-lead">{t("lead")}</p>
      <ul className="p-checklist">
        <li>{t("point1")}</li>
        <li>{t("point2")}</li>
        <li>{t("point3")}</li>
      </ul>
      {result && known.includes(result) && <p className="p-error">{t(`result.${result}`)}</p>}
      <button type="button" className="p-button-primary p-button-large" onClick={connect}>
        <Mail size={17} aria-hidden="true" />
        {t("button")}
      </button>
      <p className="p-muted p-connect-privacy">
        <ShieldCheck size={14} aria-hidden="true" />
        {t("privacy")}
      </p>
    </section>
  );
}
