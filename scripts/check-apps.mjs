// Prüft config/apps.yaml vor dem Build. Ein Fehler hier bricht das Deployment ab,
// statt dass Orbit mit kaputter Konfiguration startet.
import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { appsConfigSchema } from "../src/lib/apps-schema.mjs";

const file = path.join(process.cwd(), process.env.APPS_CONFIG_PATH ?? "config/apps.yaml");
const result = appsConfigSchema.safeParse(YAML.parse(await fs.readFile(file, "utf8")));

if (!result.success) {
  console.error(`Fehler in ${path.relative(process.cwd(), file)}:`);
  for (const issue of result.error.issues) console.error(`  • ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}
const { apps, categories } = result.data;
console.log(`apps.yaml ok – ${apps.length} Apps in ${categories.length} Kategorien.`);
