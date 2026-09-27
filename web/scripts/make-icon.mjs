// Generates the QueFalta brand mark: the Chihuahua state outline (INEGI) with a "?" (Inter Tight Medium).
//   node scripts/make-icon.mjs
// Outputs:
//   src/app/icon.svg, src/app/apple-icon.png   favicon / home-screen icon
//   src/lib/brandMark.ts                        the mark's geometry, drawn by the web UI and the PDF
//   ../brand/*.svg, ../brand/*.png              assets for slides (on black, for dark and for light backgrounds)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as fontkit from "fontkit";
import sharp from "sharp";

const SIZE = 512;
const INK = "#0a0a0a";
const LIGHT = "#e7e9e6";

const { ring, bbox } = JSON.parse(readFileSync("../brand/chihuahua-state.json", "utf-8"));
const [minX, minY, maxX, maxY] = bbox;

/** State path + "?" placement inside a SIZE×SIZE box, leaving `pad` around the state. */
function markGeometry(pad) {
  const k = Math.min((SIZE - 2 * pad) / (maxX - minX), (SIZE - 2 * pad) / (maxY - minY));
  const ox = (SIZE - (maxX - minX) * k) / 2;
  const oy = (SIZE - (maxY - minY) * k) / 2;
  const pts = ring.map(([x, y]) => [ox + (x - minX) * k, oy + (maxY - y) * k]);
  const state = `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;

  // Area centroid, so the "?" sits in the visual middle of the state.
  let a = 0, cx = 0, cy = 0;
  pts.forEach(([x0, y0], i) => {
    const [x1, y1] = pts[(i + 1) % pts.length];
    const c = x0 * y1 - x1 * y0;
    a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
  });
  cx /= 3 * a; cy /= 3 * a;

  const font = fontkit.openSync("src/fonts/InterTight-500.ttf");
  const glyph = font.layout("?").glyphs[0];
  const gb = glyph.bbox;
  const s = ((maxY - minY) * k * 0.46) / (gb.maxY - gb.minY);
  return {
    // Extent of the state inside the SIZE box (used to place the wordmark next to it)
    box: { x: ox, y: oy, w: (maxX - minX) * k, h: (maxY - minY) * k },
    state,
    question: glyph.path.toSVG(),
    // The glyph is in font units (y up): translate, then scale(s, -s).
    tx: +(cx - (s * (gb.minX + gb.maxX)) / 2).toFixed(2),
    ty: +(cy + (s * (gb.minY + gb.maxY)) / 2).toFixed(2),
    s: +s.toFixed(5),
  };
}

function iconSvg({ bg, state, mark, pad }) {
  const g = markGeometry(pad);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
${bg ? `  <rect width="${SIZE}" height="${SIZE}" rx="112" fill="${bg}"/>\n` : ""}  <path d="${g.state}" fill="${state}" stroke="${state}" stroke-width="6" stroke-linejoin="round"/>
  <path d="${g.question}" transform="translate(${g.tx} ${g.ty}) scale(${g.s} ${-g.s})" fill="${mark}"/>
</svg>
`;
}

const variants = {
  // Favicon / app icon: black rounded square, light state, dark "?"
  "quefalta-icon": iconSvg({ bg: INK, state: LIGHT, mark: INK, pad: 64 }),
  // Transparent, for dark slides
  "quefalta-icon-light": iconSvg({ bg: null, state: LIGHT, mark: INK, pad: 16 }),
  // Transparent, for light slides
  "quefalta-icon-dark": iconSvg({ bg: null, state: INK, mark: "#f4f4f2", pad: 16 }),
};

mkdirSync("../brand", { recursive: true });
for (const [name, svg] of Object.entries(variants)) {
  writeFileSync(`../brand/${name}.svg`, svg);
  for (const px of [1024, 2048]) {
    await sharp(Buffer.from(svg), { density: (72 * px) / SIZE }).resize(px, px).png().toFile(`../brand/${name}-${px}.png`);
  }
}
writeFileSync("src/app/icon.svg", variants["quefalta-icon"]);
await sharp(Buffer.from(variants["quefalta-icon"]), { density: 72 }).resize(180, 180).png().toFile("src/app/apple-icon.png");

/** Horizontal lockup: mark + "QueFalta" (Inter Tight Medium). `bg` null = transparent. */
function logoSvg({ bg, color, mark: markColor }) {
  const g = markGeometry(0);
  const markH = 400; // state height in px
  const f = markH / g.box.h;
  const pad = bg ? 140 : 24;
  const font = fontkit.openSync("src/fonts/InterTight-500.ttf");
  const run = font.layout("QueFalta");
  const fontPx = markH * 0.72; // cap height ≈ half the state's height
  const u = fontPx / font.unitsPerEm;
  const textW = run.positions.reduce((w, p) => w + p.xAdvance, 0) * u;
  const gap = markH * 0.16;
  const width = Math.round(pad * 2 + g.box.w * f + gap + textW);
  const height = Math.round(pad * 2 + markH);

  const mx = pad - g.box.x * f;
  const my = pad - g.box.y * f;
  const baseline = pad + markH / 2 + (font.capHeight * u) / 2; // cap height centered on the mark
  let x = 0;
  const glyphs = run.glyphs
    .map((gl, i) => {
      const d = `<path d="${gl.path.toSVG()}" transform="translate(${x.toFixed(1)} 0)"/>`;
      x += run.positions[i].xAdvance;
      return d;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
${bg ? `  <rect width="${width}" height="${height}" fill="${bg}"/>\n` : ""}  <g transform="translate(${mx.toFixed(1)} ${my.toFixed(1)}) scale(${f.toFixed(4)})">
    <path d="${g.state}" fill="${color}" stroke="${color}" stroke-width="6" stroke-linejoin="round"/>
    <path d="${g.question}" transform="translate(${g.tx} ${g.ty}) scale(${g.s} ${-g.s})" fill="${markColor}"/>
  </g>
  <g transform="translate(${(pad + g.box.w * f + gap).toFixed(1)} ${baseline.toFixed(1)}) scale(${u.toFixed(5)} ${(-u).toFixed(5)})" fill="${color}">${glyphs}</g>
</svg>
`;
}

const logos = {
  "quefalta-logo": logoSvg({ bg: INK, color: LIGHT, mark: INK }), // on black
  "quefalta-logo-light": logoSvg({ bg: null, color: LIGHT, mark: INK }), // transparent, for dark slides
  "quefalta-logo-dark": logoSvg({ bg: null, color: INK, mark: "#f4f4f2" }), // transparent, for light slides
};
for (const [name, svg] of Object.entries(logos)) {
  writeFileSync(`../brand/${name}.svg`, svg);
  await sharp(Buffer.from(svg), { density: 144 }).png().toFile(`../brand/${name}.png`); // 2x for slides
}

// Tight geometry (no padding) for the inline logo in the web UI and the PDF.
const mark = markGeometry(4);
writeFileSync(
  "src/lib/brandMark.ts",
  `// Generated by scripts/make-icon.mjs — do not edit by hand.
// QueFalta mark: Chihuahua state outline (INEGI) with a "?" (Inter Tight Medium), in a ${SIZE}×${SIZE} box.
export const BRAND_MARK = ${JSON.stringify({ size: SIZE, ...mark }, null, 2)} as const;
`,
);
console.log("written: src/app/icon.svg, src/app/apple-icon.png, src/lib/brandMark.ts, ../brand/*");
