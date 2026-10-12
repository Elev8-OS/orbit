"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** „Als App installieren“: erscheint nur, wenn der Browser Orbit installieren kann (Chrome, Edge, Android). */
export function InstallButton({ label }: { label: string }) {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  if (!event) return null;
  return (
    <button
      type="button"
      className="menu-action"
      onClick={async () => {
        await event.prompt();
        await event.userChoice.catch(() => null);
        setEvent(null);
      }}
    >
      <Download size={16} aria-hidden="true" />
      {label}
    </button>
  );
}
