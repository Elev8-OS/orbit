"use client";

import { usePathname } from "next/navigation";

export function AdminNav({ items }: { items: { href: string; label: string; badge?: number }[] }) {
  const pathname = usePathname();
  return (
    <nav className="p-app-nav" aria-label="Administration">
      {items.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <a key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
            {item.label}
            {!!item.badge && <span className="p-count">{item.badge}</span>}
          </a>
        );
      })}
    </nav>
  );
}
