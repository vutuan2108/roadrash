// x-extent of the tyre: points at radius d0..d1 from the axle, below the axle (no bodywork there), by radius band
const { load } = require('./glbmesh');
const [file, z0, y0, d0, d1] = [process.argv[2], ...process.argv.slice(3).map(Number)];
const M = load(file), P = M.P; let gy = 1e9; for (let i = 0; i < M.nv; i++) gy = Math.min(gy, P[i * 3 + 1]);
const B = new Map();
for (let i = 0; i < M.nv; i++) {
  const x = P[i * 3], y = P[i * 3 + 1] - gy, z = P[i * 3 + 2], d = Math.hypot(z - z0, y - y0);
  if (d < d0 || d > d1 || y > y0 - 0.05) continue;
  const k = Math.round(d * 100) / 100, b = B.get(k) || { n: 0, lo: 9, hi: -9 }; b.n++; b.lo = Math.min(b.lo, x); b.hi = Math.max(b.hi, x); B.set(k, b);
}
for (const [d, b] of [...B.entries()].sort((a, b) => a[0] - b[0])) console.log('d', d.toFixed(2), 'n', b.n, 'x', b.lo.toFixed(3), b.hi.toFixed(3));
