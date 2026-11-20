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
  // circuit furniture: sponsor boards, the crowd, braking markers, the event banner, pit garages and hospitality glass
  for (let i = 0; i < 9; i++) CELL['ad' + i] = [1280 + (i % 3) * 256, 320 + (i / 3 | 0) * 64, 256, 64];
  for (let i = 0; i < 3; i++) CELL['brk' + i] = [1280 + i * 64, 768, 64, 128];
  Object.assign(CELL, { crowd: [1024, 768, 256, 256], gpb: [1536, 768, 512, 128], garage: [1280, 896, 256, 128], vip: [1536, 896, 512, 128] });
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
    // raw triangles (flat arrays: positions, normals, uvs, colours), already placed
    raw(key, P, N, UV, C) {
      const b = this.parts[key] || (this.parts[key] = { p: [], n: [], c: [], u: [] });
      for (let i = 0; i < P.length; i++) { b.p.push(P[i]); b.n.push(N[i]); b.c.push(C[i]); }
      for (let i = 0; i < UV.length; i++) b.u.push(UV[i]);
      return this;
    }
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
  // made-up trackside sponsors (no real brands)
  const GP_ADS = [['NHỚT SIÊU TỐC', '#c81e1e', '#ffffff'], ['LỐP BÁM ĐƯỜNG', '#141414', '#ffd23a'], ['XĂNG 95 VIỆT', '#1f4fb0', '#ffffff'],
    ['HIGHWAY BRAWL', '#ffd23a', '#141414'], ['CÀ PHÊ SỮA ĐÁ', '#5a3010', '#fff0c8'], ['BẢO HIỂM MOTO', '#0f6a5a', '#ffffff'],
    ['NƯỚC TĂNG LỰC', '#e05010', '#ffffff'], ['PHỤ TÙNG XỊN', '#202a3a', '#3af0ff'], ['MŨ BẢO HIỂM TỐT', '#f2f2f2', '#c81e1e']];
  function gpAd(g, x, y, w, h, i) {
    const [t, bg, fg] = GP_ADS[i % GP_ADS.length];
    g.fillStyle = bg; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x, y, w, h * 0.42);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, t, x + w / 2, y + h / 2 + 1, w - 18, h * 0.62, '900');
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y + h - 3, w, 3); g.fillRect(x + w - 2, y, 2, h);
  }
  function gpCells(g, e) {
    for (let i = 0; i < 9; i++) {
      const [x, y, w, h] = CELL['ad' + i];
      gpAd(g, x, y, w, h, i);
      e.globalAlpha = 0.5; e.drawImage(g.canvas, x, y, w, h, x, y, w, h); e.globalAlpha = 1;
    }
    { const [x, y, w, h] = CELL.crowd, rnd = U.rng(77);                                         // packed terraces, 18 rows
      g.fillStyle = '#2a2e38'; g.fillRect(x, y, w, h);
      for (let r = 0; r < 18; r++) {
        const y0 = y + r * (h / 18);
        g.fillStyle = r % 2 ? '#3a4050' : '#343a48'; g.fillRect(x, y0 + 9, w, 5);
        for (let k = 0; k < 24; k++) {
          if (rnd() < 0.1) continue;
          const px = x + k * (w / 24) + rnd() * 3, top = rnd() < 0.15 ? 'hsl(' + (rnd() * 360 | 0) + ',80%,55%)' : 'hsl(' + (rnd() * 360 | 0) + ',' + (30 + rnd() * 50 | 0) + '%,' + (30 + rnd() * 45 | 0) + '%)';
          g.fillStyle = top; g.fillRect(px, y0 + 5, 7, 7);
          g.fillStyle = ['#f0c8a0', '#d8a878', '#b07850', '#e8b890'][rnd() * 4 | 0]; g.fillRect(px + 1.5, y0 + 1, 4, 4);
          if (rnd() < 0.05) { g.fillStyle = rnd() < 0.5 ? '#d81a1a' : '#ffd21a'; g.fillRect(px + 5, y0 - 3, 6, 4); }
        }
      }
      e.globalAlpha = 0.25; e.drawImage(g.canvas, x, y, w, h, x, y, w, h); e.globalAlpha = 1; }
    ['50', '100', '150'].forEach((n, i) => {                                                    // braking markers
      const [x, y, w, h] = CELL['brk' + i];
      g.fillStyle = '#f4f4f0'; g.fillRect(x, y, w, h); g.fillStyle = '#141414'; g.fillRect(x, y, w, 5); g.fillRect(x, y + h - 5, w, 5);
      g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, n, x + w / 2, y + h / 2, w - 6, 58, '900');
      e.fillStyle = '#909090'; e.fillRect(x, y, w, h);
    });
    { const [x, y, w, h] = CELL.gpb, gr = g.createLinearGradient(x, y, x, y + h);               // event banner
      gr.addColorStop(0, '#1d3a8a'); gr.addColorStop(1, '#0a1640'); g.fillStyle = gr; g.fillRect(x, y, w, h);
      for (let k = 0; k < 6; k++) for (let r = 0; r < 8; r++) { g.fillStyle = (k + r) % 2 ? '#111' : '#fff'; g.fillRect(x + k * 8, y + r * 16, 8, 16); g.fillRect(x + w - 48 + k * 8, y + r * 16, 8, 16); }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#ffd23a'; fitText(g, 'HIGHWAY BRAWL GP', x + w / 2, y + 52, w - 120, 58, '900');
      g.fillStyle = '#ffffff'; fitText(g, 'GIẢI ĐUA MÔ TÔ VIỆT NAM', x + w / 2, y + 100, w - 140, 24, '700');
      e.globalAlpha = 0.7; e.drawImage(g.canvas, x, y, w, h, x, y, w, h); e.globalAlpha = 1; }
    { const [x, y, w, h] = CELL.garage, rnd = U.rng(5);                                         // open garage, tinted by the team colour
      const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#d8d8d8'); gr.addColorStop(0.75, '#9a9a9a'); gr.addColorStop(1, '#3a3a3a');
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.fillStyle = '#e8e8e8'; g.fillRect(x, y, w, 12);
      for (let k = 0; k < 5; k++) { g.fillStyle = '#5a5a5a'; g.fillRect(x + 10 + k * 48, y + 30, 32, 52); g.fillStyle = '#7a7a7a'; for (let d = 0; d < 4; d++) g.fillRect(x + 12 + k * 48, y + 33 + d * 12, 28, 9); }
      g.fillStyle = '#202020'; g.fillRect(x, y + 104, w, 24);
      for (let k = 0; k < 3; k++) { g.fillStyle = '#151515'; g.fillRect(x + 40 + k * 70 + rnd() * 10, y + 86, 34, 18); g.beginPath(); g.arc(x + 46 + k * 70, y + 104, 7, 0, 7); g.arc(x + 70 + k * 70, y + 104, 7, 0, 7); g.fill(); }
      e.fillStyle = '#806a50'; e.fillRect(x, y + 12, w, 92); }
    { const [x, y, w, h] = CELL.vip, rnd = U.rng(9);                                            // hospitality glazing
      const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#6a8aa8'); gr.addColorStop(1, '#22344a');
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      for (let k = 0; k < 40; k++) { g.fillStyle = 'hsl(' + (rnd() * 360 | 0) + ',30%,' + (25 + rnd() * 30 | 0) + '%)'; g.fillRect(x + rnd() * w, y + 60 + rnd() * 30, 6, 24); }
      g.fillStyle = 'rgba(255,255,255,0.18)'; for (let k = 0; k < 8; k++) g.fillRect(x + k * 64 + 8, y, 18, h);
      g.fillStyle = '#d8dce2'; for (let k = 0; k <= 8; k++) g.fillRect(x + k * 64 - 2, y, 4, h);
      e.fillStyle = '#c8a878'; e.fillRect(x, y, w, h); e.fillStyle = '#000'; for (let k = 0; k <= 8; k++) e.fillRect(x + k * 64 - 2, y, 4, h); }
  }
  // strip of 8 sponsor boards for the continuous trackside barrier (4 m each)
  function adStrip() {
    const c = canvas(2048, 64), g = c.getContext('2d');
    for (let i = 0; i < 8; i++) gpAd(g, i * 256, 0, 256, 64, (i * 5) % 9);
    return tex(c, { repeat: true });
  }
  // circuit tarmac: dark, fine-grained, white lines along both edges (the ribbon is 14 m wide)
  function circuitTex(look, hw = 7) {   // hw: half width of the track (m); the texture spans it
    const c = canvas(512, 1024), g = c.getContext('2d'), rnd = U.rng(13), PX = 512 / (2 * hw), k = hw / 7;
    g.fillStyle = look.asphalt; g.fillRect(0, 0, 512, 1024);
    for (let i = 0; i < 14000; i++) {
      const v = rnd(); g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.04 + rnd() * 0.1})` : `rgba(255,255,255,${0.03 + rnd() * 0.07})`;
      g.fillRect(rnd() * 512, rnd() * 1024, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
    }
    for (const w of [-2.6, -0.4, 1.8]) {                                                          // rubbered-in lines
      const cx = 256 + w * k * PX, gr = g.createLinearGradient(cx - 40, 0, cx + 40, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(cx - 40, 0, 80, 1024);
    }
    for (const s of [-1, 1]) {
      const lw = 12 / k, lx = 256 + s * (hw - 0.22) * PX - lw / 2;   // a line of the same width in metres
      g.fillStyle = '#ececE8'; g.fillRect(lx, 0, lw, 1024);
      for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(60,60,60,${rnd() * 0.3})`; g.fillRect(lx + rnd() * lw, rnd() * 1024, 2, 2); }
    }
    return tex(c, { repeat: true });
  }
  function buildAtlas() {
    const cv = canvas(AW, AH), ce = canvas(AW, AH), g = cv.getContext('2d'), e = ce.getContext('2d');
    g.fillStyle = '#808080'; g.fillRect(0, 0, AW, AH); e.fillStyle = '#000'; e.fillRect(0, 0, AW, AH);
    const cell = (k, col) => { const [x, y, w, h] = CELL[k]; g.fillStyle = col; g.fillRect(x, y, w, h); };
    cell('white', '#ffffff'); cell('glow', '#fff4d0');
    { const [x, y, w, h] = CELL.glow; e.fillStyle = '#ffe0a0'; e.fillRect(x, y, w, h); }
    for (let i = 0; i < 10; i++) facade(g, e, i);
    gpCells(g, e);
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
  // ---------------- foliage atlas: what the trees, bushes and grass are made of ----------------
  // Grey-scale (the leaves' colour comes from the vertex colours) on transparent, drawn on a canvas, then copied into a
  // DataTexture with the colour of the transparent pixels filled in from their region's leaves - so the mipmaps do not
  // darken the edges. Regions [x, y, w, h] (canvas pixels, from the top left)
  const FW = 1024, FOL = { leaf: [0, 0, 512, 512], tuft: [512, 0, 512, 512], spray: [0, 512, 512, 256], grass: [0, 768, 512, 256],
    bark: [512, 512, 256, 512], leaf2: [768, 512, 256, 256], fern: [768, 768, 256, 256] };
  const folRect = k => { const [x, y, w, h] = FOL[k]; return [(x + 1) / FW, 1 - (y + h - 1) / FW, (x + w - 1) / FW, 1 - (y + 1) / FW]; };
  const grey = (g, v, a = 1) => { v = Math.max(0, Math.min(255, v | 0)); g.fillStyle = g.strokeStyle = `rgba(${v},${v},${Math.max(0, v - 6)},${a})`; };
  // a crown's mass of leaves: overlapping lobes filled with leaves, back (darker) to front (lighter), lit from above
  function leafMass(g, X, Y, S, rnd, len, n) {
    const cx = X + S / 2, cy = Y + S / 2, R = S * 0.45, lobes = [];
    for (let i = 0; i < 8; i++) { const a = rnd() * 6.283, d = rnd() * R * 0.5; lobes.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9, R * (0.42 + rnd() * 0.22)]); }
    const inside = (x, y) => lobes.some(l => Math.hypot(x - l[0], y - l[1]) < l[2]);
    for (let i = 0; i < n; i++) {
      let x, y, k = 0; do { x = cx + (rnd() * 2 - 1) * R; y = cy + (rnd() * 2 - 1) * R; } while (!inside(x, y) && ++k < 40);
      if (k >= 40) continue;
      const t = i / n, top = 1 - (y - (cy - R)) / (2 * R), L = len * (0.7 + rnd() * 0.6);
      grey(g, 55 + 175 * (0.25 + 0.75 * t) * (0.75 + 0.25 * top) * (0.85 + 0.3 * rnd()));
      g.save(); g.translate(x, y); g.rotate(rnd() * 6.283);
      g.beginPath(); g.ellipse(0, 0, L / 2, L * 0.22, 0, 0, 6.283); g.fill();
      grey(g, 40 + 60 * t, 0.5); g.lineWidth = 1; g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke();
      g.restore();
    }
  }
  function buildFoliage() {
    const cv = canvas(FW, FW), g = cv.getContext('2d'), rnd = U.rng(41);
    g.lineCap = 'round';
    // broadleaf crowns (two sizes of leaf)
    { const [x, y, w] = FOL.leaf; leafMass(g, x, y, w, rnd, 22, 2600); }
    { const [x, y, w] = FOL.leaf2; leafMass(g, x, y, w, rnd, 13, 1300); }
    // pine needle tufts: bursts of long needles from the tips of twigs
    { const [X, Y, S] = FOL.tuft, cx = X + S / 2, cy = Y + S / 2;
      for (let i = 0; i < 16; i++) {
        const a = rnd() * 6.283, d = Math.sqrt(rnd()) * S * 0.27, tx = cx + Math.cos(a) * d, ty = cy + Math.sin(a) * d * 0.85, r = S * (0.12 + rnd() * 0.07), t = i / 16;
        grey(g, 45); g.lineWidth = 3; g.beginPath(); g.moveTo(cx + (tx - cx) * 0.4, cy + (ty - cy) * 0.4); g.lineTo(tx, ty); g.stroke();
        for (let k = 0; k < 90; k++) {
          const b = rnd() * 6.283, L = r * (0.55 + rnd() * 0.45), bend = (rnd() - 0.5) * 0.4, ex = tx + Math.cos(b) * L, ey = ty + Math.sin(b) * L * 0.9 - L * 0.15;
          grey(g, (60 + 150 * (0.3 + 0.7 * t)) * (0.8 + 0.35 * rnd()) * (1.05 - 0.25 * (ey - Y) / S)); g.lineWidth = 1.4 + rnd();
          g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(b + bend) * L * 0.5, ty + Math.sin(b + bend) * L * 0.5, ex, ey); g.stroke();
        }
      } }
    // a fir's branch spray: a twig from the trunk (left) to the tip (right), drooping, side shoots, short needles on all
    { const [X, Y, W, H] = FOL.spray, twig = (x0, y0, x1, y1, droop, nd, w) => {
        grey(g, 50); g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + droop * 0.4, x1, y1 + droop); g.stroke();
        for (let k = 0; k < nd; k++) {
          const t = k / nd, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + droop * t * t, L = (14 - 7 * t) * (0.8 + rnd() * 0.4);
          for (const s of [-1, 1]) {
            const a = Math.atan2(y1 - y0, x1 - x0) + s * (0.9 + rnd() * 0.4) + 0.25;
            grey(g, (65 + 140 * rnd()) * (s < 0 ? 1.1 : 0.85)); g.lineWidth = 1.5;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
          }
        }
      };
      twig(X + 4, Y + H * 0.45, X + W - 10, Y + H * 0.5, 34, 120, 4);
      for (let i = 0; i < 9; i++) {
        const t = 0.12 + i * 0.09, x = X + 4 + (W - 14) * t, y = Y + H * 0.45 + 34 * t * t, s = i % 2 ? 1 : -1, L = (W * 0.42) * (1 - t * 0.7);
        twig(x, y, x + L * 0.85, y + s * L * 0.38, 16, 40, 2.5);
      } }
    // grass: blades from the bottom, darker at the root, leaning and curling
    { const [X, Y, W, H] = FOL.grass;
      for (let i = 0; i < 150; i++) {
        const bx = X + W / 2 + (rnd() + rnd() + rnd() - 1.5) * W * 0.55, by = Y + H - 1, h = H * (0.35 + rnd() * 0.6), lean = (rnd() - 0.5) * W * 0.32, w = 3 + rnd() * 4;
        const gr = g.createLinearGradient(0, by, 0, by - h); const v = 140 + rnd() * 80;
        gr.addColorStop(0, `rgb(${v * 0.35 | 0},${v * 0.35 | 0},${v * 0.33 | 0})`); gr.addColorStop(1, `rgb(${v | 0},${v | 0},${v * 0.92 | 0})`);
        g.fillStyle = gr; g.beginPath(); g.moveTo(bx - w, by); g.quadraticCurveTo(bx - w * 0.5 + lean * 0.3, by - h * 0.6, bx + lean, by - h);
        g.quadraticCurveTo(bx + w * 0.5 + lean * 0.3, by - h * 0.6, bx + w, by); g.fill();
      } }
    // fern: fronds arching out of the middle of the bottom edge, leaflets on both sides
    { const [X, Y, S] = FOL.fern;
      for (let f = 0; f < 6; f++) {
        const a0 = -Math.PI / 2 + (f / 5 - 0.5) * 1.9, len = S * (0.55 + rnd() * 0.35), bx = X + S / 2, by = Y + S - 2;
        let px = bx, py = by;
        for (let k = 1; k <= 22; k++) {
          const t = k / 22, a = a0 + (a0 + Math.PI / 2) * t * 0.9, x = bx + Math.cos(a) * len * t, y = by + Math.sin(a) * len * t + len * 0.35 * t * t;
          grey(g, 55); g.lineWidth = 2.2 * (1 - t) + 0.6; g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
          const L = len * 0.16 * Math.sin(Math.PI * Math.min(1, t * 1.1));
          for (const s of [-1, 1]) { grey(g, 90 + 120 * t * (0.8 + 0.4 * rnd())); g.lineWidth = 3.2 * (1 - t * 0.5);
            g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a + s * 1.25) * L, y + Math.sin(a + s * 1.25) * L); g.stroke(); }
          px = x; py = y;
        }
      } }
    // bark: grey-brown plates split by dark fissures running up the trunk
    { const [X, Y, W, H] = FOL.bark, d = g.createImageData(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const u = x / W, v = y / H, fis = Math.abs(pnoise(u * 9 + pnoise(u * 3, v * 2, 3) * 0.8, v * 3, 9) - 0.5);
        const plate = pnoise(u * 18, v * 10, 18) * 0.5 + pnoise(u * 40, v * 30, 40) * 0.3;
        const val = (110 + plate * 120) * (0.35 + 0.65 * Math.min(1, fis * 9)), i = (y * W + x) * 4;
        d.data[i] = d.data[i + 1] = val; d.data[i + 2] = val * 0.96; d.data[i + 3] = 255;
      }
      g.putImageData(d, X, Y); }
    // into a DataTexture (rows flipped: v = 1 at the canvas's top, like a canvas texture), the transparent pixels coloured
    const src = g.getImageData(0, 0, FW, FW).data, out = new Uint8Array(FW * FW * 4);
    for (const k in FOL) {
      const [X, Y, W, H] = FOL[k]; let s = 0, n = 0;
      for (let y = Y; y < Y + H; y++) for (let x = X; x < X + W; x++) { const i = (y * FW + x) * 4; if (src[i + 3] > 200) { s += src[i]; n++; } }
      const m = n ? s / n : 128;
      for (let y = Y; y < Y + H; y++) for (let x = X; x < X + W; x++) {
        const i = (y * FW + x) * 4, o = ((FW - 1 - y) * FW + x) * 4, a = src[i + 3];
        if (a < 128) { out[o] = out[o + 1] = m; out[o + 2] = m * 0.97; } else { out[o] = src[i]; out[o + 1] = src[i + 1]; out[o + 2] = src[i + 2]; }
        out[o + 3] = a;
      }
    }
    const t = new T.DataTexture(out, FW, FW, T.RGBAFormat);
    t.encoding = T.sRGBEncoding; t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter;
    t.anisotropy = G.aniso; t.needsUpdate = true;
    return t;
  }
  // terrain: rock (strata and cracks, for the steep faces) and a forest canopy seen from above (crowns, lit on top)
  function rockTex() {
    const S = 256, c = canvas(S, S), g = c.getContext('2d'), d = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S, warp = pnoise(u * 4, v * 4, 4) * 2.5 + pnoise(u * 8, v * 2, 8) * 1.5;
      const strata = 0.5 + 0.5 * Math.sin((v * 7 + warp * 0.35) * 6.283), crack = Math.abs(pnoise(u * 8 + warp, v * 3, 8) - 0.5);
      const val = (0.6 + 0.16 * strata + 0.3 * (pnoise(u * 32, v * 32, 32) - 0.5) + 0.25 * (pnoise(u * 8, v * 8, 8) - 0.5) + 0.12 * (pnoise(u * 64, v * 64, 64) - 0.5)) * (0.8 + 0.2 * Math.min(1, crack * 10));
      const i = (y * S + x) * 4; d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.max(0, Math.min(255, val * 245)); d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    return tex(c, { repeat: true });
  }
  function canopyTex() {
    const S = 256, c = canvas(S, S), g = c.getContext('2d'), rnd = U.rng(29);
    g.fillStyle = 'rgb(38,38,36)'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 230; i++) {
      const x = rnd() * S, y = rnd() * S, r = 8 + rnd() * 13, v = 150 + rnd() * 90;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        const X = x + ox, Y = y + oy; if (X < -r || X > S + r || Y < -r || Y > S + r) continue;
        const gr = g.createRadialGradient(X - r * 0.35, Y - r * 0.35, r * 0.1, X, Y, r);
        gr.addColorStop(0, `rgb(${v | 0},${v | 0},${v * 0.95 | 0})`); gr.addColorStop(0.7, `rgb(${v * 0.55 | 0},${v * 0.55 | 0},${v * 0.52 | 0})`); gr.addColorStop(1, 'rgba(40,40,38,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(X, Y, r, 0, 6.283); g.fill();
      }
    }
    return tex(c, { repeat: true });
  }
  // the terrain's look: the vertex colours (the theme's ground) times detail - grain seen from above on
  // the flat, rock projected from the side on the steep faces (no stretching down a cliff), forest canopy where the
  // ground is wooded (attribute aCan, 'canopy' materials). (Each sampled only where it shows: the GPU's time)
  function terrainShader(m, canopy) {
    const U0 = { uRock: { value: null }, uCan: { value: null } };
    m.onBeforeCompile = s => {
      U0.uRock.value = G.tx.rock; U0.uCan.value = G.tx.canopy;
      Object.assign(s.uniforms, U0);
      s.vertexShader = 'varying vec3 vWP; varying vec3 vWN;\n' + (canopy ? 'attribute float aCan; varying float vCan;\n' : '') +
        s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);' + (canopy ? ' vCan = aCan;' : ''));
      s.fragmentShader = 'uniform sampler2D uRock; uniform sampler2D uCan; varying vec3 vWP; varying vec3 vWN;\n' + (canopy ? 'varying float vCan;\n' : '') +
        s.fragmentShader.replace('#include <map_fragment>', `
          vec3 wn = normalize(vWN);
          float det = texture2D(map, vWP.xz / 7.0).r;
          float stp = smoothstep(0.42, 0.72, 1.0 - wn.y);
          if (stp > 0.002) {   // (rock only where it is steep: projected from the sides, no stretching down a face)
            float rk = texture2D(uRock, vec2(abs(wn.x) > abs(wn.z) ? vWP.z : vWP.x, vWP.y * 1.7) / 13.0).r;
            det = mix(det, rk * 0.92, stp);
          }
          ${canopy ? `if (vCan > 0.002) det = mix(det, texture2D(uCan, (vWP.xz + vWP.y * 0.6) / 9.0).r * 1.15, vCan);` : ''}
          diffuseColor.rgb *= det;`);
    };
    m.customProgramCacheKey = () => 'terrain' + (canopy ? 'C' : '');
    return m;
  }
  // the foliage material: the atlas, alpha-tested (more opaque in the smaller mipmaps, or far trees would thin out),
  // stirring in the wind. Lit per vertex by the sky and the sun only (leafLight, set by the world from its lights): the
  // cards' normals are bent out of their crown, smooth over it, so per-pixel light would look the same - and the leaves
  // are the most drawn pixels on a wooded stage (the full lighting with its shadow lookups halved the frame rate)
  const leafTime = { value: 0 };
  const leafLight = { uSunDir: { value: new T.Vector3(0, 1, 0) }, uSunCol: { value: new T.Color(1, 1, 1) }, uSky: { value: new T.Color(0.6, 0.6, 0.6) }, uGround: { value: new T.Color(0.3, 0.3, 0.3) } };
  const LEAF_VS = `uniform float uLeafT; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uGround;
    varying vec2 vUv; varying vec3 vCol;
    #include <fog_pars_vertex>
    void main() {
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      float sway = sin(uLeafT * 1.7 + wp.x * 0.31 + wp.z * 0.23) + 0.5 * sin(uLeafT * 3.1 + wp.y * 0.9 + wp.x * 0.5);
      wp.x += sway * 0.035; wp.z += sway * 0.025;
      vec3 n = normalize(mat3(modelMatrix) * normal);
      // sky from above, bounce from below, the sun wrapped a little round the crown (leaves let light through)
      vec3 light = mix(uGround, uSky, n.y * 0.5 + 0.5) + uSunCol * max(0.0, dot(n, uSunDir) * 0.8 + 0.2);
      vCol = color * light;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`;
  const LEAF_FS = `uniform sampler2D map; varying vec2 vUv; varying vec3 vCol;
    #include <fog_pars_fragment>
    void main() {
      vec4 t = texture2D(map, vUv);
      vec2 tuv = vUv * ${FW}.0; float lod = max(0.0, 0.5 * log2(max(dot(dFdx(tuv), dFdx(tuv)), dot(dFdy(tuv), dFdy(tuv)))));
      if (t.a * (1.0 + lod * 0.3) < 0.5) discard;
      gl_FragColor = vec4(t.rgb * vCol, 1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      #include <fog_fragment>
    }`;
  function leafMat(map) {
    const u = T.UniformsUtils.merge([T.UniformsLib.fog]);
    Object.assign(u, leafLight, { uLeafT: leafTime, map: { value: map } });
    return new T.ShaderMaterial({ uniforms: u, vertexShader: LEAF_VS, fragmentShader: LEAF_FS, vertexColors: true, fog: true, side: T.DoubleSide,
      extensions: { derivatives: true } });
  }
  function roadTex(theme, look, hw = 5) {   // hw: half width of the road (m); the texture spans it, lines keep their width
    const c = canvas(512, 1024), g = c.getContext('2d'), rnd = U.rng(11), PX = 512 / (2 * hw), k = PX / 51.2;
    g.fillStyle = look.asphalt; g.fillRect(0, 0, 512, 1024);
    for (let i = 0; i < 9000; i++) {
      const v = rnd(); g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.05 + rnd() * 0.12})` : `rgba(255,255,255,${0.04 + rnd() * 0.1})`;
      g.fillRect(rnd() * 512, rnd() * 1024, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    for (const lx of [-hw / 2, hw / 2]) for (const w of [-0.75, 0.75]) {                           // darker wheel tracks
      const cx = 256 + (lx + w) * PX, gr = g.createLinearGradient(cx - 18 * k, 0, cx + 18 * k, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(cx - 18 * k, 0, 36 * k, 1024);
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
    for (const s of [-1, 1]) paint(256 + s * (hw - 0.38) * PX - 4 * k, 8 * k, 0, 1024, '#e8e8e2');   // edge lines
    const lc = look.centre;
    if (lc === 'double') { paint(256 - 12 * k, 7 * k, 0, 1024, '#f0c020'); paint(256 + 5 * k, 7 * k, 0, 1024, '#f0c020'); }
    else for (const y0 of [0, 512]) paint(256 - 4 * k, 8 * k, y0, y0 + 205, lc === 'dashY' ? '#f0d040' : '#ececE6');
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
    roadTex, circuitTex, adStrip, radialTex, folRect, leafTime, leafLight, aniso: 4, mats: null, tx: null,
    init(renderer) {
      this.aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const atlas = buildAtlas();
      this.tx = { atlas, detail: detailTex(), glow: radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0.35)'),
        pool: radialTex('rgba(255,220,150,0.9)', 'rgba(255,200,120,0.4)'), cloud: cloudTex(), water: waterNormals(),
        tower: towerTex(false), towerE: towerTex(true), foliage: buildFoliage(), rock: rockTex(), canopy: canopyTex() };
      this.tx.water.repeat.set(1, 1);
      const S = T.MeshStandardMaterial, L = T.MeshLambertMaterial;
      this.mats = {
        lam: new L({ vertexColors: true, map: atlas.map }),                                     // props, clothes, tyres
        lamNight: new L({ vertexColors: true, map: atlas.map, emissive: 0xffffff, emissiveMap: atlas.emis }),
        terrain: terrainShader(new L({ vertexColors: true, map: this.tx.detail }), false),
        terrainCan: terrainShader(new L({ vertexColors: true, map: this.tx.detail }), true),   // (the streamed tiles: with canopy)
        leaf: leafMat(this.tx.foliage),
        leafDepth: new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map: this.tx.foliage, alphaTest: 0.5, side: T.DoubleSide }),
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
