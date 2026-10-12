"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";

export function RequestActions({ id, roles, graph }: { id: number; roles: string[]; graph: boolean }) {
  const t = useTranslations("platform.admin.requests");
  const router = useRouter();
  const [role, setRole] = useState(roles[0] ?? "");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [detail, setDetail] = useState("");

  const decide = async (action: "approve" | "reject") => {
    setState("busy");
    const res = await fetch(`/api/admin/requests/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, role: role || undefined, note: note || undefined })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    if (!res.ok) {
      setState("error");
      setDetail(json.detail || json.error || "");
      return;
    }
    router.refresh();
  };

  return (
    <div className="p-request-actions">
      {roles.length > 1 && (
        <label className="p-field p-field-inline">
          <span>{t("role")}</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      )}
      {roles.length === 1 && <span className="p-tag">{roles[0]}</span>}
      <input className="p-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("note")} aria-label={t("note")} maxLength={500} />
      <button type="button" className="p-button-primary" onClick={() => decide("approve")} disabled={state === "busy"}>
        <Check size={15} aria-hidden="true" />
        {graph ? t("approveAssign") : t("approve")}
      </button>
      <button type="button" className="button-ghost" onClick={() => decide("reject")} disabled={state === "busy"}>
        <X size={15} aria-hidden="true" />
        {t("reject")}
      </button>
      {state === "error" && <p className="p-error">{t("error", { detail })}</p>}
    </div>
  );
}
