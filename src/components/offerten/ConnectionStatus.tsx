"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, RefreshCw, X } from "lucide-react";

type Item = { ok: boolean; detail: string };
type Status = Record<"ghl" | "fireflies" | "claude" | "mail" | "webhook", Item>;

/** Zeigt, ob GHL, Fireflies, Claude und der Mailversand wirklich funktionieren. */
export function ConnectionStatus() {
  const t = useTranslations("offerten.settings.connections");
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/offerten/status")
      .then((r) => r.json())
      .then((d: Status) => setStatus(d))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  return (
    <section className="of-card">
      <div className="of-card-head">
        <h2 className="of-h2">{t("title")}</h2>
        <button type="button" className="button-ghost" onClick={load} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" /> {t("check")}
        </button>
      </div>
      {loading && !status && <p className="of-muted">{t("checking")}</p>}
      {status && (
        <ul className="of-steps of-connections">
          {(["ghl", "fireflies", "claude", "mail", "webhook"] as const).map((key) => (
            <li key={key} className={`of-step of-step-${status[key].ok ? "ok" : "failed"}`}>
              {status[key].ok ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
              <span>
                <strong>{t(key)}</strong> · {status[key].detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
