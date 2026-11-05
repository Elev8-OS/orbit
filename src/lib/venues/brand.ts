import { engine } from "@/lib/sm-manager/client";

// Absender und Marke der Nachrichten an die Betriebe: das ist der Betreiber (Tenant), nicht die Software.
//
// Zwei Quellen, in dieser Reihenfolge:
//   1. Umgebungsvariablen (ausdrücklich gesetzt, gewinnen immer)
//        TENANT_BRAND_NAME   Name der Marke, zum Beispiel "The R Villas Bali"
//        TENANT_LOGO_URL     Adresse des Logos (PNG, SVG oder JPG), öffentlich erreichbar
//        TENANT_INSTAGRAM    Instagram-Name, mit oder ohne @
//        TENANT_SENDER_NAME  Vorname, der in der Nachricht unterschreibt
//   2. Elev8 (über die Engine, Route /brand): Instagram, Webseite, WhatsApp und Logo der Villen. Nur öffentliche Angaben.
//
// Der Markenname kommt bewusst nicht aus Elev8: das Kundenprofil dort ist die Betreiberfirma, Gäste und Betriebe kennen die Marke.

export type Brand = { name: string; logoUrl: string; instagram: string; sender: string; website: string; whatsapp: string };

/** Nur die Einstellungen aus den Umgebungsvariablen, ohne Netzwerk. */
export function tenantBrand(): Brand {
  return {
    name: process.env.TENANT_BRAND_NAME?.trim() || "The R Villas Bali",
    logoUrl: process.env.TENANT_LOGO_URL?.trim() || "",
    instagram: (process.env.TENANT_INSTAGRAM ?? "").trim().replace(/^@/, ""),
    sender: process.env.TENANT_SENDER_NAME?.trim() || "Reto",
    website: "",
    whatsapp: ""
  };
}

type Remote = { instagram?: string; website?: string; whatsapp?: string; logoUrl?: string };

const OK_TTL = 60 * 60 * 1000; // eine Stunde; die Engine merkt sich die Antwort ausserdem sechs Stunden
const FAIL_TTL = 5 * 60 * 1000; // nach einem Fehler nicht bei jedem Seitenaufruf neu versuchen
let cache: { at: number; ttl: number; data: Remote } | null = null;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

/** Öffentliche Angaben aus Elev8. Bei jedem Fehler leer (oder die letzte gute Antwort), nie ein Fehler für die Seite. */
async function remote(): Promise<Remote> {
  if (cache && Date.now() - cache.at < cache.ttl) return cache.data;
  try {
    const data = await withTimeout(engine<Remote>("/brand"), 4000);
    cache = { at: Date.now(), ttl: OK_TTL, data };
    return data;
  } catch {
    const last = cache?.data ?? {};
    cache = { at: Date.now(), ttl: FAIL_TTL, data: last };
    return last;
  }
}

/** Marke für Seiten, Link-Vorschau und Nachrichten: Umgebungsvariablen zuerst, dann Elev8. */
export async function resolveBrand(): Promise<Brand> {
  const base = tenantBrand();
  const r = await remote();
  return {
    ...base,
    logoUrl: base.logoUrl || r.logoUrl || "",
    instagram: base.instagram || r.instagram || "",
    website: r.website || "",
    whatsapp: r.whatsapp || ""
  };
}
