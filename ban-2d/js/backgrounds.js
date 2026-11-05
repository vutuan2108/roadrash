'use strict';
// ============ Parallax background layers (dithered sky, shaded mountains, sea, skyline) ============
(() => {
  const { Buf, ramp, bay, hash } = Art;
  const BW = 1024, BH = H + 80, HZ = 200;
  const wave = (x, comps) => comps.reduce((s, [a, f, p]) => s + a * Math.sin(2 * Math.PI * f * x / BW + p), 0);

  function sky(theme) {
    const b = new Buf(BW, BH), n = 14, cols = [];
    for (let i = 0; i < n; i++) cols.push(U.hex2rgb(U.mix(theme.sky[0], theme.sky[1], i / (n - 1))));
    for (let y = 0; y < BH; y++) {
      const t = Math.min(1, y / HZ) * (n - 1);
      for (let x = 0; x < BW; x++) { const k = Math.min(n - 1, Math.floor(t + bay(x, y) - 0.5 + 0.5)); b.set(x, y, cols[k]); }
    }
    const rnd = U.rng(theme.id.length * 101 + 7);
    if (theme.night) {
      for (let i = 0; i < 260; i++) b.set(Math.floor(rnd() * BW), Math.floor(rnd() * HZ * 0.8), rnd() < 0.3 ? [255, 255, 255] : [150, 150, 200]);
      b.blob(700, 52, 15, 15, ramp('#fff4d0', { sh: 0.3, hl: 0.6 }), { amb: 0.6 });
      return b.canvas();
    }
    const cr = ramp('#e6eef8', { sh: 0.45, hl: 0.5 });
    for (let i = 0; i < 9; i++) {
      const cx = rnd() * BW, cy = 34 + rnd() * 96, s = 0.7 + rnd() * 0.9, parts = [];
      for (let k = 0; k < 9; k++) parts.push([(rnd() - 0.5) * 70 * s, (rnd() - 0.6) * 16 * s, (9 + rnd() * 12) * s]);
      parts.sort((p, q) => q[1] - p[1]);
      for (const dx of [0, -BW, BW]) for (const [ox, oy, r] of parts) {
        const by = cy + 8 * s;
        b.blob(cx + dx + ox, cy + oy, r * 1.3, r * 0.8, cr, { amb: 0.45, clip: (x, y) => y < by, bias: 0.1 });
      }
    }
    return b.canvas();
  }
  function ridge(b, comps, base, rp, o = {}) {
    for (let x = 0; x < BW; x++) {
      const top = Math.round(base - wave(x, comps));
      const slope = U.clamp((wave((x + 1) % BW, comps) - wave((x + BW - 1) % BW, comps)) / 2, -1.5, 1.5);
      for (let y = Math.max(0, top); y < BH; y++) {
        let I = 0.5 + slope * 0.32 - (y - top) * (o.fade || 0.004) + (hash(x >> 1, y >> 1) - 0.5) * (o.tex || 0.18);
        if (y - top < 2) I += 0.15;
        b.tone(x, y, I, rp);
      }
      if (o.trees && x % 6 === 0) {
        const th = 6 + Math.floor(hash(x, 3) * 6);
        for (let k = 0; k < th; k++) for (let j = -Math.floor(k / 2.4); j <= Math.floor(k / 2.4); j++) b.tone(x + j, top - th + k + 2, 0.28 + (j < 0 ? 0.15 : 0), o.trees);
      }
    }
  }
  function skyline(b, base, rp, minH, maxH, seed, lit) {
    const rnd = U.rng(seed), win = ramp('#ffd86a', { sh: 0.5, hl: 0.6 }), win2 = ramp('#7ae8ff', { sh: 0.5 });
    let x = 0;
    while (x < BW) {
      const w = 16 + Math.floor(rnd() * 30), h = minH + Math.floor(rnd() * (maxH - minH));
      b.rect(x, base - h, w, BH - base + h, rp, [0.45, 0.3]);
      b.rect(x + w - 4, base - h, 4, BH - base + h, rp, 0.18);
      if (rnd() < 0.3) b.rect(x + (w >> 1), base - h - 10, 1, 10, rp, 0.5);
      for (let yy = base - h + 4; yy < base; yy += 5) for (let xx = x + 3; xx < x + w - 5; xx += 4)
        if (rnd() < lit) b.rect(xx, yy, 2, 2, rnd() < 0.85 ? win : win2, 0.7);
      x += w + Math.floor(rnd() * 3);
    }
    b.rect(0, base, BW, BH - base, rp, 0.3);
  }
  function far(theme) {
    const b = new Buf(BW, BH), g = theme.bg;
    if (g.sea) {
      const sy = HZ - g.sea, sea = ramp('#3a7ec0', { sh: 0.6, hl: 0.7 }), rnd = U.rng(77);
      b.rect(0, sy, BW, BH - sy, sea, [0.62, 0.35]);
      for (let i = 0; i < 160; i++) b.rect(Math.floor(rnd() * BW), Math.floor(sy + 3 + rnd() * 44), 3 + Math.floor(rnd() * 7), 1, sea, 0.95);
      if (g.islands) for (let x = 0; x < BW; x++) {
        const hgt = Math.round(wave(x, g.islandComps) - 6);
        for (let k = 0; k < hgt; k++) b.tone(x, sy - hgt + k, 0.6 - k / 40 + (hash(x >> 1, k) - 0.5) * 0.2, ramp(g.islands, { sh: 0.5 }));
      }
    }
    if (g.far === 'city') skyline(b, HZ, ramp('#2a2450', { sh: 0.6 }), 20, 80, 5, 0.25);
    else if (g.far) ridge(b, g.farComps, HZ - (g.farBase || 0), ramp(g.far, { sh: 0.6, hl: 0.35 }), { tex: 0.14 });
    return b.canvas();
  }
  function near(theme) {
    const b = new Buf(BW, BH), g = theme.bg;
    if (g.near === 'city') skyline(b, HZ + 4, ramp('#1a1634', { sh: 0.6 }), 30, 100, 9, 0.35);
    else if (g.near) ridge(b, g.nearComps, HZ - (g.nearBase || 0), ramp(g.near, { sh: 0.7, hl: 0.4 }),
      { trees: g.nearTrees ? ramp(g.nearTrees, { sh: 0.7 }) : null, tex: 0.22, fade: 0.006 });
    return b.canvas();
  }
  Spr.backgrounds = theme => Spr.cached('bg|' + theme.id, () => ({ sky: sky(theme), far: far(theme), near: near(theme) }));
})();
