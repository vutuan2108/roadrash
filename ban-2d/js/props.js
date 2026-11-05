'use strict';
// ============ Roadside props (nature): trees, pines, palms, bushes, rocks, cliffs ============
(() => {
  const { Buf, ramp } = Art;
  const M = Spr.makers = {};
  Spr.prop = (name, v = 0) => Spr.cached('p|' + name + '|' + v, () => M[name](v));
  const RP = {
    bark: ramp('#6a4a2e', { hl: 0.35 }), leaf: ramp('#3f8a2e', { hl: 0.55 }), leaf2: ramp('#2f7a3a', { hl: 0.5 }),
    pine: ramp('#2a6a3a', { hl: 0.4 }), pine2: ramp('#24603a', { hl: 0.35 }), palm: ramp('#4a9a30', { hl: 0.55 }),
    trunk: ramp('#8a6a44', { hl: 0.4 }), trunk2: ramp('#6e5234', { hl: 0.35 }), rock: ramp('#8a8478', { hl: 0.55 }),
    rock2: ramp('#7a6c58', { hl: 0.5 }), moss: ramp('#5a7a32', { hl: 0.45 }), dry: ramp('#8aa83a', { hl: 0.5 }),
    yellow: ramp('#ffd030', { hl: 0.6 }), pink: ramp('#e070c0', { hl: 0.6 }), coco: ramp('#6b4420'),
  };

  M.tree = v => {
    const rnd = U.rng(v * 17 + 3), b = new Buf(140, 180), cx = 70, cy = 66;
    b.cap(cx, 179, cx + 2, 96, 8, 5, RP.bark, { tex: 0.35 });
    b.cap(cx + 1, 122, cx - 26, 84, 3.6, 2, RP.bark, { tex: 0.3 });
    b.cap(cx + 1, 114, cx + 28, 82, 3.6, 2, RP.bark, { tex: 0.3 });
    const lf = v % 2 ? RP.leaf : RP.leaf2, bl = [];
    for (let i = 0; i < 48; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd());
      const x = cx + Math.cos(a) * d * 52, y = cy + Math.sin(a) * d * 50;
      bl.push([x, y, 9 + rnd() * 9, -((x - cx) / 52 * 0.16 + (y - cy) / 50 * 0.3)]);
    }
    bl.sort((p, q) => p[3] - q[3]);
    for (const [x, y, r, bias] of bl) b.blob(x, y, r, r * 0.9, lf, { tex: 0.45, ts: 2, bias });
    return b.outline(0.35).canvas(21);
  };

  M.pine = v => {
    const b = new Buf(100, 200), cx = 50, rp = v % 2 ? RP.pine2 : RP.pine;
    b.cap(cx, 199, cx, 150, 5, 3.5, RP.bark, { tex: 0.3 });
    for (let k = 0; k < 7; k++) {
      const yb = 170 - k * 21, top = yb - 42, hw = 46 - k * 6;
      for (let y = top; y < yb; y++) {
        const t = (y - top) / (yb - top), w = hw * t * (1 + 0.1 * Math.sin(y * 1.9 + k));
        for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
          const nx = (x + 0.5 - cx) / (w + 0.01);
          if (Math.abs(nx) > 1) continue;
          if (t > 0.8 && ((Math.abs(x - cx) * 3 + y) % 7) < (t - 0.8) * 30) continue;
          b.shade(x, y, nx * 0.85, -0.3 + t * 0.6, Math.sqrt(Math.max(0, 1 - nx * nx * 0.7)), rp, { tex: 0.4, ts: 2 });
        }
      }
    }
    return b.outline(0.35).canvas(23);
  };

  M.palm = v => {
    const rnd = U.rng(v * 7 + 3), b = new Buf(140, 200), lean = (v % 2 ? 1 : -1) * (8 + v * 4);
    const tx = 70 + lean, ty = 58;
    const frond = (a, len, droop, bias) => {
      let px = tx, py = ty;
      for (let s = 3; s <= len; s += 2) {
        const t = s / len, x = tx + Math.cos(a) * s, y = ty + Math.sin(a) * s + t * t * droop;
        b.cap(px, py, x, y, 1.6, 1.3, RP.palm, { bias });
        const w = (1 - t * 0.7) * 7, pa = a + Math.PI / 2;
        for (const sg of [-1, 1]) b.cap(x, y, x + Math.cos(pa) * w * sg * 0.6, y + w * 0.9 + 2, 1.2, 0.7, RP.palm, { bias: bias - 0.08 });
        px = x; py = y;
      }
    };
    for (const a of [-2.7, -1.6, -0.5]) frond(a, 40 + rnd() * 8, 18, -0.28);
    for (let i = 0; i <= 34; i++) {
      const t = i / 34, x = U.lerp(70, tx, t * t), y = U.lerp(199, ty + 4, t);
      b.blob(x, y, U.lerp(7, 4.5, t), 3.4, i % 2 ? RP.trunk : RP.trunk2, { tex: 0.2 });
    }
    for (const [x, y] of [[-3, 5], [3, 6], [0, 8]]) b.blob(tx + x, ty + y, 3, 3, RP.coco, { gloss: 0.4 });
    for (const a of [Math.PI - 0.15, -2.2, -1.1, -0.1, Math.PI - 0.7, 0.6, 2.4]) frond(a, 42 + rnd() * 10, 24, 0);
    return b.outline(0.35).canvas(19);
  };

  M.bush = v => {
    const rnd = U.rng(v * 3 + 11), b = new Buf(76, 46), lf = v === 0 ? RP.dry : RP.leaf;
    for (let i = 0; i < 14; i++) {
      const x = 12 + rnd() * 52, y = 20 + rnd() * 16;
      b.blob(x, y, 8 + rnd() * 7, 7 + rnd() * 5, lf, { tex: 0.45, ts: 2, bias: (32 - y) / 60 });
    }
    if (v > 0) for (let i = 0; i < 26; i++) {
      const x = 6 + rnd() * 64, y = 8 + rnd() * 26;
      if (b.on(Math.round(x), Math.round(y))) b.blob(x, y, 2, 1.7, v === 1 ? RP.yellow : RP.pink, { gloss: 0.3 });
    }
    return b.outline(0.35).canvas(10.5);
  };

  M.rock = v => {
    const rnd = U.rng(v * 29 + 1), b = new Buf(92, 64), cx = 46, cy = 42, R0 = 40, p1 = rnd() * 6, p2 = rnd() * 6;
    const rp = v % 2 ? RP.rock : RP.rock2;
    for (let y = 0; y < 63; y++) for (let x = 0; x < 92; x++) {
      const dx = (x + 0.5 - cx) / R0, dy = (y + 0.5 - cy) / (R0 * 0.72), a = Math.atan2(dy, dx);
      const rr = 1 + 0.13 * Math.sin(3 * a + p1) + 0.08 * Math.sin(7 * a + p2), q = (dx * dx + dy * dy) / (rr * rr);
      if (q > 1) continue;
      b.shade(x, y, dx / rr, dy / rr, Math.sqrt(1 - q), rp, { tex: 0.3, ts: 2 });
    }
    return b.outline(0.35).canvas(9.5);
  };

  M.cliff = v => {
    const rnd = U.rng(v * 31 + 7), b = new Buf(260, 330), rocks = [];
    for (let i = 0; i < 46; i++) rocks.push([18 + rnd() * 224, 30 + rnd() * 290, 24 + rnd() * 34, 12 + rnd() * 14, rnd() < 0.5]);
    rocks.sort((p, q) => p[1] - q[1]);
    for (const [x, y, rx, ry, a] of rocks) b.blob(x, y, rx, ry, a ? RP.rock : RP.rock2, { tex: 0.16 });
    b.box(8, 34, 244, 296, RP.rock2, { r: 36, tex: 0.16, under: true, bias: -0.2 });
    for (let y = 40; y < 330; y += 11 + (y % 5)) b.rect(10, y, 240, 1, RP.rock2, 0.12, { only: true });
    for (let i = 0; i < 24; i++) b.blob(14 + rnd() * 232, 18 + rnd() * 28, 10 + rnd() * 10, 5 + rnd() * 4, RP.moss, { tex: 0.25 });
    return b.outline(0.35).canvas(28);
  };
})();
