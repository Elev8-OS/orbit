"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/platform/audit";
import { requireGro, TENANT_COOKIE } from "@/lib/gro/access";
import { credsFor, testConnection } from "@/lib/gro/elev8";
import {
  addMember, createTenant, decideOpenItem, listAllTenants, readCodes, removeMember, saveCodes, saveConstant, saveEscalation,
  saveOverlay, saveProcess, saveTemplate, tenantSecrets, updateConnection
} from "@/lib/gro/store";
import { adoptTemplate, loadTemplateLibrary } from "@/lib/gro/seeding";

export type FormState = { ok?: string; error?: string } | null;

const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
const lines = (f: FormData, k: string) =>
  String(f.get(k) ?? "")
    .slice(0, 20_000)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
const fail = (err: unknown): FormState => ({ error: err instanceof Error ? err.message : String(err) });
const who = (u: { id: string; email: string }) => ({ id: u.id, email: u.email });

export async function switchTenantAction(slug: string) {
  const ctx = await requireGro();
  if (!ctx.tenants.some((t) => t.slug === slug)) return;
  (await cookies()).set("gro_tenant", slug, { path: "/gro", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 90 });
  revalidatePath("/gro", "layout");
}

export async function saveProcessAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    const ctx = await requireGro("editor");
    const key = str(f, "key", 20);
    const title = str(f, "title", 200);
    if (!title) return { error: "Titel fehlt" };
    const status = str(f, "status", 20) === "freigegeben" ? "freigegeben" : "entwurf";
    await saveProcess(ctx.tenant.id, key, {
      title,
      grp: str(f, "grp", 20) || "allgemein",
      region: ["CH", "Bali", "alle"].includes(str(f, "region", 10)) ? str(f, "region", 10) : "alle",
      role: str(f, "role", 60) || "GRO",
      trigger: str(f, "trigger", 2000),
      goal: str(f, "goal", 2000),
      steps: lines(f, "steps"),
      rules: lines(f, "rules"),
      escalation: str(f, "escalation", 2000),
      openPoints: lines(f, "open"),
      status,
      owner: str(f, "owner", 100)
    }, ctx.user.email);
    await audit(who(ctx.user), "gro.process.save", `${ctx.tenant.slug}:${key}`);
    revalidatePath("/gro", "layout");
    return { ok: "Gespeichert, neue Version angelegt." };
  } catch (err) {
    return fail(err);
  }
}

export async function saveConstantAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    const ctx = await requireGro("editor");
    const key = str(f, "key", 40).toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const label = str(f, "label", 120);
    if (!key || !label) return { error: "Schlüssel und Bezeichnung sind nötig" };
    const numRaw = str(f, "num", 30).replace(",", ".");
    const num = numRaw === "" ? null : Number(numRaw);
    if (num !== null && !Number.isFinite(num)) return { error: "Zahl ungültig" };
    await saveConstant(ctx.tenant.id, { key, label, value: str(f, "value", 60), num, unit: str(f, "unit", 60), note: str(f, "note", 300) }, ctx.user.email);
    await audit(who(ctx.user), "gro.constant.save", `${ctx.tenant.slug}:${key}`);
    revalidatePath("/gro", "layout");
    return { ok: "Gespeichert. Alle Prozesse zeigen jetzt den neuen Wert." };
  } catch (err) {
    return fail(err);
  }
}

export async function saveTemplateAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    const ctx = await requireGro("editor");
    await saveTemplate(ctx.tenant.id, str(f, "key", 20), String(f.get("body") ?? "").slice(0, 5000));
    await audit(who(ctx.user), "gro.template.save", `${ctx.tenant.slug}:${str(f, "key", 20)}`);
    revalidatePath("/gro/vorlagen");
    return { ok: "Gespeichert." };
  } catch (err) {
    return fail(err);
  }
}

export async function saveEscalationAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    const ctx = await requireGro("editor");
    await saveEscalation(ctx.tenant.id, str(f, "id", 60), str(f, "target", 300));
    revalidatePath("/gro", "layout");
    return { ok: "Gespeichert." };
  } catch (err) {
    return fail(err);
  }
}

export async function decideAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    const ctx = await requireGro("editor");
    const status = str(f, "status", 20) === "entschieden" ? "entschieden" : "offen";
    await decideOpenItem(ctx.tenant.id, str(f, "id", 60), status, str(f, "decision", 2000), ctx.user.email);
    await audit(who(ctx.user), "gro.decision", `${ctx.tenant.slug}:${str(f, "key", 10)}`, { status });
    revalidatePath("/gro", "layout");
    return { ok: status === "entschieden" ? "Entscheid festgehalten." : "Wieder geöffnet." };
  } catch (err) {
    return fail(err);
  }
}

export async function saveOverlayAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    const ctx = await requireGro("editor");
    const listingId = str(f, "listing_id", 80);
    await saveOverlay(ctx.tenant.id, listingId, str(f, "portal", 80), str(f, "notes", 1000), ctx.user.email);
    if (ctx.canSeeCodes && f.has("codes") && String(f.get("codes")).trim() !== "") {
      await saveCodes(ctx.tenant.id, listingId, String(f.get("codes")).slice(0, 500), ctx.user.email);
      await audit(who(ctx.user), "gro.codes.save", `${ctx.tenant.slug}:${listingId}`);
    }
    revalidatePath("/gro/objekte");
    return { ok: "Gespeichert." };
  } catch (err) {
    return fail(err);
  }
}

