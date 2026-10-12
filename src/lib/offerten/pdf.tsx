import path from "node:path";
import { Document, Font, Link, Page, Path, Svg, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { QuoteDocument } from "./document";

/**
 * PDF-Ausgabe im Elev8-Look: Schwarz, Weiss und Elev8-Gelb, Inter.
 * Seite 1: Deckblatt mit schwarzem Band, Eckdaten (Paket, Investition, Gültigkeit), Anrede, Einleitung
 * und die Gesprächspunkte als nummerierte Karten.
 * Seite 2: Angebot mit Tabelle und Summe, nächste Schritte, Noah per WhatsApp und ganz am Ende die Konditionen.
 * Die Schrift kommt aus @fontsource/inter (WOFF), damit Umlaute und Ziffern sauber gesetzt sind.
 */

let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), "node_modules", "@fontsource", "inter", "files");
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(dir, "inter-latin-400-normal.woff"), fontWeight: 400 },
      { src: path.join(dir, "inter-latin-500-normal.woff"), fontWeight: 500 },
      { src: path.join(dir, "inter-latin-600-normal.woff"), fontWeight: 600 },
      { src: path.join(dir, "inter-latin-700-normal.woff"), fontWeight: 700 }
    ]
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const YELLOW = "#F6BB12";
const INK = "#000000";
const INK2 = "#2B2B2B";
const MUTED = "#6B6B6B";
const LINE = "#E6E6E6";
const SOFT = "#F6F5F1";
const DARK = "#0E0E0E";
const DARK_MUTED = "#A3A3A3";
const PAD = 52;

