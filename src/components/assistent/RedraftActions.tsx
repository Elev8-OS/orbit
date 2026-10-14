"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, PenLine, Wand2 } from "lucide-react";
import type { Item } from "@/lib/assistant/store";
import "./redraft.css";

const PRESETS = ["shorter", "friendlier", "formal", "personal", "english", "german"] as const;

/**
 * Zwei Knöpfe am Eintrag:
 * - „Umformulieren“: bestehenden Entwurf nach Schnellwahl oder eigener Anweisung neu schreiben
 * - „Antwort schreiben“: Entwurf für eine Mail, die Noah als Info oder übersprungen eingeordnet hat
 */
export function RedraftActions({ item, view }: { item: Item; view: "open" | "info" | "skip" | "done" }) {
  const t = useTranslations("assistentActions");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [done, setDone] = useState<string | null>(null);

  const mode: "rephrase" | "reply" | null = item.draftId && item.status === "open" ? "rephrase" : !item.draftId && view !== "done" ? "reply" : null;
  if (!mode) return null;

  const run = async (text: string) => {
    setState("busy");
    setDone(null);
    const res = await fetch(`/api/assistent/items/${item.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: mode, instruction: text.trim() || undefined })
    }).catch(() => null);
    if (!res?.ok) {
      setState("error");
      return;
    }
    setState("idle");
    setOpen(false);
    setInstruction("");
    setDone(mode === "rephrase" ? t("doneRephrase") : t("doneReply"));
    router.refresh();
  };

  const busy = state === "busy";
  return (
    <>
      <button type="button" className="button-ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open} disabled={busy}>
        {mode === "rephrase" ? <Wand2 size={15} aria-hidden="true" /> : <PenLine size={15} aria-hidden="true" />}
        {mode === "rephrase" ? t("rephrase") : t("reply")}
      </button>
      {(open || busy || done || state === "error") && (
        <div className="p-redraft" role="group" aria-label={mode === "rephrase" ? t("rephrase") : t("reply")}>
          {open && !busy && (
            <>
              <p className="p-redraft-title">{mode === "rephrase" ? t("rephraseTitle") : t("replyTitle")}</p>
              {mode === "rephrase" && (
                <div className="p-redraft-presets">
                  {PRESETS.map((p) => (
                    <button key={p} type="button" className="p-chip" onClick={() => run(t(`presetText.${p}`))}>
                      {t(`presets.${p}`)}
                    </button>
                  ))}
                </div>
              )}
              <div className="p-redraft-own">
                <input
                  className="p-input"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (mode === "reply" || instruction.trim())) run(instruction);
                  }}
                  placeholder={mode === "rephrase" ? t("rephrasePlaceholder") : t("replyPlaceholder")}
                  aria-label={mode === "rephrase" ? t("rephraseTitle") : t("replyTitle")}
                  maxLength={500}
                />
                <button type="button" className="p-button-primary" onClick={() => run(instruction)} disabled={mode === "rephrase" && !instruction.trim()}>
                  {mode === "rephrase" ? t("go") : t("goReply")}
                </button>
                <button type="button" className="p-link" onClick={() => setOpen(false)}>
                  {t("cancel")}
                </button>
              </div>
            </>
          )}
          {busy && (
            <p className="p-muted p-redraft-status" role="status">
              <Loader2 size={15} className="p-spin" aria-hidden="true" /> {t("working")}
            </p>
          )}
          {done && !busy && (
            <p className="p-ok" role="status">
              {done}
            </p>
          )}
          {state === "error" && !busy && <p className="p-error">{t("error")}</p>}
        </div>
      )}
    </>
  );
}
