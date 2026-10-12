"use client";

import { usePathname } from "next/navigation";

export function OffertenNav({ items }: { items: { href: string; label: string; short?: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="of-nav" aria-label="Offerten">
      {items.map((item) => {
        const active =
          item.href === "/offerten" ? pathname === "/offerten" || /^\/offerten\/[0-9a-f-]{36}/.test(pathname) : pathname.startsWith(item.href);
        return (
          <a key={item.href} href={item.href} className="of-nav-link" aria-current={active ? "page" : undefined}>
            <span className={item.short ? "of-nav-full" : undefined}>{item.label}</span>
            {item.short && <span className="of-nav-short">{item.short}</span>}
          </a>
        );
      })}
    </nav>
  );
}
