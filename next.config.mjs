import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

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
      { source: "/((?!offerten|api/offerten).*)", headers: [{ key: "X-Frame-Options", value: "DENY" }, ...common] },
      // Die Offerten-App läuft als Tab in Orbit (gleiche Domain) und öffnet PDFs in diesem Tab
      { source: "/offerten", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }, ...common] },
      { source: "/offerten/:path*", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }, ...common] },
      { source: "/api/offerten/:path*", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }, ...common] }
    ];
  }
};

export default withNextIntl(nextConfig);
