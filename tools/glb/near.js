// what lies within a distance band of an axle (|x| < xw), by height: helps place the mudguard cut below the nose
const { load } = require('./glbmesh');
const [file, z0, y0, xw, d0, d1] = [process.argv[2], ...process.argv.slice(3).map(Number)];
const M = load(file), P = M.P; let gy = 1e9; for (let i = 0; i < M.nv; i++) gy = Math.min(gy, P[i * 3 + 1]);
const rows = new Map();
for (let i = 0; i < M.nv; i++) {
  const x = P[i * 3], y = P[i * 3 + 1] - gy, z = P[i * 3 + 2]; if (Math.abs(x) > xw) continue;
  const d = Math.hypot(z - z0, y - y0); if (d < d0 || d > d1) continue;
  const k = Math.round(y * 50) / 50, r = rows.get(k) || { n: 0, zmin: 9, zmax: -9, dmin: 9, dmax: 0 };
  r.n++; r.zmin = Math.min(r.zmin, z); r.zmax = Math.max(r.zmax, z); r.dmin = Math.min(r.dmin, d); r.dmax = Math.max(r.dmax, d); rows.set(k, r);
}
for (const [y, r] of [...rows.entries()].sort((a, b) => b[0] - a[0])) console.log('y', y.toFixed(2), 'n', r.n, 'z', r.zmin.toFixed(3), r.zmax.toFixed(3), 'd', r.dmin.toFixed(3), r.dmax.toFixed(3));