const s = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 64, fontFamily: "Inter", fontSize: 10, color: INK2, lineHeight: 1.55 },
  body: { paddingHorizontal: PAD },
  // Deckblatt
  band: { backgroundColor: DARK, paddingHorizontal: PAD, paddingTop: 20, paddingBottom: 18 },
  bandTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  bandMeta: { alignItems: "flex-end" },
  bandLabel: { fontSize: 7.5, fontWeight: 600, color: DARK_MUTED, letterSpacing: 1.4, textTransform: "uppercase" },
  bandNumber: { fontSize: 9.5, color: "#FFFFFF", fontWeight: 500, marginTop: 3 },
  bandBar: { width: 34, height: 3, backgroundColor: YELLOW, marginBottom: 14 },
  bandKicker: { fontSize: 9.5, color: DARK_MUTED, marginBottom: 2 },
  bandTitle: { fontSize: 21, fontWeight: 700, color: "#FFFFFF", letterSpacing: -0.4, lineHeight: 1.15 },
  // Eckdaten
  facts: { flexDirection: "row", marginHorizontal: PAD, marginTop: -1, backgroundColor: YELLOW },
  fact: { flex: 1, paddingVertical: 11, paddingHorizontal: 14 },
  factDivider: { borderLeftWidth: 0.8, borderLeftColor: "rgba(0,0,0,0.18)" },
  factLabel: { fontSize: 7, fontWeight: 600, color: "#3A2E00", letterSpacing: 0.9, textTransform: "uppercase", marginBottom: 4 },
  factValue: { fontSize: 12.5, fontWeight: 700, color: INK, lineHeight: 1.2 },
  factSub: { fontSize: 8, color: "#3A2E00", marginTop: 2 },
  // Parteien
  parties: { flexDirection: "row", gap: 28, marginTop: 24, marginBottom: 22 },
  party: { flex: 1 },
  partyLabel: { fontSize: 7.5, fontWeight: 600, color: MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 },
  partyName: { fontSize: 10.5, fontWeight: 600, color: INK },
  partyLine: { fontSize: 9.5, color: INK2 },
  partyMuted: { fontSize: 9, color: MUTED },
  // Brief
  salutation: { fontSize: 11.5, fontWeight: 600, color: INK, marginBottom: 8 },
  paragraph: { fontSize: 10.3, color: INK2, lineHeight: 1.6, marginBottom: 8 },
  // Gesprächspunkte als Karten
  sectionHead: { flexDirection: "row", alignItems: "center", marginTop: 12, marginBottom: 10 },
  sectionBar: { width: 3, height: 14, backgroundColor: YELLOW, marginRight: 8 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: INK, letterSpacing: -0.2 },
  cards: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: { width: "48.8%", backgroundColor: SOFT, paddingVertical: 9, paddingHorizontal: 10, marginBottom: 7, flexDirection: "row" },
  cardNum: { width: 17, height: 17, borderRadius: 8.5, backgroundColor: DARK, alignItems: "center", justifyContent: "center", marginRight: 8 },
  cardNumText: { fontSize: 8, fontWeight: 700, color: YELLOW, lineHeight: 1 },
  cardText: { flex: 1, fontSize: 8.6, lineHeight: 1.45, color: INK2 },
  cardLead: { fontWeight: 600, color: INK },
  // Angebotsseite
  offerHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingTop: 40, marginBottom: 20 },
  offerTitle: { fontSize: 22, fontWeight: 700, color: INK, letterSpacing: -0.5, lineHeight: 1.2 },
  offerSub: { fontSize: 9, color: MUTED, marginTop: 4 },
  table: { marginBottom: 14 },
  thead: { flexDirection: "row", backgroundColor: DARK, paddingVertical: 7, paddingHorizontal: 10 },
  th: { fontSize: 7, fontWeight: 600, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 0.6 },
  row: { flexDirection: "row", paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 0.6, borderBottomColor: LINE },
  colItem: { flex: 1, paddingRight: 14 },
  colQty: { width: 50, textAlign: "right" },
  colPrice: { width: 70, textAlign: "right", paddingLeft: 6 },
  colDisc: { width: 44, textAlign: "right", paddingLeft: 6 },
  colInterval: { width: 60, textAlign: "right", paddingLeft: 8 },
  colTotal: { width: 88, textAlign: "right", paddingLeft: 10 },
  unitText: { color: MUTED, fontSize: 7.5, marginTop: 2, textAlign: "right" },
  itemTitle: { fontWeight: 600, color: INK, fontSize: 10.5 },
  itemDetail: { color: MUTED, fontSize: 8.5, marginTop: 3, lineHeight: 1.5 },
  num: { color: INK2, fontSize: 10 },
  totals: { alignSelf: "flex-end", width: 300, marginBottom: 22 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 12 },
  totalStrong: { backgroundColor: SOFT, marginTop: 3, paddingVertical: 8 },
  totalHero: { backgroundColor: YELLOW, marginTop: 4, paddingVertical: 11 },
  totalLabel: { color: MUTED, fontSize: 9.5 },
  totalLabelStrong: { color: INK, fontWeight: 600, fontSize: 10 },
  totalValue: { color: INK2, fontSize: 9.5 },
  totalValueStrong: { color: INK, fontWeight: 700, fontSize: 11 },
  totalValueHero: { color: INK, fontWeight: 700, fontSize: 14 },
  // Nächste Schritte
  steps: { flexDirection: "row", gap: 10, marginBottom: 18 },
  step: { flex: 1, borderTopWidth: 2, borderTopColor: INK, paddingTop: 9 },
  stepNum: { fontSize: 18, fontWeight: 700, color: YELLOW, lineHeight: 1, marginBottom: 6 },
  stepTitle: { fontSize: 10, fontWeight: 700, color: INK, marginBottom: 3 },
  stepText: { fontSize: 8.5, color: MUTED, lineHeight: 1.45 },
  // Fragen
  questions: { backgroundColor: DARK, paddingVertical: 18, paddingHorizontal: 20, marginBottom: 18, flexDirection: "row", alignItems: "center" },
  questionsMain: { flex: 1, paddingRight: 16 },
  questionsTitle: { fontSize: 13, fontWeight: 700, color: "#FFFFFF", marginBottom: 5 },
  questionsText: { fontSize: 9.5, color: DARK_MUTED, lineHeight: 1.5 },
  questionsTip: { fontSize: 8.5, color: "#FFFFFF", lineHeight: 1.5, marginTop: 7 },
  waBox: { backgroundColor: YELLOW, paddingVertical: 10, paddingHorizontal: 14, textDecoration: "none" },
  waLabel: { fontSize: 7, fontWeight: 700, color: "#3A2E00", letterSpacing: 0.9, textTransform: "uppercase" },
  waPhone: { fontSize: 14, fontWeight: 700, color: INK, marginTop: 2 },
  waSub: { fontSize: 7.5, color: "#3A2E00", marginTop: 1 },
  // Konditionen
  terms: { borderTopWidth: 0.6, borderTopColor: LINE, paddingTop: 10 },
  termsTitle: { fontSize: 7.5, fontWeight: 600, color: MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 },
  small: { fontSize: 8, color: MUTED, lineHeight: 1.5 },
  taxStrong: { fontSize: 8, color: INK, fontWeight: 600, lineHeight: 1.5, marginBottom: 3 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: PAD,
    right: PAD,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 0.6,
    borderTopColor: LINE,
    paddingTop: 7,
    fontSize: 7,
    color: MUTED
  },
  footerNote: { fontSize: 7, color: MUTED }
});

