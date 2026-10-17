/** Basis für öffentliche Links. Mit eigener Domain (z. B. https://messe.elev8-suite.com) MESSEN_PUBLIC_URL setzen. */
export function publicBase(): string {
  return (process.env.MESSEN_PUBLIC_URL || process.env.AUTH_URL || "https://myorbit.elev8-suite.com").replace(/\/+$/, "");
}

export function publicUrl(slug: string, params: Record<string, string> = {}): string {
  const q = new URLSearchParams(params).toString();
  return `${publicBase()}/m/${slug}${q ? `?${q}` : ""}`;
}

export function qrImageUrl(data: string, size = 600): string {
  const q = new URLSearchParams({ size: `${size}x${size}`, margin: "16", format: "png", data });
  return `https://api.qrserver.com/v1/create-qr-code/?${q}`;
}
