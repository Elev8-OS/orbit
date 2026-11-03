"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import "./tip.css";

/**
 * Kleines (i) mit Erklärtext. Am Rechner erscheint der Text beim Darüberfahren oder Fokussieren,
 * am Handy beim Antippen. Ein Klick hält ihn offen, Esc, ein Tipp daneben oder Scrollen schliesst ihn.
 * Der Text steht fix am Bildschirm, damit ihn Tabellen mit seitlichem Scrollen nicht abschneiden.
 */
export function Tip({ text, label = "Info" }: { text: string; label?: string }) {
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPinned(false);
    setPos(null);
  }, []);

  const place = useCallback(() => {
    const b = btn.current?.getBoundingClientRect();
    if (!b) return;
    const width = Math.min(288, window.innerWidth - 16);
    const left = Math.max(8, Math.min(b.left + b.width / 2 - width / 2, window.innerWidth - width - 8));
    const h = box.current?.offsetHeight ?? 0;
    const below = b.bottom + 8;
    const above = b.top - 8 - h;
    // unterhalb, ausser dort ist kein Platz und oberhalb schon
    setPos({ top: below + h > window.innerHeight - 8 && above > 8 ? above : below, left, width });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place, text]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onDown = (e: Event) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !box.current?.contains(t)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  return (
    <span className="tip">
      <button
        ref={btn}
        type="button"
        className="tip-btn"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setOpen(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse" && !pinned) close();
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (!pinned) close();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open && pinned) close();
          else {
            setOpen(true);
            setPinned(true);
          }
        }}
      >
        i
      </button>
      {open ? (
        <span id={id} ref={box} role="tooltip" className="tip-box" style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { top: 0, left: 0, visibility: "hidden" }}>
          {text}
        </span>
      ) : null}
    </span>
  );
}
