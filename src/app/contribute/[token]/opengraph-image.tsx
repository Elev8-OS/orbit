import { ImageResponse } from "next/og";
import { resolveBrand } from "@/lib/venues/brand";
import { getVenueByToken } from "@/lib/venues/store";

// Vorschaubild des Links (WhatsApp, Instagram, Slack …): pro Betrieb, vom Betreiber, ohne Elev8-Marke.
// Öffentlich wie die Seite selbst (Pfad /contribute/ ist von der Anmeldung ausgenommen).
//
// Wichtig für das Layout: WhatsApp Web zeigt beim Schreiben nur einen mittigen Ausschnitt (etwa 3:2), manche Apps sogar ein
// Quadrat. Darum steht alles Wichtige in einer schmalen Mittelspalte (620 px von 1200); die Seitenränder sind nur Fläche.
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

/** Schriftgrösse für den Namen; lange Namen dürfen in der schmalen Spalte auf zwei Zeilen umbrechen. */
function nameSize(name: string): number {
  const n = name.length;
  return n <= 12 ? 100 : n <= 18 ? 82 : n <= 26 ? 68 : n <= 36 ? 56 : 46;
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const venue = await getVenueByToken(token).catch(() => null);
  const brand = await resolveBrand();
  const logo = await logoData(brand.logoUrl);
  const headline = venue ? venue.spotName : "Your photos on our Instagram";
  const points = ["Free feature", "Tagged to you", "2 minutes"];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f2f0ec", fontFamily: "sans-serif" }}>
        {/* Dekor an den Rändern: darf beim Zuschneiden verschwinden */}
        <div style={{ position: "absolute", left: -140, top: -140, width: 360, height: 360, borderRadius: 999, background: "#f4b400", opacity: 0.35, display: "flex" }} />
        <div style={{ position: "absolute", right: -140, bottom: -140, width: 360, height: 360, borderRadius: 999, background: "#f4b400", opacity: 0.35, display: "flex" }} />

        <div style={{ width: 620, height: 630, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "52px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 76 }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} width={260} height={76} style={{ objectFit: "contain" }} alt="" />
            ) : (
              <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "#111111" }}>{brand.name}</div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 620 }}>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#9a7400", letterSpacing: 3 }}>WE’D LOVE TO FEATURE</div>
            <div style={{ display: "flex", width: 620, justifyContent: "center", textAlign: "center", fontSize: nameSize(headline), fontWeight: 700, color: "#111111", lineHeight: 1.05, marginTop: 16 }}>{headline}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex" }}>
              {points.map((p, i) => (
                <div key={p} style={{ display: "flex", padding: "10px 20px", marginLeft: i === 0 ? 0 : 12, borderRadius: 999, background: "#f4b400", color: "#111111", fontSize: 24, fontWeight: 700 }}>
                  {p}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", marginTop: 18, fontSize: 24, color: "#6b6b6b" }}>{brand.instagram ? `on Instagram @${brand.instagram}` : "on our Instagram"}</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
