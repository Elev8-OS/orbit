"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type Locale = "de" | "en";
const intlLocale = (l: Locale) => (l === "de" ? "de-CH" : "en-GB");

export async function post<T = Record<string, unknown>>(url: string, body: unknown): Promise<{ ok: boolean; data: T & { error?: string; detail?: string } }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string; detail?: string };
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "network" } as T & { error?: string } };
  }
}

/**
 * Beträge ohne Intl-Gruppierung, weil Node und Browser für de-CH unterschiedliche Apostrophe liefern
 * (' gegenüber ’) und die Seite sonst beim Laden neu gerendert wird. Ergebnis: "USD 49'800" bzw. "USD 49,800".
 */
export function formatMoney(value: number, currency: string, locale: Locale): string {
  const digits = Math.round(Math.abs(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, locale === "de" ? "'" : ",");
  return `${value < 0 ? "-" : ""}${currency} ${digits}`;
}

// ── Zeitzone ────────────────────────────────────────────────
// Server und Browser formatieren in derselben Zeitzone (die des Browsers, per Cookie gemeldet),
// damit „heute“, Uhrzeiten und Fälligkeiten überall gleich sind.

const TimeZoneContext = createContext("Europe/Zurich");

export function TimeZoneProvider({ timeZone, children }: { timeZone: string; children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browser && browser !== timeZone) {
      document.cookie = `SALES_TZ=${encodeURIComponent(browser)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
      router.refresh();
    }
  }, [timeZone, router]);
  return <TimeZoneContext.Provider value={timeZone}>{children}</TimeZoneContext.Provider>;
}

/** YYYY-MM-DD des Zeitpunkts in der Zeitzone. */
function ymd(t: number, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** Formatierer, an Sprache und Zeitzone gebunden. */
export function useFormat(locale: Locale) {
  const tz = useContext(TimeZoneContext);
  const loc = intlLocale(locale);
  const today = ymd(Date.now(), tz);
  const dayDiff = (iso: string) => Math.round((Date.parse(`${ymd(Date.parse(iso), tz)}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  const date = (iso: string, withWeekday = false) =>
    new Intl.DateTimeFormat(loc, { timeZone: tz, weekday: withWeekday ? "short" : undefined, day: "numeric", month: "short" }).format(
      new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)
    );
  return {
    time: (iso: string) => new Intl.DateTimeFormat(loc, { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso)),
    date,
    longToday: () => new Intl.DateTimeFormat(loc, { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(new Date()),
    relativeDay: (iso: string) => {
      const diff = dayDiff(iso);
      if (Math.abs(diff) <= 6) return new Intl.RelativeTimeFormat(loc, { numeric: "auto" }).format(diff, "day");
      return date(iso);
    },
    /** n Werktage (Mo–Fr) ab heute als YYYY-MM-DD */
    workdays: (n: number) => {
      let d = today;
      let left = n;
      while (left > 0) {
        d = addDays(d, 1);
        if (weekday(d) !== 0 && weekday(d) !== 6) left--;
      }
      return d;
    },
    nextMonday: () => addDays(today, (8 - weekday(today)) % 7 || 7)
  };
}

// ── Kurze Rückmeldungen mit optionalem „Rückgängig“ ─────────

type Toast = { id: number; text: string; tone: "ok" | "error"; action?: { label: string; run: () => void } };
const ToastContext = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((t: Omit<Toast, "id">) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), t.action ? 7000 : 4000);
  }, []);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="sl-toast-region" aria-live="polite">
        {toast && (
          <div key={toast.id} className={toast.tone === "error" ? "sl-toast is-error" : "sl-toast"}>
            <span>{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.run();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
