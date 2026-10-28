"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Loader2, Pencil } from "lucide-react";
import type { Item } from "@/lib/assistant/store";

const STRINGS = {
  de: {
    edit: "Entwurf bearbeiten",
    label: "Antworttext",
    hint: "Der Text wird im Outlook-Entwurf gespeichert. Gesendet wird aus Outlook: „Entwurf öffnen“ und dort senden.",
    save: "Im Entwurf speichern",
    saving: "Speichere …",
    cancel: "Abbrechen",
    loading: "Lade Entwurf …",
    errors: {
      draft_changed: "Der Entwurf wurde in Outlook umgebaut und lässt sich hier nicht sicher bearbeiten. Bitte dort weiterarbeiten oder von Noah neu schreiben lassen.",
      draft_gone: "Der Entwurf ist in Outlook nicht mehr vorhanden (gesendet oder gelöscht).",
      reconnect: "Das Postfach muss neu verbunden werden.",
      failed: "Das hat nicht geklappt. Bitte noch einmal versuchen."
    } as Record<string, string>
  },
  en: {
    edit: "Edit draft",
    label: "Reply text",
    hint: "The text is saved in the Outlook draft. Sending happens in Outlook: “Open draft” and send there.",
    save: "Save in draft",
    saving: "Saving …",
    cancel: "Cancel",
    loading: "Loading draft …",
    errors: {
      draft_changed: "The draft was restructured in Outlook and cannot be edited safely here. Please continue there or have Noah rewrite it.",
      draft_gone: "The draft no longer exists in Outlook (sent or deleted).",
      reconnect: "The mailbox needs to be reconnected.",
      failed: "That did not work. Please try again."
    } as Record<string, string>
  }
};

/** Antworttext eines Entwurfs in Orbit bearbeiten. Speichert in den Outlook-Entwurf, sendet nie. */
export function DraftEditor({ item }: { item: Item }) {
  const s = STRINGS[useLocale() === "en" ? "en" : "de"];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function openEditor() {
    setOpen(true);
    setState("loading");
    setError(null);
    try {
      const res = await fetch(`/api/assistent/items/${item.id}/draft`, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) {
        setError(s.errors[json.error ?? "failed"] ?? s.errors.failed);
        setState("error");
        return;
      }
      setValue(json.text ?? "");
      setState("idle");
    } catch {
      setError(s.errors.failed);
      setState("error");
    }
  }

  async function save() {
    setState("saving");
    setError(null);
    try {
      const res = await fetch(`/api/assistent/items/${item.id}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value })
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(s.errors[json.error ?? "failed"] ?? s.errors.failed);
        setState("error");
        return;
      }
      setOpen(false);
      setState("idle");
      router.refresh();
    } catch {
      setError(s.errors.failed);
      setState("error");
    }
  }

  if (!open) {
    return (
      <button type="button" className="button-secondary" onClick={openEditor}>
        <Pencil size={15} aria-hidden="true" />
        {s.edit}
      </button>
    );
  }

  const loaded = state !== "loading" && !(state === "error" && !value);
  return (
    <div className="p-mail-edit" style={{ flexBasis: "100%", display: "grid", gap: "0.5rem" }}>
      {state === "loading" ? (
        <p className="p-muted">
          <Loader2 size={15} className="p-spin" aria-hidden="true" /> {s.loading}
        </p>
      ) : null}
      {loaded ? (
        <label className="p-field">
          <span>{s.label}</span>
          <textarea rows={12} value={value} onChange={(e) => setValue(e.target.value)} maxLength={20000} />
          <small className="p-muted">{s.hint}</small>
        </label>
      ) : null}
      {error ? (
        <p className="p-error" role="alert">
          {error}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {loaded ? (
          <button type="button" className="p-button-primary" onClick={save} disabled={state === "saving" || !value.trim()}>
            {state === "saving" ? s.saving : s.save}
          </button>
        ) : null}
        <button type="button" className="button-ghost" onClick={() => setOpen(false)} disabled={state === "saving"}>
          {s.cancel}
        </button>
      </div>
    </div>
  );
}
