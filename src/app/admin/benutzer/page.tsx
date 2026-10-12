import { getLocale, getTranslations } from "next-intl/server";
import { listUsers } from "@/lib/platform/directory";
import { listAssignments, listRoles, roleManagementEnabled, type Assignment, type EntraRole } from "@/lib/platform/entra";
import { RoleEditor } from "@/components/admin/RoleEditor";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const t = await getTranslations("platform.admin.users");
  const locale = (await getLocale()) === "en" ? "en" : "de";
  const users = await listUsers();
  const graph = roleManagementEnabled();
  let roles: EntraRole[] = [];
  let assignments: Assignment[] = [];
  let graphError: string | null = null;
  if (graph) {
    try {
      [roles, assignments] = await Promise.all([listRoles(), listAssignments()]);
    } catch (err) {
      graphError = err instanceof Error ? err.message : "Graph";
    }
  }
  const fmt = (iso: string) => new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" }).format(new Date(iso));
  const groups = assignments.filter((a) => a.principalType === "Group");
  return (
    <div className="p-page">
      <h1 className="p-page-title">{t("title")}</h1>
      <p className="p-page-lead">{graph ? t("leadGraph") : t("leadManual")}</p>
      {graphError && <p className="p-error">{t("graphError", { error: graphError })}</p>}
      {groups.length > 0 && (
        <section className="p-card">
          <h2 className="p-card-title">{t("groups")}</h2>
          <ul className="p-rows">
            {groups.map((g) => (
              <li key={g.id}>
                <span className="p-row-main">
                  <span className="p-row-title">{g.principalName}</span>
                </span>
                <span className="p-tag">{g.role}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="p-card">
        <h2 className="p-card-title">
          {t("people")} <span className="p-count">{users.length}</span>
        </h2>
        <div className="p-table-wrap">
          <table className="p-table">
            <thead>
              <tr>
                <th>{t("cols.person")}</th>
                <th>{t("cols.roles")}</th>
                <th>{t("cols.lastSeen")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="p-row-title">{u.name || u.email}</span>
                    <br />
                    <span className="p-muted">{u.email}</span>
                  </td>
                  <td>
                    {graph && !graphError ? (
                      <RoleEditor
                        userId={u.id}
                        assignments={assignments.filter((a) => a.principalId === u.id).map((a) => ({ id: a.id, role: a.role }))}
                        roles={roles.map((r) => r.value)}
                      />
                    ) : (
                      <div className="p-tags">
                        {u.roles.length ? u.roles.map((r) => <span key={r} className="p-tag">{r}</span>) : <span className="p-muted">–</span>}
                      </div>
                    )}
                  </td>
                  <td className="p-num">{fmt(u.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="p-muted">{t("hint")}</p>
      </section>
    </div>
  );
}
