// connected components of a .glb (game frame, ground at 0) after dropping triangles longer than LMAX
const { load } = require('./glbmesh');
const M = load(process.argv[2]), LMAX = +(process.argv[3] || 0.2);
const P = M.P; let gy = 1e9; for (let i = 0; i < M.nv; i++) gy = Math.min(gy, P[i * 3 + 1]); for (let i = 0; i < M.nv; i++) P[i * 3 + 1] -= gy;
const I = [];
for (let t = 0; t < M.I.length; t += 3) {
  const v = k => [P[M.I[t + k] * 3], P[M.I[t + k] * 3 + 1], P[M.I[t + k] * 3 + 2]], a = v(0), b = v(1), c = v(2);
  const L = Math.max(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), Math.hypot(b[0] - c[0], b[1] - c[1], b[2] - c[2]), Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]));
  if (L <= LMAX) I.push(M.I[t], M.I[t + 1], M.I[t + 2]);
}
const par = new Int32Array(M.nv).map((_, i) => i), find = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
for (let t = 0; t < I.length; t += 3) { const a = find(I[t]); par[find(I[t + 1])] = a; par[find(I[t + 2])] = a; }
const C = new Map();
for (let t = 0; t < I.length; t += 3) {
  const r = find(I[t]); let c = C.get(r); if (!c) C.set(r, c = { n: 0, lo: [9, 9, 9], hi: [-9, -9, -9] }); c.n++;
  for (let k = 0; k < 3; k++) { const i = I[t + k]; for (let d = 0; d < 3; d++) { c.lo[d] = Math.min(c.lo[d], P[i * 3 + d]); c.hi[d] = Math.max(c.hi[d], P[i * 3 + d]); } }
}
console.log('dropped long tris', M.I.length / 3 - I.length / 3, 'components', C.size);
for (const c of [...C.values()].sort((a, b) => b.n - a.n).slice(0, 15)) console.log(' n', c.n, 'x', c.lo[0].toFixed(2), c.hi[0].toFixed(2), 'y', c.lo[1].toFixed(2), c.hi[1].toFixed(2), 'z', c.lo[2].toFixed(2), c.hi[2].toFixed(2));
