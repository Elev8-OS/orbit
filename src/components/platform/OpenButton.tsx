"use client";

import { ArrowUpRight } from "lucide-react";
import { useOpenTarget, type Target } from "./target";

/** Öffnet eine andere App (als Tab in Orbit) an der passenden Stelle. */
export function OpenButton({ label, target, variant = "button" }: { label: string; target: Target; variant?: "button" | "link" }) {
  const open = useOpenTarget();
  return (
    <button type="button" className={variant === "link" ? "p-link" : "button-secondary"} onClick={() => open(target)}>
      {label}
      <ArrowUpRight size={14} aria-hidden="true" />
    </button>
  );
}
