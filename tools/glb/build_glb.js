// Generic: .glb body -> packed HB_GLB data file. Drops slivers / long "threads", the wheels (the game draws its own),
// floating debris (or everything but the largest part), quantises, and adds the livery class map.
// usage: node build_glb.js config.js        (config: see cfg_*.js)
const fs = require('fs'), path = require('path');
const { load } = require('./glbmesh');
const C = require(path.resolve(process.argv[2]));
const M = load(C.glb);
const P = M.P; let I = M.I;
let gy = 1e9; for (let i = 0; i < M.nv; i++) gy = Math.min(gy, P[i * 3 + 1]);
for (let i = 0; i < M.nv; i++) P[i * 3 + 1] -= gy;
const v = i => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = a => Math.hypot(a[0], a[1], a[2]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// wheel = { z, y, r, x0, x1, fork?: [dz, dy] unit axis up the leg, forkIn?: [xr, xl] protected outside, guard?: [extra r, below y] }
const WH = C.wheels, RM = C.rm ?? 0.015;
const inW = p => WH.some(w => {
  const dz = p[2] - w.z, dy = p[1] - w.y, d = Math.hypot(dz, dy);
  if (d > (w.guard && p[1] < w.guard[1] ? w.r + w.guard[0] : w.r + RM) || p[0] < w.x0 || p[0] > w.x1) return false;
  if (w.fork && (p[0] < w.forkIn[0] || p[0] > w.forkIn[1])) {
    const al = dz * w.fork[0] + dy * w.fork[1], pe = Math.abs(dz * w.fork[1] - dy * w.fork[0]);
    if (al > -0.04 && pe < (w.forkR || 0.045)) return false;
  }
  return true;
});
const cut = C.cut || (() => false);   // extra per-vertex cut (all three corners must match)
const keep = [];
let nSliver = 0, nWheel = 0, nCut = 0;
for (let t = 0; t < I.length; t += 3) {
  const a = v(I[t]), b = v(I[t + 1]), c = v(I[t + 2]);
  const e = [len(sub(b, a)), len(sub(c, b)), len(sub(a, c))], L = Math.max(...e), A = len(cross(sub(b, a), sub(c, a))) / 2, h = 2 * A / (L || 1);
  if ((L > 0.06 && h < 0.004) || L > 0.2) { nSliver++; continue; }   // slivers and long "threads" (normal edges are 1-2 cm)
  if (inW(a) && inW(b) && inW(c)) { nWheel++; continue; }
  if (cut(a) && cut(b) && cut(c)) { nCut++; continue; }
  keep.push(I[t], I[t + 1], I[t + 2]);
}
I = keep;
console.log('slivers', nSliver, 'wheel tris', nWheel, 'cut', nCut, 'kept', I.length / 3);

// connected components; keep the largest only (C.largest) or drop the small floating ones
const par = new Int32Array(M.nv).map((_, i) => i), find = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
for (let t = 0; t < I.length; t += 3) { const a = find(I[t]); par[find(I[t + 1])] = a; par[find(I[t + 2])] = a; }
const size = new Map(); for (let t = 0; t < I.length; t += 3) { const r = find(I[t]); size.set(r, (size.get(r) || 0) + 1); }
const comps = [...size.entries()].sort((a, b) => b[1] - a[1]), MINC = C.minComp ?? 60;
const ok = r => C.largest ? size.get(r) >= (C.largest === true ? comps[0][1] : C.largest) : size.get(r) >= MINC;
console.log('components', comps.length, 'largest', comps.slice(0, 8).map(c => c[1]).join(','));
const I2 = []; for (let t = 0; t < I.length; t += 3) if (ok(find(I[t]))) I2.push(I[t], I[t + 1], I[t + 2]);

const remap = new Int32Array(M.nv).fill(-1), pos = [];
const idx = I2.map(i => { if (remap[i] < 0) { remap[i] = pos.length / 3; pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); } return remap[i]; });
const Q = 16000, pq = new Int16Array(pos.length); for (let i = 0; i < pos.length; i++) pq[i] = Math.round(pos[i] * Q);
const iq = new Uint16Array(idx);
console.log('final verts', pos.length / 3, 'tris', idx.length / 3);
const b64 = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');

// livery: a class map (cls.json from photo.html or a painted livery page) with its projection; without one, a flat map
let data = { q: Q, pos: b64(pq), idx: b64(iq) };
if (C.cls && fs.existsSync(C.cls)) {
  const cls = JSON.parse(fs.readFileSync(C.cls, 'utf8'));
  data = { ...data, k: cls.k.map(x => +(+x).toFixed(4)), c: cls.c.map(x => +(+x).toFixed(3)), crop: cls.crop, rle: cls.rle, boxes: cls.boxes || [] };
} else {
  const TW = 64, TH = 32, runs = []; for (let y = 0; y < TH; y++) runs.push(((1 << 12) | TW) >> 8, ((1 << 12) | TW) & 255);
  data = { ...data, k: [TW / 2.2, 0], c: [TW / 2, TH], crop: { CX: 0, CY: 0, SC: 1, TW, TH }, rle: Buffer.from(runs).toString('base64'), boxes: [] };
}
if (C.shade) data.shade = C.shade;   // per-model shader extras (nose mask, seat, tail lamp)
fs.writeFileSync(C.out, (C.header || '') + 'window.HB_GLB = window.HB_GLB || {};\nHB_GLB.' + C.name + ' = ' + JSON.stringify(data) + ';\n');
console.log('wrote', C.out, fs.statSync(C.out).size, 'bytes');
