// Extracts the brand palette from the logo by frequency + clustering,
// then writes a transparent-background, tightly-cropped PNG to public/.
import fs from 'node:fs';
import { PNG } from 'pngjs';

const src = new PNG({ filterType: 4 });
src.parse(fs.readFileSync(process.argv[2] ?? 'C:/Users/danda/Downloads/danraph-logo.png'));

src.on('parsed', () => {
  const { width, height, data } = src;

  // --- 1. Color frequency over opaque, non-near-white pixels ---
  const freq = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 235 && g > 235 && b > 235) continue; // skip background white
    const key = `${r >> 3},${g >> 3},${b >> 3}`; // 5-bit buckets
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log('top color buckets (5-bit):');
  for (const [k, n] of top) {
    const [r, g, b] = k.split(',').map((v) => (v << 3) + 4);
    console.log(`  rgb(${r},${g},${b})  x${n}`);
  }

  // --- 2. Collect exact pixels for each family (red / blue / dark) ---
  const reds = [], blues = [], darks = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 235 && g > 235 && b > 235) continue;
    if (r > 140 && g < 90 && b < 90) reds.push([r, g, b]);
    else if (b > 120 && r < 110 && g < 130) blues.push([r, g, b]);
    else if (r < 90 && g < 90 && b < 90) darks.push([r, g, b]);
  }
  const avg = (arr) => {
    if (!arr.length) return null;
    const s = arr.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]);
    return s.map((v) => Math.round(v / arr.length));
  };
  const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
  const red = avg(reds), blue = avg(blues), dark = avg(darks);
  console.log('red avg :', red ? hex(red) : 'none', `(${reds.length}px)`);
  console.log('blue avg:', blue ? hex(blue) : 'none', `(${blues.length}px)`);
  console.log('dark avg:', dark ? hex(dark) : 'none', `(${darks.length}px)`);

  // --- 3. Trim near-white border rows/cols, then export transparent PNG ---
  const isWhite = (x, y) => {
    const i = (y * width + x) * 4;
    return data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235;
  };
  let yTop = 0, yBot = height - 1, xLeft = 0, xRight = width - 1;
  const rowBlank = (y) => { for (let x = 0; x < width; x++) if (!isWhite(x, y)) return false; return true; };
  const colBlank = (x) => { for (let y = 0; y < height; y++) if (!isWhite(x, y)) return false; return true; };
  while (yTop < yBot && rowBlank(yTop)) yTop++;
  while (yBot > yTop && rowBlank(yBot)) yBot--;
  while (xLeft < xRight && colBlank(xLeft)) xLeft++;
  while (xRight > xLeft && colBlank(xRight)) xRight--;
  const pad = 8;
  yTop = Math.max(0, yTop - pad); xLeft = Math.max(0, xLeft - pad);
  yBot = Math.min(height - 1, yBot + pad); xRight = Math.min(width - 1, xRight + pad);
  const w = xRight - xLeft + 1, h = yBot - yTop + 1;
  console.log(`crop: ${width}x${height} -> ${w}x${h}`);

  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((y + yTop) * width + (x + xLeft)) * 4;
      const di = (y * w + x) * 4;
      const r = data[si], g = data[si + 1], b = data[si + 2];
      // Feather the edge: pixels close to white become progressively transparent
      const lum = (r + g + b) / 3;
      const whiteDist = Math.max(235 - Math.min(r, g, b), 0) / 235;
      out.data[di] = r; out.data[di + 1] = g; out.data[di + 2] = b;
      out.data[di + 3] = r > 235 && g > 235 && b > 235 ? 0 : Math.round(Math.min(1, whiteDist * 3) * 255);
    }
  }
  fs.mkdirSync('public', { recursive: true });
  fs.writeFileSync('public/logo.png', PNG.sync.write(out));
  console.log('wrote public/logo.png');

  fs.writeFileSync('scripts/palette.json', JSON.stringify({ red: hex(red), blue: hex(blue), dark: hex(dark) }, null, 2));
  console.log('wrote scripts/palette.json');
});
