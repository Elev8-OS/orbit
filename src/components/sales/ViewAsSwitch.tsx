"use client";

import { useTranslations } from "next-intl";

/** Nur für Manager: Ansicht eines anderen Sales-Mitarbeiters öffnen. Gilt für alle Seiten, bis zurückgestellt. */
export function ViewAsSwitch({
  users,
  current,
  own,
  ownEmails
}: {
  users: { id: string; name: string }[];
  current: string;
  own: string;
  ownEmails: Record<string, string>;
}) {
  const t = useTranslations("sales");
  const change = (id: string) => {
    const mine = ownEmails[id] === own;
    document.cookie = mine
      ? "SALES_VIEW_AS=; Path=/; Max-Age=0; SameSite=Lax; Secure"
      : `SALES_VIEW_AS=${encodeURIComponent(id)}; Path=/; Max-Age=28800; SameSite=Lax; Secure`;
    window.location.reload();
  };
  return (
    <label className="sl-viewas">
      <span className="sl-sr">{t("viewAs")}</span>
      <select value={current} onChange={(e) => change(e.target.value)}>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {ownEmails[u.id] === own ? t("viewAsMe", { name: u.name }) : u.name}
          </option>
        ))}
      </select>
    </label>
  );
}
