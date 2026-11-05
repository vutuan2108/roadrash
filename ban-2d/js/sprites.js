'use strict';
// ============ Riders + motorbikes seen from behind, crash sprites ============
const Spr = (() => {
  const { Buf, ramp } = Art;
  const cache = new Map();
  const cached = (k, f) => { let v = cache.get(k); if (!v) { v = f(); cache.set(k, v); } return v; };
  const RPX = 4.0, RW = 148, RH = 144, CX = 74, OY = 16;   // design space: ground at y=126
  const R = {
    tire: ramp('#3a3a42', { sh: 0.9, hl: 0.22 }), chrome: ramp('#a8b2c0', { sh: 0.85, hl: 0.95 }),
    metal: ramp('#565a64', { hl: 0.5 }), black: ramp('#2e2e36', { hl: 0.35 }), glove: ramp('#2c2622', { hl: 0.35 }),
    boot: ramp('#2a2420', { hl: 0.4 }), red: ramp('#e01a1a', { hl: 0.75 }), plate: ramp('#e8e0b0', { sh: 0.5 }),
    amber: ramp('#ff9a1a', { hl: 0.7 }), wood: ramp('#8a5a2a'), steel: ramp('#9aa2ae', { hl: 0.8 }),
    pipe: ramp('#80868f', { sh: 0.8, hl: 0.6 }),
    copR: ramp('#ff2020', { hl: 0.9 }), copRd: ramp('#601010', { hl: 0.2 }),
    copB: ramp('#2a6aff', { hl: 0.9 }), copBd: ramp('#101850', { hl: 0.2 }),
  };
  const pr = pal => cached('pr|' + pal.id, () => ({
    jacket: ramp(pal.jacket, { hl: 0.55 }), pants: ramp(pal.pants, { hl: 0.4 }), helmet: ramp(pal.helmet, { hl: 0.75 }),
    stripe: pal.stripe ? ramp(pal.stripe, { hl: 0.6 }) : null, bike: ramp(pal.bike, { hl: 0.65 }),
    hair: pal.hair ? ramp(pal.hair, { hl: 0.5 }) : null, emblem: pal.emblem ? ramp(pal.emblem, { hl: 0.5 }) : null,
  }));

  function weapon(b, kind, h, s, mode) {
    if (kind === 'club') {
      const tip = mode === 'up' ? [h[0] - s * 4, h[1] - 22] : [h[0] + s * 20, h[1] - 12];
      b.cap(h[0], h[1], tip[0], tip[1], 2.2, 3, R.wood, { tex: 0.25 });
    } else {
      for (let i = 1; i <= 9; i++) {
        const t = i / 9;
        const x = mode === 'up' ? h[0] + s * Math.sin(t * 2.2) * 6 : h[0] + s * i * 2.3;
        const y = mode === 'up' ? h[1] - i * 2.4 : h[1] - Math.sin(t * Math.PI) * 7 + t * 4;
        b.blob(x, y, 1.9, 1.5, R.steel, { gloss: 0.7 });
      }
    }
  }
  function arm(b, s, mode, P, wpn) {
    const sx = CX + s * 18, sy = 34;
    let e, h;
    if (mode === 'bar') { e = [CX + s * 29, 46]; h = [CX + s * 32, 57]; }
    else if (mode === 'up') { e = [CX + s * 31, 22]; h = [CX + s * 27, 7]; }
    else { e = [CX + s * 33, 33]; h = [CX + s * 48, 31]; }
    if (wpn) weapon(b, wpn, h, s, mode);
    b.cap(sx, sy, e[0], e[1], 6.2, 5.2, P.jacket, { tex: 0.1 });
    b.cap(e[0], e[1], h[0], h[1], 5.2, 4.3, P.jacket, { tex: 0.1 });
    b.blob(h[0], h[1] + 0.5, 4.8, 4.6, R.glove, { gloss: 0.5 });
  }

  function riderBase(pal, act, wpn, flash) {
    const b = new Buf(RW, RH, 0, OY), P = pr(pal);
    // mirrors + handlebar (furthest away)
    for (const s of [-1, 1]) {
      b.cap(CX + s * 30, 56, CX + s * 36, 40, 0.9, 0.9, R.metal);
      b.blob(CX + s * 37, 37, 6, 4.2, R.chrome, { gloss: 0.8 });
    }
    b.cap(CX - 34, 57, CX + 34, 57, 1.6, 1.6, R.metal);
    b.box(CX - 25, 56, 50, 20, P.bike, { r: 8, gloss: 0.7, shin: 16 });       // tank / fairing sides
    for (const s of [-1, 1]) {                                                // thighs + shins
      b.cap(CX + s * 11, 63, CX + s * 25, 70, 7.5, 6.5, P.pants, { tex: 0.12 });
      b.cap(CX + s * 25, 70, CX + s * 22, 88, 6.2, 4.6, P.pants, { tex: 0.12 });
    }
    const mL = act === 1 ? 'up' : act === 2 ? 'out' : 'bar', mR = act === 3 ? 'up' : act === 4 ? 'out' : 'bar';
    arm(b, -1, mL, P, act === 1 || act === 2 ? wpn : null);
    arm(b, 1, mR, P, act === 3 || act === 4 ? wpn : null);
    // torso (hunched back)
    b.box(CX - 18, 30, 36, 34, P.jacket, { r: 13, tex: 0.08 });
    b.box(CX - 16, 52, 32, 14, P.jacket, { r: 7, tex: 0.08, bias: -0.08 });
    for (const s of [-1, 1]) b.blob(CX + s * 12, 34, 10.5, 8, P.jacket, { tex: 0.08, gloss: 0.25 });
    if (P.emblem) {                                                           // winged biker patch
      for (const s of [-1, 1]) b.poly([[CX + s * 3, 42], [CX + s * 15, 37], [CX + s * 13, 41], [CX + s * 16, 42],
        [CX + s * 13, 45], [CX + s * 15, 47], [CX + s * 3, 49]], P.emblem, { I: 0.62, only: true });
      b.blob(CX, 45, 4.5, 4.5, P.emblem, { only: true, gloss: 0.4 });
      b.blob(CX, 45, 2, 2, P.jacket, { only: true, bias: -0.2 });
    }
    for (let y = 42; y < 62; y += 2) b.set(CX, y + OY, P.jacket[1]);           // spine crease
    b.rect(CX - 16, 61, 32, 4, P.jacket, 0.22, { only: true });              // jacket hem
    b.blob(CX, 28, 8.5, 4, P.jacket, { bias: -0.15 });                        // collar
    if (P.hair) {                                                             // long hair blowing back
      b.cap(CX - 4, 25, CX - 6, 40, 6, 3.5, P.hair, { tex: 0.3 });
      b.cap(CX + 4, 25, CX + 7, 42, 6, 3.5, P.hair, { tex: 0.3 });
      b.cap(CX, 25, CX + 1, 44, 7, 4, P.hair, { tex: 0.3 });
    }
    // helmet
    b.blob(CX, 17, 12.5, 13, P.helmet, { gloss: 0.9, shin: 30 });
    const inHelmet = (x, y) => ((x + 0.5 - CX) / 12.5) ** 2 + ((y + 0.5 - 17) / 13) ** 2 <= 1;
    if (P.stripe) b.box(CX - 2.5, 3, 5, 28, P.stripe, { r: 2, clip: inHelmet, gloss: 0.9, shin: 30 });
    b.rect(CX - 9, 28, 18, 2, P.helmet, 0.1, { clip: inHelmet });             // rim
    // seat, boots, pegs
    b.box(CX - 12, 62, 24, 10, R.black, { r: 4, gloss: 0.3 });
    for (const s of [-1, 1]) {
      b.box(CX + s * 22 - 5, 86, 10, 11, R.boot, { r: 4, gloss: 0.5 });
      b.cap(CX + s * 18, 95, CX + s * 27, 95, 1.3, 1.3, R.metal);
    }
    // tail section + lights + plate
    b.box(CX - 15, 70, 30, 19, P.bike, { r: 8, gloss: 0.8, shin: 18 });
    b.box(CX - 9, 78, 18, 6, R.red, { r: 2.5, gloss: 0.5, shin: 60, amb: 0.45 });
    if (pal.police) {
      b.blob(CX - 20, 73, 3.5, 3.5, flash ? R.copR : R.copRd, { gloss: 1, amb: 0.6 });
      b.blob(CX + 20, 73, 3.5, 3.5, flash ? R.copBd : R.copB, { gloss: 1, amb: 0.6 });
    }
    for (const s of [-1, 1]) b.blob(CX + s * 17, 85, 2.2, 2, R.amber, { gloss: 1 });
    b.box(CX - 10, 92, 20, 7, R.black, { r: 3 });
    b.rect(CX - 7, 89, 14, 7, R.plate, 0.6); b.rect(CX - 5, 91, 10, 1, R.black, 0.4); b.rect(CX - 5, 93, 10, 1, R.black, 0.4);
    // exhausts, swingarm, tyre
    for (const s of [-1, 1]) {
      b.cap(CX + s * 23, 87, CX + s * 16, 97, 4, 4.6, R.pipe, { gloss: 0.35, shin: 40 });
      b.blob(CX + s * 16, 98, 3.6, 3.6, R.pipe, { gloss: 0.4, shin: 40 });
      b.blob(CX + s * 16, 98, 2, 2, R.black, { amb: 0 });
      b.cap(CX + s * 11, 101, CX + s * 13, 92, 2.2, 2.2, R.metal);
    }
    b.box(CX - 9, 96, 18, 30, R.tire, { r: 8, tex: 0.12 });
    for (let y = 100; y < 124; y += 3) for (let x = CX - 4; x <= CX + 4; x++) if ((x + y) % 4 === 0) b.set(x, y + OY, R.tire[0]);
    return b.outline(0.3);
  }
  function rider(pal, act, wpn, lean, flash) {
    if (act) lean = 0;
    return cached(`r|${pal.id}|${act}|${wpn || ''}|${lean}|${flash ? 1 : 0}`, () => {
      const base = cached(`rb|${pal.id}|${act}|${wpn || ''}|${flash ? 1 : 0}`, () => riderBase(pal, act, wpn, flash));
      return (lean ? base.sheared(lean * 4) : base).canvas(RPX);
    });
  }

  function tumble(pal, f) {
    return cached('t|' + pal.id + '|' + f, () => {
      const P = pr(pal), b = new Buf(72, 72), c = 36;
      b.cap(c - 6, c - 6, c - 18, c - 16, 4.6, 4, P.jacket); b.blob(c - 19, c - 18, 4, 4, R.glove);
      b.cap(c + 6, c - 6, c + 18, c + 2, 4.6, 4, P.jacket); b.blob(c + 19, c + 3, 4, 4, R.glove);
      b.cap(c - 5, c + 10, c - 10, c + 26, 5.6, 4.6, P.pants); b.box(c - 15, c + 24, 9, 8, R.boot, { r: 3 });
      b.cap(c + 5, c + 10, c + 16, c + 22, 5.6, 4.6, P.pants); b.box(c + 14, c + 20, 9, 8, R.boot, { r: 3 });
      b.box(c - 9, c - 9, 18, 22, P.jacket, { r: 7 });
      b.blob(c, c - 16, 9, 9.5, P.helmet, { gloss: 0.9 });
      return b.rotated(f * Math.PI / 4).outline(0.3).canvas(RPX);
    });
  }
  function bikeDown(pal) {
    return cached('bd|' + pal.id, () => {
      const P = pr(pal), b = new Buf(170, 60);
      for (const x of [30, 140]) {
        b.blob(x, 40, 26, 16, R.tire, { tex: 0.1 });
        b.blob(x, 40, 15, 9, R.chrome, { gloss: 0.7 }); b.blob(x, 40, 5, 3, R.metal);
      }
      b.poly([[40, 30], [120, 18], [146, 32], [60, 44]], P.bike, { I: 0.6 });
      b.box(64, 12, 44, 15, P.bike, { r: 6, gloss: 0.8 });
      b.box(110, 8, 30, 10, R.black, { r: 4 });
      b.box(78, 34, 40, 9, R.chrome, { r: 4, gloss: 0.9 });
      b.cap(18, 20, 32, 38, 2.2, 2.2, R.metal);
      return b.outline(0.3).canvas(RPX);
    });
  }
  return { cached, rider, tumble, bikeDown, RPX };
})();
