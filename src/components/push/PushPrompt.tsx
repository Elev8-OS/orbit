"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { deviceState } from "./client";
import "./push.css";

const KEY = "orbit:push-prompt-dismissed";

/** Kleiner Hinweis in „Mein Tag“, solange auf diesem Gerät keine Mitteilungen aktiv sind. */
export function PushPrompt() {
  const t = useTranslations("push.prompt");
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "1") return;
    } catch {
      /* ignorieren */
    }
    deviceState().then((s) => setShow(s === "off" || s === "ios-install"));
  }, []);
  if (!show) return null;
  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignorieren */
    }
  };
  return (
    <div className="p-push-prompt" role="note">
      <Bell size={16} aria-hidden="true" />
      <span>{t("text")}</span>
      <a className="p-link p-link-strong" href="/mitteilungen">
        {t("action")}
      </a>
      <button type="button" className="p-link" onClick={dismiss}>
        {t("dismiss")}
      </button>
    </div>
  );
}
