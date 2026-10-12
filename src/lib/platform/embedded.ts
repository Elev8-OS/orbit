import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Orbits eigene Apps (Kunden, Assistent) laufen als Tab in Orbit.
 * Direkt im Browser geöffnet, geht es zur Startseite, die die App als Tab an derselben Stelle öffnet.
 */
export async function ensureEmbedded(appId: string, path: string) {
  const dest = (await headers()).get("sec-fetch-dest");
  if (dest === "document") redirect(`/?app=${encodeURIComponent(appId)}&path=${encodeURIComponent(path)}`);
}

export async function isEmbedded(): Promise<boolean> {
  return (await headers()).get("sec-fetch-dest") === "iframe";
}
