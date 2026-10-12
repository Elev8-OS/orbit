"use client";

import { usePathname } from "next/navigation";
import { CalendarCheck, Columns3 } from "lucide-react";

const ICONS = { today: CalendarCheck, pipeline: Columns3 } as const;

/** Seitenleisten-Navigation von Sales (Elev8 Design System, wie ERT und Revenue Desk). */
export function SalesNav({
  group,
  items
}: {
  group: string;
  items: { href: string; label: string; icon: keyof typeof ICONS }[];
}) {
  const pathname = usePathname();
  return (
    <nav className="sl-side-nav" aria-label={group}>
      <div className="sl-side-label">{group}</div>
      {items.map((item) => {
        const active = item.href === "/sales" ? pathname === "/sales" : pathname.startsWith(item.href);
        const Icon = ICONS[item.icon];
        return (
          <a key={item.href} href={item.href} className="sl-side-link" aria-current={active ? "page" : undefined}>
            <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
