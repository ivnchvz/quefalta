import "server-only";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { Analysis, CategoryResult } from "./engine";
import { DOCUMENTS_SOURCE, VERIFIED_ON, type LaunchPlan } from "./launch";
import type { GoogleCheck } from "./places";
import { googleMapsSearchUrl, googleVerdict } from "./placesShared";

// Monochrome "presentation" style: black pages, rounded light/dark cards, pill labels,
// circled arrows and oversized light numerals. Typeface: Inter Tight (SIL OFL, src/fonts).

const FONT_DIR = path.join(process.cwd(), "src", "fonts");
const LIGHT = "InterTight-Light";
const REGULAR = "InterTight";
const MEDIUM = "InterTight-Medium";

const BG = "#0a0a0a";
const CARD = "#f4f4f2";
const CARD_DARK = "#1b1b1b";
const TILE_A = "#e3e5e2";
const TILE_B = "#c9ccc7";
const INK = "#111111";
const INK_SOFT = "#6b706b";
const ON_DARK = "#e7e9e6";
const ON_DARK_SOFT = "#8c918c";
const HEADLINE_GRAY = "#a4a8a3";

const W = 595.28;
const H = 841.89;
const M = 26; // outer frame
const PAD = 26; // inside cards
const BOTTOM = H - 58; // content limit, footer below

const fmt = (x: number) => x.toLocaleString("es-MX");
const pct = (x: number) => `${Math.round(x * 100)}%`;
// Inter Tight covers Latin; drop emoji and other symbols it has no glyphs for.
const clean = (s: string) =>
  s
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/≤/g, "<=")
    .replace(/ {2,}/g, " ")
    .trim();

const FIELD_CHECKS = [
  "Recorre la zona en horas pico (7-9, 13-15 y 18-20 h) y cuenta a las personas que pasan frente a los locales disponibles: nuestro análisis no mide tráfico peatonal.",
  "Pregunta la renta de al menos 3 locales cercanos: no tenemos datos de rentas.",
  "Visita a los competidores más cercanos: precios, horarios, calidad y qué tan llenos están.",
  "Antes de firmar un contrato, confirma en Desarrollo Urbano y Ecología que el uso de suelo del local permite tu giro.",
];

// `google`: live Google Maps check for the business type (null when unavailable).
export type PlanPdfInput = { analysis: Analysis; result: CategoryResult; plan: LaunchPlan; google?: GoogleCheck | null };

