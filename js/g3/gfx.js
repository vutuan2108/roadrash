'use strict';
// ============ three.js helpers: colour, noise, geometry baking/merging, procedural textures, materials ============
const G3 = (() => {
  const T = THREE;
  T.ColorManagement.legacyMode = false;            // hex colours are sRGB, lighting is done in linear space
  const _c = new T.Color();
  const lin = h => { _c.set(h); return [_c.r, _c.g, _c.b]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const smooth = (a, b, x) => { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ---------------- noise ----------------
  function hash(x, y) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct = 4) {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += vnoise(x * f + i * 17.3, y * f - i * 9.1) * a; n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  }

  // ---------------- atlas (one texture shared by every prop) ----------------
  const AW = 2048, AH = 1024;
  const CELL = {
    white: [1280, 0, 64, 64], glow: [1344, 0, 64, 64], chev0: [1472, 0, 128, 128], chev1: [1600, 0, 128, 128],
    km: [1728, 0, 64, 128], gate0: [512, 640, 512, 128], gate1: [1024, 640, 512, 128],
    truckS: [1024, 512, 512, 128], truckB: [1536, 512, 256, 128], shop: [1792, 512, 256, 128],
  };
  CELL.lorryB = [0, 768, 256, 256]; CELL.lorryS = [256, 768, 768, 256];                     // box lorry: rear doors, sides
  for (let i = 0; i < 4; i++) { CELL['plW' + i] = [1280 + i * 192, 128, 192, 40]; CELL['plY' + i] = [1280 + i * 192, 176, 192, 40]; }   // number plates
  for (let i = 0; i < 5; i++) CELL['plM' + i] = [1280 + i * 128, 224, 128, 96];                                                     // motorbike plates
  for (let i = 0; i < 10; i++) CELL['fac' + i] = [i * 128, 0, 128, 512];
  for (let i = 0; i < 6; i++) CELL['bb' + i] = [(i % 4) * 256, 512 + (i / 4 | 0) * 128, 256, 128];
  const uvRect = k => { const [x, y, w, h] = CELL[k]; return [(x + 1) / AW, 1 - (y + h - 1) / AH, (x + w - 1) / AW, 1 - (y + 1) / AH]; };
  const WHITE = [(1280 + 32) / AW, 1 - 32 / AH];
  const FAC_FLOORS = [3, 5, 4, 6, 3, 7, 4, 5, 8, 4];

  // ---------------- Mesher: bake many transformed parts into per-material vertex buffers ----------------
  const _v = new T.Vector3(), _n = new T.Vector3(), _nm = new T.Matrix3();
  class Mesher {
    constructor(seed) { this.parts = {}; this.rnd = U.rng(seed || 7); }
    // geo: BufferGeometry, m: Matrix4, col: hex | [r,g,b] (linear) | fn(x,y,z)->[r,g,b]
    // o: { flat: face normals, jit: per-face brightness jitter, uv: atlas cell name (maps geometry uv into it) }
    add(geo, m, col, key = 'lam', o = {}) {
      const g = geo.index ? geo.toNonIndexed() : geo;
      const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
      const b = this.parts[key] || (this.parts[key] = { p: [], n: [], c: [], u: [] });
      _nm.getNormalMatrix(m);
      const base = typeof col === 'function' ? null : Array.isArray(col) ? col : lin(col);
      const rect = o.uv ? (Array.isArray(o.uv) ? o.uv : uvRect(o.uv)) : null;
      const p0 = b.p.length;
      for (let i = 0; i < P.count; i++) {
        _v.fromBufferAttribute(P, i).applyMatrix4(m); b.p.push(_v.x, _v.y, _v.z);
        _n.fromBufferAttribute(N, i);
        if (o.uvFn && UV) { const r = o.uvFn(UV.getX(i), UV.getY(i), _n.x, _n.y, _n.z); b.u.push(r[0], r[1]); }
        else if (o.raw && UV) b.u.push(UV.getX(i), UV.getY(i));
        else if (rect && UV) b.u.push(rect[0] + UV.getX(i) * (rect[2] - rect[0]), rect[1] + UV.getY(i) * (rect[3] - rect[1]));
        else b.u.push(WHITE[0], WHITE[1]);
        _n.applyMatrix3(_nm).normalize(); b.n.push(_n.x, _n.y, _n.z);
        const c = base || col(_v.x, _v.y, _v.z); b.c.push(c[0], c[1], c[2]);
      }
      if (o.flat || o.jit) {
        const p = b.p, n = b.n, c = b.c;
        for (let i = p0; i < p.length; i += 9) {
          if (o.flat) {
            const ax = p[i + 3] - p[i], ay = p[i + 4] - p[i + 1], az = p[i + 5] - p[i + 2];
            const bx = p[i + 6] - p[i], by = p[i + 7] - p[i + 1], bz = p[i + 8] - p[i + 2];
            let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
            const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
            for (let k = 0; k < 9; k += 3) { n[i + k] = nx; n[i + k + 1] = ny; n[i + k + 2] = nz; }
          }
          if (o.jit) { const f = 1 + (this.rnd() * 2 - 1) * o.jit; for (let k = 0; k < 9; k++) c[i + k] *= f; }
        }
      }
      return this;
    }
    proto() {   // typed arrays per material key, for instancing through Bag
      const out = {};
      for (const k in this.parts) {
        const b = this.parts[k];
        out[k] = { p: new Float32Array(b.p), n: new Float32Array(b.n), c: new Float32Array(b.c), u: new Float32Array(b.u), count: b.p.length / 3 };
      }
      return out;
    }
    geos() { const pr = this.proto(), out = {}; for (const k in pr) out[k] = geo(pr[k]); return out; }
  }
  function geo(b) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(b.p, 3));
    g.setAttribute('normal', new T.BufferAttribute(b.n, 3));
    g.setAttribute('color', new T.BufferAttribute(b.c, 3));
    g.setAttribute('uv', new T.BufferAttribute(b.u, 2));
    g.computeBoundingSphere();
    return g;
  }
  // Bag: merge many prototype instances (each with its own matrix and tint) into a few big geometries
  class Bag {
    constructor() { this.items = {}; }
    put(proto, m, tint) { for (const k in proto) (this.items[k] || (this.items[k] = [])).push([proto[k], m, tint]); }
    geos() {
      const out = {};
      for (const k in this.items) {
        const list = this.items[k]; let total = 0;
        for (const it of list) total += it[0].count;
        if (!total) continue;
        const P = new Float32Array(total * 3), N = new Float32Array(total * 3), C = new Float32Array(total * 3), UV = new Float32Array(total * 2);
        let o = 0;
        for (const [pr, m, t] of list) {
          const e = m.elements; _nm.getNormalMatrix(m); const q = _nm.elements;
          const tr = t ? t[0] : 1, tg = t ? t[1] : 1, tb = t ? t[2] : 1;
          for (let i = 0; i < pr.count; i++) {
            const x = pr.p[i * 3], y = pr.p[i * 3 + 1], z = pr.p[i * 3 + 2], j = (o + i) * 3;
            P[j] = e[0] * x + e[4] * y + e[8] * z + e[12];
            P[j + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
            P[j + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
            const nx = pr.n[i * 3], ny = pr.n[i * 3 + 1], nz = pr.n[i * 3 + 2];
            let ax = q[0] * nx + q[3] * ny + q[6] * nz, ay = q[1] * nx + q[4] * ny + q[7] * nz, az = q[2] * nx + q[5] * ny + q[8] * nz;
            const l = Math.hypot(ax, ay, az) || 1;
            N[j] = ax / l; N[j + 1] = ay / l; N[j + 2] = az / l;
            C[j] = pr.c[i * 3] * tr; C[j + 1] = pr.c[i * 3 + 1] * tg; C[j + 2] = pr.c[i * 3 + 2] * tb;
            UV[(o + i) * 2] = pr.u[i * 2]; UV[(o + i) * 2 + 1] = pr.u[i * 2 + 1];
          }
          o += pr.count;
        }
        out[k] = geo({ p: P, n: N, c: C, u: UV });
      }
      return out;
    }
  }

  // ---------------- canvas textures ----------------
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(c, o = {}) {
    const t = new T.CanvasTexture(c);
    if (!o.linear) t.encoding = T.sRGBEncoding;
    t.anisotropy = G.aniso;
    if (o.repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }
  const SANS = '"Arial", "Helvetica", sans-serif';
  function fitText(g, s, x, y, maxW, size, weight = 'bold') {
    let sz = size; g.font = `${weight} ${sz}px ${SANS}`;
    while (g.measureText(s).width > maxW && sz > 6) { sz--; g.font = `${weight} ${sz}px ${SANS}`; }
    g.fillText(s, x, y);
  }
  function grain(g, x, y, w, h, n, a, rnd) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${a * rnd()})` : `rgba(255,255,255,${a * rnd()})`;
      g.fillRect(x + rnd() * w, y + rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
    }
  }

  // Saigon "nhà ống" facades: colour canvas g, emissive (night lights) canvas e
  const SHOPS = [['PHỞ 24H', '#c81e1e'], ['CÀ PHÊ', '#5a3010'], ['TẠP HÓA', '#1f6fd0'], ['KARAOKE', '#8a1fa0'], ['BIA HƠI', '#d08a00'],
    ['KHÁCH SẠN', '#0f6a5a'], ['NHÀ THUỐC', '#109040'], ['SỬA XE', '#3050a0'], ['ĐIỆN THOẠI', '#e05010'], ['BÁNH MÌ', '#b05a10']];
  const WALLS = ['#e8c95a', '#e6a0a8', '#9cc4e0', '#a8d8b8', '#f0ece0', '#f0a050', '#b8b8c0', '#e8d8a0', '#c8a0d8', '#d8e8a0'];
  const NEON = ['#ff3a8a', '#3af0ff', '#ffe03a', '#7aff5a', '#ff7a2a'];
  function facade(g, e, i) {
    const x0 = i * 128, F = FAC_FLOORS[i], top = 512 - F * 64, rnd = U.rng(i * 71 + 5);
    g.fillStyle = WALLS[i]; g.fillRect(x0, top, 128, F * 64);
    grain(g, x0, top, 128, F * 64, 260, 0.08, rnd);
    for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(40,30,20,${0.04 + rnd() * 0.06})`; g.fillRect(x0 + rnd() * 128, top + rnd() * F * 64, 1 + rnd() * 3, 8 + rnd() * 40); }
    for (let f = 0; f < F; f++) {
      const y = 512 - (f + 1) * 64;
      if (f === 0) {
        const [label, sc] = SHOPS[i];
        g.fillStyle = '#2a2018'; g.fillRect(x0 + 6, y + 22, 116, 42);                                 // open shopfront
        for (let k = 0; k < 9; k++) { g.fillStyle = `hsl(${rnd() * 360},50%,${35 + rnd() * 25}%)`; g.fillRect(x0 + 10 + rnd() * 100, y + 34 + rnd() * 20, 6 + rnd() * 10, 4 + rnd() * 8); }
        g.fillStyle = '#7a7a80'; g.fillRect(x0 + 6, y + 20, 116, 3);
        g.fillStyle = sc; g.fillRect(x0 + 2, y + 3, 124, 17);                                         // sign board
        g.fillStyle = '#fff6d0'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, label, x0 + 64, y + 12, 116, 14);
        e.fillStyle = '#a07040'; e.fillRect(x0 + 6, y + 23, 116, 41);
        for (let k = 0; k < 4; k++) { e.fillStyle = 'rgba(255,220,150,0.5)'; e.fillRect(x0 + 10 + k * 28, y + 24, 18, 3); }
        e.fillStyle = U.mix(sc, '#000000', 0.5); e.fillRect(x0 + 2, y + 3, 124, 17);
        e.fillStyle = NEON[i % NEON.length]; e.textAlign = 'center'; e.textBaseline = 'middle'; fitText(e, label, x0 + 64, y + 12, 116, 14);
      } else {
        const lit = rnd() < 0.55, lit2 = rnd() < 0.4;
        g.fillStyle = '#3a4048'; g.fillRect(x0 + 18, y + 8, 92, 44);                                   // window/door bay
        g.fillStyle = lit ? '#d8b070' : '#24384a'; g.fillRect(x0 + 21, y + 10, 41, 40);
        g.fillStyle = lit2 ? '#d8b070' : '#2a4058'; g.fillRect(x0 + 66, y + 10, 41, 40);
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x0 + 23, y + 12, 8, 36); g.fillRect(x0 + 68, y + 12, 8, 36);
        if (lit) { e.fillStyle = '#ffc070'; e.fillRect(x0 + 21, y + 10, 41, 40); }
        if (lit2) { e.fillStyle = '#ffd890'; e.fillRect(x0 + 66, y + 10, 41, 40); }
        g.fillStyle = '#d8d8d0'; g.fillRect(x0 + 4, y + 56, 120, 6);                                   // balcony slab
        g.fillStyle = '#2a2a2e'; g.fillRect(x0 + 4, y + 40, 120, 2);
        for (let x = 6; x < 124; x += 6) g.fillRect(x0 + x, y + 40, 2, 16);                            // railing
        for (let k = 0; k < 3; k++) {                                                                  // potted plants
          const px = x0 + 10 + rnd() * 100;
          g.fillStyle = '#2f7a2a'; g.beginPath(); g.arc(px, y + 46, 5 + rnd() * 4, 0, 7); g.fill();
          g.fillStyle = '#3f9a3a'; g.beginPath(); g.arc(px + 2, y + 44, 3, 0, 7); g.fill();
        }
        if (rnd() < 0.5) { g.fillStyle = '#e8e8e8'; g.fillRect(x0 + (rnd() < 0.5 ? 4 : 106), y + 14, 18, 12); g.fillStyle = '#9a9a9a'; g.fillRect(x0 + 6, y + 16, 2, 8); }
      }
    }
    if (i % 3 === 0) {                                                                                 // vertical neon sign
      const lab = i === 0 ? 'KARAOKE' : i === 3 ? 'KHÁCH SẠN' : i === 6 ? 'MASSAGE' : 'NHÀ NGHỈ', ys = 512 - 64 * Math.min(F, 4) + 6, hgt = 64 * (Math.min(F, 4) - 1) - 12;
      g.fillStyle = '#20202a'; g.fillRect(x0 + 108, ys, 18, hgt); e.fillStyle = '#100810'; e.fillRect(x0 + 108, ys, 18, hgt);
      const ch = [...lab.replace(' ', '')], step = hgt / ch.length;
      g.font = `bold 13px ${SANS}`; e.font = g.font; g.textAlign = e.textAlign = 'center'; g.textBaseline = e.textBaseline = 'middle';
      ch.forEach((c, k) => { g.fillStyle = '#ff9ad0'; g.fillText(c, x0 + 117, ys + step * (k + 0.5)); e.fillStyle = NEON[(i + 1) % NEON.length]; e.fillText(c, x0 + 117, ys + step * (k + 0.5)); });
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x0, top, 128, 4);
  }
  const ADS = [['CÀ PHÊ SỮA ĐÁ', 'ĐẬM ĐÀ HƯƠNG VIỆT', '#5a3010', '#fff0c8', '#e0a050'], ['NƯỚC MÍA', 'SIÊU SẠCH - MÁT LẠNH', '#1f8a3a', '#ffe84a', '#ffffff'],
    ['SỬA XE MÁY', 'VÁ XE - THAY NHỚT 24/7', '#1f4fb0', '#ffffff', '#ffd23a'], ['BÁNH MÌ', 'NÓNG GIÒN - PATÊ GAN', '#e07a10', '#fff6e0', '#5a2a00'],
    ['NHÀ NGHỈ', 'MÁY LẠNH - WIFI - 200K', '#a01e6a', '#ffffff', '#ffd0f0'], ['PHỞ BÒ', 'GIA TRUYỀN NAM ĐỊNH', '#c01818', '#fff2a0', '#ffffff']];
  function billboard(g, i) {
    const [x, y] = CELL['bb' + i], [t1, t2, bg, c1, c2] = ADS[i], rnd = U.rng(i + 40);
    const gr = g.createLinearGradient(x, y, x, y + 128); gr.addColorStop(0, U.shade(bg, 0.15)); gr.addColorStop(1, U.shade(bg, -0.25));
    g.fillStyle = gr; g.fillRect(x, y, 256, 128);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(x + 210, y + 30, 70, 0, 7); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.35)'; fitText(g, t1, x + 130, y + 52, 236, 40, '900');
    g.fillStyle = c1; fitText(g, t1, x + 128, y + 50, 236, 40, '900');
    g.fillStyle = c2; fitText(g, t2, x + 128, y + 92, 230, 18);
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(x, y, 256, 4); g.fillRect(x, y + 124, 256, 4);
    grain(g, x, y, 256, 128, 120, 0.06, rnd);
  }
  function buildAtlas() {
    const cv = canvas(AW, AH), ce = canvas(AW, AH), g = cv.getContext('2d'), e = ce.getContext('2d');
    g.fillStyle = '#808080'; g.fillRect(0, 0, AW, AH); e.fillStyle = '#000'; e.fillRect(0, 0, AW, AH);
    const cell = (k, col) => { const [x, y, w, h] = CELL[k]; g.fillStyle = col; g.fillRect(x, y, w, h); };
    cell('white', '#ffffff'); cell('glow', '#fff4d0');
    { const [x, y, w, h] = CELL.glow; e.fillStyle = '#ffe0a0'; e.fillRect(x, y, w, h); }
    for (let i = 0; i < 10; i++) facade(g, e, i);
    for (let i = 0; i < 6; i++) {
      billboard(g, i);
      const [x, y] = CELL['bb' + i]; e.globalAlpha = 0.45; e.drawImage(cv, x, y, 256, 128, x, y, 256, 128); e.globalAlpha = 1;
    }
    for (const d of [0, 1]) {                                                                     // chevron curve signs
      const [x, y] = CELL['chev' + d];
      g.fillStyle = '#ffcc00'; g.fillRect(x, y, 128, 128); g.fillStyle = '#111'; g.fillRect(x, y, 128, 6); g.fillRect(x, y + 122, 128, 6);
      g.fillRect(x, y, 6, 128); g.fillRect(x + 122, y, 6, 128);
      for (const ox of [-26, 18]) {
        g.beginPath();
        const s = d ? 1 : -1, cx = x + 64 + ox * s;
        g.moveTo(cx - 18 * s, y + 22); g.lineTo(cx + 14 * s, y + 64); g.lineTo(cx - 18 * s, y + 106);
        g.lineTo(cx - 2 * s, y + 106); g.lineTo(cx + 30 * s, y + 64); g.lineTo(cx - 2 * s, y + 22); g.closePath(); g.fill();
      }
    }
    { const [x, y] = CELL.km;                                                                     // kilometre stone
      g.fillStyle = '#f4f4ee'; g.fillRect(x, y, 64, 128); g.fillStyle = '#d02020'; g.fillRect(x, y, 64, 52);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, 'QL1A', x + 32, y + 26, 58, 18);
      g.fillStyle = '#222'; fitText(g, 'KM', x + 32, y + 80, 56, 22); }
    for (const v of [0, 1]) {                                                                     // start / finish banners
      const [x, y] = CELL['gate' + v], gr = g.createLinearGradient(x, y, x, y + 128);
      gr.addColorStop(0, v ? '#202020' : '#d01818'); gr.addColorStop(1, v ? '#000' : '#7a0808');
      g.fillStyle = gr; g.fillRect(x, y, 512, 128);
      for (let k = 0; k < 32; k++) for (let r = 0; r < 2; r++) { g.fillStyle = (k + r) % 2 ? '#111' : '#fff'; g.fillRect(x + k * 16, y + r * 8, 16, 8); g.fillRect(x + k * 16, y + 112 + r * 8, 16, 8); }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#000'; fitText(g, v ? 'VỀ ĐÍCH' : 'XUẤT PHÁT', x + 259, y + 67, 470, 72, '900');
      g.fillStyle = '#ffd23a'; fitText(g, v ? 'VỀ ĐÍCH' : 'XUẤT PHÁT', x + 256, y + 64, 470, 72, '900');
    }
    { const [x, y] = CELL.truckS;                                                                 // lorry box sides / back
      g.fillStyle = '#eef0f2'; g.fillRect(x, y, 512, 128); g.fillStyle = '#1f4fb0'; g.fillRect(x, y + 92, 512, 18); g.fillStyle = '#d02020'; g.fillRect(x, y + 112, 512, 6);
      g.fillStyle = '#1f4fb0'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, 'VẬN TẢI BẮC - NAM', x + 256, y + 44, 480, 50, '900');
      g.fillStyle = '#d02020'; fitText(g, 'ĐT: 0909 123 456', x + 256, y + 78, 300, 18);
      g.fillStyle = 'rgba(0,0,0,0.15)'; for (let k = 1; k < 8; k++) g.fillRect(x + k * 64, y, 2, 128); }
    { const [x, y] = CELL.truckB;
      g.fillStyle = '#d8dce0'; g.fillRect(x, y, 256, 128); g.fillStyle = '#9aa0a8'; g.fillRect(x + 127, y, 3, 128);
      for (const k of [30, 98]) { g.fillStyle = '#7a8088'; g.fillRect(x + 4, y + k, 248, 4); }
      g.fillStyle = '#1f4fb0'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, 'VẬN TẢI', x + 128, y + 52, 230, 34, '900');
      g.fillStyle = '#d02020'; fitText(g, 'BẮC - NAM', x + 128, y + 82, 200, 20);
      g.fillStyle = '#ffcc00'; for (let k = 0; k < 8; k++) g.fillRect(x + k * 32 + (k % 2) * 8, y + 116, 16, 12); }
    // Vietnamese long number plates (520 x 110 mm): white = private, yellow = commercial transport
    ['51G-246.81', '30F-579.12', '43A-318.66', '29H-104.27', '51C-882.40', '29C-517.03', '15C-260.91', '61C-374.58'].forEach((t, i) => {
      const [x, y, w, h] = CELL[(i < 4 ? 'plW' : 'plY') + (i % 4)];
      g.fillStyle = '#151515'; g.fillRect(x, y, w, h);
      g.fillStyle = i < 4 ? '#f2f2ee' : '#f0bf1a'; g.fillRect(x + 3, y + 3, w - 6, h - 6);
      g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, t, x + w / 2, y + h / 2 + 1, w - 16, 30, '700');
    });
    // Vietnamese motorbike plates (190 x 140 mm, two lines); the last one is the police bike's blue plate
    [['59-T1', '234.56'], ['29-B1', '678.90'], ['51-F2', '136.48'], ['43-K1', '802.17'], ['80-CS', '113.05']].forEach(([a, b], i) => {
      const [x, y, w, h] = CELL['plM' + i], pol = i === 4;
      g.fillStyle = '#151515'; g.fillRect(x, y, w, h);
      g.fillStyle = pol ? '#1d3a9a' : '#f2f2ee'; g.fillRect(x + 4, y + 4, w - 8, h - 8);
      g.fillStyle = pol ? '#f4f4f4' : '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
      fitText(g, a, x + w / 2, y + h * 0.3, w - 18, 34, '700'); fitText(g, b, x + w / 2, y + h * 0.72, w - 18, 34, '700');
    });
    const tape = (x, y, w, h, vertical) => {                                                     // red / white reflective tape
      const n = Math.ceil((vertical ? h : w) / 14);
      for (let k = 0; k < n; k++) { g.fillStyle = k % 2 ? '#f4f4f4' : '#d81a1a'; vertical ? g.fillRect(x, y + k * 14, w, Math.min(14, h - k * 14)) : g.fillRect(x + k * 14, y, Math.min(14, w - k * 14), h); }
    };
    { const [x, y, w, h] = CELL.lorryS;                                                           // lorry box side
      const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#f6f7f9'); gr.addColorStop(1, '#d9dde3');
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      for (let k = 1; k < 16; k++) { g.fillStyle = 'rgba(0,0,0,0.09)'; g.fillRect(x + k * w / 16, y, 2, h); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + k * w / 16 + 2, y, 1, h); }
      g.fillStyle = '#1f4fb0'; g.fillRect(x, y + 168, w, 22); g.fillStyle = '#d02020'; g.fillRect(x, y + 192, w, 7);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#1f4fb0'; fitText(g, 'VẬN TẢI BẮC - NAM', x + w / 2, y + 78, w - 90, 84, '900');
      g.fillStyle = '#d02020'; fitText(g, 'HOTLINE: 0909 123 456', x + w / 2, y + 140, 420, 30, '700');
      tape(x, y + h - 30, w, 14); }
    { const [x, y, w, h] = CELL.lorryB;                                                           // lorry rear doors
      g.fillStyle = '#e3e6ea'; g.fillRect(x, y, w, h);
      for (let k = 0; k < 9; k++) { g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(x, y + 14 + k * 28, w, 3); }
      g.fillStyle = '#7d838c'; g.fillRect(x + 126, y, 4, h);
      tape(x, y, 12, h, true); tape(x + w - 12, y, 12, h, true); tape(x, y, w, 10);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#151515';
      fitText(g, '51C-882.40', x + w / 2, y + 150, 210, 40, '900');                               // plate number painted on the doors (required)
      g.fillStyle = '#1f4fb0'; fitText(g, 'VẬN TẢI BẮC - NAM', x + w / 2, y + 60, 200, 22, '900'); }
    { const [x, y] = CELL.shop;                                                                   // country shop front (houses)
      g.fillStyle = '#3a2a1c'; g.fillRect(x, y, 256, 128); g.fillStyle = '#d8c8a0'; g.fillRect(x, y, 256, 30);
      g.fillStyle = '#b01818'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, 'TẠP HÓA - GIẢI KHÁT', x + 128, y + 15, 240, 20);
      for (let k = 0; k < 14; k++) { g.fillStyle = `hsl(${k * 47 % 360},55%,50%)`; g.fillRect(x + 10 + k * 17, y + 50 + (k % 3) * 22, 12, 16); } }
    return { map: tex(cv), emis: tex(ce) };
  }

  // tiling textures
  function pnoise(x, y, P) {   // value noise that repeats every P units (for seamless tiles)
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = k => ((k % P) + P) % P;
    const a = hash(w(xi), w(yi)), b = hash(w(xi + 1), w(yi)), c = hash(w(xi), w(yi + 1)), d = hash(w(xi + 1), w(yi + 1));
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function detailTex() {   // grey-scale grain used to break up vertex-coloured terrain
    const c = canvas(256, 256), g = c.getContext('2d'), d = g.createImageData(256, 256), rnd = U.rng(5);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const n = pnoise(x / 32, y / 32, 8) * 0.4 + pnoise(x / 8, y / 8, 32) * 0.35 + pnoise(x / 2, y / 2, 128) * 0.1 + rnd() * 0.15;
      const v = 150 + n * 105, i = (y * 256 + x) * 4;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    return tex(c, { repeat: true });
  }
  function roadTex(theme, look) {
    const c = canvas(512, 1024), g = c.getContext('2d'), rnd = U.rng(11), PX = 51.2;
    g.fillStyle = look.asphalt; g.fillRect(0, 0, 512, 1024);
    for (let i = 0; i < 9000; i++) {
      const v = rnd(); g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.05 + rnd() * 0.12})` : `rgba(255,255,255,${0.04 + rnd() * 0.1})`;
      g.fillRect(rnd() * 512, rnd() * 1024, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    for (const lx of [-2.5, 2.5]) for (const w of [-0.75, 0.75]) {                                 // darker wheel tracks
      const cx = 256 + (lx + w) * PX, gr = g.createLinearGradient(cx - 18, 0, cx + 18, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(cx - 18, 0, 36, 1024);
    }
    for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(40 + rnd() * 380, rnd() * 900, 30 + rnd() * 70, 40 + rnd() * 120); }  // patches
    for (let i = 0; i < 6; i++) {                                                                  // cracks
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.beginPath();
      let x = rnd() * 512, y = rnd() * 1024; g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += (rnd() - 0.5) * 30; y += rnd() * 18; g.lineTo(x, y); }
      g.stroke();
    }
    const paint = (x, w, y0, y1, col) => {
      g.fillStyle = col; g.fillRect(x, y0, w, y1 - y0);
      for (let i = 0; i < (y1 - y0) / 3; i++) { g.fillStyle = `rgba(60,60,60,${rnd() * 0.35})`; g.fillRect(x + rnd() * w, y0 + rnd() * (y1 - y0), 2, 2); }
    };
    for (const s of [-1, 1]) paint(256 + s * 4.62 * PX - 4, 8, 0, 1024, '#e8e8e2');               // edge lines
    const lc = look.centre;
    if (lc === 'double') { paint(244, 7, 0, 1024, '#f0c020'); paint(261, 7, 0, 1024, '#f0c020'); }
    else for (const y0 of [0, 512]) paint(252, 8, y0, y0 + 205, lc === 'dashY' ? '#f0d040' : '#ececE6');
    return tex(c, { repeat: true });
  }
  function radialTex(inner, outer) {
    const c = canvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return tex(c);
  }
  function cloudTex() {
    const c = canvas(256, 128), g = c.getContext('2d'), rnd = U.rng(3);
    for (let i = 0; i < 26; i++) {
      const x = 40 + rnd() * 176, y = 50 + rnd() * 40 - Math.abs(x - 128) * 0.2, r = 18 + rnd() * 26;
      const gr = g.createRadialGradient(x, y - r * 0.3, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(240,244,250,0.7)'); gr.addColorStop(1, 'rgba(220,228,240,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    g.globalCompositeOperation = 'source-atop';
    const sh = g.createLinearGradient(0, 40, 0, 120); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(70,90,120,0.35)');
    g.fillStyle = sh; g.fillRect(0, 0, 256, 128);
    return tex(c);
  }
  function waterNormals() {
    const S = 256, c = canvas(S, S), g = c.getContext('2d'), d = g.createImageData(S, S);
    const h = (x, y) => Math.sin(x * 0.098) * 0.5 + Math.sin((x + y) * 0.074) * 0.6 + Math.sin(y * 0.147 - x * 0.05) * 0.4
      + Math.sin(x * 0.3 + y * 0.21) * 0.15 + Math.sin(y * 0.39 - x * 0.27) * 0.12;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1), l = Math.hypot(dx, dy, 1.2), i = (y * S + x) * 4;
      d.data[i] = (-dx / l * 0.5 + 0.5) * 255; d.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; d.data[i + 2] = (1.2 / l * 0.5 + 0.5) * 255; d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    return tex(c, { repeat: true, linear: true });
  }
  function towerTex(emissive) {   // repeating office-tower window grid (4 m x 4 m per cell)
    const c = canvas(64, 64), g = c.getContext('2d'), rnd = U.rng(emissive ? 9 : 9);
    g.fillStyle = emissive ? '#000' : '#5a6270'; g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const on = rnd() < 0.45;
      g.fillStyle = emissive ? (on ? (rnd() < 0.5 ? '#ffd890' : '#cfe8ff') : '#000') : (on ? '#c8b890' : '#2a3a4a');
      g.fillRect(x * 16 + 3, y * 16 + 4, 10, 9);
    }
    return tex(c, { repeat: true });
  }

  // ---------------- shared materials ----------------
  const G = {
    T, lin, mix, mul, smooth, hash, vnoise, fbm, Mesher, Bag, geo, canvas, tex, uvRect, CELL, FAC_FLOORS, SANS, fitText,
    roadTex, radialTex, aniso: 4, mats: null, tx: null,
    init(renderer) {
      this.aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const atlas = buildAtlas();
      this.tx = { atlas, detail: detailTex(), glow: radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0.35)'),
        pool: radialTex('rgba(255,220,150,0.9)', 'rgba(255,200,120,0.4)'), cloud: cloudTex(), water: waterNormals(),
        tower: towerTex(false), towerE: towerTex(true) };
      this.tx.water.repeat.set(1, 1);
      const S = T.MeshStandardMaterial, L = T.MeshLambertMaterial;
      this.mats = {
        lam: new L({ vertexColors: true, map: atlas.map }),                                     // props, clothes, tyres
        lamNight: new L({ vertexColors: true, map: atlas.map, emissive: 0xffffff, emissiveMap: atlas.emis }),
        terrain: new L({ vertexColors: true, map: this.tx.detail }),
        paint: new S({ vertexColors: true, roughness: 0.32, metalness: 0.25 }),
        carPaint: new S({ vertexColors: true, roughness: 0.26, metalness: 0.3 }),            // glossy car paint
        chrome: new S({ vertexColors: true, roughness: 0.2, metalness: 1.0 }),
        glass: new S({ vertexColors: true, roughness: 0.06, metalness: 0.7 }),
        light: new T.MeshBasicMaterial({ vertexColors: true }),
        tower: new L({ map: this.tx.tower, vertexColors: true }),
        towerNight: new L({ map: this.tx.tower, vertexColors: true, emissive: 0xffffff, emissiveMap: this.tx.towerE }),
      };
    },
  };
  return G;
})();
