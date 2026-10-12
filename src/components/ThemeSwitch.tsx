"use client";

import { useState, useTransition } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { setThemeAction } from "@/app/actions";
import { PREFS_EVENT, type PrefsDetail, type Theme } from "@/lib/prefs";

type Props = { current: Theme; labels: { group: string; system: string; light: string; dark: string } };

const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

/** Darstellung für Orbit und alle eingebetteten Tools. Orbit wechselt sofort, die Tools direkt danach. */
export function ThemeSwitch({ current, labels }: Props) {
  const [theme, setTheme] = useState<Theme>(current);
  const [, startTransition] = useTransition();

  const choose = (next: Theme) => {
    if (next === theme) return;
    setTheme(next);
    // Orbit selbst sofort umstellen
    document.documentElement.dataset.theme = next;
    startTransition(async () => {
      // Erst speichern, dann den Tools Bescheid geben – sie lesen die Einstellung beim Neuladen aus dem Cookie
      await setThemeAction(next);
      window.dispatchEvent(new CustomEvent<PrefsDetail>(PREFS_EVENT, { detail: { theme: next } }));
    });
  };

  return (
    <div className="theme-switch" role="group" aria-label={labels.group}>
      {(["system", "light", "dark"] as Theme[]).map((t) => {
        const Icon = ICONS[t];
        return (
          <button key={t} type="button" aria-pressed={theme === t} aria-label={labels[t]} title={labels[t]} onClick={() => choose(t)}>
            <Icon size={15} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