function Logo({ height = 26, color = INK }: { height?: number; color?: string }) {
  return (
    <Svg width={(height * 124) / 27} height={height} viewBox="0 0 124 27">
      <Path fill={color} d="M2.10571 14.2607H13.9104V16.2707H2.10571V14.2607ZM2.36095 24.566H15.7928V26.6079H0V4.27457H15.3143V6.31647H2.36095V24.566Z" />
      <Path fill={color} d="M21.3425 26.6079V4.27457H23.7034V24.566H36.2101V26.6079H21.3425Z" />
      <Path fill={color} d="M42.2358 14.2607H54.0406V16.2707H42.2358V14.2607ZM42.4911 24.566H55.9229V26.6079H40.1301V4.27457H55.4444V6.31647H42.4911V24.566Z" />
      <Path fill={color} d="M67.5101 26.6079L57.6196 4.27457H60.172L69.4244 25.2998H68.0206L77.3367 4.27457H79.7296L69.8391 26.6079H67.5101Z" />
      <Path
        fill={color}
        d="M89.4483 26.7993C87.6616 26.7993 86.1196 26.544 84.8221 26.0336C83.5459 25.5231 82.5569 24.7893 81.855 23.8321C81.1743 22.8537 80.834 21.7052 80.834 20.3864C80.834 19.1103 81.1637 18.0255 81.8231 17.1322C82.5037 16.2176 83.4821 15.5157 84.7583 15.0265C86.0558 14.5372 87.6191 14.2926 89.4483 14.2926C91.2562 14.2926 92.8089 14.5372 94.1064 15.0265C95.4038 15.5157 96.3929 16.2176 97.0735 17.1322C97.7754 18.0255 98.1264 19.1103 98.1264 20.3864C98.1264 21.7052 97.7754 22.8537 97.0735 23.8321C96.3716 24.7893 95.3719 25.5231 94.0745 26.0336C92.777 26.544 91.235 26.7993 89.4483 26.7993ZM89.4483 24.8531C91.4264 24.8531 92.9684 24.449 94.0745 23.6407C95.2018 22.8325 95.7654 21.7371 95.7654 20.3545C95.7654 18.972 95.2018 17.8872 94.0745 17.1003C92.9684 16.292 91.4264 15.8879 89.4483 15.8879C87.4702 15.8879 85.9282 16.292 84.8221 17.1003C83.7161 17.8872 83.1631 18.972 83.1631 20.3545C83.1631 21.7371 83.7161 22.8325 84.8221 23.6407C85.9282 24.449 87.4702 24.8531 89.4483 24.8531ZM89.4483 15.6007C87.7893 15.6007 86.3748 15.3774 85.205 14.9307C84.0564 14.4841 83.1737 13.846 82.5569 13.0165C81.9401 12.1657 81.6317 11.1554 81.6317 9.98551C81.6317 8.75186 81.9507 7.69901 82.5888 6.82695C83.2482 5.93362 84.1628 5.25298 85.3326 4.78505C86.5024 4.31711 87.8743 4.08314 89.4483 4.08314C91.0223 4.08314 92.3942 4.31711 93.564 4.78505C94.7551 5.25298 95.6804 5.93362 96.3397 6.82695C96.9991 7.69901 97.3288 8.75186 97.3288 9.98551C97.3288 11.1554 97.0204 12.1657 96.4035 13.0165C95.7867 13.846 94.8827 14.4841 93.6916 14.9307C92.5218 15.3774 91.1073 15.6007 89.4483 15.6007ZM89.4483 14.0693C91.1924 14.0693 92.5537 13.7077 93.5321 12.9846C94.5105 12.2614 94.9997 11.2936 94.9997 10.0812C94.9997 8.80504 94.4892 7.81599 93.4683 7.11409C92.4686 6.39092 91.1286 6.02933 89.4483 6.02933C87.768 6.02933 86.428 6.39092 85.4283 7.11409C84.4286 7.81599 83.9288 8.7944 83.9288 10.0493C83.9288 11.283 84.4074 12.2614 85.3645 12.9846C86.3429 13.7077 87.7042 14.0693 89.4483 14.0693Z"
      />
      <Path
        fill={color}
        d="M120.495 5.27865C122.163 6.90124 123.2 9.16837 123.2 11.679C123.2 18.0394 114.323 25.9852 114.27 26.0326C114.27 26.0326 105.338 18.0585 105.338 11.679C105.338 9.19779 106.35 6.9528 107.984 5.33431L109.402 12.1576C109.436 12.4557 109.497 12.7455 109.582 13.0247L109.584 13.0326C110.196 15.0188 112.047 16.4622 114.234 16.4622C116.737 16.4622 118.798 14.5709 119.067 12.139L120.495 5.27865Z"
      />
      <Path fill="#F6BB11" d="M116.362 4.095L114.265 0L112.168 4.095L109.022 2.0475L110.464 8.92755C110.464 8.92755 111.68 6.59862 114.265 6.59862C116.85 6.59862 118.001 8.92755 118.001 8.92755L119.508 2.0475L116.362 4.095Z" />
      <Path fill={color} d="M114.622 14.5068C113.047 14.7014 111.613 13.5828 111.418 12.0082C111.223 10.4337 112.342 8.99939 113.917 8.80471C115.491 8.61003 116.926 9.72866 117.12 11.3032C117.315 12.8778 116.196 14.3121 114.622 14.5068Z" />
    </Svg>
  );
}

