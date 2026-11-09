// Authored car .glb -> packed HB_GLB data for a drift car (models.js glbCar). usage: node build_car.js cfg_xxx.js
// - sized from the real wheelbase (cfg.wb), centred across, wheels on the ground, front axle at z = +cfg.a (the physics'
//   centre of mass at the origin); game frame x = left, y = up, z = forward
// - parts sorted into colour categories by material (cfg.mats), 'lamp' split into head / tail by which end it is at,
//   'drop' left out (cabin interior behind dark glass, engine, badges)
// - wheel categories (cfg.wheel) go to the nearest of the four wheels; the left front and left rear ones are kept
//   centred on their hub ('caliper' stays on the steering pivot, the rest spins); the right side mirrors them
// - each part welded and simplified with meshoptimizer to an absolute error (err, errLo for the far body, errW wheels)
// - a wheel part that spans several wheels (all four tyres in one mesh) is cut into one per wheel first; 'wheel' = a
//   tyre and rim modelled as one mesh: found like a tyre, then cut by radius (beyond rimK x the tyre radius = tyre)
// - cfg.colors: colours of this model's categories (rims, calipers...) over the game's defaults
const fs = require('fs'), path = require('path');
const { load } = require('./glbfull');
const { MeshoptSimplifier } = require(process.env.MESHOPT || 'F:/hb_tmp/nodetools/node_modules/meshoptimizer');
const C = require(path.resolve(process.argv[2]));
(async () => {
  await MeshoptSimplifier.ready;
  const loaded = load(C.glb, 1, (x, y, z) => [x, y, z]).parts;
  const catOfMat = new Map(); for (const [k, ids] of Object.entries(C.mats)) for (const id of ids) catOfMat.set(id, k);
  const catOf = p => p.cat || (C.byName && C.byName(p)) || catOfMat.get(p.mat) || 'trim';
  const WHEEL = new Set(C.wheel);
  // ---- wheel parts spanning several wheels: cut by quarter of the car (round the middle of all the tyres)
  const box = list => { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const p of list) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p.lo[k]); hi[k] = Math.max(hi[k], p.hi[k]); } return { lo, hi }; };
  const tb = box(loaded.filter(p => ['tyre', 'wheel'].includes(catOf(p)))), mx = (tb.lo[0] + tb.hi[0]) / 2, mz = (tb.lo[2] + tb.hi[2]) / 2;
  const parts = [];
  for (const p of loaded) {
    const cat = catOf(p);
    if (!WHEEL.has(cat) || ((p.hi[0] - mx) * (p.lo[0] - mx) > 0 && (p.hi[2] - mz) * (p.lo[2] - mz) > 0)) { parts.push(p); continue; }
    const Q = {};
    for (let t = 0; t < p.I.length; t += 3) {
      const a = p.I[t] * 3, b = p.I[t + 1] * 3, d = p.I[t + 2] * 3;
      const k = ((p.P[a] + p.P[b] + p.P[d]) / 3 > mx ? 'L' : 'R') + ((p.P[a + 2] + p.P[b + 2] + p.P[d + 2]) / 3 > mz ? 'F' : 'B');
      (Q[k] || (Q[k] = [])).push(p.I[t], p.I[t + 1], p.I[t + 2]);
    }
    for (const k in Q) {
      const I = Uint32Array.from(Q[k]), lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      for (const i of I) for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], p.P[i * 3 + j]); hi[j] = Math.max(hi[j], p.P[i * 3 + j]); }
      parts.push(Object.assign({}, p, { I, lo, hi, tris: I.length / 3, cat }));
    }
  }
  // ---- the four wheels from the tyres
  const tyres = parts.filter(p => catOf(p) === 'tyre' || catOf(p) === 'wheel');
  let cx = 0, cz = 0; for (const p of tyres) { cx += (p.lo[0] + p.hi[0]) / 2; cz += (p.lo[2] + p.hi[2]) / 2; } cx /= tyres.length; cz /= tyres.length;
  const W = {};
  for (const p of tyres) {
    const k = ((p.lo[0] + p.hi[0]) / 2 > cx ? 'L' : 'R') + ((p.lo[2] + p.hi[2]) / 2 > cz ? 'F' : 'B');
    const w = W[k] || (W[k] = { lo: [1e9, 1e9, 1e9], hi: [-1e9, -1e9, -1e9] });
    for (let i = 0; i < 3; i++) { w.lo[i] = Math.min(w.lo[i], p.lo[i]); w.hi[i] = Math.max(w.hi[i], p.hi[i]); }
  }
  for (const w of Object.values(W)) { w.c = [0, 1, 2].map(i => (w.lo[i] + w.hi[i]) / 2); w.R = (w.hi[1] - w.lo[1]) / 2; w.w = w.hi[0] - w.lo[0]; }
  const zF = (W.LF.c[2] + W.RF.c[2]) / 2, zB = (W.LB.c[2] + W.RB.c[2]) / 2, s = C.wb / (zF - zB);
  const ground = Math.min(W.LF.lo[1], W.RF.lo[1], W.LB.lo[1], W.RB.lo[1]);
  const xc = (W.LF.c[0] + W.RF.c[0] + W.LB.c[0] + W.RB.c[0]) / 4;
  const X = v => [(v[0] - xc) * s, (v[1] - ground) * s, (v[2] - zF) * s + C.a];
  const hubs = {}; for (const k in W) hubs[k] = X(W[k].c);
  console.log('scale', s.toFixed(6), 'wheelbase raw', (zF - zB).toFixed(4));
  for (const k of ['LF', 'RF', 'LB', 'RB']) console.log(' wheel', k, 'hub', hubs[k].map(v => v.toFixed(3)).join(' '), 'R', (W[k].R * s).toFixed(3), 'w', (W[k].w * s).toFixed(3));
  // ---- parts into the game frame, sorted
  const body = [], wheels = { LF: [], LB: [] };
  const nearestWheel = c => { let best = null, bd = 1e9; for (const k in hubs) { const h = hubs[k], d = Math.hypot(c[0] - h[0], c[1] - h[1], c[2] - h[2]); if (d < bd) { bd = d; best = k; } } return best; };
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const p of parts) {
    let cat = catOf(p); if (cat === 'drop') continue;
    const n = p.P.length / 3, P = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const q = X([p.P[i * 3], p.P[i * 3 + 1], p.P[i * 3 + 2]]); P[i * 3] = q[0]; P[i * 3 + 1] = q[1]; P[i * 3 + 2] = q[2]; }
    // (the centre of the faces it has: a part cut from a mesh of all four wheels still shares that mesh's vertices)
    const c = [0, 1, 2].map(k => { let a = 1e9, b = -1e9; for (const i of p.I) { a = Math.min(a, P[i * 3 + k]); b = Math.max(b, P[i * 3 + k]); } return (a + b) / 2; });
    if (WHEEL.has(cat)) {
      const k = nearestWheel(c); if (!wheels[k]) continue;
      const h = hubs[k]; for (let i = 0; i < n; i++) { P[i * 3] -= h[0]; P[i * 3 + 1] -= h[1]; P[i * 3 + 2] -= h[2]; }
      wheels[k].push({ cat, P, I: p.I, tris: p.tris });
      continue;
    }
    for (let i = 0; i < P.length; i++) { const k = i % 3; lo[k] = Math.min(lo[k], P[i]); hi[k] = Math.max(hi[k], P[i]); }
    if (cat === 'lamp' || cat === 'amberLamp') {   // lamps and their covers: front ones are head (or indicator) lamps, rear ones tail lamps
      const Ih = [], It = [];
      for (let t = 0; t < p.I.length; t += 3) { const z = (P[p.I[t] * 3 + 2] + P[p.I[t + 1] * 3 + 2] + P[p.I[t + 2] * 3 + 2]) / 3; (z > 0 ? Ih : It).push(p.I[t], p.I[t + 1], p.I[t + 2]); }
      if (Ih.length) body.push({ cat: cat === 'lamp' ? 'head' : 'amber', P, I: Uint32Array.from(Ih), tris: Ih.length / 3 });
      if (It.length) body.push({ cat: 'tail', P, I: Uint32Array.from(It), tris: It.length / 3 });
      continue;
    }
    body.push({ cat, P, I: p.I, tris: p.tris });
  }
  // ---- each kept wheel turned onto its own axle: modelled wheels lean in (camber) and may toe, so spinning them about
  // the car's x axis would wobble. The tyre's axis is the direction its vertices spread least; the wheel is stored
  // with that axis along x, centred on the tyre, and the lean is kept as a fixed rotation (quaternion) for the game
  const orient = {};
  for (const k of Object.keys(wheels)) {
    const T = wheels[k].filter(p => p.cat === 'tyre' || p.cat === 'wheel'), AX = wheels[k].filter(p => (C.axisCats || ['tyre', 'wheel']).includes(p.cat));
    // area-weighted moments of the axle parts' surface (vertex counts would follow the meshing, not the shape)
    let n = 0; const c = [0, 0, 0], M = new Array(9).fill(0), tri = [];
    for (const p of AX) for (let t = 0; t < p.I.length; t += 3) {
      const a = p.I[t] * 3, b = p.I[t + 1] * 3, d = p.I[t + 2] * 3, P = p.P;
      const u = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], v = [P[d] - P[a], P[d + 1] - P[a + 1], P[d + 2] - P[a + 2]];
      const A = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
      if (!(A > 0)) continue;
      const g = [0, 1, 2].map(j => (P[a + j] + P[b + j] + P[d + j]) / 3);
      tri.push([g, A]); n += A; for (let j = 0; j < 3; j++) c[j] += g[j] * A;
    }
    for (let j = 0; j < 3; j++) c[j] /= n;
    for (const [g, A] of tri) { const d = [g[0] - c[0], g[1] - c[1], g[2] - c[2]]; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) M[a * 3 + b] += d[a] * d[b] * A / n; }
    // smallest eigenvector: power iteration on (trace - M)
    const tr = M[0] + M[4] + M[8]; let ax = [1, 0, 0];
    for (let it = 0; it < 300; it++) { const w = [0, 1, 2].map(r => (tr - M[r * 4]) * ax[r] - [0, 1, 2].reduce((s, q) => s + (q === r ? 0 : M[r * 3 + q] * ax[q]), 0)); const l = Math.hypot(...w); ax = w.map(v => v / l); }
    if (ax[0] < 0) ax = ax.map(v => -v);
    // frame: ex = axle, ey = up made square to it, ez = ex x ey; aligned = R^T (p - c)
    const up = [0, 1, 0], dd = ax[1], ey0 = [up[0] - dd * ax[0], up[1] - dd * ax[1], up[2] - dd * ax[2]], ly = Math.hypot(...ey0), ey = ey0.map(v => v / ly);
    const ez = [ax[1] * ey[2] - ax[2] * ey[1], ax[2] * ey[0] - ax[0] * ey[2], ax[0] * ey[1] - ax[1] * ey[0]];
    const toAl = (P, o) => { for (let i = 0; i < P.length; i += 3) { const d = [P[i] - o[0], P[i + 1] - o[1], P[i + 2] - o[2]];
      P[i] = d[0] * ax[0] + d[1] * ax[1] + d[2] * ax[2]; P[i + 1] = d[0] * ey[0] + d[1] * ey[1] + d[2] * ey[2]; P[i + 2] = d[0] * ez[0] + d[1] * ez[1] + d[2] * ez[2]; } };
    for (const p of wheels[k]) toAl(p.P, c);
    // re-centre on the tyre's box in its own frame (the centroid sits off-centre on unevenly meshed tyres)
    const lo = [9, 9, 9], hi = [-9, -9, -9];
    for (const p of T) for (const v of p.I) for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], p.P[v * 3 + j]); hi[j] = Math.max(hi[j], p.P[v * 3 + j]); }
    const m = [0, 1, 2].map(j => (lo[j] + hi[j]) / 2);
    for (const p of wheels[k]) for (let i = 0; i < p.P.length; i += 3) for (let j = 0; j < 3; j++) p.P[i + j] -= m[j];
    const hub = [0, 1, 2].map(j => hubs[k][j] + c[j] + ax[j] * m[0] + ey[j] * m[1] + ez[j] * m[2]);
    // the lean kept for the game: camber only - any toe (a model posed with its front wheels turned) is taken out, the
    // game steers the wheels itself. Quaternion of the matrix [ex ey ez] (columns) of that leaned axle
    const lx = Math.hypot(ax[0], ax[1]), ex2 = [ax[0] / lx, ax[1] / lx, 0], ey2 = [-ex2[1], ex2[0], 0], ez2 = [0, 0, 1];
    const m00 = ex2[0], m01 = ey2[0], m02 = ez2[0], m10 = ex2[1], m11 = ey2[1], m12 = ez2[1], m20 = ex2[2], m21 = ey2[2], m22 = ez2[2];
    const qw = Math.sqrt(Math.max(0, 1 + m00 + m11 + m22)) / 2, q = [(m21 - m12) / (4 * qw), (m02 - m20) / (4 * qw), (m10 - m01) / (4 * qw), qw];
    orient[k] = { hub, q, R: (hi[1] - lo[1]) / 2 };
    // tyre and rim in one mesh: the faces further out than rimK x the tyre's radius are the tyre
    const Rw = (hi[1] - lo[1]) / 2, rk = (C.rimK || 0.72) * Rw;
    for (const p of wheels[k].filter(q => q.cat === 'wheel')) {
      const It = [], Ir = [];
      for (let t = 0; t < p.I.length; t += 3) {
        const a = p.I[t] * 3, b = p.I[t + 1] * 3, d = p.I[t + 2] * 3;
        const r = Math.hypot((p.P[a + 1] + p.P[b + 1] + p.P[d + 1]) / 3, (p.P[a + 2] + p.P[b + 2] + p.P[d + 2]) / 3);
        (r > rk ? It : Ir).push(p.I[t], p.I[t + 1], p.I[t + 2]);
      }
      p.cat = 'tyre'; p.I = Uint32Array.from(It); p.tris = It.length / 3;
      if (Ir.length) wheels[k].push({ cat: 'rim', P: p.P, I: Uint32Array.from(Ir), tris: Ir.length / 3 });
    }
    console.log(' wheel', k, 'axle', ax.map(v => v.toFixed(3)).join(' '), 'camber', (Math.asin(ax[1]) * 57.3).toFixed(1), 'deg, toe left out', (Math.atan2(ax[2], ax[0]) * 57.3).toFixed(1), 'deg, hub', hub.map(v => v.toFixed(3)).join(' '), 'R', ((hi[1] - lo[1]) / 2).toFixed(3));
  }
  // ---- weld + simplify + pack
  const Q = 8000, b64 = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
  const pack = (list, ERR) => {
    const groups = {}; let before = 0, after = 0;
    for (const p of list) {
      const map = new Map(), V = [], remap = new Uint32Array(p.P.length / 3);
      for (let i = 0; i < remap.length; i++) {
        const k = Math.round(p.P[i * 3] * 20000) + ',' + Math.round(p.P[i * 3 + 1] * 20000) + ',' + Math.round(p.P[i * 3 + 2] * 20000);
        let j = map.get(k); if (j === undefined) { j = V.length / 3; map.set(k, j); V.push(p.P[i * 3], p.P[i * 3 + 1], p.P[i * 3 + 2]); } remap[i] = j;
      }
      const I = [];
      for (let t = 0; t < p.I.length; t += 3) { const a = remap[p.I[t]], b = remap[p.I[t + 1]], c = remap[p.I[t + 2]]; if (a !== b && b !== c && a !== c) I.push(a, b, c); }
      const Vf = new Float32Array(V);
      let out = Uint32Array.from(I);
      if (I.length > 120) [out] = MeshoptSimplifier.simplify(out, Vf, 3, Math.max(24, Math.floor(I.length * 0.01 / 3) * 3), ERR, ['ErrorAbsolute']);
      before += p.tris; after += out.length / 3;
      const g = groups[p.cat] || (groups[p.cat] = { P: [], I: [] }), base = g.P.length / 3, used = new Map();
      for (const i of out) { let j = used.get(i); if (j === undefined) { j = base + used.size; used.set(i, j); g.P.push(Vf[i * 3], Vf[i * 3 + 1], Vf[i * 3 + 2]); } g.I.push(j); }
    }
    const res = [];
    for (const [cat, g] of Object.entries(groups)) {
      const nv = g.P.length / 3;
      res.push({ cat, n32: nv >= 65536 ? 1 : 0, pos: b64(Int16Array.from(g.P, v => Math.round(v * Q))), idx: b64(nv < 65536 ? Uint16Array.from(g.I) : Uint32Array.from(g.I)) });
      if (process.env.VERBOSE) console.log('   ', cat.padEnd(10), 'tris', g.I.length / 3);
    }
    return { res, before, after };
  };
  const hiB = pack(body, C.err), loB = pack(body, C.errLo), wf = pack(wheels.LF, C.errW), wr = pack(wheels.LB, C.errW);
  console.log('body tris', hiB.before, '->', hiB.after, '(far', loB.after + ')', 'wheel front', wf.before, '->', wf.after, 'rear', wr.before, '->', wr.after);
  const r3 = v => +v.toFixed(3);
  // where the left headlamp / tail lamp glows (centre of its lit faces), unless the config says
  const lampAt = cat => {
    let n = 0; const sum = [0, 0, 0];
    for (const p of body) if (p.cat === cat) for (const i of p.I) if (p.P[i * 3] > 0.25) { n++; for (let k = 0; k < 3; k++) sum[k] += p.P[i * 3 + k]; }
    return n ? sum.map(v => r3(v / n)) : null;
  };
  const spec = { len: [r3(lo[2]), r3(hi[2])], hw: r3(Math.max(-lo[0], hi[0])), top: r3(hi[1]), axles: [r3((hubs.LF[2] + hubs.RF[2]) / 2), r3((hubs.LB[2] + hubs.RB[2]) / 2)],
    wheel: { R: r3((W.LF.R + W.LB.R) / 2 * s), w: r3((W.LF.w + W.LB.w) / 2 * s), x: r3((hubs.LF[0] - hubs.RF[0] + hubs.LB[0] - hubs.RB[0]) / 4), xr: r3((hubs.LB[0] - hubs.RB[0]) / 2) },
    colors: C.colors || {},
    hub: { f: orient.LF.hub.map(r3), r: orient.LB.hub.map(r3), qf: orient.LF.q.map(v => +v.toFixed(5)), qr: orient.LB.q.map(v => +v.toFixed(5)) }, head: C.head || lampAt('head'), tail: C.tail || lampAt('tail'), exh: C.exh || [] };
  console.log('spec', JSON.stringify(spec));
  const data = { q: Q, spec, groups: hiB.res, lo: loB.res, wheels: { f: wf.res, r: wr.res } };
  fs.writeFileSync(C.out, (C.header || '') + 'window.HB_GLB = window.HB_GLB || {};\nHB_GLB.' + C.name + ' = ' + JSON.stringify(data) + ';\n');
  console.log('wrote', C.out, (fs.statSync(C.out).size / 1024).toFixed(0), 'KB');
})().catch(e => { console.error(e); process.exit(1); });
