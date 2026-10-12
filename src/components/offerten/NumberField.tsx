"use client";

import { useEffect, useState } from "react";

/**
 * Zahleneingabe, die Zwischenstände wie "" oder "12." erlaubt und Komma wie Punkt akzeptiert.
 * Gibt erst gültige Zahlen nach aussen.
 */
export function NumberField({
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  className,
  ariaLabel
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text.replace(",", ".")) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      className={className}
      aria-label={ariaLabel}
      inputMode={step === 1 ? "numeric" : "decimal"}
      value={text}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.,-]/g, "");
        setText(raw);
        const n = Number(raw.replace(",", "."));
        if (raw.trim() !== "" && Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)) onChange(n);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}
