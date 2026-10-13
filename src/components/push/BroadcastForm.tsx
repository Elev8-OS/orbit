"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Send } from "lucide-react";
import "./push.css";

type Person = { id: string; name: string };
type App = { id: string; name: string };
type Audience = { type: "all" } | { type: "roles"; roles: string[] } | { type: "users"; ids: string[] };

/** Mitteilung an alle, an Rollen oder an Personen; sofort oder geplant. */
export function BroadcastForm({ roles, people, apps }: { roles: string[]; people: Person[]; apps: App[] }) {
  const t = useTranslations("push.admin");
  const router = useRouter();
  const [mode, setMode] = useState<Audience["type"]>("all");
  const [pickedRoles, setPickedRoles] = useState<string[]>([]);
  const [pickedPeople, setPickedPeople] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [app, setApp] = useState("");
  const [path, setPath] = useState("");
  const [later, setLater] = useState(false);
  const [when, setWhen] = useState("");
  const [reach, setReach] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "busy">("idle");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const audience: Audience = mode === "all" ? { type: "all" } : mode === "roles" ? { type: "roles", roles: pickedRoles } : { type: "users", ids: pickedPeople };
  const audienceValid = mode === "all" || (mode === "roles" ? pickedRoles.length > 0 : pickedPeople.length > 0);

  useEffect(() => {
    if (!audienceValid) return setReach(0);
    const ctrl = new AbortController();
    fetch("/api/admin/push", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audience }), signal: ctrl.signal })
      .then((r) => r.json())
      .then((j: { users?: number }) => setReach(j.users ?? 0))
      .catch(() => {});
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pickedRoles.join(","), pickedPeople.join(",")]);

  const url = app ? `/?${new URLSearchParams({ app, ...(path.trim().startsWith("/") ? { path: path.trim() } : {}) })}` : undefined;

  const submit = async () => {
    setState("busy");
    setMsg(null);
    const res = await fetch("/api/admin/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, url, audience, ...(later && when ? { scheduledAt: new Date(when).toISOString() } : {}) })
    }).catch(() => null);
    const json = res ? ((await res.json().catch(() => ({}))) as { sent?: boolean; result?: { users: number; devices: number; delivered: number }; scheduledAt?: string; error?: string; limit?: number }) : {};
    setState("idle");
    if (!res?.ok) {
      setMsg({ text: json.error === "rate_limited" ? t("rateLimited", { limit: json.limit ?? 5 }) : t("error"), error: true });
      return;
    }
    setMsg({
      text: json.sent
        ? t("sent", { delivered: json.result?.delivered ?? 0, devices: json.result?.devices ?? 0, users: json.result?.users ?? 0 })
        : t("scheduled", { time: new Date(json.scheduledAt ?? when).toLocaleString() })
    });
    setTitle("");
    setBody("");
    router.refresh();
  };

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <section className="p-card p-push-compose" aria-label={t("title")}>
      <div className="p-field">
        <span>{t("audience")}</span>
        <div className="p-push-segment" role="group" aria-label={t("audience")}>
          {(["all", "roles", "users"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m === "all" ? t("all") : m === "roles" ? t("roles") : t("people")}
            </button>
          ))}
        </div>
      </div>
      {mode === "roles" && (
        <div className="p-push-picks" aria-label={t("pickRoles")}>
          {roles.map((r) => (
            <label key={r}>
              <input type="checkbox" checked={pickedRoles.includes(r)} onChange={() => toggle(pickedRoles, setPickedRoles, r)} />
              {r}
            </label>
          ))}
        </div>
      )}
      {mode === "users" && (
        <div className="p-push-picks" aria-label={t("pickPeople")}>
          {people.map((p) => (
            <label key={p.id}>
              <input type="checkbox" checked={pickedPeople.includes(p.id)} onChange={() => toggle(pickedPeople, setPickedPeople, p.id)} />
              {p.name}
            </label>
          ))}
        </div>
      )}
      {reach !== null && <p className="p-muted">{t("reach", { count: reach })}</p>}

      <label className="p-field">
        <span>{t("messageTitle")}</span>
        <input className="p-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
      </label>
      <label className="p-field">
        <span>{t("body")}</span>
        <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={300} />
      </label>
      <div className="p-field">
        <span>{t("target")}</span>
        <select className="p-input" value={app} onChange={(e) => setApp(e.target.value)}>
          <option value="">{t("targetHome")}</option>
          {apps.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {app && <input className="p-input" value={path} onChange={(e) => setPath(e.target.value)} placeholder={t("path")} aria-label={t("path")} maxLength={300} />}
      </div>
      <div className="p-field">
        <span>{t("when")}</span>
        <div className="p-push-segment" role="group" aria-label={t("when")}>
          <button type="button" aria-pressed={!later} onClick={() => setLater(false)}>
            {t("now")}
          </button>
          <button type="button" aria-pressed={later} onClick={() => setLater(true)}>
            {t("later")}
          </button>
        </div>
        {later && <input className="p-input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />}
      </div>

      {(title || body) && (
        <div className="p-push-preview" aria-hidden="true">
          <strong>{title || "…"}</strong>
          <span>{body || "…"}</span>
        </div>
      )}
      <div className="p-form-actions">
        <button type="button" className="p-button-primary" onClick={submit} disabled={state === "busy" || !title.trim() || !body.trim() || !audienceValid || (later && !when)}>
          {state === "busy" ? <Loader2 size={15} className="p-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
          {state === "busy" ? t("sending") : later ? t("schedule") : t("send")}
        </button>
        {msg && <span className={msg.error ? "p-error" : "p-ok"}>{msg.text}</span>}
      </div>
    </section>
  );
}
