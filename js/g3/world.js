'use strict';
// ============ 3D world: road path, streamed terrain + scenery, sky, camera, entity sync, rendering ============
const World = (() => {
  const T = THREE, { lin, smooth, fbm, vnoise, Mesher, Bag } = G3, { M4 } = Models;
  const KZ = CFG.KZ, KX = CFG.KX, SL = CFG.segL * KZ;
  const CH = 128;                       // road segments per scenery chunk (~118 m)
  const TS = 126;                       // terrain tile size (m); LOD 0 = 3 m grid (near), LOD 1 = 6 m grid (far)
  const LODS = [{ rs: 3 }, { rs: 6 }].map(l => Object.assign(l, { nv: TS / l.rs + 1 }));
  let R = null;

  // ---------------------------------------------------------------- per-theme look
  const LOOK = {
    coast: { roadMin: 5, base: -8, sea: '#1b6aa6', sky: ['#1a58bf', '#7db6ec', '#d4eaf8'], fog: ['#d4eaf8', 180, 1600],
      sun: [-0.45, 0.62, -0.64], sunCol: '#fff1d8', sunI: 1.35, hemi: ['#d6eaff', '#c9a878', 0.8], exp: 1.0, clouds: 18,
      asphalt: '#6a6a6e', centre: 'dash', shoulder: '#cfb68a',
      rings: [{ r: 2650, h: 210, col: '#8eaac2', f: 3.2, cut: 0.48, seed: 1 }, { r: 2250, h: 110, col: '#7f9c86', f: 6, cut: 0.52, seed: 2 }] },
    forest: { base: -25, ground: '#2f5a2c', sky: ['#2f6cc8', '#8fc0ee', '#d2e4ee'], fog: ['#d2e4ee', 120, 1250],
      sun: [-0.5, 0.58, -0.64], sunCol: '#fff4e0', sunI: 1.3, hemi: ['#d0e6ff', '#4a6a3a', 0.8], exp: 1.0, clouds: 14,
      asphalt: '#58585c', centre: 'dash', shoulder: '#8e7c5c',
      rings: [{ r: 2700, h: 330, col: '#7d98b8', f: 4, cut: 0.25, seed: 3 }, { r: 2200, h: 190, col: '#4f7a5a', f: 7, cut: 0.3, seed: 4 }] },
    pass: { roadMin: 74, base: -8, sea: '#18609e', sky: ['#1d5ec8', '#86bff0', '#dcecf6'], fog: ['#dcecf6', 220, 1900],
      sun: [-0.4, 0.66, -0.63], sunCol: '#fff0d6', sunI: 1.35, hemi: ['#d8ecff', '#8a7a5a', 0.8], exp: 1.0, clouds: 16,
      asphalt: '#606064', centre: 'double', shoulder: '#9c8c6e',
      rings: [{ r: 2700, h: 420, col: '#7896a8', f: 3.5, cut: 0.2, seed: 5 }, { r: 2150, h: 240, col: '#5a7a5a', f: 6, cut: 0.32, seed: 6 }] },
    city: { base: -1, ground: '#24242a', night: true, sky: ['#04030f', '#160c34', '#3a2450'], fog: ['#2a1c3e', 70, 950],
      sun: [0.35, 0.55, 0.76], sunCol: '#9ab0ff', sunI: 0.45, hemi: ['#5a5a9a', '#2a2026', 0.55], exp: 1.15, clouds: 0,
      asphalt: '#45454c', centre: 'dashY', shoulder: '#8a8a92', rings: [] },
    // circuits: runoff = the painted strip behind the kerbs
    gpIsland: { roadMin: 3, base: -8, sea: '#1b6aa6', sky: ['#1a58bf', '#7db6ec', '#d4eaf8'], fog: ['#d4eaf8', 300, 2400],
      sun: [-0.45, 0.62, -0.64], sunCol: '#fff1d8', sunI: 1.35, hemi: ['#d6eaff', '#a8b070', 0.8], exp: 1.0, clouds: 18,
      asphalt: '#47484d', runoff: '#3a8a4c', rings: [{ r: 2650, h: 170, col: '#8eaac2', f: 3.2, cut: 0.5, seed: 11 }] },
    gpHills: { base: -30, ground: '#2f5a2c', sky: ['#2f6cc8', '#8fc0ee', '#d2e4ee'], fog: ['#d2e4ee', 220, 1900],
      sun: [-0.5, 0.58, -0.64], sunCol: '#fff4e0', sunI: 1.3, hemi: ['#d0e6ff', '#4a6a3a', 0.8], exp: 1.0, clouds: 14,
      asphalt: '#45464b', runoff: '#2f6f9a',
      rings: [{ r: 2700, h: 560, col: '#6d88aa', f: 4, cut: 0.15, seed: 12 }, { r: 2200, h: 300, col: '#46705a', f: 7, cut: 0.22, seed: 13 }] },
    gpNight: { base: -1, ground: '#141c14', night: true, flood: true, sky: ['#04030e', '#100b28', '#2a2244'], fog: ['#1a1830', 220, 1700],
      sun: [0.3, 0.8, 0.52], sunCol: '#eef4ff', sunI: 1.25, hemi: ['#a8b0d8', '#2a3020', 0.95], exp: 1.15, clouds: 0,
      asphalt: '#3c3d42', runoff: '#2f6a40', rings: [] },
    // drift: a cliff road above a jade river, a pine pass at sunset, a floodlit arena
    dMaPiLeng: { roadMin: 110, base: -8, sea: '#3f8f7a', sky: ['#1d5ec8', '#86bff0', '#dcecf6'], fog: ['#dcecf6', 240, 2000],
      sun: [-0.4, 0.66, -0.63], sunCol: '#fff0d6', sunI: 1.35, hemi: ['#d8ecff', '#8a7a5a', 0.8], exp: 1.0, clouds: 16,
      asphalt: '#5e5e62', centre: 'double', shoulder: '#9c8c6e',
      rings: [{ r: 2700, h: 640, col: '#6f8a8e', f: 9, cut: 0.42, seed: 31 }, { r: 2150, h: 380, col: '#5a7a58', f: 13, cut: 0.45, seed: 32 }] },
    dOQuyHo: { base: -25, ground: '#2a4026', sky: ['#28306a', '#c4705c', '#ffc890'], fog: ['#e2a684', 150, 1400],
      sun: [0.62, 0.16, -0.77], sunCol: '#ffb070', sunI: 1.5, hemi: ['#ffd0b0', '#3a4a30', 0.72], exp: 1.05, clouds: 14,
      asphalt: '#55555a', centre: 'dash', shoulder: '#8e7c5c',
      rings: [{ r: 2700, h: 700, col: '#5a5680', f: 4, cut: 0.12, seed: 21 }, { r: 2200, h: 360, col: '#4a5048', f: 7, cut: 0.2, seed: 22 }] },
    dArena: { base: -1, ground: '#141414', night: true, flood: true, sky: ['#04030e', '#100b28', '#2a2244'], fog: ['#1a1830', 180, 1500],
      sun: [0.3, 0.8, 0.52], sunCol: '#eef4ff', sunI: 1.2, hemi: ['#a8b0d8', '#2a3020', 0.95], exp: 1.15, clouds: 0,
      asphalt: '#3a3b40', runoff: '#34353a', rings: [] },
  };

  // ---------------------------------------------------------------- terrain height + colour per theme
  const C = lin, PAL = {
    coast: { sand: C('#d8bd88'), sandL: C('#ecd8ae'), wet: C('#b0956c'), grass: C('#94a058'), grass2: C('#7a8a46'), deep: C('#8aa89a') },
    forest: { g1: C('#4a8e36'), g2: C('#3a7a2e'), g3: C('#62a244'), dirt: C('#7a6446'), rock: C('#7c7a70') },
    pass: { g1: C('#6e8e3e'), g2: C('#567630'), dry: C('#9c9a5c'), rock: C('#8c8478'), rock2: C('#6c645a'), sand: C('#d4c090') },
    city: { a: C('#4a4a52'), b: C('#3a3a42') },
    gp: { g1: C('#5a9a3e'), g2: C('#4a8a34'), gravel: C('#cdb88e'), gravel2: C('#b8a27a'), pit: C('#55565c'), sand: C('#e2cc98'),
      wet: C('#b49a70'), deep: C('#8aa89a'), forest: C('#2f6a2a'), forest2: C('#3e7a32'), rock: C('#7c7a70'), night: C('#2a4a26'), night2: C('#22401f') },
  };
  // circuits: flat mowed grass out to the barrier (striped along the track), gravel traps outside the bends, the pit lane
  // behind the pit wall; beyond, each theme has its own country (sea round the island, mountains, flat night)
  const circuitTerrain = (far, farCol) => ({
    h(o, ry, x, z, W) {
      const a = Math.abs(o);
      if (a < 7.5) return ry - 0.5;
      return far(ry - 0.04 + (fbm(x / 70, z / 70) - 0.5) * 2.5 * smooth(34, 95, a), a, x, z, W);
    },
    c(h, sl, o, x, z, i, W) {
      const P = PAL.gp, a = Math.abs(o), n = vnoise(x / 3, z / 3), s = W.race.segs[Math.min(i, W.path.N - 1)];
      if (a < W.wallM + 0.8) {
        if (a > 9 && s.gravel === Math.sign(o)) return G3.mix(P.gravel, P.gravel2, n);
        return G3.mul(Math.floor(a / 4) % 2 ? P.g1 : P.g2, 0.94 + n * 0.12);
      }
      if (o > W.wallM && o < W.wallM + 10 && W.inPit(i)) return P.pit;
      return farCol(h, sl, a, x, z, n);
    },
  });
  const grassC = (a, n) => G3.mul(Math.floor(a / 4) % 2 ? PAL.gp.g1 : PAL.gp.g2, 0.94 + n * 0.12);

  const TERRAIN = {
    coast: {
      h(o, ry, x, z) {
        const a = Math.abs(o);
        if (a < 8) return ry - 0.6;
        if (o > 0) {
          const s = smooth(8, 60, a), beach = 1.5 - Math.max(0, a - 75) * 0.06 + (fbm(x / 30, z / 30) - 0.5) * 2.5 * (1 - smooth(55, 80, a));
          return U.lerp(ry - 0.6, Math.min(beach, ry - 0.6), s);
        }
        const s = smooth(8, 30, a), far = smooth(60, 260, a);
        return U.lerp(ry - 0.6 + s * ((a - 8) * 0.07 + (fbm(x / 40, z / 40) - 0.35) * 8), 14 + fbm(x / 170, z / 170) * 60, far);
      },
      c(h, sl, o, x, z) {
        const P = PAL.coast, n = fbm(x / 22, z / 22);
        if (h < 0.3) return P.deep;
        if (h < 1.7) return G3.mix(P.wet, P.sandL, smooth(0.3, 1.7, h));
        let c = G3.mix(P.sand, P.sandL, n * 0.6);
        if (o < 0) c = G3.mix(c, n > 0.55 ? P.grass : P.grass2, smooth(0.42, 0.62, n));
        return c;
      },
    },
    forest: {
      h(o, ry, x, z, W) {
        const a = Math.abs(o);
        if (a < 8) return ry - 0.6;
        const s = smooth(8, 30, a), far = smooth(50, 240, a);
        return U.lerp(ry - 0.6 + s * ((a - 8) * 0.2 + (fbm(x / 45, z / 45) - 0.4) * 10), W.mean + 5 + (fbm(x / 210, z / 210) - 0.3) * 130, far);
      },
      c(h, sl, o, x, z) {
        const P = PAL.forest, n = fbm(x / 30, z / 30), n2 = vnoise(x / 5, z / 5);
        let c = n < 0.45 ? G3.mix(P.g2, P.g1, n / 0.45) : G3.mix(P.g1, P.g3, (n - 0.45) / 0.55);
        c = G3.mix(c, P.dirt, Math.min(1, smooth(0.35, 0.6, sl) * 0.8 + (Math.abs(o) < 11 ? 0.35 : 0)));
        c = G3.mix(c, P.rock, smooth(0.6, 0.85, sl));
        return G3.mul(c, 0.92 + n2 * 0.16);
      },
    },
    pass: {
      h(o, ry, x, z) {
        const a = Math.abs(o);
        if (a < 8) return ry - 0.6;
        if (o < 0) {
          const wall = smooth(8, 9.5, a) * (a - 8) * 2.6 + (fbm(x / 8, z / 8) - 0.5) * 4 * smooth(9, 13, a);
          return Math.min(ry - 0.6 + wall, ry + 40 + fbm(x / 70, z / 70) * 80);
        }
        const h = ry - 0.6 - smooth(9, 18, a) * (a - 9) * 1.1 + (fbm(x / 30, z / 30) - 0.5) * 8 * smooth(12, 30, a);
        return Math.max(h, -7 + fbm(x / 90, z / 90) * 9);
      },
      c(h, sl, o, x, z) {
        const P = PAL.pass, n = fbm(x / 26, z / 26);
        if (h < 1.2) return G3.mix(P.sand, P.rock2, smooth(1.2, -2, h) * 0.5);
        let c = G3.mix(P.g2, P.g1, n);
        c = G3.mix(c, P.dry, smooth(0.55, 0.75, n) * 0.6);
        const strata = 0.82 + 0.18 * Math.sin(h * 1.7 + fbm(x / 12, z / 12) * 6);           // banded rock on steep faces
        const rock = G3.mul(G3.mix(P.rock, P.rock2, vnoise(x / 7, h / 3)), strata);
        return G3.mix(c, rock, smooth(o < 0 ? 0.22 : 0.4, o < 0 ? 0.45 : 0.7, sl));
      },
    },
    city: {
      h(o, ry) { return Math.abs(o) < 9.8 ? ry - 0.6 : ry + 0.12; },
      c(h, sl, o, x, z) { return G3.mix(PAL.city.a, PAL.city.b, vnoise(x / 9, z / 9)); },
    },
  };

  Object.assign(TERRAIN, {
    gpIsland: circuitTerrain((h, a, x, z) => U.lerp(h, -2.6 + fbm(x / 40, z / 40) * 1.4, smooth(170, 270, a)), (h, sl, a, x, z, n) => {
      const P = PAL.gp;
      if (h < 0.3) return P.deep;
      if (h < 1.8) return G3.mix(P.wet, P.sand, smooth(0.3, 1.8, h));
      return G3.mix(grassC(a, n), P.sand, smooth(120, 190, a));
    }),
    gpHills: circuitTerrain((h, a, x, z, W) => U.lerp(h, W.mean + 6 + (fbm(x / 220, z / 220) - 0.3) * 170, smooth(70, 270, a)), (h, sl, a, x, z, n) => {
      const P = PAL.gp;
      let c = G3.mix(grassC(a, n), G3.mix(P.forest, P.forest2, fbm(x / 30, z / 30)), smooth(45, 90, a));
      return G3.mix(c, P.rock, smooth(0.55, 0.8, sl));
    }),
    gpNight: circuitTerrain(h => h, (h, sl, a, x, z, n) => G3.mix(grassC(a, n), G3.mix(PAL.gp.night, PAL.gp.night2, n), smooth(40, 80, a))),
    dArena: circuitTerrain(h => h, (h, sl, a, x, z, n) => G3.mix(G3.mix(PAL.gp.pit, G3.mul(PAL.gp.pit, 0.8), n), G3.mix(PAL.gp.night, PAL.gp.night2, n), smooth(60, 110, a))),
  });
  // the drift stages are wider than the ground they borrow expects (rails w0 m out): it is moved out by the difference
  const widen = (T0, w0) => {
    const at = (o, W) => { const e = Math.max(0, W.wallM - w0); return Math.sign(o) * Math.max(0, Math.abs(o) - e); };
    const nw = W => W._nw || (W._nw = Object.create(W, { wallM: { value: Math.min(W.wallM, w0) } }));
    return { h: (o, ry, x, z, W) => T0.h(at(o, W), ry, x, z, nw(W)), c: (h, sl, o, x, z, i, W) => T0.c(h, sl, at(o, W), x, z, i, nw(W)) };
  };
  TERRAIN.dMaPiLeng = widen(TERRAIN.pass, 7.25); TERRAIN.dOQuyHo = widen(TERRAIN.forest, 7.25); TERRAIN.dArena = widen(TERRAIN.dArena, 11.5);
  // the drift stages borrow the scenery of the stage they look like
  const DECOR_AS = { dMaPiLeng: 'pass', dOQuyHo: 'forest', dArena: 'gpNight' };
  // ---------------------------------------------------------------- road centre line
  class Path {
    // lapN: the road is a closed circuit of lapN segments (the race segments repeat it lap after lap)
    constructor(segs, look, lapN) {
      const N = this.N = lapN || segs.length;
      this.loop = !!lapN;
      const X = this.x = new Float64Array(N + 1), Y = this.y = new Float32Array(N + 1), Z = this.z = new Float64Array(N + 1), Hd = this.h = new Float64Array(N + 1);
      let mn = Infinity, sum = 0;
      for (let i = 0; i <= N; i++) { Y[i] = (i < N ? segs[i].p1.world.y : segs[N - 1].p2.world.y) * CFG.KY; mn = Math.min(mn, Y[i]); sum += Y[i]; }
      const off = look.roadMin !== undefined ? look.roadMin - mn : 0;
      for (let i = 0; i <= N; i++) Y[i] += off;
      this.mean = sum / (N + 1) + off;
      let x = 0, z = 0, h = 0;
      for (let i = 0; i < N; i++) {
        X[i] = x; Z[i] = z; Hd[i] = h;
        const h2 = h - segs[i].curve * CFG.KC, hm = (h + h2) / 2;
        x += Math.sin(hm) * SL; z += Math.cos(hm) * SL; h = h2;
      }
      X[N] = x; Z[N] = z; Hd[N] = h;
      if (this.loop) {   // close the lap exactly: spread the few metres of rounding round it
        const ex = X[N] - X[0], ez = Z[N] - Z[0];
        for (let i = 0; i <= N; i++) { X[i] -= ex * i / N; Z[i] -= ez * i / N; }
      }
      this.step = 6; this.grid = new Map();
      for (let i = 0; i <= N; i += this.step) { const k = this.cell(X[i], Z[i]); let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(i); }
    }
    cell(x, z) { return Math.floor(x / 64) * 100000 + Math.floor(z / 64); }
    // seg index i + fraction t, lateral offset in metres (+ = right)
    atM(i, t, om, out) {
      const N = this.N;
      if (this.loop) { const f = ((i + t) % N + N) % N; i = Math.floor(f); t = f - i; }
      else { if (i < 0) { t += i; i = 0; } if (i > N - 1) { t += i - (N - 1); i = N - 1; } }
      const h = this.h[i] + (this.h[i + 1] - this.h[i]) * t;
      const cx = this.x[i] + (this.x[i + 1] - this.x[i]) * t, cz = this.z[i] + (this.z[i + 1] - this.z[i]) * t;
      out.x = cx - Math.cos(h) * om; out.z = cz + Math.sin(h) * om; out.h = h;
      out.y = this.y[i] + (this.y[i + 1] - this.y[i]) * U.clamp(t, 0, 1);
      out.slope = (this.y[i + 1] - this.y[i]) / SL;
      return out;
    }
    at(zu, xo, out) { const f = zu / CFG.segL, i = Math.floor(f); return this.atM(i, f - i, xo * KX, out); }
    cands(x0, z0, x1, z1) {
      const out = [];
      for (let cx = Math.floor(x0 / 64); cx <= Math.floor(x1 / 64); cx++) for (let cz = Math.floor(z0 / 64); cz <= Math.floor(z1 / 64); cz++) {
        const a = this.grid.get(cx * 100000 + cz); if (a) for (const i of a) out.push(i);
      }
      return out;
    }
    nearest(px, pz, cands, out) {
      let best = -1, bd = Infinity;
      for (let k = 0; k < cands.length; k++) { const i = cands[k], dx = px - this.x[i], dz = pz - this.z[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
      if (best < 0) { out.a = 1e9; out.o = 1e9; out.i = 0; out.ry = this.mean; return out; }
      const a = Math.max(0, best - this.step), b = Math.min(this.N, best + this.step);
      for (let i = a; i <= b; i++) { const dx = px - this.x[i], dz = pz - this.z[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
      const h = this.h[best], dx = px - this.x[best], dz = pz - this.z[best];
      const along = dx * Math.sin(h) + dz * Math.cos(h), off = -dx * Math.cos(h) + dz * Math.sin(h);
      let j = best, t = along / SL;
      if (t < 0 && j > 0) { j--; t += 1; }
      if (j >= this.N) { j = this.N - 1; t = 1; }
      t = U.clamp(t, 0, 1);
      out.i = best; out.ry = this.y[j] + (this.y[j + 1] - this.y[j]) * t;
      out.a = Math.hypot(off, Math.max(0, Math.abs(along) - SL)); out.o = off >= 0 ? out.a : -out.a;
      return out;
    }
  }

  // ---------------------------------------------------------------- drift: tyre smoke (soft point sprites) and skid marks
  // puffs fade out as they come close to the lens and never grow past maxPx on screen, so a cloud the camera drives
  // into thins out instead of turning the whole screen white
  const SMOKE_VS = `uniform float scale; uniform float maxPx; attribute float size; attribute float alpha; varying float vA;
    #include <fog_pars_vertex>
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float d = max(0.1, -mvPosition.z);
      gl_PointSize = min(size * scale / d, maxPx);
      gl_Position = projectionMatrix * mvPosition; vA = alpha * smoothstep(1.0, 5.5, d);
      #include <fog_vertex>
    }`;
  const SMOKE_FS = `uniform sampler2D map; uniform vec3 color; varying float vA;
    #include <fog_pars_fragment>
    void main() {
      vec4 t = texture2D(map, gl_PointCoord);
      gl_FragColor = vec4(color * (0.8 + 0.2 * t.r), t.a * vA);
      if (gl_FragColor.a < 0.004) discard;
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      #include <fog_fragment>
    }`;
  let PUFF = null;
  function puffTex() {   // a soft, lumpy puff
    if (PUFF) return PUFF;
    const c = G3.canvas(128, 128), g = c.getContext('2d'), rnd = U.rng(5);
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * 26, x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, r = 22 + rnd() * 20;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const v = 200 + (rnd() * 55 | 0);
      gr.addColorStop(0, `rgba(${v},${v},${v},0.5)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    return (PUFF = G3.tex(c));
  }
  class Smoke {
    constructor(scene, col) {
      const N = this.N = 1500;
      this.p = new Float32Array(N * 3); this.sz = new Float32Array(N); this.al = new Float32Array(N);
      this.v = new Float32Array(N * 3); this.age = new Float32Array(N).fill(9); this.life = new Float32Array(N).fill(1);
      this.s0 = new Float32Array(N); this.s1 = new Float32Array(N); this.a0 = new Float32Array(N); this.k = 0;
      const g = this.g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(this.p, 3).setUsage(T.DynamicDrawUsage));
      g.setAttribute('size', new T.BufferAttribute(this.sz, 1).setUsage(T.DynamicDrawUsage));
      g.setAttribute('alpha', new T.BufferAttribute(this.al, 1).setUsage(T.DynamicDrawUsage));
      const u = T.UniformsUtils.merge([T.UniformsLib.fog, { color: { value: new T.Color(col) }, scale: { value: 500 }, maxPx: { value: 400 } }]);
      u.map = { value: puffTex() };
      this.mat = new T.ShaderMaterial({ uniforms: u, vertexShader: SMOKE_VS, fragmentShader: SMOKE_FS, transparent: true, depthWrite: false, fog: true });
      this.pts = new T.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = 5;
      scene.add(this.pts);
    }
    emit(x, y, z, vx, vy, vz, s0, s1, life, a0) {
      const i = this.k++ % this.N;
      this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
      this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
      this.age[i] = 0; this.life[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a0;
    }
    update(dt, scale, maxPx) {
      const P = this.p, V = this.v, drag = Math.max(0, 1 - dt * 1.6);
      for (let i = 0; i < this.N; i++) {
        const a = this.age[i] += dt, L = this.life[i];
        if (a >= L) { this.al[i] = 0; this.sz[i] = 0; continue; }
        const f = a / L;
        V[i * 3] *= drag; V[i * 3 + 2] *= drag; V[i * 3 + 1] = V[i * 3 + 1] * drag + 0.35 * dt;
        P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
        this.sz[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * Math.sqrt(f);
        this.al[i] = this.a0[i] * Math.pow(1 - f, 1.4) * Math.min(1, a * 10);
      }
      for (const k of ['position', 'size', 'alpha']) this.g.attributes[k].needsUpdate = true;
      this.mat.uniforms.scale.value = scale; this.mat.uniforms.maxPx.value = maxPx || 400;
    }
    dispose() { this.g.dispose(); this.mat.dispose(); }
  }
  // black rubber left on the tarmac: a ring buffer of quads, one strip per tyre
  class Skids {
    constructor(scene) {
      const n = (this.max = 6000) * 6;
      this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4);
      const g = this.g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(this.pos, 3).setUsage(T.DynamicDrawUsage));
      g.setAttribute('color', new T.BufferAttribute(this.col, 4).setUsage(T.DynamicDrawUsage));
      g.setDrawRange(0, 0);
      this.mat = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      this.mesh = new T.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
      scene.add(this.mesh);
      this.n = 0; this.last = []; this.dirty = false;   // last mark of each tyre (car k: tyres 4k .. 4k + 3)
    }
    // tyre k at (x, y, z), sideways unit (lx, lz), half width hw, darkness a
    add(k, x, y, z, lx, lz, hw, a) {
      const L = this.last[k], l = [x + lx * hw, y, z + lz * hw], r = [x - lx * hw, y, z - lz * hw];
      if (L) {
        const d = Math.hypot(x - L.x, z - L.z);
        if (d < 0.35) return;
        if (d < 4) {
          const i = (this.n++ % this.max) * 6, v = [L.l, L.r, l, L.r, r, l], al = [L.a, L.a, a, L.a, a, a];
          if (!this.dirty) { this.lo = i; this.hi = i + 6; } else if (i < this.lo) this.lo = -1; else this.hi = i + 6;   // lo -1: wrapped
          for (let j = 0; j < 6; j++) {
            this.pos.set(v[j], (i + j) * 3);
            const c = (i + j) * 4; this.col[c] = 0.025; this.col[c + 1] = 0.025; this.col[c + 2] = 0.028; this.col[c + 3] = al[j];
          }
          this.dirty = true;
        }
      }
      this.last[k] = { x, z, l, r, a };
    }
    cut(k) { this.last[k] = null; }
    flush() {
      if (!this.dirty) return;
      this.dirty = false;
      this.g.setDrawRange(0, Math.min(this.n, this.max) * 6);
      // upload only the quads written this frame
      for (const [k, n] of [['position', 3], ['color', 4]]) {
        const at = this.g.attributes[k];
        at.updateRange.offset = this.lo < 0 ? 0 : this.lo * n; at.updateRange.count = this.lo < 0 ? -1 : (this.hi - this.lo) * n;
        at.needsUpdate = true;
      }
    }
    dispose() { this.g.dispose(); this.mat.dispose(); }
  }

  // ---------------------------------------------------------------- sky shader
  const SKY_VS = 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const SKY_FS = `uniform vec3 top, mid, hor, sunDir, sunCol; uniform float sunAmt; varying vec3 vDir;
    void main(){
      vec3 d = normalize(vDir); float h = d.y;
      vec3 c = mix(hor, mid, smoothstep(0.0, 0.22, h));
      c = mix(c, top, smoothstep(0.18, 0.9, h));
      c = mix(c, hor * 0.9, smoothstep(0.0, -0.25, h));
      float s = max(dot(d, sunDir), 0.0);
      c += sunCol * sunAmt * (pow(s, 1500.0) * 8.0 + pow(s, 60.0) * 0.3 + pow(s, 5.0) * 0.12);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`;

  // ================================================================ one world per race
  const _t1 = {}, _t2 = {}, _t3 = {}, _q = {}, _v = new T.Vector3();
  class W3 {
    constructor(race) {
      this.race = race; this.theme = race.theme; this.L = LOOK[race.theme.id]; this.terr = TERRAIN[race.theme.id];
      this.night = !!this.L.night; this.time = 0; this.owned = [];
      this.circuit = !!race.circuit; this.lapN = race.lapN || 0; this.wallM = (race.wall || 3.2) * KX;
      this.path = new Path(race.segs, this.L, this.lapN); this.mean = this.path.mean;
      this.base = this.L.base + (this.L.roadMin !== undefined ? 0 : this.mean);
      const sc = this.scene = new T.Scene();
      this.cam = new T.PerspectiveCamera(62, 1.6, 0.25, 3400);
      sc.fog = new T.Fog(this.L.fog[0], this.L.fog[1], this.L.fog[2]);
      this.buildSky(); this.buildLights(); this.buildEnv(); this.buildBase(); this.buildRoad();
      this.corridor = this.corridorTiles();
      this.tiles = new Map(); this.chunks = new Map();
      this.riders = new Map(); this.cars = new Map(); this.carPool = {};
      if (this.night) this.buildGlows();
      this.cs = null;
      if (race.drift) { this.initDrift(race); this.updateDriftCam(race, 0); } else this.updateCam(race, 0);
      this.stream(true);
    }
    own(x) { this.owned.push(x); return x; }
    mat(m) { return this.own(m); }

    // ---------------- sky, clouds, stars, distant mountains ----------------
    buildSky() {
      const L = this.L, sun = new T.Vector3(...L.sun).normalize();
      this.sunDir = sun;
      this.skyMat = this.mat(new T.ShaderMaterial({
        uniforms: { top: { value: new T.Color(L.sky[0]) }, mid: { value: new T.Color(L.sky[1]) }, hor: { value: new T.Color(L.sky[2]) },
          sunDir: { value: sun }, sunCol: { value: new T.Color(L.sunCol) }, sunAmt: { value: this.night ? 0.0 : 1.0 } },
        vertexShader: SKY_VS, fragmentShader: SKY_FS, side: T.BackSide, depthWrite: false, fog: false }));
      const g = this.skyG = new T.Group();
      const sky = new T.Mesh(this.own(new T.SphereGeometry(3000, 32, 16)), this.skyMat); sky.renderOrder = -10; sky.frustumCulled = false;
      g.add(sky);
      const rnd = U.rng(this.race.segs.length + 17);
      for (let i = 0; i < L.clouds; i++) {
        const a = rnd() * Math.PI * 2, r = 1500 + rnd() * 1000, s = 500 + rnd() * 500;
        const sp = new T.Sprite(this.mat(new T.SpriteMaterial({ map: G3.tx.cloud, transparent: true, depthWrite: false, fog: false, opacity: 0.75 + rnd() * 0.25 })));
        sp.position.set(Math.sin(a) * r, 260 + rnd() * 380, Math.cos(a) * r); sp.scale.set(s, s * 0.45, 1); sp.renderOrder = -8;
        g.add(sp);
      }
      if (this.night) {
        const pos = [];
        for (let i = 0; i < 1400; i++) {
          const a = rnd() * Math.PI * 2, y = 0.08 + rnd() * 0.92, r = Math.sqrt(1 - y * y);
          pos.push(Math.sin(a) * r * 2800, y * 2800, Math.cos(a) * r * 2800);
        }
        const sg = this.own(new T.BufferGeometry()); sg.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        const st = new T.Points(sg, this.mat(new T.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })));
        st.renderOrder = -9; g.add(st);
        const moon = new T.Mesh(this.own(new T.SphereGeometry(55, 20, 12)), this.mat(new T.MeshBasicMaterial({ color: '#fff6dc', fog: false })));
        moon.position.copy(this.sunDir).multiplyScalar(2600); g.add(moon);
        const halo = new T.Sprite(this.mat(new T.SpriteMaterial({ map: G3.tx.glow, color: '#8a90c0', transparent: true, depthWrite: false, fog: false, blending: T.AdditiveBlending })));
        halo.position.copy(moon.position); halo.scale.set(520, 520, 1); g.add(halo);
      }
      this.scene.add(g);
      // distant ridge rings (follow the camera so they sit at the horizon)
      this.ringG = new T.Group();
      for (const rg of L.rings) this.ringG.add(this.ring(rg));
      if (this.night) this.ringG.add(this.skyline());
      this.scene.add(this.ringG);
    }
    ring(o) {
      const K = 256, pos = [], col = [], idx = [], fogC = lin(this.L.fog[0]), cc = lin(o.col), y0 = Math.min(this.base, 0) - 60;
      for (let k = 0; k <= K; k++) {
        const a = k / K * Math.PI * 2, n = fbm(Math.cos(a) * o.f + o.seed * 13, Math.sin(a) * o.f + o.seed * 7, 5);
        const hh = o.h * Math.max(0, (n - o.cut) / (1 - o.cut)) * 1.6, x = Math.sin(a) * o.r, z = Math.cos(a) * o.r, sh = 0.8 + 0.4 * vnoise(a * 40, o.seed);
        pos.push(x, y0, z, x, Math.max(0, this.mean * 0.3) + hh * 0.35, z, x, Math.max(0, this.mean * 0.3) + hh, z);
        col.push(...fogC, ...G3.mix(cc, fogC, 0.45), ...G3.mul(G3.mix(cc, fogC, 0.12), sh));
        if (k < K) { const b = k * 3; idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5); }
      }
      const g = this.own(new T.BufferGeometry());
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx);
      const m = new T.Mesh(g, this.mat(new T.MeshBasicMaterial({ vertexColors: true, fog: false, side: T.DoubleSide })));
      m.renderOrder = -7; m.frustumCulled = false;
      return m;
    }
    skyline() {
      const c = G3.canvas(2048, 256), g = c.getContext('2d'), rnd = U.rng(77);
      for (let pass = 0; pass < 2; pass++) for (let x = 0; x < 2048;) {
        const w = 30 + rnd() * 70, h = (pass ? 40 : 80) + rnd() * (pass ? 110 : 160);
        g.fillStyle = pass ? '#1a1430' : '#2a2046'; g.fillRect(x, 256 - h, w, h);
        for (let wy = 256 - h + 6; wy < 250; wy += 8) for (let wx = x + 4; wx < x + w - 4; wx += 7) if (rnd() < (pass ? 0.35 : 0.2)) {
          g.fillStyle = rnd() < 0.7 ? '#ffd890' : '#a8d8ff'; g.fillRect(wx, wy, 3, 4);
        }
        if (rnd() < 0.15) { g.fillStyle = '#ff3030'; g.fillRect(x + w / 2, 256 - h - 6, 3, 3); }
        x += w + rnd() * 10;
      }
      const t = G3.tex(c); t.wrapS = T.RepeatWrapping; t.repeat.set(2, 1); this.own(t);
      const m = new T.Mesh(this.own(new T.CylinderGeometry(1700, 1700, 340, 64, 1, true)),
        this.mat(new T.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.3, fog: false, side: T.BackSide, depthWrite: false })));
      m.position.y = this.mean + 150; m.renderOrder = -7; m.frustumCulled = false;
      return m;
    }
    buildLights() {
      const L = this.L, sc = this.scene;
      this.hemi = new T.HemisphereLight(L.hemi[0], L.hemi[1], L.hemi[2]); sc.add(this.hemi);
      const sun = this.sun = new T.DirectionalLight(L.sunCol, L.sunI);
      sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 420 });
      sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
      sc.add(sun); sc.add(sun.target);
      this.head = new T.SpotLight('#fff0d0', this.night ? 2.6 : 0, 75, 0.42, 0.5, 1.2); sc.add(this.head); sc.add(this.head.target);
      this.siren = new T.PointLight('#2050ff', 0, 32, 1.5); sc.add(this.siren);
    }
    buildEnv() {
      const pm = new T.PMREMGenerator(R), es = new T.Scene();
      es.add(new T.Mesh(new T.SphereGeometry(10, 32, 16), this.skyMat));
      const gnd = new T.Mesh(new T.CircleGeometry(12, 24), new T.MeshBasicMaterial({ color: this.night ? '#101018' : PAL_GROUND[this.theme.id] }));
      gnd.rotation.x = -Math.PI / 2; gnd.position.y = -0.6; es.add(gnd);
      this.env = this.own(pm.fromScene(es, 0.03, 0.1, 50).texture);
      pm.dispose(); gnd.geometry.dispose(); gnd.material.dispose(); es.children[0].geometry.dispose();
    }
    buildBase() {   // sea or a ground plane under/around the terrain corridor
      const L = this.L, P = this.path, cx = (P.x[0] + P.x[P.N]) / 2, cz = (P.z[0] + P.z[P.N]) / 2;
      const g = this.own(new T.PlaneGeometry(30000, 30000)); g.rotateX(-Math.PI / 2);
      if (L.sea) {
        const tx = G3.tx.water; tx.repeat.set(3000, 3000);
        this.seaMat = this.mat(new T.MeshStandardMaterial({ color: L.sea, roughness: 0.14, metalness: 0.05, normalMap: tx,
          normalScale: new T.Vector2(0.35, 0.35), envMap: this.env, envMapIntensity: 1.1 }));
        const m = new T.Mesh(g, this.seaMat); m.position.set(cx, 0, cz); m.receiveShadow = false; this.scene.add(m);
      } else {
        const m = new T.Mesh(g, this.mat(new T.MeshLambertMaterial({ color: L.ground })));
        m.position.set(cx, this.base, cz); this.scene.add(m);
      }
    }

    // ---------------- road ribbon (built once) ----------------
    buildRoad() {
      if (this.circuit) { this.buildCircuit(); this.buildLines(); return; }
      const P = this.path, N = P.N, L = this.L, city = this.theme.id === 'city', pass = this.theme.id === 'pass';
      const drift = !!this.race.drift, hw = (this.race.E || 1) * KX, WM = this.wallM;
      const roadTex = this.own(G3.roadTex(this.theme, L, drift ? hw : 5));
      const roadMat = this.mat(new T.MeshLambertMaterial({ map: roadTex }));
      const sh = lin(L.shoulder), curb = lin('#c8c8c4'), dk = k => G3.mul(sh, k);
      const side = city
        ? [[4.98, 0, curb], [5.0, 0.16, curb], [5.25, 0.16, curb], [5.27, 0.15, sh], [9.8, 0.15, sh], [10.0, -1.4, dk(0.6)]]
        : drift ? [[hw, 0, dk(0.9)], [hw + 0.3, -0.015, sh], [WM + 0.5, -0.04, dk(0.95)], [Math.max(9.8, WM + 2.4), -1.4, dk(0.75)]]
        : [[5.0, 0, dk(0.9)], [5.35, -0.015, sh], [7.6, -0.07, dk(0.95)], [9.8, -1.4, dk(0.75)]];
      const prof = side.slice().reverse().map(([o, y, c]) => [-o, y, c]).concat(side);
      const tmp = {};
      for (let c0 = 0; c0 < N; c0 += 256) {
        const c1 = Math.min(N, c0 + 256), rp = [], ru = [], sp = [], sc = [], su = [], gp = [], gl = [], posts = drift ? new Mesher(5) : null;
        for (let i = c0; i <= c1; i++) {
          const v = i * SL;
          for (const o of [-hw, hw]) { P.atM(i, 0, o, tmp); rp.push(tmp.x, tmp.y, tmp.z); ru.push(o < 0 ? 0 : 1, v / 20); }
          for (const [o, y, col] of prof) { P.atM(i, 0, o, tmp); sp.push(tmp.x, tmp.y + y, tmp.z); sc.push(...col); su.push(o / 4, v / 4); }
          if (pass) for (const y of [0.42, 0.82]) { P.atM(i, 0, 6.05, tmp); gp.push(tmp.x, tmp.y + y, tmp.z); }
          if (drift) {   // W-beam guard rails on both sides at the wall line, a post every ~3.7 m
            for (const y of [0.4, 0.78]) { P.atM(i, 0, WM, tmp); gp.push(tmp.x, tmp.y + y, tmp.z); P.atM(i, 0, -WM, tmp); gl.push(tmp.x, tmp.y + y, tmp.z); }
            if (i % 4 === 0 && i < c1) for (const sd of [-1, 1]) {
              P.atM(i, 0, sd * (WM + 0.1), tmp);
              posts.add(Models.GEO.box, Models.M4(tmp.x, tmp.y + 0.3, tmp.z, 0, tmp.h, 0, 0.12, 1.0, 0.1), '#6c7078', 'lam');
            }
          }
        }
        const strip = (pos, w, reverse) => {
          const idx = [];
          for (let i = 0; i < c1 - c0; i++) for (let j = 0; j < w - 1; j++) {
            const a = i * w + j, b = a + 1, c = a + w, d = c + 1;
            if (reverse) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
          }
          return idx;
        };
        const mk = (pos, uv, col, idx, mat) => {
          const g = this.own(new T.BufferGeometry());
          g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
          if (uv) g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
          if (col) g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
          g.setIndex(idx); g.computeVertexNormals();
          const m = new T.Mesh(g, mat); m.receiveShadow = true; this.scene.add(m);
          return m;
        };
        mk(rp, ru, null, strip(rp, 2), roadMat);
        // shoulders: split the profile into its left and right halves (never bridge across the road)
        const w = prof.length, idx = [];
        for (let i = 0; i < c1 - c0; i++) for (let j = 0; j < w - 1; j++) {
          if (j === side.length - 1) continue;
          const a = i * w + j, b = a + 1, c = a + w, d = c + 1; idx.push(a, b, c, b, d, c);
        }
        mk(sp, su, sc, idx, G3.mats.terrain);
        if (pass || drift) {
          this.railMat = this.railMat || this.mat(new T.MeshLambertMaterial({ color: '#a4aab2', side: T.DoubleSide }));
          mk(gp, null, null, strip(gp, 2), this.railMat).castShadow = true;
        }
        if (drift) {
          mk(gl, null, null, strip(gl, 2), this.railMat).castShadow = true;
          const pg = posts.geos().lam;
          if (pg) { this.own(pg); const pm = new T.Mesh(pg, G3.mats.lam); pm.castShadow = true; pm.receiveShadow = true; this.scene.add(pm); }
        }
      }
      this.buildLines();
    }
    // chequered start / finish lines
    buildLines() {
      const P = this.path, tmp = {};
      const ck = G3.canvas(256, 64), g2 = ck.getContext('2d');
      for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g2.fillStyle = (x + y) % 2 ? '#141414' : '#f2f2f2'; g2.fillRect(x * 16, y * 16, 16, 16); }
      const ckMat = this.mat(new T.MeshLambertMaterial({ map: this.own(G3.tex(ck)), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      const hw = (this.race.E || 1) * KX;
      this.race.segs.forEach((s, i) => {
        if (i >= P.N || !s.checker || this.race.segs[i - 1] && this.race.segs[i - 1].checker) return;
        const pos = [], uv = [];
        for (const [k, v] of [[0, 0], [2, 1]]) for (const o of [-hw, hw]) { P.atM(i, k, o, tmp); pos.push(tmp.x, tmp.y + 0.01, tmp.z); uv.push(o < 0 ? 0 : 1, v); }
        const g = this.own(new T.BufferGeometry());
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
        g.setIndex([0, 1, 2, 1, 3, 2]); g.computeVertexNormals();
        const m = new T.Mesh(g, ckMat); m.receiveShadow = true; this.scene.add(m);
      });
    }

    // ---------------- circuit: 14 m tarmac, kerbs, run-off, barrier with sponsor boards and catch fence, grid boxes ----------------
    inPit(i) { const p = this.race.pit; return !!p && (p[0] <= p[1] ? i >= p[0] && i <= p[1] : i >= p[0] || i <= p[1]); }
    buildCircuit() {
      const P = this.path, N = P.N, L = this.L, segs = this.race.segs, HW = this.race.E * KX, WM = this.wallM, tmp = {}, tmp2 = {};
      const roadMat = this.mat(new T.MeshLambertMaterial({ map: this.own(G3.circuitTex(L, HW)) }));
      const S1 = Math.max(9.35, HW + 1.85), S2 = S1 + 0.45;   // run-off behind the kerb, then the lip
      const vcMat = this.mat(new T.MeshLambertMaterial({ vertexColors: true }));
      const adTex = this.own(G3.adStrip());
      const adMat = this.mat(new T.MeshLambertMaterial({ map: adTex, emissive: this.night ? 0xffffff : 0x000000, emissiveMap: this.night ? adTex : null, emissiveIntensity: 0.45 }));
      const run = lin(L.runoff), edge = G3.mul(PAL.gp.g2, 0.9), kW = lin('#ecece8'), kR = lin('#c41c1c'), conc = lin('#b8b8b2'), conc2 = lin('#9a9a94');
      const add = (pos, col, uv, idx, mat, shadow) => {
        const g = this.own(new T.BufferGeometry());
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        if (col) g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
        if (uv) g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
        if (idx) g.setIndex(idx);
        g.computeVertexNormals();
        const m = new T.Mesh(g, mat); m.receiveShadow = true; m.castShadow = !!shadow; this.scene.add(m);
        return m;
      };
      const strip = (rows, w) => { const idx = []; for (let i = 0; i < rows; i++) for (let j = 0; j < w - 1; j++) { const a = i * w + j; idx.push(a, a + 1, a + w, a + 1, a + w + 1, a + w); } return idx; };
      for (let c0 = 0; c0 < N; c0 += 256) {
        const c1 = Math.min(N, c0 + 256), rp = [], ru = [], sp = [], sc = [], kp = [], kc = [], wp = [], wu = [], cp = [], cc = [], fence = [];
        for (let i = c0; i <= c1; i++) {
          const v = i * SL;
          for (const o of [-HW, HW]) { P.atM(i, 0, o, tmp); rp.push(tmp.x, tmp.y, tmp.z); ru.push(o < 0 ? 0 : 1, v / 20); }
          // shoulders: painted run-off behind the kerb, then a lip down under the grass
          for (const [o, y, col] of [[-S2, -0.6, edge], [-S1, -0.012, run], [-HW, 0, run], [HW, 0, run], [S1, -0.012, run], [S2, -0.6, edge]]) {
            P.atM(i, 0, o, tmp); sp.push(tmp.x, tmp.y + y, tmp.z); sc.push(...col);
          }
          // barrier: inner face (sponsor boards), top and back
          for (const s of [-1, 1]) {
            P.atM(i, 0, s * WM, tmp); P.atM(i, 0, s * (WM + 0.45), tmp2);
            wp.push(tmp.x, tmp.y - 0.1, tmp.z, tmp.x, tmp.y + 1.05, tmp.z); wu.push(v / 32, 0.04, v / 32, 0.96);
            cp.push(tmp.x, tmp.y + 1.05, tmp.z, tmp2.x, tmp2.y + 1.05, tmp2.z, tmp2.x, tmp2.y - 0.1, tmp2.z);
            cc.push(...conc, ...conc, ...conc2);
            if (i % 5 === 0) {   // catch-fence posts every ~4.6 m
              P.atM(i, 0, s * (WM + 0.22), tmp);
              fence.push(tmp.x, tmp.y + 1.05, tmp.z, tmp.x, tmp.y + 4.2, tmp.z);
            }
          }
          if (i < c1 && segs[i].kerb) for (const s of [-1, 1]) {   // red and white kerb, ~1 m stripes, a raised hump
            const col = (i >> 0) % 2 ? kR : kW, prof = [[HW - 0.05, 0.004], [HW + 0.35, 0.045], [HW + 1.15, 0.006]];
            for (let q = 0; q < 2; q++) {
              const A = prof[q], B = prof[q + 1], pts = [];
              for (const [k, p] of [[0, A], [0, B], [1, B], [1, A]]) { P.atM(i, k, s * p[0], tmp); pts.push([tmp.x, tmp.y + p[1], tmp.z]); }
              const tri = s > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
              for (const t of tri) { kp.push(...pts[t]); kc.push(...col); }
            }
          }
        }
        const rows = c1 - c0;
        add(rp, null, ru, strip(rows, 2), roadMat);
        const sidx = []; for (let i = 0; i < rows; i++) for (const j of [0, 1, 3, 4]) { const a = i * 6 + j; sidx.push(a, a + 1, a + 6, a + 1, a + 7, a + 6); }
        add(sp, sc, null, sidx, G3.mats.terrain);
        if (kp.length) add(kp, kc, null, null, vcMat);
        // barrier faces: inner (per side, facing the track) and the concrete top / back
        const widx = [], cidx = [];
        for (let i = 0; i < rows; i++) {
          const a = i * 4, b = a + 4;
          widx.push(a, b, a + 1, a + 1, b, b + 1);              // left side faces +right
          widx.push(a + 2, a + 3, b + 2, a + 3, b + 3, b + 2);  // right side faces left
          const c = i * 6, d = c + 6;
          cidx.push(c, d, c + 1, c + 1, d, d + 1, c + 1, d + 1, c + 2, c + 2, d + 1, d + 2);              // left: top, back
          cidx.push(c + 3, c + 4, d + 3, c + 4, d + 4, d + 3, c + 4, c + 5, d + 4, c + 5, d + 5, d + 4);  // right: top, back
        }
        add(wp, null, wu, widx, adMat, true);
        add(cp, cc, null, cidx, vcMat, true);
        if (fence.length) {
          const g = this.own(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(fence, 3));
          this.scene.add(new T.LineSegments(g, this.fenceMat || (this.fenceMat = this.mat(new T.LineBasicMaterial({ color: this.night ? '#7a8090' : '#5a606a' })))));
        }
      }
      // catch-fence wires along the whole lap
      const wires = [];
      for (const s of [-1, 1]) for (const y of [1.9, 2.8, 3.7, 4.15]) for (let i = 0; i < N; i += 5) {
        P.atM(i, 0, s * (WM + 0.22), tmp); P.atM(i + 5, 0, s * (WM + 0.22), tmp2);
        wires.push(tmp.x, tmp.y + y, tmp.z, tmp2.x, tmp2.y + y, tmp2.z);
      }
      const wg = this.own(new T.BufferGeometry()); wg.setAttribute('position', new T.Float32BufferAttribute(wires, 3));
      this.scene.add(new T.LineSegments(wg, this.fenceMat));
      // grid boxes behind the line: a white bar in front of each slot and two short side marks
      const gp = [];
      const quad = (zu, xo, dz, dx) => {   // centre (road units / half-widths), size in metres along / across
        const pts = [];
        for (const [a, b] of [[-1, -1], [-1, 1], [1, 1], [1, -1]]) { this.path.at(zu + a * dz / 2 / KZ, xo + b * dx / 2 / KX, tmp); pts.push([tmp.x, tmp.y + 0.012, tmp.z]); }
        for (const t of [0, 1, 2, 0, 2, 3]) gp.push(...pts[t]);
      };
      if (!this.race.drift) for (const [row, col] of GRID) {
        const zu = this.race.startZ + (3 - row) * 650 + RIDER_L * 1.4, xo = [-0.5, 0, 0.5][col] * this.race.E;
        quad(zu, xo, 0.14, 1.9);
        for (const s of [-1, 1]) quad(zu - 0.5 / KZ, xo + s * 0.95 / KX, 1.0, 0.12);
      }
      const gm = this.mat(new T.MeshLambertMaterial({ color: '#f0f0ec', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      add(gp, null, null, null, gm);
    }

    // ---------------- terrain tiles (streamed) ----------------
    corridorTiles() {
      const P = this.path, set = new Map(), R0 = 330;
      for (let i = 0; i <= P.N; i += 6) {
        const x = P.x[i], z = P.z[i];
        for (let tx = Math.floor((x - R0) / TS); tx <= Math.floor((x + R0) / TS); tx++)
          for (let tz = Math.floor((z - R0) / TS); tz <= Math.floor((z + R0) / TS); tz++) {
            const k = tx * 100000 + tz;
            if (!set.has(k)) set.set(k, { tx, tz, cx: (tx + 0.5) * TS, cz: (tz + 0.5) * TS });
          }
      }
      return set;
    }
    heightAt(q, x, z) { return U.lerp(this.terr.h(q.o, q.ry, x, z, this), this.base, smooth(250, 330, q.a)); }
    buildTile(t, lod) {
      const P = this.path, x0 = t.tx * TS, z0 = t.tz * TS, { rs: RS, nv: NV } = LODS[lod], E = NV + 2;
      const cands = P.cands(x0 - 360, z0 - 360, x0 + TS + 360, z0 + TS + 360);
      const hs = new Float32Array(E * E), os = new Float32Array(E * E), is = new Int32Array(E * E);
      for (let gz = 0; gz < E; gz++) for (let gx = 0; gx < E; gx++) {
        const x = x0 + (gx - 1) * RS, z = z0 + (gz - 1) * RS;
        P.nearest(x, z, cands, _q);
        hs[gz * E + gx] = this.heightAt(_q, x, z); os[gz * E + gx] = _q.o; is[gz * E + gx] = _q.i;
      }
      // grid vertices followed by a skirt (copy of the border pushed 4 m down) that hides LOD cracks
      const n = NV * NV, tot = n + 4 * NV, pos = new Float32Array(tot * 3), nor = new Float32Array(tot * 3), col = new Float32Array(tot * 3), uv = new Float32Array(tot * 2);
      for (let gz = 0; gz < NV; gz++) for (let gx = 0; gx < NV; gx++) {
        const k = gz * NV + gx, e = (gz + 1) * E + gx + 1, x = x0 + gx * RS, z = z0 + gz * RS, h = hs[e];
        let nx = (hs[e - 1] - hs[e + 1]) / (2 * RS), nz = (hs[e - E] - hs[e + E]) / (2 * RS), ny = 1;
        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
        nor[k * 3] = nx; nor[k * 3 + 1] = ny; nor[k * 3 + 2] = nz;
        const c = this.terr.c(h, 1 - ny, os[e], x, z, is[e], this);
        col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
        uv[k * 2] = x / 7; uv[k * 2 + 1] = z / 7;
      }
      const edges = LODS[lod].edges;
      for (let e = 0; e < 4; e++) for (let k = 0; k < NV; k++) {
        const s = edges[e][k], d = n + e * NV + k;
        pos.copyWithin(d * 3, s * 3, s * 3 + 3); pos[d * 3 + 1] -= 4;
        nor.copyWithin(d * 3, s * 3, s * 3 + 3); col.copyWithin(d * 3, s * 3, s * 3 + 3); uv.copyWithin(d * 2, s * 2, s * 2 + 2);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3));
      g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2));
      g.setIndex(LODS[lod].index); g.computeBoundingSphere();
      const m = new T.Mesh(g, G3.mats.terrain); m.receiveShadow = true;
      this.scene.add(m);
      return { mesh: m, lod };
    }

    // ---------------- scenery chunks (streamed) ----------------
    buildChunk(c) {
      const P = this.path, segs = this.race.segs, s0 = c * CH, s1 = Math.min(P.N, s0 + CH);
      const bag = new Bag(), far = new Bag(), rnd = U.rng(c * 7919 + segs.length), tmp = {};
      const ex = { wires: [], pools: new Mesher(2), glows: [], fglows: [], towers: new Mesher(3) };
      for (let n = s0; n < s1; n++) for (const sp of segs[n].sprites) this.placeProp(sp, n, bag, rnd, ex, tmp);
      this.decor(s0, s1, far, rnd, ex);
      const grp = new T.Group(), night = this.night;
      // roadside props cast shadows onto the road; the far decoration does not (saves most of the shadow pass)
      for (const [b, cast] of [[bag, true], [far, false]]) {
        const geos = b.geos();
        for (const k in geos) {
          const m = new T.Mesh(geos[k], night ? G3.mats.lamNight : G3.mats.lam);
          m.castShadow = cast; m.receiveShadow = true; grp.add(m);
        }
      }
      const tg = ex.towers.geos();
      if (tg.tower) { const m = new T.Mesh(tg.tower, night ? G3.mats.towerNight : G3.mats.tower); m.receiveShadow = true; grp.add(m); }
      if (ex.wires.length) {
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(ex.wires, 3));
        grp.add(new T.LineSegments(g, WIRE_MAT));
      }
      const pg = ex.pools.geos();
      if (pg.pool) { const m = new T.Mesh(pg.pool, POOL_MAT); m.renderOrder = 2; grp.add(m); }
      if (pg.poolW) { const m = new T.Mesh(pg.poolW, POOLW_MAT); m.renderOrder = 2; grp.add(m); }
      for (const [list, mat] of [[ex.glows, LAMP_GLOW], [ex.fglows, FLOOD_GLOW]]) if (list.length) {
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(list, 3));
        const pts = new T.Points(g, mat); pts.renderOrder = 3; grp.add(pts);
      }
      this.scene.add(grp);
      return grp;
    }
    groundY(o, n, x, z) {   // ground height for something standing o metres from the centre of segment n
      const ry = this.path.y[n];
      if (Math.abs(o) < 8.5) return ry + (this.theme.id === 'city' && Math.abs(o) > 5.2 ? 0.15 : -0.04);
      return this.terr.h(o, ry, x, z, this);
    }
    placeProp(sp, n, bag, rnd, ex, tmp) {
      const name = sp.name;
      if (name === 'cliff') return;
      const P = this.path, cxh = sp.anchor === 'c' ? sp.offset : sp.offset + Math.sign(sp.offset) * sp.w / 2, o = cxh * KX;
      const p = P.atM(n, 0.5, o, tmp), side = Math.sign(o) || 1;
      const y = name === 'gate' || name === 'gantry' || name === 'bridge' ? p.y : this.groundY(o, n, p.x, p.z);
      const face = Models.FACING[name];
      let yaw = rnd() * Math.PI * 2, s = 0.85 + rnd() * 0.35, tint = null;
      if (face === 'road') { yaw = p.h + (side > 0 ? Math.PI / 2 : -Math.PI / 2); s = 1; }
      else if (face === 'along') { yaw = p.h + Math.PI / 2; s = 1; }
      else if (face === 'traffic') { yaw = p.h + Math.PI + (name === 'billboard' ? -side * 0.32 : 0); s = 1; }
      else { const k = 0.88 + rnd() * 0.24; tint = [k, k * (0.96 + rnd() * 0.08), k]; }
      if (sp.k) s = sp.k;   // a prop sized for its stage (the drift arches over the wide roads)
      const v = name === 'kmpost' || name === 'lamp' || name === 'pole' || name === 'fence' || name === 'post' ? 0 : sp.v;
      const m = M4(p.x, y - (face ? 0 : 0.15), p.z, 0, yaw, 0, s);
      bag.put(Models.proto(name, v), m, tint);
      if (name === 'pole') this.wire(n, side, m, ex);
      if (name === 'lamp' && this.night) {
        const hp = new T.Vector3(0, 7.85, 2.45).applyMatrix4(m), gy = P.y[n] + 0.16;
        ex.glows.push(hp.x, hp.y - 0.15, hp.z);
        ex.pools.add(G3_POOL_GEO, M4(hp.x, gy + 0.02, hp.z, -Math.PI / 2, 0, 0, 13, 13, 1), [1, 1, 1], 'pool', { raw: true });
      }
      if (name === 'flood') {   // floodlight: glowing lamp head and a broad pool of white light over the track
        for (let i = 0; i < 4; i++) { const hp = new T.Vector3(-2.25 + i * 1.5, 24.2, 0.9).applyMatrix4(m); ex.fglows.push(hp.x, hp.y, hp.z); }
        const c = P.atM(n, 0.5, side * 3, {});
        ex.pools.add(G3_POOL_GEO, M4(c.x, c.y + 0.03, c.z, -Math.PI / 2, 0, 0, 40, 40, 1), [1, 1, 1], 'poolW', { raw: true });
      }
    }
    wire(n, side, m, ex) {   // power lines from this pole to the next one on the same side
      const segs = this.race.segs, P = this.path, tmp = {};
      for (let k = n + 1; k < Math.min(segs.length, n + 40); k++) {
        const sp = segs[k].sprites.find(s => s.name === 'pole' && Math.sign(s.offset) === side);
        if (!sp) continue;
        const o = (sp.offset + side * sp.w / 2) * KX, p = P.atM(k, 0.5, o, tmp);
        const m2 = M4(p.x, this.groundY(o, k, p.x, p.z), p.z, 0, p.h + Math.PI / 2, 0);
        for (const lz of [-0.8, 0, 0.8]) {
          const a = new T.Vector3(0, 8.12, lz).applyMatrix4(m), b = new T.Vector3(0, 8.12, lz).applyMatrix4(m2);
          let prev = a;
          for (let i = 1; i <= 8; i++) {
            const t = i / 8, q = a.clone().lerp(b, t); q.y -= Math.sin(t * Math.PI) * 0.6;
            ex.wires.push(prev.x, prev.y, prev.z, q.x, q.y, q.z); prev = q;
          }
        }
        return;
      }
    }
    decor(s0, s1, bag, rnd, ex) {
      const th = DECOR_AS[this.theme.id] || this.theme.id, P = this.path, tmp = {};
      const put = (name, v, dmin, dmax, sd, o = {}) => {
        const n = s0 + Math.floor(rnd() * (s1 - s0)), side = sd || (rnd() < 0.5 ? -1 : 1);
        const d = dmin + Math.pow(rnd(), o.pow || 1.4) * (dmax - dmin);
        const p = P.atM(n, rnd(), side * d, tmp);
        const cands = P.cands(p.x - d - 30, p.z - d - 30, p.x + d + 30, p.z + d + 30);
        P.nearest(p.x, p.z, cands, _q);
        if (_q.a < Math.max(o.clear || 12, this.race.drift ? this.wallM + 2.5 : 0)) return;
        let y = o.water ? 0 : this.heightAt(_q, p.x, p.z);
        if (o.minH !== undefined && y < o.minH) return;
        if (o.maxH !== undefined && y > o.maxH) return;
        const k = 0.85 + rnd() * 0.3, yaw = o.face ? p.h + (side > 0 ? Math.PI / 2 : -Math.PI / 2) : rnd() * Math.PI * 2;
        if (o.water) { const qy = this.heightAt(_q, p.x, p.z); if (qy > -1.2) return; }
        bag.put(Models.proto(name, v), M4(p.x, y - (o.sink || 0.2), p.z, 0, yaw, 0, o.face ? 1 : (o.scale || 1) * (0.8 + rnd() * 0.45)), o.face ? null : [k, k * (0.95 + rnd() * 0.1), k]);
      };
      if (th === 'forest') {
        for (let i = 0; i < 120; i++) put('pine', i % 3, 13, 250, 0, { pow: 1.7 });
        for (let i = 0; i < 22; i++) put('tree', i % 3, 13, 200);
        for (let i = 0; i < 10; i++) put('bush', 1 + (i % 2), 10, 40, 0, { clear: 9 });
      } else if (th === 'coast') {
        for (let i = 0; i < 20; i++) put('palm', i % 4, 13, 140, -1, { pow: 1.8 });
        for (let i = 0; i < 8; i++) put('palm', i % 4, 13, 70, 1, { minH: 1.8 });
        for (let i = 0; i < 10; i++) put('shrub', i % 3, 12, 160, -1);
        if (rnd() < 0.7) put('hut', rnd() * 3 | 0, 22, 90, -1, { face: true, sink: 0.1 });
        for (let i = 0; i < 4; i++) put('basket', i % 3, 50, 110, 1, { minH: 0.25, maxH: 1.6, sink: 0.25, scale: 1 });
        for (let i = 0; i < 2; i++) put('boat', i % 3, 95, 330, 1, { water: true, sink: 0.25, scale: 1.3 });
      } else if (th === 'pass') {
        for (let i = 0; i < 26; i++) put(i % 3 ? 'tree' : 'shrub', i % 3, 12, 150, 1, { minH: 2 });
        for (let i = 0; i < 16; i++) put(i % 2 ? 'pine' : 'tree', i % 3, 28, 180, -1);
        for (let i = 0; i < 4; i++) put('rock', i % 2, 14, 80, 1, { minH: 1 });
      } else if (th === 'gpIsland') {
        for (let i = 0; i < 16; i++) put('palm', i % 4, 44, 170, 0, { pow: 1.5, clear: 42, minH: 1.9 });
        for (let i = 0; i < 6; i++) put('shrub', i % 3, 44, 140, 0, { clear: 42, minH: 1.9 });
        for (let i = 0; i < 2; i++) put('boat', i % 3, 200, 420, 0, { water: true, sink: 0.25, scale: 1.3, clear: 150 });
      } else if (th === 'gpHills') {
        for (let i = 0; i < 70; i++) put(i % 4 ? 'pine' : 'tree', i % 3, 46, 260, 0, { pow: 1.4, clear: 44 });
        for (let i = 0; i < 4; i++) put('rock', i % 2, 46, 120, 0, { clear: 44 });
      } else if (th === 'gpNight') {
        for (let i = 0; i < 8; i++) put('tree', i % 3, 46, 140, 0, { clear: 44 });
      } else if (th === 'city') {
        for (let i = 0; i < 9; i++) {   // second-row towers behind the shop houses
          const n = s0 + Math.floor(rnd() * (s1 - s0)), side = rnd() < 0.5 ? -1 : 1, d = 30 + rnd() * 90, p = P.atM(n, 0.5, side * d, tmp);
          const cands = P.cands(p.x - d - 40, p.z - d - 40, p.x + d + 40, p.z + d + 40);
          P.nearest(p.x, p.z, cands, _q); if (_q.a < 26) continue;
          const w = 14 + rnd() * 14, dd = 14 + rnd() * 12, hgt = 24 + Math.pow(rnd(), 1.5) * 80;
          const shade = 0.75 + rnd() * 0.3, tint = [shade, shade * (0.95 + rnd() * 0.1), shade * (1 + rnd() * 0.1)];
          ex.towers.add(Models.GEO.box, M4(p.x, P.y[n] + hgt / 2 - 0.5, p.z, 0, p.h + rnd() * 0.3, 0, w, hgt, dd), tint, 'tower', {
            uvFn: (u, v, nx, ny, nz) => Math.abs(ny) > 0.5 ? [0.02, 0.02] : [u * (Math.abs(nx) > 0.5 ? dd : w) / 4, v * hgt / 4] });
        }
      }
    }

    // ---------------- streaming ----------------
    // build/drop scenery chunks and terrain tiles around the player; non-initial calls spend at most ~4 ms
    stream(initial) {
      const P = this.path, z = this.race.player.z, cs = Math.floor(z / CFG.segL), t0 = performance.now();
      const busy = () => !initial && performance.now() - t0 > 4;
      // chunks: ~185 m behind to ~1 km ahead (initially only ~550 m ahead; the rest streams in); a circuit wraps round
      const NCl = Math.ceil(P.N / CH), last = Math.floor(P.N / CH), id = k => P.loop ? ((k % NCl) + NCl) % NCl : U.clamp(k, 0, last);
      const k0 = Math.floor((cs - 200) / CH), k1 = Math.floor((cs + (initial ? 600 : 1150)) / CH), kc = Math.floor(cs / CH), keep = new Set();
      for (let k = k0 - 1; k <= k1 + 2; k++) keep.add(id(k));
      for (const [c, g] of this.chunks) if (!keep.has(c)) { this.dropGroup(g); this.chunks.delete(c); }
      let built = 0;
      for (let k = kc; k <= k1; k++) { const c = id(k); if (!this.chunks.has(c)) { if (built && busy()) return; this.chunks.set(c, this.buildChunk(c)); built++; } }
      for (let k = k0; k < kc; k++) { const c = id(k); if (!this.chunks.has(c)) { if (built && busy()) return; this.chunks.set(c, this.buildChunk(c)); built++; } }
      // terrain tiles near the camera, nearest first; detailed grid within ~420 m
      const cx = this.cam.position.x, cz = this.cam.position.z;
      for (const [k, tl] of this.tiles) {
        const t = this.corridor.get(k);
        if (Math.hypot(t.cx - cx, t.cz - cz) > 1500) { this.scene.remove(tl.mesh); tl.mesh.geometry.dispose(); this.tiles.delete(k); }
      }
      if (built && !initial) return;
      const want = [];
      for (const [k, t] of this.corridor) {
        const d = Math.hypot(t.cx - cx, t.cz - cz), lod = d < 360 ? 0 : 1, have = this.tiles.get(k);
        if (have && have.lod <= lod) continue;
        if (d < (initial ? 470 : 1250)) want.push([d, k, t, lod]);
      }
      want.sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < want.length; i++) {
        if (i && busy()) break;
        const [, k, t, lod] = want[i], old = this.tiles.get(k);
        if (old) { this.scene.remove(old.mesh); old.mesh.geometry.dispose(); }
        this.tiles.set(k, this.buildTile(t, lod));
      }
    }
    dropGroup(g) {
      this.scene.remove(g);
      g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }

    // ---------------- per-frame ----------------
    updateCam(race, dt) {
      const P = race.player, sp = U.clamp(P.speed / P.top, 0, 1), cam = this.cam;
      if (!this.cs || dt === 0) this.cs = { x: P.x, back: 4.6, y: null, wk: 0, side: 1 };
      const s = this.cs;
      s.x += (P.x - s.x) * Math.min(1, dt * 5);
      s.back += ((4.3 + sp * 1.3) - s.back) * Math.min(1, dt * 2);
      // during a wheelie the camera swings low and to one side so the raised front wheel is visible
      if (s.wk < 0.02) s.side = P.x > 0.2 ? -1 : 1;
      s.wk += (U.clamp(P.pitch / 0.4, 0, 1) - s.wk) * Math.min(1, dt * 3);
      this.camZu = P.z - (s.back - s.wk * 1.3) / KZ; this.camXu = s.x * 0.92 + s.wk * 0.42 * s.side;
      const cp = this.path.at(this.camZu, this.camXu, _t1), tp = this.path.at(P.z + 10 / KZ, P.x * 0.65 + s.x * 0.35, _t2);
      const cy = cp.y + 1.8 + sp * 0.12 - s.wk * 0.3;
      s.y = s.y === null || dt === 0 ? cy : s.y + (cy - s.y) * Math.min(1, dt * 8);
      cam.position.set(cp.x, Math.max(s.y, cp.y + 1.2), cp.z);
      if (race.shake > 0) cam.position.add(_v.set((Math.random() - 0.5), (Math.random() - 0.5), 0).multiplyScalar(race.shake * 0.35));
      cam.lookAt(tp.x, tp.y + 0.95, tp.z);
      // the camera rolls a little with the bike in a corner
      const po = this.riders.get(P.pal.id), roll = P.crash ? 0 : U.clamp(P.lean || 0, -1.15, 1.15) * (po ? po.leanMax : 1);
      s.roll = dt === 0 ? roll * 0.1 : (s.roll || 0) + (roll * 0.1 - (s.roll || 0)) * Math.min(1, dt * 4);
      cam.rotateZ(-s.roll);
      const fov = 60 + sp * 9;
      if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = fov; cam.updateProjectionMatrix(); }
    }
    riderStyle(r, race) { return r.style !== undefined ? r.style : r.isPolice ? 2 : (parseInt(r.pal.id.slice(2), 10) || 0) % BIKE_STYLES; }
    syncRiders(race, dt) {
      const camZ = race.player.z;
      for (const o of this.riders.values()) o.used = false;
      for (const r of race.riders()) {
        let o = this.riders.get(r.pal.id);
        if (!o) {
          o = Models.rider(r.pal, this.riderStyle(r, race)); o.yaw = 0; o.px = r.x;
          this.scene.add(o.root); this.scene.add(o.body); this.riders.set(r.pal.id, o);
        }
        o.used = true;
        const far = Math.abs(r.z - camZ) * KZ > 1300;
        const atCam = r !== race.player && Math.abs(r.z - this.camZu) < 330 && Math.abs(r.x - this.camXu) < 0.16;
        o.root.visible = !far && !atCam && !r.gone;
        if (far || r.gone) { o.body.visible = false; o.px = r.x; continue; }
        this.placeRider(o, r, race, dt);
      }
      for (const o of this.riders.values()) if (!o.used) { o.root.visible = false; o.body.visible = false; }
    }
    placeRider(o, r, race, dt) {
      const p = this.path.at(r.z, r.x, _t1);
      o.root.position.set(p.x, p.y, p.z);
      const vx = dt > 0 ? (r.x - o.px) / dt : 0; o.px = r.x;
      if (r.crash) { this.placeCrash(o, r, race, p, dt); return; }
      o.crashed = false; o.rider.visible = true; o.body.visible = false; o.lean.position.y = 0;
      const yawT = U.clamp(-Math.atan2(vx * KX, Math.max(4, r.speed * KZ)), -0.4, 0.4);
      o.yaw += (yawT - o.yaw) * Math.min(1, dt * 8);
      o.root.rotation.set(-Math.atan(p.slope), p.h + o.yaw, 0);
      const a = r.atk;
      // the lean: 1 = the bike's full lean (MotoGP-deep on the sport bikes); it rolls onto the shoulder of its tyres,
      // which lifts it a touch, and the rider hangs off the inside with the knee down
      const roll = U.clamp(r.lean || 0, -1.15, 1.15) * o.leanMax + Models.kickRoll(a, r.weapon);
      o.lean.rotation.z = roll; o.lean.position.y = 0.09 * (1 - Math.cos(roll));
      o.pitch.rotation.x = -r.pitch;   // wheelie: front wheel up, pivoting on the rear axle
      o.pose(a ? a.side : 0, a ? a.t : 0, r.weapon, r.lean || 0, roll);
      o.setDetail(Math.abs(r.z - this.camZu) * KZ < 45);   // full-detail bike only close to the camera
      if (o.sirens) {
        const f = Math.floor(this.time * 8) % 2;
        o.sirens.red.color.setHex(f ? 0xff2020 : 0x400606); o.sirens.blue.color.setHex(f ? 0x080c40 : 0x2a5aff);
      }
    }
    // a crash: the bike slides and spins on its side; the rider tumbles, gets up, runs back to it and stands it up
    placeCrash(o, r, race, p, dt) {
      const c = r.crash, ph = c.ph || 0, lift = c.lift || 0, ls = lift * lift * (3 - 2 * lift);
      if (!o.crashed) { o.crashed = true; o.spin = 0; }
      o.crashSide = c.side || 1;   // the bike lies with its seat towards the side he will stand on
      if (ph === 0) o.spin += dt * r.speed * KZ * 0.06 * o.crashSide;
      else if (ph === 3) { const tgt = Math.round(o.spin / (Math.PI * 2)) * Math.PI * 2; o.spin += (tgt - o.spin) * Math.min(1, dt * 5); }   // straighten it up
      o.root.rotation.set(-Math.atan(p.slope), p.h + o.spin, 0);
      o.lean.rotation.z = o.crashSide * 1.3 * (1 - ls); o.lean.position.y = 0.1 * (1 - ls); o.pitch.rotation.x = 0;
      o.rider.visible = false;
      const b = race.bodies.find(b => b.owner === r), body = o.body, F = o.foot;
      if (!b) { body.visible = false; return; }
      const bp = this.path.at(b.z, b.x, _t3), mode = b.mode || 0;
      body.visible = true;
      if (mode === 0) {   // thrown: tumbling through the air, then lying face down
        F.pose(0, 0, 0);
        if (b.vz > 50 || b.h > 0) { body.position.set(bp.x, bp.y + b.h * CFG.KH + 0.55, bp.z); body.rotation.set(b.rot, bp.h + 0.4, b.rot * 0.35); }
        else { body.position.set(bp.x, bp.y + 0.17, bp.z); body.rotation.set(Math.PI / 2, bp.h + 0.5, 0); }
      } else if (mode === 1) {   // pushes up onto his knees, then stands, turning towards the bike
        const u = U.clamp(b.mt / CRASH.up, 0, 1), s1 = smooth(0, 0.45, u), s2 = smooth(0.45, 1, u);
        const toBike = -Math.atan2((r.x - b.x) * 5, (r.z - b.z) / 216);
        F.pose(1, 0, s2);
        body.position.set(bp.x, bp.y + 0.17 + 0.33 * s1 + 0.43 * s2, bp.z);
        body.rotation.set(Math.PI / 2 * (1 - s1), bp.h + 0.5 + (toBike - 0.5) * s1, 0);
      } else {   // running back, then bent over the bike lifting it
        F.pose(mode, b.mt, lift);
        body.position.set(bp.x, bp.y + (mode === 2 ? 0.93 + F.bob : 0.86 + 0.05 * lift), bp.z);
        body.rotation.set(0, bp.h - b.face, 0);
      }
    }
    syncCars(race) {
      const camZ = race.player.z;
      for (const c of race.cars) {
        const key = c.type + '|' + c.col;
        let o = this.cars.get(c);
        if (o && o.key !== key) { o.g.visible = false; (this.carPool[o.key] || (this.carPool[o.key] = [])).push(o); o = null; }
        if (!o) {
          const pool = this.carPool[key];
          o = pool && pool.length ? pool.pop() : { key, type: c.type, g: Models.car(c.type, c.col) };
          if (!o.g.parent) { o.g.rotation.order = 'YXZ'; this.scene.add(o.g); }
          this.cars.set(c, o);
        }
        const far = Math.abs(c.z - camZ) * KZ > 1200;
        // hide a vehicle that the chase camera is inside of (e.g. an oncoming truck after a crash)
        const hit = Math.abs(c.z - this.camZu) < c.len / 2 + 300 && Math.abs(c.x - this.camXu) < c.w / 2 + 0.12;
        o.g.visible = !far && !hit;
        if (far) continue;
        const p = this.path.at(c.z, c.x, _t1);
        o.g.position.set(p.x, p.y, p.z);
        o.g.rotation.set(-Math.atan(p.slope), p.h, 0);
        o.g.userData.setDetail(Math.abs(c.z - this.camZu) * KZ < 45);   // full-detail body only near the camera
      }
    }
    // ---------------- drift mode: the car, its camera, tyre smoke, skid marks, exhaust flames ----------------
    initDrift(race) {
      this.dy = this.path.y[0] - race.ctr.Y[0];   // the world lifts some stages (roadMin): the race's heights + dy
      this.smoke = new Smoke(this.scene, this.night ? '#9aa0b4' : '#e4e4e2');
      this.skids = new Skids(this.scene);
      // a model for every car on the stage (the player's first), each with its exhaust flames and smoke emitters
      this.dcs = race.racers.map(c => {
        const o = Models.driftCar(c.spec.model, c.paint);
        this.scene.add(o.root);
        o.setNight(this.night);
        o.flames = []; o.emitAcc = [0, 0, 0, 0];
        for (let i = 0; i < 4; i++) {
          const sp = new T.Sprite(this.mat(new T.SpriteMaterial({ map: G3.tx.glow, color: '#ff9040', transparent: true, depthWrite: false, blending: T.AdditiveBlending })));
          sp.visible = false; sp.renderOrder = 6; this.scene.add(sp); o.flames.push(sp);
        }
        return o;
      });
      this.dc = this.dcs[0];
    }
    syncDrift(race, dt) {
      race.racers.forEach((c, k) => this.syncDriftCar(race, c, this.dcs[k], k, dt));
      this.skids.flush();
    }
    syncDriftCar(race, c, o, k, dt) {
      const S = o.spec, R = o.root, me = c === race.car, cp = this.cam.position, dist = Math.hypot(c.px - cp.x, c.pz - cp.z);
      // a computer car is drawn while it is on the stage and not far away; its tyres mark the road and smoke nearer still
      R.visible = me ? race.camMode !== 2 : !c.gone && dist < 700 && dist > 4.5;   // (not right in front of the lens)
      if (!me && (!R.visible || dist > 260)) {
        for (const f of o.flames) f.visible = false;
        for (let i = 0; i < 4; i++) this.skids.cut(k * 4 + i);
        if (!R.visible) return;
      }
      if (o.setDetail) o.setDetail(me || dist < 35);   // the full model up close, the coarse one further away
      R.position.set(c.px, c.y + this.dy, c.pz);
      R.rotation.set(-Math.atan(c.slope * Math.cos(c.psi - c.h)), c.psi, 0);
      const kk = Math.min(1, dt * 10);
      o.tilt.rotation.z += (U.clamp(c.ay * 0.0055, -0.075, 0.075) - o.tilt.rotation.z) * kk;   // body roll
      o.tilt.rotation.x += (U.clamp(-c.ax * 0.005, -0.05, 0.05) - o.tilt.rotation.x) * kk;     // squat / dive
      const rearV = c.hand ? 0 : c.u + (c.gas ? Math.max(c.wheelSpin, c.rearSlide) * 16 * (c.gear < 0 ? -1 : 1) : 0);
      for (const w of o.wheels) {
        if (w.front) w.pivot.rotation.y = c.steer;
        w.spin.rotation.x += (w.front ? c.u : rearV) / S.wheel.R * dt;
      }
      o.setBrake(c.brk > 0);
      o.paint.envMap = this.env;
      if (!me && dist > 260) return;
      // tyres: smoke from the rear, rubber on the road from any tyre that slides
      const sn = Math.sin(c.psi), cs = Math.cos(c.psi), spd = Math.hypot(c.vx, c.vz), q = this._dq || (this._dq = {});
      const marks = [c.frontSlide > 0.5 || (c.brk > 0 && spd > 8 && c.frontSlide > 0.3), c.rearSlide > 0.35 || c.wheelSpin > 0.4 || (c.hand && spd > 3)];
      for (let i = 0; i < 4; i++) {
        const front = i < 2, side = i % 2 ? -1 : 1, zb = front ? S.axles[0] : S.axles[1], xb = side * S.wheel.x;
        const x = c.px + zb * sn + xb * cs, z = c.pz + zb * cs - xb * sn;
        race.project(x, z, c.seg, q);
        const on = marks[front ? 0 : 1] && (spd > 1.5 || c.wheelSpin > 0.4);
        if (on) this.skids.add(k * 4 + i, x, q.y + this.dy + 0.012, z, cs, -sn, S.wheel.w * 0.55, Math.min(0.75, 0.28 + (front ? c.frontSlide : Math.max(c.rearSlide, c.wheelSpin)) * 0.45));
        else this.skids.cut(k * 4 + i);
        const sm = front ? Math.max(0, c.frontSlide - 0.6) * 0.5 : c.smoke;
        if (sm > 0.12 && dt > 0) {
          o.emitAcc[i] += sm * (front ? 25 : 60) * dt * (me ? 1 : 0.5);   // the others' smoke lighter: it must not blind the player
          while (o.emitAcc[i] >= 1) {
            o.emitAcc[i]--;
            const j = () => (Math.random() - 0.5);
            this.smoke.emit(x + j() * 0.3, q.y + this.dy + 0.25, z + j() * 0.3, c.vx * 0.25 + j() * 1.6 + cs * side * 0.8, 0.5 + Math.random() * 0.6, c.vz * 0.25 + j() * 1.6 - sn * side * 0.8,
              0.9, 3.2 + Math.random() * 1.6 + sm * 1.5, 1.4 + Math.random() * 1.2, (0.21 + 0.2 * sm) * (me ? 1 : 0.7));
          }
        }
      }
      // exhaust: pops on lifting off, blue nitro flame
      o.root.updateMatrixWorld();
      for (let i = 0; i < o.flames.length; i++) {
        const f = o.flames[i], e = S.exh[i];
        f.visible = !!e && R.visible && (c.nitroOn || c.backfire > 0);
        if (!f.visible) continue;
        f.position.set(e[0], e[1], (e[3] !== undefined ? e[3] : S.len[0]) - 0.2 - (c.nitroOn ? 0.15 : 0)); o.body.localToWorld(f.position);   // e[3]: tip z of a model's own pipes
        const sc = (c.nitroOn ? 0.75 : 0.5) * (0.7 + Math.random() * 0.6);
        f.scale.set(sc, sc, 1); f.material.color.set(c.nitroOn ? '#5aa8ff' : '#ff8a3a');
      }
    }
    // chase camera: looks along a mix of the nose and the direction of travel, so a drift is seen from the side;
    // camMode 1 = further back and higher, 2 = on the bonnet
    updateDriftCam(race, dt) {
      const c = race.car, cam = this.cam, spd = Math.hypot(c.vx, c.vz), q = this._cq || (this._cq = {});
      const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
      if (!this.cs || dt === 0 || this.cs.mode !== race.camMode) this.cs = { yaw: c.psi, y: null, mode: race.camMode };
      const s = this.cs;
      let tgt = c.psi;
      if (spd > 2.5) tgt = c.psi + wrap(Math.atan2(c.vx, c.vz) - c.psi) * 0.6;
      s.yaw += wrap(tgt - s.yaw) * (dt === 0 ? 1 : Math.min(1, dt * 3.4));
      const dy = this.dy || 0, cyc = c.y + dy;
      if (race.camMode === 2) {
        const fx = Math.sin(c.psi), fz = Math.cos(c.psi);
        cam.position.set(c.px + fx * 0.5, cyc + 1.12, c.pz + fz * 0.5);
        cam.lookAt(c.px + fx * 12, cyc + 0.95, c.pz + fz * 12);
      } else {
        const [dist, hgt, look] = race.camMode === 1 ? [9.2, 3.5, 1.0] : [6.0, 2.05, 0.95];
        const x = c.px - Math.sin(s.yaw) * dist, z = c.pz - Math.cos(s.yaw) * dist;
        race.project(x, z, c.seg, q);
        const qy = q.y + dy, cy = Math.max(cyc, qy) + hgt;
        s.y = s.y === null || dt === 0 ? cy : s.y + (cy - s.y) * Math.min(1, dt * 6);
        cam.position.set(x, Math.max(s.y, qy + 1.0), z);
        cam.lookAt(c.px + Math.sin(s.yaw) * 3, cyc + look, c.pz + Math.cos(s.yaw) * 3);
      }
      if (race.shake > 0) cam.position.add(_v.set((Math.random() - 0.5), (Math.random() - 0.5), 0).multiplyScalar(race.shake * 0.3));
      const fov = 60 + Math.min(20, spd * 0.27) + (c.nitroOn ? 8 : 0);   // wider at speed: it feels faster
      s.fov = s.fov === undefined || dt === 0 ? fov : s.fov + (fov - s.fov) * Math.min(1, dt * 3);
      if (Math.abs(cam.fov - s.fov) > 0.05) { cam.fov = s.fov; cam.updateProjectionMatrix(); }
      this.camZu = race.player.z; this.camXu = race.player.x;
    }
    updateDrift(race, dt) {
      this.syncDrift(race, dt);
      this.updateDriftCam(race, dt);
      this.stream(false);
      const c = race.car, cp = this.cam.position;
      this.skyG.position.set(cp.x, cp.y, cp.z); this.ringG.position.set(cp.x, 0, cp.z);
      const fx = Math.sin(c.psi), fz = Math.cos(c.psi);
      const cy = c.y + this.dy;
      this.sun.target.position.set(c.px + fx * 10, cy, c.pz + fz * 10);
      this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDir, 200);
      if (this.night) {
        this.head.position.set(c.px + fx * 2.0, cy + 0.75, c.pz + fz * 2.0);
        this.head.target.position.set(c.px + fx * 30, cy, c.pz + fz * 30);
        this.updateGlows(race);
      }
      this.siren.intensity = 0;
      R.getSize(size);
      this.smoke.update(dt, size.y / (2 * Math.tan(this.cam.fov * Math.PI / 360)), size.y * 0.4);
      if (this.L.sea) { const w = G3.tx.water.offset; w.x = this.time * 0.02; w.y = this.time * 0.013; }
    }
    buildGlows() {   // dynamic head / tail light flares for vehicles at night
      const n = 160, g = this.own(new T.BufferGeometry());
      g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3).setUsage(T.DynamicDrawUsage));
      g.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3), 3).setUsage(T.DynamicDrawUsage));
      this.glow = new T.Points(g, this.mat(new T.PointsMaterial({ size: 1.4, map: G3.tx.glow, vertexColors: true, transparent: true,
        depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true })));
      this.glow.frustumCulled = false; this.glow.renderOrder = 4; this.scene.add(this.glow);
    }
    updateGlows(race) {
      const g = this.glow.geometry, P = g.attributes.position.array, Cc = g.attributes.color.array, camZ = race.player.z;
      let n = 0;
      const add = (obj, x, y, z, r, gg, b) => {
        if (n >= 160) return;
        _v.set(x, y, z).applyMatrix4(obj.matrixWorld); P[n * 3] = _v.x; P[n * 3 + 1] = _v.y; P[n * 3 + 2] = _v.z;
        Cc[n * 3] = r; Cc[n * 3 + 1] = gg; Cc[n * 3 + 2] = b; n++;
      };
      for (const [c, o] of this.cars) {
        if (!o.g.visible || Math.abs(c.z - camZ) * KZ > 700) continue;
        o.g.updateMatrixWorld();
        const L = Models.CAR_LIGHTS[o.type];   // [z, y, x] of the tail lamps (all traffic drives away from us)
        for (const s of [-1, 1]) add(o.g, s * L[2], L[1], L[0] - 0.08, 0.9, 0.08, 0.05);
      }
      for (const o of this.riders.values()) {
        if (!o.root.visible || o.crashed) continue;
        o.root.updateMatrixWorld();
        const [tl, hl] = o.lights;
        add(o.lean, 0, tl[0], tl[1] - 0.03, 0.9, 0.06, 0.04); add(o.lean, 0, hl[0], hl[1] + 0.03, 0.8, 0.75, 0.55);
      }
      if (this.dcs) race.racers.forEach((c, k) => {   // drift cars: lamps flare only towards the side they shine on
        const o = this.dcs[k], S = o.spec, b = c.brk > 0 ? 1 : 0.45, cp = this.cam.position;
        if (!o.root.visible || Math.hypot(c.px - cp.x, c.pz - cp.z) > 400) return;
        const ahead = (cp.x - c.px) * Math.sin(c.psi) + (cp.z - c.pz) * Math.cos(c.psi);
        o.root.updateMatrixWorld();
        for (const s of [-1, 1]) {
          if (ahead > S.head[2] - 0.5) add(o.body, s * S.head[0], S.head[1], S.head[2] + 0.06, 0.85, 0.82, 0.7);
          if (ahead < S.tail[2] + 0.5) add(o.body, s * S.tail[0], S.tail[1], S.tail[2] - 0.06, 0.9 * b, 0.05 * b, 0.04 * b);
        }
      });
      for (let i = n; i < 160; i++) P[i * 3 + 1] = -9999;
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    }
    update(race, dt) {
      this.time += dt;
      if (race.drift) { this.updateDrift(race, dt); return; }
      this.updateCam(race, dt);
      this.stream(false);
      this.syncRiders(race, dt); this.syncCars(race);
      const cp = this.cam.position;
      this.skyG.position.set(cp.x, cp.y, cp.z);
      this.ringG.position.set(cp.x, 0, cp.z);
      const pp = this.path.at(race.player.z, race.player.x, _t1);
      const fx = Math.sin(pp.h), fz = Math.cos(pp.h);
      this.sun.target.position.set(pp.x + fx * 14, pp.y, pp.z + fz * 14);
      this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDir, 200);
      if (this.night) {
        this.head.position.set(pp.x + fx * 0.9, pp.y + 1.0, pp.z + fz * 0.9);
        this.head.target.position.set(pp.x + fx * 30, pp.y, pp.z + fz * 30);
        this.updateGlows(race);
      }
      const pol = race.police;
      if (pol && !pol.crash && Math.abs(pol.z - race.player.z) * KZ < 90) {
        const p = this.path.at(pol.z, pol.x, _t2), f = Math.floor(this.time * 8) % 2;
        this.siren.position.set(p.x, p.y + 1.5, p.z); this.siren.color.setHex(f ? 0xff2020 : 0x2050ff); this.siren.intensity = this.night ? 3 : 1.2;
      } else this.siren.intensity = 0;
      if (this.L.sea) { const w = G3.tx.water.offset; w.x = this.time * 0.02; w.y = this.time * 0.013; }
    }
    dispose() {
      for (const g of this.chunks.values()) this.dropGroup(g);
      for (const t of this.tiles.values()) t.mesh.geometry.dispose();
      for (const o of this.owned) if (o && o.dispose) o.dispose();
      for (const o of this.riders.values()) o.arms.geo.dispose();
      if (this.dcs) { for (const o of this.dcs) o.dispose(); this.smoke.dispose(); this.skids.dispose(); }
      this.scene.clear();
    }
  }
  const PAL_GROUND = { coast: '#c8b083', forest: '#3a6a30', pass: '#6a7a4a', city: '#202024', gpIsland: '#a8b070', gpHills: '#3a6a30', gpNight: '#121a14',
    dMaPiLeng: '#6a7a4a', dOQuyHo: '#3a5a30', dArena: '#121212' };
  let WIRE_MAT = null, POOL_MAT = null, POOLW_MAT = null, LAMP_GLOW = null, FLOOD_GLOW = null, G3_POOL_GEO = null;

  // ================================================================ showroom (shop preview)
  let show = null;
  function buildShow() {
    const sc = new T.Scene(), cam = new T.PerspectiveCamera(30, 1.5, 0.1, 50);
    sc.add(new T.HemisphereLight('#dfe8ff', '#3a3040', 0.9));
    const key = new T.DirectionalLight('#fff4e0', 1.4); key.position.set(3, 5, 4); sc.add(key);
    const rim = new T.DirectionalLight('#8ab0ff', 0.8); rim.position.set(-4, 3, -4); sc.add(rim);
    const floor = new T.Mesh(new T.CylinderGeometry(1.7, 1.75, 0.08, 48), new T.MeshStandardMaterial({ color: '#2a2c34', roughness: 0.35, metalness: 0.4 }));
    floor.position.y = -0.04; sc.add(floor);
    const pm = new T.PMREMGenerator(R), es = new T.Scene();
    es.add(new T.Mesh(new T.SphereGeometry(10, 16, 8), new T.MeshBasicMaterial({ color: '#8a96b0', side: T.BackSide })));
    const lamp = new T.Mesh(new T.PlaneGeometry(8, 3), new T.MeshBasicMaterial({ color: '#ffffff', side: T.DoubleSide })); lamp.position.set(0, 6, 2); lamp.rotation.x = Math.PI / 2; es.add(lamp);
    const env = pm.fromScene(es, 0.04).texture; pm.dispose();
    show = { sc, cam, env, models: {}, cars: {}, floor };
  }

  // ================================================================ public API
  const worlds = [];
  function get(race) {
    const i = worlds.findIndex(w => w.race === race);
    if (i >= 0) { const w = worlds[i]; if (i !== worlds.length - 1) { worlds.splice(i, 1); worlds.push(w); } return w; }
    Models.prebuildCars();   // one-off: every vehicle type, so traffic never stalls a frame when it first appears
    const w = new W3(race); worlds.push(w);
    while (worlds.length > 2) worlds.shift().dispose();
    return w;
  }
  const size = new T.Vector2();
  return {
    LOOK,
    init(canvas) {
      R = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
      R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping;
      R.shadowMap.enabled = true; R.shadowMap.type = T.PCFShadowMap;
      R.setClearColor(0x000000, 1);
      G3.init(R);
      for (const L of LODS) {   // shared index buffers: grid + double-sided skirts along the 4 borders
        const NV = L.nv, n = NV * NV, idx = [];
        for (let z = 0; z < NV - 1; z++) for (let x = 0; x < NV - 1; x++) { const a = z * NV + x, b = a + 1, c = a + NV, d = c + 1; idx.push(a, c, b, b, c, d); }
        L.edges = [[], [], [], []];
        for (let k = 0; k < NV; k++) { L.edges[0].push(k); L.edges[1].push((NV - 1) * NV + k); L.edges[2].push(k * NV); L.edges[3].push(k * NV + NV - 1); }
        for (let e = 0; e < 4; e++) for (let k = 0; k < NV - 1; k++) {
          const a = L.edges[e][k], b = L.edges[e][k + 1], c = n + e * NV + k, d = c + 1;
          idx.push(a, b, c, b, d, c, a, c, b, b, c, d);
        }
        L.index = new T.Uint16BufferAttribute(idx, 1);
      }
      WIRE_MAT = new T.LineBasicMaterial({ color: '#1c1c20' });
      POOL_MAT = new T.MeshBasicMaterial({ map: G3.tx.pool, color: '#ffb060', transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      LAMP_GLOW = new T.PointsMaterial({ size: 4.2, map: G3.tx.glow, color: '#ffcf80', transparent: true, depthWrite: false, blending: T.AdditiveBlending });
      POOLW_MAT = new T.MeshBasicMaterial({ map: G3.tx.pool, color: '#9ab0d8', transparent: true, opacity: 0.42, depthWrite: false, blending: T.AdditiveBlending,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      FLOOD_GLOW = new T.PointsMaterial({ size: 7, map: G3.tx.glow, color: '#e8f0ff', transparent: true, depthWrite: false, blending: T.AdditiveBlending });
      G3_POOL_GEO = new T.PlaneGeometry(1, 1);
      return R;
    },
    resize(w, h, pr) { R.setPixelRatio(pr); R.setSize(w, h, false); },
    _show() { return show; },   // (test views)
    get renderer() { return R; },
    world: get,
    // mode: 'full' (menus) | 'race' (leaves the dashboard strip at the bottom)
    render(race, mode, dt) {
      const w = get(race);
      w.update(race, dt);
      R.getSize(size);
      let vy = 0, vh = size.y;
      if (mode === 'race') { vy = size.y * (H - CFG.viewH) / H; vh = size.y - vy; }
      R.setScissorTest(false); R.setViewport(0, vy, size.x, vh);
      if (Math.abs(w.cam.aspect - size.x / vh) > 1e-3) { w.cam.aspect = size.x / vh; w.cam.updateProjectionMatrix(); }
      for (const k of ['paint', 'chrome', 'glass']) G3.mats[k].envMap = w.env;
      Models.setCarEnv(w.env);
      R.toneMappingExposure = w.L.exp;
      R.render(w.scene, w.cam);
    },
    // draw a rotating bike in a rectangle given in 512x320 overlay units
    preview(bikeIdx, x, y, w, h, t) {
      if (!show) buildShow();
      let o = show.models[bikeIdx];
      if (!o) { o = show.models[bikeIdx] = Models.rider(playerPal(bikeIdx), bikeIdx); o.rider.visible = false; show.sc.add(o.root); }
      for (const k in show.models) show.models[k].root.visible = +k === bikeIdx;
      for (const k in show.cars) show.cars[k].root.visible = false;
      show.floor.scale.set(1, 1, 1);
      o.root.rotation.y = t * 0.6;
      R.getSize(size);
      const sx = size.x / W, sy = size.y / H, vx = x * sx, vw = w * sx, vh = h * sy, vy = size.y - (y + h) * sy;
      show.cam.aspect = vw / vh; show.cam.updateProjectionMatrix();
      show.cam.position.set(0, 1.25, 3.7); show.cam.lookAt(0, 0.52, 0);
      for (const k of ['paint', 'chrome', 'glass', 'carPaint']) G3.mats[k].envMap = show.env;
      R.toneMappingExposure = 1.0;
      R.setScissorTest(true); R.setScissor(vx, vy, vw, vh); R.setViewport(vx, vy, vw, vh);
      R.setClearColor('#14182a', 1); R.clear(true, true, false);
      R.render(show.sc, show.cam);
      R.setScissorTest(false); R.setClearColor(0x000000, 1);
    },
    // a turning drift car in the garage
    carPreview(model, paint, x, y, w, h, t) {
      if (!show) buildShow();
      let o = show.cars[model];
      if (o && !o.glb && Models.hasCar(model)) { show.sc.remove(o.root); o.dispose(); o = null; }   // (a stand-in until the model loaded)
      if (!o) { o = show.cars[model] = Models.driftCar(model, paint); show.sc.add(o.root); }
      for (const k in show.models) show.models[k].root.visible = false;
      for (const k in show.cars) show.cars[k].root.visible = k === model;
      o.setPaint(paint); o.paint.envMap = show.env;
      for (const wl of o.wheels) if (wl.front) wl.pivot.rotation.y = Math.sin(t * 0.7) * 0.35;
      o.root.rotation.y = t * 0.45 + 0.6;
      show.floor.scale.set(1.75, 1, 1.75);
      R.getSize(size);
      const sx = size.x / W, sy = size.y / H, vx = x * sx, vw = w * sx, vh = h * sy, vy = size.y - (y + h) * sy;
      show.cam.aspect = vw / vh; show.cam.updateProjectionMatrix();
      show.cam.position.set(0, 2.0, 7.1); show.cam.lookAt(0, 0.55, 0);
      for (const k of ['paint', 'chrome', 'glass']) G3.mats[k].envMap = show.env;
      R.toneMappingExposure = 1.0;
      R.setScissorTest(true); R.setScissor(vx, vy, vw, vh); R.setViewport(vx, vy, vw, vh);
      R.setClearColor('#14182a', 1); R.clear(true, true, false);
      R.render(show.sc, show.cam);
      R.setScissorTest(false); R.setClearColor(0x000000, 1);
    },
  };
})();
