'use strict';
// ============ Pixel-art painter: lit primitives + ordered dithering + selective outline ============
const Art = (() => {
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const bay = (x, y) => BAY[((y & 3) << 2) | (x & 3)];
  const norm = v => { const m = Math.hypot(v[0], v[1], v[2]); return v.map(a => a / m); };
  const LIGHT = norm([-0.55, -0.72, 0.55]);
  const HALF = norm([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const C = h => U.hex2rgb(h);
  const SPEC = C('#ffffff');
  // 6-tone ramp, hue-shifted: shadows toward violet, highlights toward warm white
  function ramp(base, o = {}) {
    const sh = o.sh === undefined ? 0.85 : o.sh, hl = o.hl === undefined ? 0.45 : o.hl;
    return [U.mix(base, '#140c26', sh), U.mix(base, '#140c26', sh * 0.6), U.mix(base, '#140c26', sh * 0.28), base,
      U.mix(base, '#fff3d6', hl * 0.5), U.mix(base, '#fff6e6', hl)].map(C);
  }

  class Buf {
    constructor(w, h, ox = 0, oy = 0) { this.w = w; this.h = h; this.ox = ox; this.oy = oy; this.d = new Uint8ClampedArray(w * h * 4); }
    set(x, y, c) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = (y * this.w + x) << 2, d = this.d;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    on(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.d[((y * this.w + x) << 2) + 3] > 0; }
    ok(x, y, o) {
      if (o.only && !this.on(x, y)) return false;
      if (o.under && this.on(x, y)) return false;
      if (o.clip && !o.clip(x - this.ox, y - this.oy)) return false;
      return true;
    }
    tone(x, y, I, rp) {
      const n = rp.length;
      let k = Math.floor((I < 0 ? 0 : I > 1 ? 1 : I) * (n - 1) + bay(x, y));
      this.set(x, y, rp[k < 0 ? 0 : k >= n ? n - 1 : k]);
    }
    shade(x, y, nx, ny, nz, rp, o) {
      const amb = o.amb === undefined ? 0.15 : o.amb;
      let I = amb + (1 - amb) * Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      if (o.tex) { const s = o.ts || 1; I += (hash(Math.floor(x / s), Math.floor(y / s)) - 0.5) * o.tex; }
      if (o.bias) I += o.bias;
      if (o.gloss) {
        const sp = Math.pow(Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]), o.shin || 24) * o.gloss;
        if (sp > bay(x + 1, y + 2)) { this.set(x, y, o.spec || SPEC); return; }
      }
      this.tone(x, y, I, rp);
    }
    blob(cx, cy, rx, ry, rp, o = {}) {
      cx += this.ox; cy += this.oy;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, q = nx * nx + ny * ny;
          if (q > 1 || !this.ok(x, y, o)) continue;
          this.shade(x, y, nx, ny, Math.sqrt(1 - q), rp, o);
        }
      return this;
    }
    cap(ax, ay, bx, by, ra, rb, rp, o = {}) {
      ax += this.ox; ay += this.oy; bx += this.ox; by += this.oy;
      const r = Math.max(ra, rb), dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
      for (let y = Math.floor(Math.min(ay, by) - r); y <= Math.ceil(Math.max(ay, by) + r); y++)
        for (let x = Math.floor(Math.min(ax, bx) - r); x <= Math.ceil(Math.max(ax, bx) + r); x++) {
          const px = x + 0.5, py = y + 0.5;
          let t = ((px - ax) * dx + (py - ay) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const rr = ra + (rb - ra) * t, ex = (px - ax - dx * t) / rr, ey = (py - ay - dy * t) / rr, q = ex * ex + ey * ey;
          if (q > 1 || !this.ok(x, y, o)) continue;
          this.shade(x, y, ex, ey, Math.sqrt(1 - q), rp, o);
        }
      return this;
    }
    box(x, y, w, h, rp, o = {}) {
      x += this.ox; y += this.oy;
      const r = Math.max(0.5, Math.min(o.r === undefined ? Math.min(w, h) * 0.35 : o.r, w / 2, h / 2));
      for (let py = Math.floor(y); py < Math.ceil(y + h); py++)
        for (let px = Math.floor(x); px < Math.ceil(x + w); px++) {
          const cx = U.clamp(px + 0.5, x + r, x + w - r), cy = U.clamp(py + 0.5, y + r, y + h - r);
          let nx = (px + 0.5 - cx) / r, ny = (py + 0.5 - cy) / r, q = nx * nx + ny * ny;
          if (q > 1) { if (o.round) continue; const m = Math.sqrt(q); nx /= m; ny /= m; q = 1; }
          if (!this.ok(px, py, o)) continue;
          this.shade(px, py, nx, ny, Math.sqrt(1 - q), rp, o);
        }
      return this;
    }
    // dithered rect; I = number or [top, bottom]
    rect(x, y, w, h, rp, I, o = {}) {
      x = Math.round(x + this.ox); y = Math.round(y + this.oy);
      for (let py = y; py < y + h; py++) {
        const t = h > 1 ? (py - y) / (h - 1) : 0;
        let v = Array.isArray(I) ? I[0] + (I[1] - I[0]) * t : I;
        for (let px = x; px < x + w; px++) {
          if (!this.ok(px, py, o)) continue;
          let vv = v;
          if (o.tex) { const s = o.ts || 1; vv += (hash(Math.floor(px / s), Math.floor(py / s)) - 0.5) * o.tex; }
          this.tone(px, py, vv, rp);
        }
      }
      return this;
    }
    // polygon [[x,y],...]; o.I = number or fn(x,y)
    poly(pts, rp, o = {}) {
      const P = pts.map(p => [p[0] + this.ox, p[1] + this.oy]);
      const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
      for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
        for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
          const px = x + 0.5, py = y + 0.5; let inside = false;
          for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
            const [xi, yi] = P[i], [xj, yj] = P[j];
            if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
          }
          if (!inside || !this.ok(x, y, o)) continue;
          let I = typeof o.I === 'function' ? o.I(x - this.ox, y - this.oy) : (o.I === undefined ? 0.6 : o.I);
          if (o.tex) { const s = o.ts || 1; I += (hash(Math.floor(x / s), Math.floor(y / s)) - 0.5) * o.tex; }
          this.tone(x, y, I, rp);
        }
      return this;
    }
    text(str, x, y, size, rp, I, align) {
      const c = document.createElement('canvas'), g = c.getContext('2d'), font = 'bold ' + size + 'px Arial, sans-serif';
      g.font = font;
      const w = Math.ceil(g.measureText(str).width) + 2, h = Math.ceil(size * 1.3);
      c.width = w; c.height = h; g.font = font; g.textBaseline = 'top'; g.fillStyle = '#fff'; g.fillText(str, 1, 0);
      const d = g.getImageData(0, 0, w, h).data, x0 = Math.round(x - (align === 'center' ? w / 2 : 0) + this.ox), y0 = Math.round(y + this.oy);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (d[(j * w + i) * 4 + 3] > 120) this.tone(x0 + i, y0 + j, I, rp);
      return this;
    }
    // selective outline: transparent pixels touching the sprite get a darkened copy of the neighbour
    outline(f = 0.3) {
      const w = this.w, h = this.h, src = new Uint8ClampedArray(this.d), d = this.d;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) << 2; if (src[i + 3]) continue;
        let j = -1;
        if (x > 0 && src[i - 1]) j = i - 4; else if (x < w - 1 && src[i + 7]) j = i + 4;
        else if (y > 0 && src[i - w * 4 + 3]) j = i - w * 4; else if (y < h - 1 && src[i + w * 4 + 3]) j = i + w * 4;
        if (j < 0) continue;
        d[i] = src[j] * f; d[i + 1] = src[j + 1] * f; d[i + 2] = src[j + 2] * f + 8; d[i + 3] = 255;
      }
      return this;
    }
    rotated(a) {
      const out = new Buf(this.w, this.h), cs = Math.cos(a), sn = Math.sin(a), cx = this.w / 2, cy = this.h / 2;
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const sx = Math.floor(cs * dx + sn * dy + cx), sy = Math.floor(-sn * dx + cs * dy + cy);
        if (sx < 0 || sy < 0 || sx >= this.w || sy >= this.h) continue;
        const si = (sy * this.w + sx) << 2, di = (y * this.w + x) << 2;
        for (let k = 0; k < 4; k++) out.d[di + k] = this.d[si + k];
      }
      return out;
    }
    sheared(k) {
      const out = new Buf(this.w, this.h);
      for (let y = 0; y < this.h; y++) {
        const off = Math.round(k * (this.h - 1 - y) / (this.h - 1));
        for (let x = 0; x < this.w; x++) {
          const sx = x - off; if (sx < 0 || sx >= this.w) continue;
          const si = (y * this.w + sx) << 2, di = (y * this.w + x) << 2;
          for (let q = 0; q < 4; q++) out.d[di + q] = this.d[si + q];
        }
      }
      return out;
    }
    canvas(px) {
      const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
      const g = c.getContext('2d'), id = g.createImageData(this.w, this.h);
      id.data.set(this.d); g.putImageData(id, 0, 0); c.px = px || 1;
      return c;
    }
  }
  return { Buf, ramp, bay, hash, C };
})();
