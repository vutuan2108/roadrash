// One image of a .glb as a WebP data URI in a text file (for build_car.js cfg.tex: a livery painted in the model's body
// texture, or a layer of decals). usage: node tex_img.js file.glb imageIndex out.txt [size = 2048] [mode] [quality = 0.88]
// The alpha channel says where the car's paint shows through (the game multiplies the paint into those texels):
//   mode 'paint:#rrggbb:tol[:minArea]'  texels within tol (0-441) of that base colour are paint - stored white, so the
//        car's paint shows as it is. Only patches larger than minArea (share of the image, default 0.002) count: the
//        small ones are parts of a logo
//   mode 'neutral[:minArea]'  a wrap with no one base colour (a white to black fade under the artwork): the smooth grey
//        texels joined into large patches (default 0.012 of the image) are paint - kept as they are, so the fade stays
//   mode 'overlay'  the image's own alpha says where its artwork is (a body skin of decals over the paint: paint where
//        the image is clear)
//   mode 'alpha'  the image's own alpha is kept (a see-through decal layer of its own)
//   mode 'none' (default)  no paint anywhere: the texture as it is
// alpha is stored as 128 (paint) .. 255 (texture): a canvas keeps no colour under a low alpha
// (headless Edge re-encodes it: PUPPETEER points at puppeteer-core, as for pp.js)
const fs = require('fs');
const puppeteer = require(process.env.PUPPETEER || 'puppeteer-core');
const [file, idx, out, size = 2048, mode = 'none', q = 0.88] = process.argv.slice(2);
const buf = fs.readFileSync(file);
let off = 12, g, bin;
while (off < buf.length) { const len = buf.readUInt32LE(off), type = buf.toString('ascii', off + 4, off + 8), d = buf.subarray(off + 8, off + 8 + len);
  if (type.startsWith('JSON')) g = JSON.parse(d.toString('utf8')); else bin = d; off += 8 + len; }
const im = g.images[+idx], bv = g.bufferViews[im.bufferView], bytes = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--user-data-dir=F:/hb_tmp/edgeprof_pp'] });
  const page = await browser.newPage();
  const res = await page.evaluate(async (src, size, mode, q) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, size, size);
    const D = x.getImageData(0, 0, size, size), d = D.data, n = size * size, M = mode.split(':');
    let share = 0;
    if (M[0] === 'paint' || M[0] === 'neutral') {
      // candidates: texels that could be bare paint
      const cand = new Uint8Array(n);
      if (M[0] === 'paint') {
        const b = [1, 3, 5].map(i => parseInt(M[1].slice(i, i + 2), 16)), tol = +M[2];
        for (let i = 0; i < n; i++) cand[i] = Math.hypot(d[i * 4] - b[0], d[i * 4 + 1] - b[1], d[i * 4 + 2] - b[2]) < tol ? 1 : 0;
      } else {
        const L = new Float32Array(n);
        for (let i = 0; i < n; i++) L[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
        const edge = new Uint8Array(n);
        for (let y = 1; y < size - 1; y++) for (let xx = 1; xx < size - 1; xx++) { const i = y * size + xx;
          if (Math.abs(L[i + 1] - L[i - 1]) + Math.abs(L[i + size] - L[i - size]) > 7) edge[i] = 1; }
        for (let y = 2; y < size - 2; y++) for (let xx = 2; xx < size - 2; xx++) { const i = y * size + xx;
          const grey = Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) - Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) <= 14;
          let e = 0; for (let dy = -2; dy <= 2 && !e; dy++) for (let dx = -2; dx <= 2; dx++) if (edge[i + dy * size + dx]) { e = 1; break; }
          cand[i] = grey && !e ? 1 : 0; }
      }
      // keep the large connected patches of candidates
      const minA = +(M[0] === 'paint' ? M[3] || 0.002 : M[1] || 0.012) * n, lab = new Int32Array(n), stack = new Int32Array(n), paint = new Uint8Array(n);
      let id = 0;
      for (let s = 0; s < n; s++) {
        if (!cand[s] || lab[s]) continue;
        id++; let top = 0, cnt = 0; stack[top++] = s; lab[s] = id; const first = [];
        const items = [];
        while (top) { const i = stack[--top]; cnt++; items.push(i); const xx = i % size;
          if (xx > 0 && cand[i - 1] && !lab[i - 1]) { lab[i - 1] = id; stack[top++] = i - 1; }
          if (xx < size - 1 && cand[i + 1] && !lab[i + 1]) { lab[i + 1] = id; stack[top++] = i + 1; }
          if (i >= size && cand[i - size] && !lab[i - size]) { lab[i - size] = id; stack[top++] = i - size; }
          if (i < n - size && cand[i + size] && !lab[i + size]) { lab[i + size] = id; stack[top++] = i + size; } }
        if (cnt >= minA) for (const i of items) paint[i] = 1;
      }
      // neutral: the paint grows back over the rim its edge test took off (up to the artwork's outline)
      if (M[0] === 'neutral') for (let it = 0; it < 3; it++) { const p2 = paint.slice();
        for (let y = 1; y < size - 1; y++) for (let xx = 1; xx < size - 1; xx++) { const i = y * size + xx;
          if (!paint[i] && (paint[i - 1] || paint[i + 1] || paint[i - size] || paint[i + size]) &&
            Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) - Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) <= 14) p2[i] = 1; }
        paint.set(p2); }
      // soft edge (3x3), alpha 128 (paint) .. 255 (texture); a paint mode's bare texels are stored white
      for (let y = 0; y < size; y++) for (let xx = 0; xx < size; xx++) { const i = y * size + xx; let s = 0, k = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, x2 = xx + dx; if (yy < 0 || x2 < 0 || yy >= size || x2 >= size) continue; s += paint[yy * size + x2]; k++; }
        const m = 1 - s / k; share += 1 - m;
        if (M[0] === 'paint' && m === 0) d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255;
        d[i * 4 + 3] = Math.round(128 + 127 * m); }
      share /= n;
    } else if (M[0] === 'overlay') {
      for (let i = 0; i < n; i++) { const a = d[i * 4 + 3] / 255; share += 1 - a;
        for (let k = 0; k < 3; k++) d[i * 4 + k] = Math.round(255 + (d[i * 4 + k] - 255) * a);
        d[i * 4 + 3] = Math.round(128 + 127 * a); }
      share /= n;
    } else if (M[0] !== 'alpha') for (let i = 0; i < n; i++) d[i * 4 + 3] = 255;
    x.putImageData(D, 0, 0);
    return { uri: c.toDataURL('image/webp', q), share };
  }, 'data:' + im.mimeType + ';base64,' + bytes.toString('base64'), +size, mode, +q);
  await browser.close();
  fs.writeFileSync(out, res.uri);
  if (process.env.PNG) fs.writeFileSync(process.env.PNG, Buffer.from(res.uri.split(',')[1], 'base64'));
  console.log('wrote', out, (res.uri.length / 1024).toFixed(0), 'KB', im.mimeType, '->', size + 'px webp q' + q, mode, 'paint share', res.share.toFixed(3));
})().catch(e => { console.error(e); process.exit(1); });
