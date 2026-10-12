import type { MetadataRoute } from "next";

/** Orbit als installierbare App (PWA): Home-Bildschirm auf dem Handy, eigenes Fenster am Computer. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Elev8 Orbit",
    short_name: "Orbit",
    description: "Alle Elev8-Tools an einem Ort, mit einem Microsoft-Login.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#000000",
    theme_color: "#000000",
    lang: "de",
    categories: ["business", "productivity"],
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ],
    shortcuts: [
      { name: "Suche und Noah", short_name: "Suche", url: "/?palette=1", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "E-Mail-Assistent", short_name: "Assistent", url: "/?app=assistent", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Kunden", short_name: "Kunden", url: "/?app=kunden", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] }
    ]
  };
}
