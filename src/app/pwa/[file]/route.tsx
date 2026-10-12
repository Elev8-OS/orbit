import { ImageResponse } from "next/og";

/**
 * App-Icons für die installierte Orbit-App (Home-Bildschirm, Taskleiste), aus dem Orbit-Logo erzeugt.
 * /pwa/icon-192.png, /pwa/icon-512.png, /pwa/maskable-512.png (mit Schutzrand für Android), /pwa/apple-180.png
 */
const SIZES: Record<string, { size: number; maskable: boolean; rounded: boolean }> = {
  "icon-192.png": { size: 192, maskable: false, rounded: true },
  "icon-512.png": { size: 512, maskable: false, rounded: true },
  "maskable-512.png": { size: 512, maskable: true, rounded: false },
  "apple-180.png": { size: 180, maskable: false, rounded: false }
};

function logo(withBackground: boolean, rounded: boolean) {
  const bg = withBackground ? `<rect width="64" height="64" ${rounded ? 'rx="16"' : ""} fill="#000"/>` : "";
  return `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${bg}<circle cx="32" cy="32" r="11" fill="#F6BB12"/><ellipse cx="32" cy="32" rx="24" ry="9" fill="none" stroke="#fff" stroke-width="3" transform="rotate(-24 32 32)"/><circle cx="51" cy="22" r="4" fill="#fff"/></svg>`
  ).toString("base64")}`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const spec = SIZES[(await params).file];
  if (!spec) return new Response("Not found", { status: 404 });
  const { size, maskable, rounded } = spec;
  const inner = maskable ? Math.round(size * 0.72) : size;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: maskable || !rounded ? "#000" : "transparent" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo(!maskable, rounded)} width={inner} height={inner} alt="" />
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } }
  );
}
