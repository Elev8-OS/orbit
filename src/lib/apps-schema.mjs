// Gemeinsames Schema für config/apps.yaml.
// Wird von der App (TypeScript) und von scripts/check-apps.mjs (Build-Prüfung) genutzt.
import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Farbe als #RRGGBB angeben");
const localized = z.object({
  de: z.string().min(1),
  en: z.string().min(1)
});

export const categorySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id nur aus a-z, 0-9 und -"),
  name: localized,
  color: hex
});

export const appSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id nur aus a-z, 0-9 und -").max(64),
  name: localized,
  description: localized,
  url: z.string().url(),
  // Lucide-Icon-Name (PascalCase, z.B. "TrendingUp") oder Pfad zu einer Datei in /public (z.B. "/icons/pricing.svg")
  icon: z.string().min(1),
  category: z.string(),
  // Mindestens eine Entra App Role. "*" = alle angemeldeten User (inkl. Gäste!)
  roles: z.array(z.string().min(1)).min(1),
  openIn: z.enum(["newTab", "sameTab"]).default("newTab"),
  // Überschreibt die Kategoriefarbe (optional)
  color: hex.optional(),
  // false = Kachel ausblenden, ohne den Eintrag zu löschen
  enabled: z.boolean().default(true),
  // Wer diese App über "Zugriff anfragen" anfragen darf (App Roles, "*" = alle angemeldeten User).
  // Leer = App taucht in der Anfrageliste nicht auf, ihr Name bleibt für andere unsichtbar.
  requestableBy: z.array(z.string().min(1)).default([])
});

export const appsConfigSchema = z
  .object({
    categories: z.array(categorySchema).min(1),
    apps: z.array(appSchema)
  })
  .superRefine((cfg, ctx) => {
    const categoryIds = new Set();
    cfg.categories.forEach((c, i) => {
      if (categoryIds.has(c.id)) {
        ctx.addIssue({ code: "custom", path: ["categories", i, "id"], message: `Doppelte Kategorie-id "${c.id}"` });
      }
      categoryIds.add(c.id);
    });
    const appIds = new Set();
    cfg.apps.forEach((a, i) => {
      if (appIds.has(a.id)) {
        ctx.addIssue({ code: "custom", path: ["apps", i, "id"], message: `Doppelte App-id "${a.id}"` });
      }
      appIds.add(a.id);
      if (!categoryIds.has(a.category)) {
        ctx.addIssue({ code: "custom", path: ["apps", i, "category"], message: `Unbekannte Kategorie "${a.category}"` });
      }
    });
  });
