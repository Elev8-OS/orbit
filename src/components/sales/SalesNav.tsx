"use client";

import { usePathname } from "next/navigation";

export function SalesNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="sl-nav" aria-label="Sales">
      {items.map((item) => {
        const active = item.href === "/sales" ? pathname === "/sales" : pathname.startsWith(item.href);
        return (
          <a key={item.href} href={item.href} className="sl-nav-link" aria-current={active ? "page" : undefined}>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