export function renderPlanPdf({ analysis, result: r, plan, google = null }: PlanPdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true, autoFirstPage: false });
  doc.registerFont(LIGHT, path.join(FONT_DIR, "InterTight-300.ttf"));
  doc.registerFont(REGULAR, path.join(FONT_DIR, "InterTight-400.ttf"));
  doc.registerFont(MEDIUM, path.join(FONT_DIR, "InterTight-500.ttf"));

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const newPage = () => {
    doc.addPage({ size: "A4", margin: 0 });
    doc.rect(0, 0, W, H).fill(BG);
  };

  // ---------- drawing primitives ----------
  const asterisk = (cx: number, cy: number, size: number, color: string) => {
    doc.save().lineCap("round").lineWidth(size * 0.28).strokeColor(color);
    for (const deg of [0, 45, 90, 135]) {
      const a = (deg * Math.PI) / 180;
      doc.moveTo(cx - Math.cos(a) * size, cy - Math.sin(a) * size).lineTo(cx + Math.cos(a) * size, cy + Math.sin(a) * size).stroke();
    }
    doc.restore();
  };
  const logo = (x: number, y: number, color: string) => {
    asterisk(x + 6, y + 6, 6, color);
    doc.font(MEDIUM).fontSize(10).fillColor(color).text("QueFalta", x + 18, y + 0.5, { lineBreak: false });
  };
  const pill = (x: number, y: number, label: string, style: "outline-dark" | "outline-light" | "filled") => {
    doc.font(REGULAR).fontSize(8);
    const w = doc.widthOfString(label, { characterSpacing: 0.6 }) + 24;
    const h = 20;
    if (style === "filled") doc.roundedRect(x, y, w, h, h / 2).fill("#e4e6e3");
    else doc.roundedRect(x, y, w, h, h / 2).lineWidth(0.9).strokeColor(style === "outline-dark" ? ON_DARK : INK).stroke();
    doc.fillColor(style === "outline-dark" ? ON_DARK : INK).text(label, x + 12, y + 6, { characterSpacing: 0.6, lineBreak: false });
    return w;
  };
  const arrowCircle = (cx: number, cy: number, rad: number, color: string, dir: "down-left" | "down-right" = "down-left") => {
    doc.save().lineWidth(0.9).strokeColor(color).circle(cx, cy, rad).stroke();
    const s = rad * 0.32;
    const sx = dir === "down-left" ? 1 : -1;
    doc.lineCap("round").lineWidth(1.2);
    doc.moveTo(cx + sx * s, cy - s).lineTo(cx - sx * s, cy + s).stroke();
    doc.moveTo(cx - sx * s, cy + s).lineTo(cx - sx * s, cy + s - s * 1.3).stroke();
    doc.moveTo(cx - sx * s, cy + s).lineTo(cx - sx * s + sx * s * 1.3, cy + s).stroke();
    doc.restore();
  };
  const checkBadge = (cx: number, cy: number, rad: number) => {
    doc.circle(cx, cy, rad).fill(INK);
    doc
      .save()
      .lineWidth(1.4)
      .lineCap("round")
      .lineJoin("round")
      .strokeColor("#ffffff")
      .moveTo(cx - rad * 0.45, cy + 0.2)
      .lineTo(cx - rad * 0.1, cy + rad * 0.4)
      .lineTo(cx + rad * 0.5, cy - rad * 0.35)
      .stroke()
      .restore();
  };
  /** Largest font size (from `max` down) at which `text` fits in `height` at `width`. */
  const fitSize = (text: string, font: string, max: number, width: number, height: number, lineGap: number) => {
    let size = max;
    doc.font(font);
    while (size > 18 && doc.fontSize(size).heightOfString(text, { width, lineGap: lineGap * size }) > height) size -= 2;
    return size;
  };

  // ---------- page 1: cover ----------
  newPage();
  logo(48, 46, ON_DARK);
  pill(140, 42, "PLAN DE NEGOCIO", "outline-dark");
  arrowCircle(W - 64, 52, 18, ON_DARK);

  const title = clean(r.category.name);
  const titleSize = fitSize(title, LIGHT, 64, W - 96, 250, -0.12);
  doc.font(LIGHT).fontSize(titleSize).fillColor(ON_DARK).text(title, 48, 120, { width: W - 96, lineGap: -0.12 * titleSize });
  const afterTitle = doc.y + 26;
  doc.font(REGULAR).fontSize(9).fillColor(ON_DARK_SOFT).text("Zona analizada", 48, afterTitle, { continued: true });
  doc.font(MEDIUM).fillColor(ON_DARK).text(`   Radio de 1 km · Chihuahua, Chih.`);
  doc.font(REGULAR).fontSize(9).fillColor(ON_DARK_SOFT).text("Preparado el", 48, doc.y + 6, { continued: true });
  doc
    .font(MEDIUM)
    .fillColor(ON_DARK)
    .text(`   ${new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Chihuahua" })}`);

  const year = new Date().toLocaleDateString("es-MX", { year: "numeric", timeZone: "America/Chihuahua" });
  doc.font(LIGHT).fontSize(200).fillColor("#dfe2df").text(year, 36, H - 300, { lineBreak: false });
  doc
    .font(REGULAR)
    .fontSize(8.5)
    .fillColor(ON_DARK_SOFT)
    .text(`Datos: INEGI · Municipio y Gobierno del Estado de Chihuahua`, 48, H - 52, { lineBreak: false });

  // ---------- page 2: introduction + executive summary ----------
  newPage();
  const introH = 300;
  doc.roundedRect(M, M, W - 2 * M, introH, 24).fill(CARD);
  doc.font(REGULAR).fontSize(8);
  const introPillW = doc.widthOfString("INTRODUCCIÓN", { characterSpacing: 0.6 }) + 24;
  pill((W - introPillW) / 2, M + 26, "INTRODUCCIÓN", "outline-light");

  const lead =
    r.status === "opportunity"
      ? `En esta zona hay ${r.actual} de este giro y, para una zona así, se esperan ~${Math.round(r.expected)}. `
      : r.status === "saturated"
        ? `En esta zona hay ${r.actual} de este giro, más de los ~${Math.round(r.expected)} esperados. `
        : `En esta zona hay ${r.actual} de este giro, cerca de los ~${Math.round(r.expected)} esperados. `;
  const leadRest = "Esta guía te dice qué te falta para abrir el tuyo: documentos, trámites, apoyos y qué validar.";
  const introW = W - 2 * M - 110;
  // Two centered paragraphs (pdfkit mis-positions mixed colors inside one centered paragraph).
  doc.font(REGULAR).fontSize(21).fillColor(INK).text(lead.trim(), (W - introW) / 2, M + 70, { width: introW, align: "center", lineGap: -2 });
  doc.fillColor(HEADLINE_GRAY).text(leadRest, (W - introW) / 2, doc.y + 2, { width: introW, align: "center", lineGap: -2 });
  logo(W / 2 - 34, M + introH - 44, INK_SOFT);

  // Executive summary card
  const sumY = M + introH + 12;
  const sumH = BOTTOM - sumY + 20;
  doc.roundedRect(M, sumY, W - 2 * M, sumH, 24).fill(CARD);
  arrowCircle(M + PAD + 16, sumY + PAD + 16, 16, INK, "down-right");
  pill(M + PAD + 44, sumY + PAD + 6, "RESUMEN EJECUTIVO", "outline-light");

  const f = analysis.features;
  const verdictLead =
    r.status === "opportunity" ? "Hay espacio para " : r.status === "saturated" ? "Competencia fuerte para " : "Mercado equilibrado para ";
  const innerW = W - 2 * M - 2 * PAD;
  let y = sumY + PAD + 52;
  doc
    .font(REGULAR)
    .fontSize(20)
    .fillColor(INK)
    .text(verdictLead, M + PAD, y, { width: innerW, lineGap: -2, continued: true })
    .fillColor(HEADLINE_GRAY)
    .text(clean(r.category.name.toLowerCase()) + " en esta zona.");
  y = doc.y + 12;
  doc
    .font(REGULAR)
    .fontSize(9.5)
    .fillColor(INK)
    .text(
      clean(
        `En 1 km a la redonda viven ${fmt(f.pop)} personas y trabajan aprox. ${fmt(f.workers)}; ${pct(f.kids)} son niños de 0 a 14 años, ${pct(f.seniors)} adultos de 65+ y el ${pct(f.cars)} de los hogares tiene auto.` +
          (r.nearestCompetitorM !== null ? ` El competidor más cercano está a ${fmt(r.nearestCompetitorM)} m.` : "") +
          ` Comparamos la zona con las 661 zonas de la ciudad: para este giro el modelo explica el ${pct(r.modelR2)} de las diferencias entre zonas (confianza ${r.confidence}).` +
          (plan.lowRisk ? " Tu giro es de bajo riesgo: puedes abrir por el SARE en máximo 3 días hábiles." : ""),
      ),
      M + PAD,
      y,
      { width: innerW, lineGap: 3.5 },
    );

  // Fact tiles
  y = doc.y + 18;
  const tileGap = 10;
  const tileW = (innerW - 2 * tileGap) / 3;
  const tileH = 88;
  const facts: [string, string, string][] = [
    ["Aquí", String(r.actual), TILE_A],
    ["Esperados", `~${Math.round(r.expected)}`, TILE_B],
    ["Zonas parecidas", String(r.twinExpected), TILE_A],
  ];
  facts.forEach(([label, value, color], i) => {
    const x = M + PAD + i * (tileW + tileGap);
    doc.roundedRect(x, y, tileW, tileH, 18).fill(color);
    doc.font(REGULAR).fontSize(12).fillColor(color === TILE_B ? "#f7f7f5" : INK).text(label, x + 14, y + 12, { lineBreak: false });
    checkBadge(x + tileW - 20, y + 19, 7);
    doc.roundedRect(x + 8, y + 38, tileW - 16, tileH - 46, 13).fill("#ffffff");
    doc.font(LIGHT).fontSize(26).fillColor(INK).text(value, x + 8, y + 45, { width: tileW - 16, align: "center", lineBreak: false });
  });

  // Area stats
  y += tileH + 16;
  const stats: [string, string][] = [
    ["Habitantes", fmt(f.pop)],
    ["Trabajadores", `~${fmt(f.workers)}`],
    ["Niños 0-14", pct(f.kids)],
    ["Adultos 65+", pct(f.seniors)],
    ["Hogares con auto", pct(f.cars)],
  ];
  const statW = innerW / stats.length;
  stats.forEach(([label, value], i) => {
    const x = M + PAD + i * statW;
    doc.font(LIGHT).fontSize(17).fillColor(INK).text(value, x, y, { width: statW - 6, lineBreak: false });
    doc.font(REGULAR).fontSize(7.5).fillColor(INK_SOFT).text(label, x, y + 22, { width: statW - 6, lineBreak: false });
  });

  // ---------- sections ----------
  let cursor = 0; // 0 = no section page open yet
  const HEADER_H = 206;
  const sectionHeader = (n: number, heading: string, blurb: string) => {
    // Share the page with the previous section when the header and a couple of tiles still fit.
    if (!cursor || cursor + HEADER_H + 110 > BOTTOM) {
      newPage();
      cursor = M;
    }
    const y0 = cursor;
    doc.roundedRect(M, y0, W - 2 * M, HEADER_H, 24).fill(CARD_DARK);
    pill(M + PAD, y0 + PAD, `SECCIÓN ${n}`, "filled");
    doc.font(REGULAR).fontSize(8.5).fillColor(ON_DARK_SOFT).text(clean(blurb), M + PAD, y0 + PAD + 32, { width: 210, lineGap: 1.5 });
    doc.font(LIGHT).fontSize(120).fillColor(ON_DARK).text(String(n).padStart(2, "0"), M, y0 + 2, { width: W - 2 * M - PAD, align: "right", lineBreak: false });
    const headW = W - 2 * M - 2 * PAD - 60;
    const hs = fitSize(heading, LIGHT, 36, headW, 84, -0.08);
    doc.font(LIGHT).fontSize(hs);
    const headH = doc.heightOfString(heading, { width: headW, lineGap: -0.08 * hs });
    doc.fillColor(ON_DARK).text(heading, M + PAD, y0 + HEADER_H - PAD - headH + 4, { width: headW, lineGap: -0.08 * hs });
    arrowCircle(W - M - PAD - 18, y0 + HEADER_H - PAD - 16, 18, ON_DARK);
    cursor = y0 + HEADER_H + 10;
  };
  /** A rounded tile of height `h`; starts a continuation page if it would cross the bottom. */
  const tile = (h: number, color = CARD) => {
    if (cursor + h > BOTTOM) {
      newPage();
      cursor = M;
    }
    doc.roundedRect(M, cursor, W - 2 * M, h, 16).fill(color);
    const top = cursor;
    cursor += h + 8;
    return top;
  };
  const textW = W - 2 * M - 2 * 20 - 30;

  // 01 — live competition (Google Maps at generation time) + INEGI competitors
  const GMAPS_GRAY = "#5e5e5e"; // Google's text attribution color
  const attribution = (top: number) =>
    doc.font(REGULAR).fontSize(9).fillColor(GMAPS_GRAY).text("Google Maps", W - M - 20 - 70, top + 14, { width: 70, align: "right", lineBreak: false });
  sectionHeader(
    1,
    "Competencia en vivo",
    google ? "Consultado en Google Maps al generar este PDF, en 1 km a la redonda." : "Competidores registrados por INEGI cerca del punto.",
  );
  if (google) {
    const g = google.summary;
    // Three numbers: INEGI / Google / expected
    const rowTop = tile(96);
    attribution(rowTop);
    const cw = (W - 2 * M - 40 - 20) / 3;
    (
      [
        ["INEGI", String(r.actual), TILE_A],
        ["Google", `${g.operating}${g.truncated ? "+" : ""}`, TILE_B],
        ["Esperado", `~${Math.round(r.expected)}`, TILE_A],
      ] as const
    ).forEach(([label, value, color], i) => {
      const x = M + 20 + i * (cw + 10);
      doc.roundedRect(x, rowTop + 34, cw, 50, 14).fill(color);
      doc.font(REGULAR).fontSize(9).fillColor(INK).text(label, x + 12, rowTop + 40, { lineBreak: false });
      doc.font(LIGHT).fontSize(20).fillColor(INK).text(value, x, rowTop + 56, { width: cw - 12, align: "right", lineBreak: false });
    });
    // Verdict
    const v = googleVerdict(g.operating, r.actual, r.expected);
    const vText = clean(v.text);
    doc.font(REGULAR).fontSize(10.5);
    const vH = doc.heightOfString(vText, { width: textW + 30, lineGap: 2.5 }) + 26;
    const vTop = tile(vH, v.level === "covered" ? INK : v.level === "smaller" ? TILE_B : TILE_A);
    doc.font(REGULAR).fontSize(10.5).fillColor(v.level === "covered" ? "#ffffff" : INK).text(vText, M + 20, vTop + 13, { width: textW + 30, lineGap: 2.5 });
    // Stats
    const stats: string[] = [];
    if (g.avgRating !== null) stats.push(`Calificación promedio ${g.avgRating} de 5`);
    stats.push(`${g.opensLate} abren hasta las 21 h o más tarde`);
    if (g.closedPermanently) stats.push(`${g.closedPermanently} cerrados permanentemente`);
    const sTop = tile(40);
    doc.font(REGULAR).fontSize(9.5).fillColor(INK).text(clean(stats.join("  ·  ")), M + 20, sTop + 15, { width: W - 2 * M - 40, lineBreak: false });
    // Places
    for (const p of google.places.slice(0, 10)) {
      const detail = clean(
        [`${fmt(p.distanceM)} m`, p.rating !== null ? `${p.rating} de 5 (${p.reviews} reseñas)` : "sin reseñas", p.status === "CLOSED_PERMANENTLY" ? "cerrado permanentemente" : p.status === "CLOSED_TEMPORARILY" ? "cerrado temporalmente" : "", p.hoursToday ?? ""]
          .filter(Boolean)
          .join(" · "),
      );
      doc.font(REGULAR).fontSize(8.5);
      const h = 34 + doc.heightOfString(detail, { width: W - 2 * M - 130 });
      const top = tile(h);
      doc.font(MEDIUM).fontSize(10.5).fillColor(INK).text(clean(p.name), M + 20, top + 11, { width: W - 2 * M - 130, lineBreak: false, link: p.mapsUrl ?? undefined });
      doc.font(REGULAR).fontSize(8.5).fillColor(INK_SOFT).text(detail, M + 20, top + 26, { width: W - 2 * M - 130 });
      attribution(top - 3);
    }
    if (!google.summary.typeFiltered) {
      const nTop = tile(30, CARD_DARK);
      doc.font(REGULAR).fontSize(7.5).fillColor(ON_DARK_SOFT).text("Google no tiene un tipo específico para este giro: búsqueda por palabra clave, puede incluir lugares que no son del giro.", M + 20, nTop + 11, { width: W - 2 * M - 40, lineBreak: false });
    }
  } else if (r.competitors.length) {
    for (const c of r.competitors.slice(0, 8)) {
      const top = tile(38);
      doc.font(MEDIUM).fontSize(10.5).fillColor(INK).text(clean(c.name), M + 20, top + 13, { width: W - 2 * M - 180, lineBreak: false });
      doc.font(REGULAR).fontSize(9).fillColor(INK_SOFT).text(`${fmt(c.distanceM)} m · ${c.size} empleados`, W - M - 20 - 150, top + 14, { width: 150, align: "right", lineBreak: false });
    }
  }
  const linkTop = tile(40, CARD_DARK);
  doc
    .font(MEDIUM)
    .fontSize(10)
    .fillColor(ON_DARK)
    .text("Ver la competencia en Google Maps ›", M + 20, linkTop + 14, { link: googleMapsSearchUrl(r.category.q, analysis.lat, analysis.lon), underline: true, lineBreak: false });

  // 02 — what's missing
  sectionHeader(2, "Lo que te falta", `${plan.documents.length} documentos que te van a pedir para abrir. Tacha cada uno cuando lo tengas.`);
  for (const item of plan.documents) {
    const text = clean(item);
    doc.font(REGULAR).fontSize(10);
    const h = Math.max(40, doc.heightOfString(text, { width: textW, lineGap: 2.5 }) + 24);
    const top = tile(h);
    doc.roundedRect(M + 20, top + h / 2 - 7, 14, 14, 3.5).lineWidth(1).strokeColor(INK).stroke();
    doc.font(REGULAR).fontSize(10).fillColor(INK).text(text, M + 20 + 30, top + 12, { width: textW, lineGap: 2.5 });
  }
  const srcTop = tile(30, CARD_DARK);
  doc
    .font(REGULAR)
    .fontSize(7.5)
    .fillColor(ON_DARK_SOFT)
    .text("Fuente: hoja informativa de Licencia de funcionamiento del Municipio de Chihuahua y Formato Único de Apertura del SARE ›", M + 20, srcTop + 11, {
      width: W - 2 * M - 40,
      link: DOCUMENTS_SOURCE,
      lineBreak: false,
    });

  // 03 — procedures
  sectionHeader(
    3,
    "Trámites en orden",
    plan.lowRisk ? "Tu giro es de bajo riesgo: el SARE resuelve uso de suelo, Protección Civil y licencia en una ventanilla." : "Ruta ordinaria: tu giro no está en el catálogo de bajo riesgo del SARE.",
  );
  plan.steps.forEach((s, i) => {
    const name = clean(s.name);
    const body = [clean(s.what), s.details ? clean(s.details) : ""].filter(Boolean).join("\n");
    doc.font(MEDIUM).fontSize(11.5);
    const nameH = doc.heightOfString(name, { width: textW });
    doc.font(REGULAR).fontSize(9.3);
    const bodyH = doc.heightOfString(body, { width: textW, lineGap: 2.2 });
    const h = 18 + nameH + 14 + bodyH + 26;
    const top = tile(h);
    doc.font(MEDIUM).fontSize(8).fillColor(INK);
    doc.roundedRect(M + 20, top + 17, 24, 16, 8).lineWidth(0.9).strokeColor(INK).stroke();
    doc.text(String(i + 1).padStart(2, "0"), M + 20, top + 21, { width: 24, align: "center", lineBreak: false });
    doc.font(MEDIUM).fontSize(11.5).fillColor(INK).text(name, M + 50, top + 17, { width: textW });
    doc.font(REGULAR).fontSize(8.3).fillColor(INK_SOFT).text(clean(`${s.agency} · ${s.level}`), M + 50, doc.y + 2, { width: textW });
    doc.font(REGULAR).fontSize(9.3).fillColor(INK).text(body, M + 50, doc.y + 6, { width: textW, lineGap: 2.2 });
    doc.font(MEDIUM).fontSize(8.5).fillColor(INK).text("Información oficial ›", M + 50, doc.y + 5, { link: s.url, underline: true, lineBreak: false });
  });

  // 04 — support
  sectionHeader(4, "Apoyos y financiamiento", "Programas del Municipio y del Estado, y cuándo te conviene cada uno.");
  plan.programs.forEach((p, i) => {
    const color = i % 2 ? TILE_B : TILE_A;
    const body = clean(p.what);
    const when = clean(`Cuándo: ${p.fit}`);
    doc.font(REGULAR).fontSize(9.3);
    const h = 18 + 18 + doc.heightOfString(body, { width: textW, lineGap: 2.2 }) + 8 + doc.heightOfString(when, { width: textW }) + 22;
    const top = tile(h, color);
    doc.font(MEDIUM).fontSize(12.5).fillColor(INK).text(clean(p.name), M + 20, top + 16, { width: textW });
    checkBadge(W - M - 30, top + 24, 7);
    doc.font(REGULAR).fontSize(9.3).fillColor(INK).text(body, M + 20, doc.y + 6, { width: textW, lineGap: 2.2 });
    doc.font(MEDIUM).fontSize(9.3).fillColor(INK).text(when, M + 20, doc.y + 6, { width: textW, link: p.source });
  });

  // 05 — field validation
  sectionHeader(5, "Qué validar en campo", "Lo que los datos no ven. Hazlo antes de rentar o invertir.");
  for (const item of FIELD_CHECKS) {
    const text = clean(item);
    doc.font(REGULAR).fontSize(10);
    const h = Math.max(40, doc.heightOfString(text, { width: textW, lineGap: 2.5 }) + 24);
    const top = tile(h);
    doc.circle(M + 27, top + h / 2, 4).fill(INK);
    doc.font(REGULAR).fontSize(10).fillColor(INK).text(text, M + 50, top + 12, { width: textW, lineGap: 2.5 });
  }
  const note = clean(
    `Datos: INEGI (DENUE con registros a abril de 2026, Censo de Población 2020). Trámites y apoyos verificados el ${VERIFIED_ON}; confirma requisitos y costos con cada dependencia. Las oportunidades son hipótesis a validar, no garantías.`,
  );
  doc.font(REGULAR).fontSize(8);
  const noteH = doc.heightOfString(note, { width: W - 2 * M - 40, lineGap: 2 }) + 24;
  const noteTop = tile(noteH, CARD_DARK);
  doc.fillColor(ON_DARK_SOFT).text(note, M + 20, noteTop + 12, { width: W - 2 * M - 40, lineGap: 2 });

  // ---------- footers (all pages but the cover) ----------
  const range = doc.bufferedPageRange();
  for (let i = 1; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    asterisk(M + 10, H - 30, 5, ON_DARK_SOFT);
    doc.font(REGULAR).fontSize(7.5).fillColor(ON_DARK_SOFT).text("Plan de negocio  |  QueFalta · Chihuahua", M + 22, H - 33.5, { lineBreak: false });
    doc.font(MEDIUM).fontSize(8).fillColor(ON_DARK).text(`P.${String(i).padStart(2, "0")}`, W - M - 60, H - 34, { width: 60, align: "right", lineBreak: false });
  }

  doc.end();
  return done;
}
