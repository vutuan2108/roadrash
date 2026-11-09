// Winner X body from the .glb: cut the wheels out (the game draws its own spinning wheels), drop stray sliver
// triangles and floating debris, quantise, and write a JS data file with the livery class map from the photo.
// usage: node build_wx.js model.glb cls.json out.js
const fs = require('fs');
const { load } = require('./glbmesh');
const [glb, clsFile, out] = process.argv.slice(2);
const M = load(glb), cls = JSON.parse(fs.readFileSync(clsFile, 'utf8'));
const P = M.P; let I = M.I;
let gy = 1e9; for (let i = 0; i < M.nv; i++) gy = Math.min(gy, P[i * 3 + 1]);
for (let i = 0; i < M.nv; i++) P[i * 3 + 1] -= gy;
const v = i => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = a => Math.hypot(a[0], a[1], a[2]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// wheels measured from the mesh (game frame, ground y = 0): z, y, tyre radius, x centre, half-width to cut
// x0..x1: the tyre (+ the lumpy discs the generator put right against it); the fork legs (x ~ -0.075 and +0.105, raked
// ~21 deg) are protected outside |x| 0.045 / 0.075 so they still reach the axle; the top of the front cut stays under the mudguard
// The front mudguard is fused to the tyre, so it goes too (up to mudguard height, below the headlamp) and the game
// draws a clean one
const WH = [{ z: 0.646, y: 0.315, r: 0.307, x0: -0.08, x1: 0.115, fork: [-0.351, 0.936], guard: [0.075, 0.66] }, { z: -0.584, y: 0.322, r: 0.315, x0: -0.075, x1: 0.105 }];
const RM = +(process.env.RM || 0.015);
const inW = p => WH.some(w => {
  const dz = p[2] - w.z, dy = p[1] - w.y, d = Math.hypot(dz, dy);
  if (d > (w.guard && p[1] < w.guard[1] ? w.r + w.guard[0] : w.r + RM) || p[0] < w.x0 || p[0] > w.x1) return false;
  if (w.fork && (p[0] < -0.045 || p[0] > 0.075)) {
    const al = dz * w.fork[0] + dy * w.fork[1], pe = Math.abs(dz * w.fork[1] - dy * w.fork[0]);
    if (al > -0.04 && pe < 0.045) return false;
  }
  return true;
});
const keep = [];
let nSliver = 0, nWheel = 0;
const sliv = [];
for (let t = 0; t < I.length; t += 3) {
  const a = v(I[t]), b = v(I[t + 1]), c = v(I[t + 2]);
  const e = [len(sub(b, a)), len(sub(c, b)), len(sub(a, c))], L = Math.max(...e), A = len(cross(sub(b, a), sub(c, a))) / 2, h = 2 * A / (L || 1);
  // slivers and the long "threads" (normal edges are 1-2 cm)
  if ((L > 0.06 && h < 0.004) || L > 0.2) { nSliver++; sliv.push([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3, L].map(x => +x.toFixed(3))); continue; }
  if (inW(a) && inW(b) && inW(c)) { nWheel++; continue; }
  keep.push(I[t], I[t + 1], I[t + 2]);
}
I = keep;
console.log('slivers', nSliver, 'wheel tris', nWheel, 'kept', I.length / 3);
if (process.env.SHOWSLIV) console.log(JSON.stringify(sliv.slice(0, 60)));

// connected components (shared vertices); drop the small floating ones
const par = new Int32Array(M.nv).map((_, i) => i), find = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
for (let t = 0; t < I.length; t += 3) { const a = find(I[t]), b = find(I[t + 1]), c = find(I[t + 2]); par[b] = a; par[find(c)] = a; }
const size = new Map(); for (let t = 0; t < I.length; t += 3) { const r = find(I[t]); size.set(r, (size.get(r) || 0) + 1); }
const MINC = +(process.env.MINC || 60);
const comps = [...size.entries()].sort((a, b) => b[1] - a[1]);
console.log('components', comps.length, 'largest', comps.slice(0, 8).map(c => c[1]).join(','), 'dropped (<' + MINC + ')', comps.filter(c => c[1] < MINC).length);
const I2 = []; for (let t = 0; t < I.length; t += 3) if (size.get(find(I[t])) >= MINC) I2.push(I[t], I[t + 1], I[t + 2]);

// optional Taubin smoothing (shrink-free): evens out the generator's lumps without rounding the silhouette much
const NS = +(process.env.SMOOTH || 0);
if (NS) {
  const nb = Array.from({ length: M.nv }, () => new Set());
  for (let t = 0; t < I2.length; t += 3) for (let e = 0; e < 3; e++) { const a = I2[t + e], b = I2[t + (e + 1) % 3]; nb[a].add(b); nb[b].add(a); }
  const step = f => {
    const D = new Float64Array(M.nv * 3);
    for (let i = 0; i < M.nv; i++) { const s = nb[i]; if (!s.size) continue; let x = 0, y = 0, z = 0; for (const j of s) { x += P[j * 3]; y += P[j * 3 + 1]; z += P[j * 3 + 2]; }
      D[i * 3] = x / s.size - P[i * 3]; D[i * 3 + 1] = y / s.size - P[i * 3 + 1]; D[i * 3 + 2] = z / s.size - P[i * 3 + 2]; }
    for (let i = 0; i < M.nv * 3; i++) P[i] += f * D[i];
  };
  for (let k = 0; k < NS; k++) { step(0.5); step(-0.53); }
  console.log('taubin iterations', NS);
}
// compact + quantise (1/16000 m)
const remap = new Int32Array(M.nv).fill(-1), pos = [];
const idx = I2.map(i => { if (remap[i] < 0) { remap[i] = pos.length / 3; pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); } return remap[i]; });
const Q = 16000, pq = new Int16Array(pos.length); for (let i = 0; i < pos.length; i++) pq[i] = Math.round(pos[i] * Q);
const iq = new Uint16Array(idx);
console.log('final verts', pos.length / 3, 'tris', idx.length / 3);
const b64 = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');