/** Gesprächspunkt "Thema: Text" in fett gesetztes Thema und Text aufteilen */
function splitLead(note: string): [string, string] {
  const m = note.match(/^([^:]{2,40}):\s+(.+)$/);
  return m ? [m[1], m[2]] : ["", note];
}

function QuotePdf({ doc }: { doc: QuoteDocument }) {
  const L = doc.labels;
  const issuerLine = [doc.issuer.company, ...doc.issuer.addressLines, doc.issuer.taxId].filter(Boolean).join(" · ");
  const contactLine = [doc.issuer.website.replace(/^https?:\/\//, ""), doc.contact.email || doc.issuer.email, doc.contact.phone || doc.issuer.phone]
    .filter(Boolean)
    .join(" · ");
  const notes = doc.notes
    .split("\n")
    .map((n) => n.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  const who = doc.recipient.company || doc.recipient.name;

  return (
    <Document title={`${L.document} ${doc.number}`} author={doc.issuer.company} creator="Elev8 Orbit" language={doc.lang}>
      <Page size="A4" style={s.page}>
        <View style={s.footer} fixed>
          <View style={{ maxWidth: 400 }}>
            {issuerLine ? <Text>{issuerLine}</Text> : null}
            {contactLine ? <Text>{contactLine}</Text> : null}
          </View>
          <Text style={s.footerNote}>
            {L.document} {doc.number}
          </Text>
        </View>

        {/* ── Seite 1: Deckblatt und persönlicher Teil ── */}
        <View style={s.band}>
          <View style={s.bandTop}>
            <Logo height={22} color="#FFFFFF" />
            <View style={s.bandMeta}>
              <Text style={s.bandLabel}>{L.document}</Text>
              <Text style={s.bandNumber}>{doc.number}</Text>
              <Text style={[s.bandLabel, { marginTop: 3, letterSpacing: 0 }]}>{doc.dateText}</Text>
            </View>
          </View>
          {who ? <Text style={s.bandKicker}>{L.offerFor}</Text> : null}
          <Text style={s.bandTitle}>{who || L.document}</Text>
        </View>

        {doc.facts.length ? (
          <View style={s.facts}>
            {doc.facts.map((f, i) => (
              <View key={i} style={i > 0 ? [s.fact, s.factDivider] : s.fact}>
                <Text style={s.factLabel}>{f.label}</Text>
                <Text style={s.factValue}>{f.value}</Text>
                {f.sub ? <Text style={s.factSub}>{f.sub}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={s.body}>
          <View style={s.parties}>
            <View style={s.party}>
              <Text style={s.partyLabel}>{L.for}</Text>
              {doc.recipient.company ? <Text style={s.partyName}>{doc.recipient.company}</Text> : null}
              {doc.recipient.name ? (
                <Text style={doc.recipient.company ? s.partyLine : s.partyName}>{doc.recipient.name}</Text>
              ) : null}
              {doc.recipient.addressLines.map((line, i) => (
                <Text key={i} style={s.partyLine}>
                  {line}
                </Text>
              ))}
              {doc.recipient.email ? <Text style={s.partyMuted}>{doc.recipient.email}</Text> : null}
              {doc.customerVatId ? (
                <Text style={s.partyMuted}>
                  {L.customerVatId}: {doc.customerVatId}
                </Text>
              ) : null}
            </View>
            <View style={s.party}>
              <Text style={s.partyLabel}>{L.contact}</Text>
              {doc.contact.name ? <Text style={s.partyName}>{doc.contact.name}</Text> : null}
              {doc.contact.phone ? <Text style={s.partyLine}>{doc.contact.phone}</Text> : null}
              {doc.contact.email ? <Text style={s.partyMuted}>{doc.contact.email}</Text> : null}
            </View>
          </View>

          <Text style={s.salutation}>{doc.salutation}</Text>
          {doc.intro
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p, i) => (
              <Text key={i} style={s.paragraph}>
                {p}
              </Text>
            ))}

          {notes.length ? (
            <View>
              <View style={s.sectionHead} wrap={false}>
                <View style={s.sectionBar} />
                <Text style={s.sectionTitle}>{L.highlights}</Text>
              </View>
              <View style={s.cards}>
                {notes.map((n, i) => {
                  const [lead, text] = splitLead(n);
                  return (
                    <View key={i} style={s.card} wrap={false}>
                      <View style={s.cardNum}>
                        <Text style={s.cardNumText}>{i + 1}</Text>
                      </View>
                      <Text style={s.cardText}>
                        {lead ? <Text style={s.cardLead}>{lead}: </Text> : null}
                        {text}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* ── Seite 2: Angebot ── */}
          <View break style={s.offerHead}>
            <View>
              <View style={s.bandBar} />
              <Text style={s.offerTitle}>{doc.offerHeading}</Text>
              <Text style={s.offerSub}>
                {doc.number} · {L.validShort} {doc.validUntilText}
              </Text>
            </View>
            <Logo height={16} />
          </View>

          <View style={s.table}>
            <View style={s.thead} fixed>
              <Text style={[s.th, s.colItem]}>{L.position}</Text>
              <Text style={[s.th, s.colQty]}>{L.qty}</Text>
              <Text style={[s.th, s.colPrice]}>{L.unitPrice}</Text>
              {doc.hasDiscount ? <Text style={[s.th, s.colDisc]}>{L.discount}</Text> : null}
              <Text style={[s.th, s.colInterval]}>{L.interval}</Text>
              <Text style={[s.th, s.colTotal]}>{L.total}</Text>
            </View>
            {doc.lines.map((line) => (
              <View key={line.id} style={s.row} wrap={false}>
                <View style={s.colItem}>
                  <Text style={s.itemTitle}>{line.title}</Text>
                  {line.detail ? <Text style={s.itemDetail}>{line.detail}</Text> : null}
                </View>
                <View style={s.colQty}>
                  <Text style={[s.num, { textAlign: "right" }]}>{line.qtyText}</Text>
                  {line.unitText ? <Text style={s.unitText}>{line.unitText}</Text> : null}
                </View>
                <Text style={[s.num, s.colPrice]}>{line.unitPriceText}</Text>
                {doc.hasDiscount ? <Text style={[s.num, s.colDisc]}>{line.discountText}</Text> : null}
                <Text style={[s.num, s.colInterval]}>{line.intervalText}</Text>
                <Text style={[s.itemTitle, s.colTotal]}>{line.totalText}</Text>
              </View>
            ))}
          </View>

          <View style={s.totals} wrap={false}>
            {doc.totals.map((row, i) => {
              const hero = i === doc.totals.length - 1 && row.strong;
              return (
                <View key={i} style={hero ? [s.totalRow, s.totalHero] : row.strong ? [s.totalRow, s.totalStrong] : s.totalRow}>
                  <Text style={row.strong ? s.totalLabelStrong : s.totalLabel}>{row.label}</Text>
                  <Text style={hero ? s.totalValueHero : row.strong ? s.totalValueStrong : s.totalValue}>{row.text}</Text>
                </View>
              );
            })}
          </View>

          {doc.closing
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p, i) => (
              <Text key={i} style={s.paragraph}>
                {p}
              </Text>
            ))}

          <View wrap={false}>
            <View style={[s.sectionHead, { marginTop: 10 }]}>
              <View style={s.sectionBar} />
              <Text style={s.sectionTitle}>{L.nextSteps}</Text>
            </View>
            <View style={s.steps}>
              {doc.steps.map((step, i) => (
                <View key={i} style={s.step}>
                  <Text style={s.stepNum}>{String(i + 1).padStart(2, "0")}</Text>
                  <Text style={s.stepTitle}>{step.title}</Text>
                  <Text style={s.stepText}>{step.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {doc.assistant ? (
            <View style={s.questions} wrap={false}>
              <View style={s.questionsMain}>
                <Text style={s.questionsTitle}>{L.questions}</Text>
                <Text style={s.questionsText}>{doc.assistant.text.replace(/:$/, ".")}</Text>
                <Text style={s.questionsTip}>{doc.assistant.tip}</Text>
              </View>
              <Link src={doc.assistant.link} style={s.waBox}>
                <Text style={s.waLabel}>{L.whatsappCta.replace("{name}", doc.assistantName)}</Text>
                <Text style={s.waPhone}>{doc.assistant.phone}</Text>
                <Text style={s.waSub}>{L.available}</Text>
              </Link>
            </View>
          ) : null}

          <View style={s.terms} wrap={false}>
            <Text style={s.termsTitle}>{L.terms}</Text>
            {doc.reverseCharge ? <Text style={s.taxStrong}>{doc.taxNote}</Text> : null}
            <Text style={s.small}>{doc.terms}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderQuotePdf(doc: QuoteDocument): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<QuotePdf doc={doc} />);
}
