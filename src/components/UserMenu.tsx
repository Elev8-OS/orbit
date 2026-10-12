"use client";

import { useEffect, useRef } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { signOutAction } from "@/app/actions";

type Props = {
  name: string | null;
  email: string | null;
  admin: boolean;
  labels: { account: string; signOut: string; admin: string };
};

function initials(name: string | null, email: string | null) {
  const source = (name || email || "?").trim();
  const parts = source.split(/[\s.@_-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function UserMenu({ name, email, admin, labels }: Props) {
  const ref = useRef<HTMLDetailsElement>(null);

  // Menü bei Klick ausserhalb oder Escape schliessen
  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) {
        el.open = false;
        if (e instanceof KeyboardEvent) el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <details className="user-menu" ref={ref}>
      <summary aria-label={labels.account}>
        <span className="avatar">{initials(name, email)}</span>
      </summary>
      <div className="user-menu-panel">
        <p className="user-name">{name ?? email}</p>
        {email && name && <p className="user-email">{email}</p>}
        {admin && (
          <p className="user-admin">
            <ShieldCheck size={16} aria-hidden="true" />
            {labels.admin}
          </p>
        )}
        <form action={signOutAction}>
          <button type="submit" className="menu-action">
            <LogOut size={16} aria-hidden="true" />
            {labels.signOut}
          </button>
        </form>
      </div>
    </details>
  );
}
