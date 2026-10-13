"use client";

import { useRouter } from "next/navigation";

export function CancelBroadcast({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="p-link"
      onClick={async () => {
        await fetch(`/api/admin/push?id=${id}`, { method: "DELETE" });
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
