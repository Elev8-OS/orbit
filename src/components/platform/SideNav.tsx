"use client";

import { usePathname } from "next/navigation";
import { CalendarCheck, Columns3, FileText, Settings, type LucideIcon } from "lucide-react";
import "./side-nav.css";

/** Icons der Seitenleiste; neue Module ergänzen hier ihre Einträge. */
const ICONS: Record<string, LucideIcon> = {
  today: CalendarCheck,
  pipeline: Columns3,
  offers: FileText,
  settings: Settings
};

export type SideNavItem = { href: string; label: string; icon: keyof typeof ICONS | string };

/**
 * Gemeinsame Seitenleisten-Navigation für Orbits eigene Module (Elev8 Design System, wie ERT und
 * Revenue Desk). Aktiv ist der Eintrag, dessen Adresse am besten passt; Unterseiten (z. B. eine
 * einzelne Offerte) zählen zum ersten Eintrag, wenn kein anderer passt.
 */
export function SideNav({ group, items }: { group: string; items: SideNavItem[] }) {
  const pathname = usePathname();
  const match = items
    .slice(1)
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const active = match?.href ?? items[0]?.href;
  return (
    <nav className="ap-side-nav" aria-label={group}>
      <div className="ap-side-label">{group}</div>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        return (
          <a key={item.href} href={item.href} className="ap-side-link" aria-current={item.href === active ? "page" : undefined}>
            {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden="true" />}
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