// left-side text: the side projection shows the lettering mirrored on the left, so each text box gets a copy (in an
// unused corner of the map) with only the text pixels reflected along the text line; the shader samples the copy there
const { TW, TH } = cls.crop, map = new Uint8Array(TW * TH), rb = Buffer.from(cls.rle, 'base64');
for (let i = 0, o = 0; i < rb.length; i += 2) { const w = (rb[i] << 8) | rb[i + 1]; map.fill(w >> 12, o, o + (w & 4095)); o += w & 4095; }
// inside the rims the photo shows discs and the gold caliper; the game draws its own, so what is left of the mesh
// there (fork bottoms, hub) is painted dark
{
  const { CX, CY, SC } = cls.crop;
  for (const w of [cls.RW, cls.FW]) {
    const cx = (w.cx - CX) * SC, cy = (w.cy - CY) * SC, rr = w.r * SC * 0.75;
    for (let y = Math.floor(cy - rr); y <= cy + rr; y++) for (let x = Math.floor(cx - rr); x <= cx + rr; x++) {
      if (Math.hypot(x - cx, y - cy) > rr) continue; const i = y * TW + x; if ([4, 6, 7, 8].includes(map[i])) map[i] = 5;
    }
  }
}
// [x, y, w, h, text angle (deg, y down), text classes, background class, dst x, dst y]
const BOX = [
  [1224, 1032, 156, 28, 0, [4], 1, 20, 20],            // HONDA on the lower cowl
  [1544, 554, 58, 48, 0, [4], 2, 200, 20],             // wing
  [1528, 598, 66, 28, 22, [4], 2, 280, 20],            // HONDA under the wing
  [1408, 598, 114, 38, 12, [4], 2, 370, 20],           // WINNER R on the blue graphic
  [698, 576, 210, 102, 23.7, [4, 7, 6], 5, 500, 20],   // WINNER R on the carbon panel
];
const boxes = [];
for (const [x0, y0, w, h, ang, txt, bgc, dx, dy] of BOX) {
  const d = [Math.cos(ang * Math.PI / 180), Math.sin(ang * Math.PI / 180)], cx = x0 + w / 2, cy = y0 + h / 2;
  const at = (x, y) => map[Math.min(TH - 1, Math.max(0, Math.round(y))) * TW + Math.min(TW - 1, Math.max(0, Math.round(x)))];
  const isT = k => txt.includes(k);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x0 + x + 0.5 - cx, py = y0 + y + 0.5 - cy, t = px * d[0] + py * d[1], rx = px - 2 * t * d[0], ry = py - 2 * t * d[1];
    const own = at(x0 + x, y0 + y), ref = at(cx + rx - 0.5, cy + ry - 0.5);
    map[(dy + y) * TW + dx + x] = isT(ref) ? ref : isT(own) ? bgc : own;
  }
  boxes.push([x0 / TW, y0 / TH, (x0 + w) / TW, (y0 + h) / TH, (dx - x0) / TW, (dy - y0) / TH].map(v => +v.toFixed(6)));
}
const runs = [];
for (let y = 0; y < TH; y++) { let x = 0; while (x < TW) { const k = map[y * TW + x]; let n = 1; while (x + n < TW && n < 4095 && map[y * TW + x + n] === k) n++; runs.push(((k << 12) | n) >> 8, ((k << 12) | n) & 255); x += n; } }
const data = {
  q: Q, pos: b64(pq), idx: b64(iq),
  // photo projection: photo px = k * (z, -y) + c (complex multiply), texture = crop of the photo (CX, CY, SC)
  k: cls.k.map(v => +v.toFixed(4)), c: cls.c.map(v => +v.toFixed(3)), crop: cls.crop, rle: Buffer.from(runs).toString('base64'),
  boxes,   // [u0, v0, u1, v1, du, dv]: left-side text copies
};
fs.writeFileSync(out, '// Honda Winner X body: mesh from the user\'s white_mesh.glb (wheels cut out), livery classes from the side photo\n' +
  'window.HB_GLB = window.HB_GLB || {};\nHB_GLB.winnerx = ' + JSON.stringify(data) + ';\n');
console.log('wrote', out, fs.statSync(out).size, 'bytes');
