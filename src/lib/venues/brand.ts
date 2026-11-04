// Absender und Marke der Nachrichten an die Betriebe: das ist der Betreiber (Tenant), nicht die Software.
// Aus Umgebungsvariablen, bis Orbit einen eigenen Tenant-Datensatz hat:
//   TENANT_BRAND_NAME   Name des Betreibers, zum Beispiel "The R Villas Bali"
//   TENANT_LOGO_URL     Adresse des Logos (PNG, SVG oder JPG), öffentlich erreichbar
//   TENANT_INSTAGRAM    Instagram-Name des Betreibers, mit oder ohne @
//   TENANT_SENDER_NAME  Vorname, der in der Nachricht unterschreibt

export type Brand = { name: string; logoUrl: string; instagram: string; sender: string };

export function tenantBrand(): Brand {
  return {
    name: process.env.TENANT_BRAND_NAME?.trim() || "The R Villas Bali",
    logoUrl: process.env.TENANT_LOGO_URL?.trim() || "",
    instagram: (process.env.TENANT_INSTAGRAM ?? "").trim().replace(/^@/, ""),
    sender: process.env.TENANT_SENDER_NAME?.trim() || "Reto"
  };
}
