import { ImageResponse } from "next/og";
import { tenantBrand } from "@/lib/venues/brand";
import { getVenueByToken } from "@/lib/venues/store";

// Vorschaubild des Links (WhatsApp, Instagram, Slack …): pro Betrieb, vom Betreiber, ohne Elev8-Marke.
// Öffentlich wie die Seite selbst (Pfad /contribute/ ist von der Anmeldung ausgenommen).
export const alt = "A free feature on our Instagram";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Logo einmal holen und einbetten; schlägt das fehl, steht stattdessen der Name da. */
async function logoData(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 1_500_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function nameSize(name: string): number {
  const n = name.length;
  return n <= 14 ? 112 : n <= 22 ? 92 : n <= 32 ? 74 : 60;
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const venue = await getVenueByToken(token).catch(() => null);
  const brand = tenantBrand();
  const logo = await logoData(brand.logoUrl);
  const headline = venue ? venue.spotName : "Your photos on our Instagram";
  const points = ["Free feature on our Instagram", "Tagged to you", "Takes 2 minutes"];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f2f0ec", padding: "54px 72px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} width={280} height={84} style={{ objectFit: "contain", objectPosition: "left center" }} alt="" />
          ) : (
            <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: "#111111" }}>{brand.name}</div>
          )}
          <div style={{ display: "flex", fontSize: 30, color: "#6b6b6b" }}>{brand.instagram ? `@${brand.instagram}` : ""}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "#9a7400", letterSpacing: 3 }}>WE’D LOVE TO FEATURE</div>
          <div style={{ display: "flex", fontSize: nameSize(headline), fontWeight: 700, color: "#111111", lineHeight: 1.05, marginTop: 14 }}>{headline}</div>
        </div>

        <div style={{ display: "flex" }}>
          {points.map((p) => (
            <div key={p} style={{ display: "flex", padding: "14px 26px", marginRight: 16, borderRadius: 999, background: "#f4b400", color: "#111111", fontSize: 30, fontWeight: 700 }}>
              {p}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
