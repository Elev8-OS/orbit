import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

/**
 * Einblendungen im Elev8-Design als PNG (1920×1080, transparent): Eröffnung, Abschluss, Kapitel,
 * Kernaussage, Sprecher-Ring. Schwarz, Weiss, Elev8-Gelb, Schrift Inter, offizielles Logo.
 */
const require = createRequire(import.meta.url);
const font = (subset, weight) => readFileSync(require.resolve(`@fontsource/inter/files/inter-${subset}-${weight}-normal.woff`));
const FONTS = [400, 600, 700, 800].flatMap((weight) =>
  ["latin", "latin-ext"].map((subset) => ({ name: "Inter", data: font(subset, weight), weight, style: "normal" }))
);
const LOGO = `data:image/svg+xml;base64,${readFileSync(new URL("../assets/elev8-logo-white.svg", import.meta.url)).toString("base64")}`;

export const W = 1920;
export const H = 1080;
const YELLOW = "#F6BB12";
const GREY = "#A3A3A3";
const MARGIN = 72;

/** Zeichen, die Inter (latin, latin-ext) nicht hat, durch gleichwertige ersetzen. */
export const clean = (t) =>
  String(t ?? "")
    .replace(/[→⇒➔➜⟶]/g, "–")
    .replace(/[←⇐]/g, "–")
    .replace(/[^\u0000-\u024F\u2000-\u206F\u20AC\u2122]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Kleines Hilfsmittel statt JSX: h("div", style, ...kinder) */
const h = (type, style = {}, ...children) => {
  const kids = children.flat().filter((c) => c !== null && c !== undefined && c !== false).map((c) => (typeof c === "string" ? clean(c) : c));
  return { type, props: { style: { display: "flex", ...style }, children: kids.length === 1 ? kids[0] : kids } };
};
const img = (src, style) => ({ type: "img", props: { src, style } });

async function png(node, width = W, height = H) {
  const svg = await satori(node, { width, height, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
}

function card({ title, sub, meta, url }) {
  return h(
    "div",
    { width: W, height: H, background: "#000", color: "#fff", flexDirection: "column", justifyContent: "space-between", padding: "120px 140px", fontFamily: "Inter" },
    img(LOGO, { width: 194, height: 64 }),
    h(
      "div",
      { flexDirection: "column" },
      h("div", { width: 160, height: 14, background: YELLOW, marginBottom: 44 }),
      h("div", { fontSize: 104, lineHeight: 1.02, fontWeight: 800, letterSpacing: "-0.035em", maxWidth: 1500 }, title),
      sub ? h("div", { marginTop: 36, fontSize: 44, lineHeight: 1.25, color: GREY, fontWeight: 400, maxWidth: 1300 }, sub) : null,
      url ? h("div", { marginTop: 48 }, h("div", { background: YELLOW, color: "#000", fontWeight: 700, fontSize: 60, letterSpacing: "-0.02em", padding: "22px 36px" }, url)) : null
    ),
    h("div", { fontSize: 30, color: GREY }, meta || " ")
  );
}

export const introPng = (p) => png(card({ title: p.title, sub: p.subtitle, meta: p.meta }));
export const outroPng = (p) => png(card({ title: p.outro?.title || "Mehr über Elev8 erfahren", url: p.outro?.url || "elev8-suite.com", meta: "your key to seamless hospitality." }));

/** YouTube-Vorschaubild (1280×720): Titel auf Schwarz, gelber Balken, Logo */
export function thumbPng(p) {
  return png(
    h(
      "div",
      { width: 1280, height: 720, background: "#000", color: "#fff", flexDirection: "column", justifyContent: "space-between", padding: "72px 84px", fontFamily: "Inter" },
      img(LOGO, { width: 146, height: 48 }),
      h(
        "div",
        { flexDirection: "column" },
        h("div", { width: 120, height: 12, background: YELLOW, marginBottom: 30 }),
        h("div", { fontSize: 84, lineHeight: 1.02, fontWeight: 800, letterSpacing: "-0.035em", maxWidth: 1110 }, p.thumbTitle || p.title)
      ),
      h("div", { fontSize: 28, color: GREY }, p.thumbSub || "Erklärvideo")
    ),
    1280,
    720
  );
}

const frame = (...children) => h("div", { width: W, height: H, position: "relative", fontFamily: "Inter" }, ...children);
const blockBase = { position: "absolute", left: MARGIN, bottom: MARGIN, maxWidth: 1240, flexDirection: "column", boxShadow: "0 18px 48px rgba(0,0,0,0.28)" };

export const chapterPng = ({ label, title }) =>
  png(
    frame(
      h(
        "div",
        { ...blockBase, background: YELLOW, color: "#000", padding: "30px 44px 34px" },
        h("div", { fontSize: 26, fontWeight: 600, marginBottom: 8 }, label),
        h("div", { fontSize: 56, lineHeight: 1.08, fontWeight: 800, letterSpacing: "-0.025em" }, title)
      )
    )
  );

export const keyPng = ({ text }) =>
  png(
    frame(
      h(
        "div",
        { ...blockBase, background: "#000", color: "#fff", padding: "30px 44px 34px", borderLeft: `14px solid ${YELLOW}` },
        h("div", { fontSize: 26, fontWeight: 600, marginBottom: 8, color: YELLOW }, "Kernaussage"),
        h("div", { fontSize: 46, lineHeight: 1.18, fontWeight: 700 }, text)
      )
    )
  );

/** Sprecher-Kreis: gelber Ring und Name. Das Kamerabild setzt ffmpeg in den Ring (PIP_*). */
export const PIP = { size: 174, ring: 8, right: MARGIN, bottom: MARGIN };
export const pipX = W - PIP.right - PIP.size - PIP.ring;
export const pipY = H - PIP.bottom - PIP.size - PIP.ring;

export const pipPng = ({ name }) => {
  const outer = PIP.size + PIP.ring * 2;
  return png(
    frame(
      h("div", { position: "absolute", left: pipX - PIP.ring, top: pipY - PIP.ring, width: outer, height: outer, borderRadius: outer, border: `${PIP.ring}px solid ${YELLOW}` }),
      name
        ? h(
            "div",
            { position: "absolute", right: PIP.right + outer + 18, bottom: PIP.bottom + outer / 2 - 26, background: "#000", color: "#fff", fontSize: 26, fontWeight: 600, padding: "10px 18px" },
            name
          )
        : null
    )
  );
};
