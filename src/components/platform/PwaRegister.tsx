"use client";

import { useEffect } from "react";

/** Registriert den Service Worker (nur in Produktion), damit Orbit installiert werden kann. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => console.warn("Service Worker nicht registriert:", err));
  }, []);
  return null;
}
