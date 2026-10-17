import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Domains, die die Messe-Landingpages (/m/…) einbetten dürfen, z. B. die WordPress-Website. Wird beim Build gelesen.
const messenFrameAncestors = process.env.MESSEN_FRAME_ANCESTORS || "https://elev8-suite.com https://www.elev8-suite.com";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // PDF- und Excel-Erzeugung laufen nur auf dem Server und laden Schriften/Streams zur Laufzeit
  serverExternalPackages: ["@react-pdf/renderer", "exceljs"],
  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
    ];
    return [
      // Orbit selbst darf nirgends eingebettet werden
      { source: "/((?!offerten|api/offerten|sales|api/sales|kunden|api/kunden|assistent|api/assistent|portfolio|api/portfolio|portfolio-app|messen|api/messen|m/).*)", headers: [{ key: "X-Frame-Options", value: "DENY" }, ...common] },
      // Die Offerten-App läuft als Tab in Orbit (gleiche Domain) und öffnet PDFs in diesem Tab
      { source: "/offerten", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }, ...common] },
      { source: "/offerten/:path*", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }, ...common] },
      { source: "/api/offerten/:path*", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }, ...common] },
      // Sales läuft ebenfalls als Tab in Orbit
      { source: "/sales", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }, ...common] },
      { source: "/sales/:path*", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }, ...common] },
      { source: "/api/sales/:path*", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }, ...common] },
      // Kunden-360, der E-Mail-Assistent, das Portfolio-Modul und Messen laufen ebenfalls als Tabs in Orbit
      ...["/kunden", "/kunden/:path*", "/api/kunden/:path*", "/assistent", "/assistent/:path*", "/api/assistent/:path*", "/portfolio", "/portfolio/:path*", "/api/portfolio/:path*", "/portfolio-app/:path*", "/messen", "/messen/:path*", "/api/messen/:path*"].map((source) => ({
        source,
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }, ...common]
      })),
      // Messe-Landingpages: einbettbar nur in Orbit selbst und auf den Domains aus MESSEN_FRAME_ANCESTORS
      { source: "/m/:path*", headers: [{ key: "Content-Security-Policy", value: `frame-ancestors 'self' ${messenFrameAncestors}` }, ...common] },
      // Service Worker immer frisch laden, damit Aktualisierungen sofort greifen
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] }
    ];
  }
};

export default withNextIntl(nextConfig);
