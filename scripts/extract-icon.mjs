// Generates every icon format from the logo:
//   src/app/favicon.ico    - multi-size ICO (16/32/48), replaces the default Next.js one
//   src/app/icon.png       - 192px PNG favicon (Next file convention)
//   src/app/apple-icon.png - 180px full-bleed square (iOS rounds corners itself)
//   public/icon-192.png / icon-512.png - full-bleed squares for the PWA manifest
//   public/logo-white.png  - white wordmark variant for dark panels
import fs from 'node:fs';
import { PNG } from 'pngjs';

const logo = PNG.sync.read(fs.readFileSync('public/logo.png'));
const { width, height, data } = logo;

const isRed = (x, y) => {
  const i = (y * width + x) * 4;
  return data[i + 3] > 200 && data[i] > 140 && data[i + 1] < 90 && data[i + 2] < 90;
};

// Red bands by row coverage; take the tallest (the glyph, not the underline).
const bands = [];
let start = null;
const redRowCount = (y) => {
  let n = 0;
  for (let x = 0; x < width; x++) if (isRed(x, y)) n++;
  return n;
};
for (let y = 0; y < height; y++) {
  if (redRowCount(y) > 0) {
    if (start === null) start = y;
  } else if (start !== null) {
    bands.push([start, y - 1]);
    start = null;
  }
}
if (start !== null) bands.push([start, height - 1]);
const [yT, yB] = bands.sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
let gxL = width, gxR = -1;
for (let y = yT; y <= yB; y++)
  for (let x = 0; x < width; x++) if (isRed(x, y)) { if (x < gxL) gxL = x; if (x > gxR) gxR = x; }
const gw = gxR - gxL + 1, gh = yB - yT + 1;
console.log(`glyph: ${gw}x${gh} at x${gxL},y${yT}`);

// Bilinear sample of the glyph region, alpha-weighted (no dark halos).
function drawGlyph(target, cx, cy, drawH) {
  const drawW = (gw / gh) * drawH;
  const x0 = cx - drawW / 2, y0 = cy - drawH / 2;
  const { width: tw, data: td } = target;
  for (let py = 0; py < Math.ceil(drawH); py++) {
    for (let px = 0; px < Math.ceil(drawW); px++) {
      const fx = gxL + ((px + 0.5) / drawW) * gw - 0.5;
      const fy = yT + ((py + 0.5) / drawH) * gh - 0.5;
      const sx = Math.max(0, Math.min(width - 2, Math.floor(fx)));
      const sy = Math.max(0, Math.min(height - 2, Math.floor(fy)));
      const dx = fx - sx, dy = fy - sy;
      let ar = 0, ag = 0, ab = 0, aw = 0;
      for (const [ox, oy, wgt] of [[0,0,(1-dx)*(1-dy)],[1,0,dx*(1-dy)],[0,1,(1-dx)*dy],[1,1,dx*dy]]) {
        const si = ((sy + oy) * width + (sx + ox)) * 4;
        const a = (data[si + 3] / 255) * wgt;
        ar += data[si] * a; ag += data[si + 1] * a; ab += data[si + 2] * a; aw += a;
      }
      if (aw < 0.02) continue;
      const di = ((py + Math.round(y0)) * tw + (px + Math.round(x0))) * 4;
      td[di] = ar / aw; td[di + 1] = ag / aw; td[di + 2] = ab / aw;
      td[di + 3] = Math.max(td[di + 3], Math.round(Math.min(1, aw) * 255));
    }
  }
}

const BG = [16, 32, 63]; // deep navy from the brand ramp

// Navy square (optionally rounded) with the red glyph centered.
function brandIcon(size, radiusPct) {
  const out = new PNG({ width: size, height: size });
  const r = Math.round(size * radiusPct);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (r > 0) {
        const dx = Math.max(r - x, x - (size - 1 - r), 0);
        const dy = Math.max(r - y, y - (size - 1 - r), 0);
        if (Math.hypot(dx, dy) > r + 0.5) continue; // outside the rounded corner
      }
      out.data[i] = BG[0]; out.data[i + 1] = BG[1]; out.data[i + 2] = BG[2];
      out.data[i + 3] = 255;
    }
  }
  drawGlyph(out, size / 2, size / 2, Math.round(size * 0.61));
  return out;
}

// ICO container holding PNG-encoded entries (read by every modern browser).
function buildIco(pngs) {
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(1, 2); // type: icon
  dir.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = [], blobs = [];
  for (const { size, png } of pngs) {
    const bytes = PNG.sync.write(png);
    const e = Buffer.alloc(16);
    e[0] = size === 256 ? 0 : size;
    e[1] = size === 256 ? 0 : size;
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(bytes.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += bytes.length;
    entries.push(e);
    blobs.push(bytes);
  }
  return Buffer.concat([dir, ...entries, ...blobs]);
}

fs.writeFileSync(
  'src/app/favicon.ico',
  buildIco([16, 32, 48].map((s) => ({ size: s, png: brandIcon(s, 0.225) }))),
);
fs.writeFileSync('src/app/icon.png', PNG.sync.write(brandIcon(192, 0.225)));
fs.writeFileSync('src/app/apple-icon.png', PNG.sync.write(brandIcon(180, 0)));
fs.writeFileSync('public/icon-192.png', PNG.sync.write(brandIcon(192, 0)));
fs.writeFileSync('public/icon-512.png', PNG.sync.write(brandIcon(512, 0)));
console.log('wrote favicon.ico (16/32/48), icon.png (192), apple-icon.png (180), icon-192/512 (square)');

// --- White wordmark for dark panels: dark text -> white, blue -> light blue ---
const white = new PNG({ width, height });
white.data = Buffer.from(data);
for (let i = 0; i < white.data.length; i += 4) {
  const [r, g, b] = [white.data[i], white.data[i + 1], white.data[i + 2]];
  if (white.data[i + 3] === 0) continue;
  if (r < 90 && g < 90 && b < 90) {
    white.data[i] = 255; white.data[i + 1] = 255; white.data[i + 2] = 255;
  } else if (b > 120 && r < 110 && g < 130) {
    white.data[i] = 0xbf; white.data[i + 1] = 0xd3; white.data[i + 2] = 0xf2;
  }
}
fs.writeFileSync('public/logo-white.png', PNG.sync.write(white));
console.log('wrote public/logo-white.png');
