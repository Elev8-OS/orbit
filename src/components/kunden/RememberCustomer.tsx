"use client";

import { useEffect } from "react";
import { RECENT_KEY, type Recent } from "./CustomerSearch";

/** Merkt sich die zuletzt geöffneten Kunden (nur in diesem Browser) für die Kundensuche. */
export function RememberCustomer({ id, name, company }: Recent) {
  useEffect(() => {
    try {
      const list = (JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as Recent[]).filter((r) => r.id !== id);
      localStorage.setItem(RECENT_KEY, JSON.stringify([{ id, name, company }, ...list].slice(0, 8)));
    } catch {
      /* ignorieren */
    }
  }, [id, name, company]);
  return null;
}
