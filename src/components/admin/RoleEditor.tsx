"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";

/** Rollen einer Person direkt in Entra vergeben oder entziehen. */
export function RoleEditor({ userId, assignments, roles }: { userId: string; assignments: { id: string; role: string }[]; roles: string[] }) {
  const t = useTranslations("platform.admin.users");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = roles.filter((r) => !assignments.some((a) => a.role === r));
  const [pick, setPick] = useState("");

  const call = async (init: RequestInit, url = "/api/admin/roles") => {
    setBusy(true);
    setError(null);
    const res = await fetch(url, init);
    const json = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    setBusy(false);
    if (!res.ok) setError(json.error === "self_admin" ? t("selfAdmin") : json.detail || json.error || "Fehler");
    else router.refresh();
  };

  return (
    <div className="p-role-editor">
      <div className="p-tags">
        {assignments.map((a) => (
          <span key={a.id} className="p-tag">
            {a.role}
            <button
              type="button"
              className="p-tag-remove"
              aria-label={t("remove", { role: a.role })}
              disabled={busy}
              onClick={() => window.confirm(t("confirmRemove", { role: a.role })) && call({ method: "DELETE" }, `/api/admin/roles?assignment=${encodeURIComponent(a.id)}`)}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
      {missing.length > 0 && (
        <div className="p-role-add">
          <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={t("add")}>
            <option value="">{t("add")}</option>
            {missing.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="button-ghost"
            disabled={!pick || busy}
            onClick={() => call({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, role: pick }) })}
            aria-label={t("add")}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
      )}
      {error && <p className="p-error">{error}</p>}
    </div>
  );
}
