"use client";

import { usePathname } from "next/navigation";
import { Activity, AppWindow, Bell, KeyRound, LayoutDashboard, ScrollText, Users, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  requests: KeyRound,
  users: Users,
  apps: AppWindow,
  status: Activity,
  push: Bell,
  audit: ScrollText
};

/** Seitenleisten-Navigation der Administration (Elev8 Design System, wie Sales, ERT und Revenue Desk). */
export function AdminNav({ group, items }: { group: string; items: { href: string; label: string; icon: keyof typeof ICONS; badge?: number }[] }) {
  const pathname = usePathname();
  return (
    <nav className="ad-side-nav" aria-label={group}>
      <div className="ad-side-label">{group}</div>
      {items.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        const Icon = ICONS[item.icon];
        return (
          <a key={item.href} href={item.href} className="ad-side-link" aria-current={active ? "page" : undefined}>
            <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
            {item.label}
            {!!item.badge && <span className="p-count">{item.badge}</span>}
          </a>
        );
      })}
    </nav>
  );
}
