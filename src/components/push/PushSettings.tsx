"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { deviceState, disablePush, enablePush, currentSubscription, type DeviceState } from "./client";
import type { Prefs, Device } from "@/lib/push/service";
import "./push.css";

export type Category = { id: string; label: string; hint: string };

/** Mitteilungen: dieses Gerät an- und abmelden, Kategorien wählen, Uhrzeit für Mein Tag, Test. */
export function PushSettings({ initialPrefs, devices: initialDevices, categories }: { initialPrefs: Prefs; devices: Device[]; categories: Category[] }) {
  const t = useTranslations("push");
  const locale = useLocale();
  const [state, setState] = useState<DeviceState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [devices, setDevices] = useState(initialDevices);
  const [thisEndpoint, setThisEndpoint] = useState<string | null>(null);

  useEffect(() => {
    deviceState().then(setState);
    currentSubscription().then((s) => setThisEndpoint(s?.endpoint ?? null));
  }, []);

  const refreshDevices = async () => {
    const s = await currentSubscription();
    setThisEndpoint(s?.endpoint ?? null);
    // Liste neu laden über die Seite (Server), einfach und ohne eigene API
    window.location.reload();
  };

  const toggleDevice = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const next = state === "on" ? await disablePush() : await enablePush(locale);
      setState(next);
      if (next === "on" || state === "on") await refreshDevices();
    } catch {
      setMsg(t("device.error"));
    } finally {
      setBusy(false);
    }
  };

  const test = async (art?: "myday") => {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/push/test${art ? `?art=${art}` : ""}`, { method: "POST" }).catch(() => null);
    const json = res ? ((await res.json().catch(() => ({}))) as { delivered?: number; devices?: number }) : {};
    setMsg(res?.ok ? t("device.testSent", { count: json.delivered ?? 0 }) : t("device.testNone"));
    setBusy(false);
  };

  const save = async (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch, categories: { ...prefs.categories, ...(patch.categories ?? {}) } };
    setPrefs(next);
    await fetch("/api/push/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    setMsg(t("what.saved"));
  };

  const removeDevice = async (endpoint: string) => {
    await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint }) });
    if (endpoint === thisEndpoint) await disablePush();
    setDevices((d) => d.filter((x) => x.endpoint !== endpoint));
    if (endpoint === thisEndpoint) setState("off");
  };

  const deviceName = (ua: string | null) => {
    if (!ua) return "Browser";
    const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
    const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
    return [br, os].filter(Boolean).join(" · ");
  };

  const on = state === "on";
  return (
    <div className="p-page p-narrow">
      <h1 className="p-page-title">{t("title")}</h1>
      <p className="p-page-lead">{t("lead")}</p>

      <section className="p-card" aria-labelledby="push-device">
        <h2 id="push-device" className="p-card-title">
          {t("device.title")}
        </h2>
        <div className={`p-push-state${on ? " is-on" : ""}`}>
          <span className="p-push-dot" aria-hidden="true" />
          <p>
            {state === null
              ? t("device.working")
              : state === "unsupported"
                ? t("device.unsupported")
                : state === "ios-install"
                  ? t("device.iosInstall")
                  : state === "denied"
                    ? t("device.denied")
                    : on
                      ? t("device.on")
                      : t("device.off")}
          </p>
        </div>
        <div className="p-push-actions">
          {(state === "on" || state === "off") && (
            <button type="button" className={on ? "button-secondary" : "p-button-primary"} onClick={toggleDevice} disabled={busy}>
              {busy ? <Loader2 size={15} className="p-spin" aria-hidden="true" /> : on ? <BellOff size={15} aria-hidden="true" /> : <Bell size={15} aria-hidden="true" />}
              {busy ? t("device.working") : on ? t("device.disable") : t("device.enable")}
            </button>
          )}
          {devices.length > 0 && (
            <>
              <button type="button" className="button-ghost" onClick={() => test()} disabled={busy}>
                <Send size={15} aria-hidden="true" />
                {t("device.test")}
              </button>
              <button type="button" className="button-ghost" onClick={() => test("myday")} disabled={busy}>
                <Send size={15} aria-hidden="true" />
                {t("device.testMyday")}
              </button>
            </>
          )}
        </div>
        {msg && (
          <p className="p-muted" role="status">
            {msg}
          </p>
        )}
      </section>

      <section className="p-card" aria-labelledby="push-what">
        <h2 id="push-what" className="p-card-title">
          {t("what.title")}
        </h2>
        {categories.map((c) => (
          <div key={c.id} className="p-push-row">
            <label htmlFor={`cat-${c.id}`}>
              <strong>{c.label}</strong>
              <span className="p-muted">{c.hint}</span>
              {c.id === "myday" && prefs.categories.myday !== false && (
                <span className="p-push-myday" onClick={(e) => e.preventDefault()}>
                  <span>
                    {t("what.hour")}{" "}
                    <select value={prefs.mydayHour} onChange={(e) => save({ mydayHour: Number(e.target.value) })} aria-label={t("what.hour")}>
                      {Array.from({ length: 18 }, (_, i) => i + 5).map((h) => (
                        <option key={h} value={h}>
                          {String(h).padStart(2, "0")}:00
                        </option>
                      ))}
                    </select>
                  </span>
                  <span>
                    <input id="weekend" type="checkbox" checked={prefs.mydayWeekend} onChange={(e) => save({ mydayWeekend: e.target.checked })} />{" "}
                    <span onClick={() => save({ mydayWeekend: !prefs.mydayWeekend })}>{t("what.weekend")}</span>
                  </span>
                </span>
              )}
            </label>
            <input id={`cat-${c.id}`} type="checkbox" checked={prefs.categories[c.id] !== false} onChange={(e) => save({ categories: { [c.id]: e.target.checked } })} />
          </div>
        ))}
        <p className="p-muted">{t("what.broadcast")}</p>
      </section>

      <section className="p-card" aria-labelledby="push-devices">
        <h2 id="push-devices" className="p-card-title">
          {t("devices.title")}
        </h2>
        {devices.length === 0 ? (
          <p className="p-muted">{t("devices.none")}</p>
        ) : (
          <ul className="p-rows">
            {devices.map((d) => (
              <li key={d.id}>
                <span className="p-row-main">
                  <span className="p-row-title">
                    {deviceName(d.userAgent)}
                    {d.endpoint === thisEndpoint ? ` (${t("devices.this")})` : ""}
                  </span>
                  <span className="p-muted">{t("devices.since", { date: new Date(d.createdAt).toLocaleDateString() })}</span>
                </span>
                <button type="button" className="button-ghost" onClick={() => removeDevice(d.endpoint)}>
                  {t("devices.remove")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
