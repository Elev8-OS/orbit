/** Basis für öffentliche Links. Mit eigener Domain (z. B. https://messe.elev8-suite.com) MESSEN_PUBLIC_URL setzen. */
export function publicBase(): string {
  return (process.env.MESSEN_PUBLIC_URL || process.env.AUTH_URL || "https://myorbit.elev8-suite.com").replace(/\/+$/, "");
}

export function publicUrl(slug: string, params: Record<string, string> = {}): string {
  const q = new URLSearchParams(params).toString();
  return `${publicBase()}/m/${slug}${q ? `?${q}` : ""}`;
}

/** Hängt Parameter an eine beliebige Adresse an (z. B. die WordPress-Seite) */
export function withParams(url: string, params: Record<string, string>): string {
  try {
    const u = new URL(url);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    return url;
  }
}

/** Code für einen HTML-Block in WordPress: bettet die Seite ein und meldet Leads an die Pixel der Website.
 *  lang legt die Sprache fest (je eine WordPress-Seite pro Sprache). */
export function embedSnippet(slug: string, title: string, lang: "de" | "en"): string {
  const origin = publicBase();
  const src = publicUrl(slug, { embed: "1", lang });
  const safeTitle = title.replace(/[&<>"]/g, "");
  return `<iframe id="elev8-messe" title="${safeTitle}" src="${src}" allow="clipboard-read; clipboard-write" style="display:block;width:100%;border:0;min-height:900px"></iframe>
<script>
(function () {
  var f = document.getElementById("elev8-messe");
  var q = location.search.replace(/^\\?/, "");
  if (q) f.src += "&" + q;
  window.addEventListener("message", function (e) {
    if (e.origin !== "${origin}" || !e.data || typeof e.data.type !== "string") return;
    var d = e.data;
    if (d.type === "elev8-messe:height") f.style.height = d.height + "px";
    if (d.type === "elev8-messe:scroll") f.scrollIntoView({ behavior: "smooth", block: "start" });
    if (d.type === "elev8-messe:lead") {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: "messe_lead", messe: d.slug, tier: d.tier, units: d.units, kanal: d.channel });
      if (window.fbq) window.fbq("track", "Lead", { content_name: d.slug });
      if (window.gtag) window.gtag("event", "generate_lead", { event_category: "messe", event_label: d.slug });
    }
  });
})();
</script>`;
}

export function qrImageUrl(data: string, size = 600): string {
  const q = new URLSearchParams({ size: `${size}x${size}`, margin: "16", format: "png", data });
  return `https://api.qrserver.com/v1/create-qr-code/?${q}`;
}
