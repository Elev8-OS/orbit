"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCw } from "lucide-react";

export function RunChecksButton() {
  const t = useTranslations("platform.admin.status");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="p-button-primary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/admin/status", { method: "POST" }).catch(() => null);
        setBusy(false);
        router.refresh();
      }}
    >
      {busy ? <Loader2 size={15} className="p-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
      {busy ? t("checking") : t("checkNow")}
    </button>
  );
}
