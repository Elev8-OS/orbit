/**
 * Gemeinsame Einstellungen für Orbit und alle eingebetteten Tools: Sprache und Darstellung.
 * Liegen als Cookies auf der Hauptdomain, damit jedes Tool sie lesen kann. Nicht geheim,
 * deshalb ohne HttpOnly – so können Tools sie auch im Browser lesen.
 */
export const SHARED_LOCALE_COOKIE = "orbit_locale";
export const THEME_COOKIE = "orbit_theme";
export const themes = ["system", "light", "dark"] as const;
export type Theme = (typeof themes)[number];

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (themes as readonly string[]).includes(value);
}

/** Nachricht an eingebettete Tools, wenn sich Sprache oder Darstellung ändert. */
export const PREFS_EVENT = "orbit:prefs-changed";
export type PrefsDetail = { locale?: string; theme?: Theme };
