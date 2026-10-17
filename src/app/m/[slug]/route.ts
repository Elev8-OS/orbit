import { getEventBySlug } from "@/lib/messen/store";
import { renderLanding } from "@/lib/messen/landing";

export const dynamic = "force-dynamic";

/**
 * Öffentliche Gewinnspiel-Seite einer Messe: /m/<slug>
 * Kein Login (siehe middleware.ts). Unveröffentlichte Messen sind nur mit ?vorschau=1 erreichbar;
 * das Formular lässt sich dann durchklicken, gespeichert wird aber nichts (der Server antwortet 410).
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = /^[a-z0-9-]{2,60}$/.test(slug) ? await getEventBySlug(slug) : null;
  const preview = new URL(req.url).searchParams.get("vorschau") === "1";
  if (!event || (!event.active && !preview)) {
    return new Response(notFound(), { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  return new Response(renderLanding(event, { preview: !event.active }), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex"
    }
  });
}

function notFound(): string {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Elev8</title><meta name="robots" content="noindex">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;background:#fff;color:#000;padding:1.5rem}
@media (prefers-color-scheme:dark){body{background:#000;color:#fff}}a{color:inherit}h1{font-size:1.5rem;margin:0 0 .5rem}</style></head>
<body><main><h1>Dieses Gewinnspiel gibt es nicht mehr.</h1><p>Schau auf <a href="https://elev8-suite.com">elev8-suite.com</a> vorbei.</p></main></body></html>`;
}