/** Zeigt die Codes eines Objekts. Nur mit Sichtrecht, jeder Abruf wird protokolliert. */
export async function revealCodesAction(listingId: string): Promise<{ codes: string | null; error?: string }> {
  try {
    const ctx = await requireGro();
    if (!ctx.canSeeCodes) return { codes: null, error: "Dafür hast du kein Sichtrecht" };
    const codes = await readCodes(ctx.tenant.id, listingId);
    await audit(who(ctx.user), "gro.codes.view", `${ctx.tenant.slug}:${listingId}`);
    return { codes };
  } catch (err) {
    return { codes: null, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Verwaltung ───────────────────────────────────────────────────────
export async function createTenantAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    const ctx = await requireGro("admin");
    if (!ctx.platformAdmin) return { error: "Nur Orbit-Admins legen Mandanten an" };
    const slug = str(f, "slug", 40).toLowerCase();
    const name = str(f, "name", 120);
    if (!/^[a-z0-9-]{2,40}$/.test(slug) || !name) return { error: "Kürzel (a-z, 0-9, Bindestrich) und Name sind nötig" };
    await createTenant(slug, name);
    await audit(who(ctx.user), "gro.tenant.create", slug);
    revalidatePath("/gro", "layout");
    return { ok: `Mandant ${name} angelegt. Wechsle oben auf ihn, dann Elev8 verbinden und die Vorlage übernehmen.` };
  } catch (err) {
    return fail(err);
  }
}

export async function loadLibraryAction(): Promise<FormState> {
  try {
    const ctx = await requireGro("admin");
    if (!ctx.platformAdmin) return { error: "Nur Orbit-Admins pflegen die Vorlagen-Bibliothek" };
    await loadTemplateLibrary();
    await audit(who(ctx.user), "gro.library.load", null);
    revalidatePath("/gro", "layout");
    return { ok: "Vorlagen-Bibliothek ist auf dem neuesten Stand." };
  } catch (err) {
    return fail(err);
  }
}

export async function adoptTemplateAction(): Promise<FormState> {
  try {
    const ctx = await requireGro("admin");
    const { added } = await adoptTemplate(ctx.tenant.id);
    await audit(who(ctx.user), "gro.library.adopt", ctx.tenant.slug, { added });
    revalidatePath("/gro", "layout");
    return { ok: added ? `${added} Einträge aus der Vorlage übernommen. Bestehendes blieb unverändert.` : "Nichts zu übernehmen, alles ist schon da." };
  } catch (err) {
    return fail(err);
  }
}

export async function saveConnectionAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    const ctx = await requireGro("admin");
    const url = str(f, "url", 300);
    if (url && !/^https:\/\//.test(url)) return { error: "Die Adresse muss mit https:// beginnen" };
    const tags = str(f, "tags", 300).split(",").map((s) => s.trim()).filter(Boolean);
    const base = Math.max(1, Math.min(20, Number(str(f, "base_guests", 3)) || 2));
    const token = String(f.get("token") ?? "").trim();
    await updateConnection(ctx.tenant.id, url || null, token || null, tags, base);
    await audit(who(ctx.user), "gro.connection.save", ctx.tenant.slug, { tokenChanged: Boolean(token) });
    const fresh = (await listAllTenants()).find((t) => t.id === ctx.tenant.id) ?? ctx.tenant;
    const res = await testConnection(fresh, credsFor(fresh, await tenantSecrets(fresh.id)));
    revalidatePath("/gro", "layout");
    return res.ok ? { ok: `Gespeichert. ${res.text}` } : { error: `Gespeichert, aber die Verbindung klappt nicht: ${res.text}` };
  } catch (err) {
    return fail(err);
  }
}

export async function testConnectionAction(): Promise<FormState> {
  try {
    const ctx = await requireGro("admin");
    const res = await testConnection(ctx.tenant, credsFor(ctx.tenant, await tenantSecrets(ctx.tenant.id)));
    return res.ok ? { ok: res.text } : { error: res.text };
  } catch (err) {
    return fail(err);
  }
}

export async function addMemberAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    const ctx = await requireGro("admin");
    const email = str(f, "email", 200).toLowerCase();
    const role = str(f, "role", 10);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !["viewer", "editor", "admin"].includes(role)) return { error: "E-Mail und Rolle prüfen" };
    await addMember(ctx.tenant.id, email, role, f.get("codes") === "on", ctx.user.email);
    await audit(who(ctx.user), "gro.member.add", `${ctx.tenant.slug}:${email}`, { role });
    revalidatePath("/gro/admin");
    return { ok: `${email} hat Zugriff als ${role}.` };
  } catch (err) {
    return fail(err);
  }
}

export async function removeMemberAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    const ctx = await requireGro("admin");
    const email = str(f, "email", 200).toLowerCase();
    await removeMember(ctx.tenant.id, email);
    await audit(who(ctx.user), "gro.member.remove", `${ctx.tenant.slug}:${email}`);
    revalidatePath("/gro/admin");
    return { ok: "Entfernt." };
  } catch (err) {
    return fail(err);
  }
}

export async function refreshLiveAction() {
  await requireGro();
  revalidatePath("/gro");
}
