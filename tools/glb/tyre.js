// outer radius of a tyre per 30-degree sector (points near the centre plane), around a given axle; ground at 0
const { load } = require('./glbmesh');
const [file, z0, y0, xw] = [process.argv[2], +process.argv[3], +process.argv[4], +(process.argv[5] || 0.05)];
const M = load(file), P = M.P; let gy = 1e9; for (let i = 0; i < M.nv; i++) gy = Math.min(gy, P[i * 3 + 1]);
const sec = Array.from({ length: 12 }, () => []);
for (let i = 0; i < M.nv; i++) {
  const x = P[i * 3], y = P[i * 3 + 1] - gy, z = P[i * 3 + 2]; if (Math.abs(x) > xw) continue;
  const d = Math.hypot(z - z0, y - y0); if (d < 0.2 || d > 0.42) continue;
  const a = (Math.atan2(y - y0, z - z0) * 180 / Math.PI + 360) % 360; sec[Math.floor(a / 30)].push(d);
}
sec.forEach((s, k) => { s.sort((a, b) => a - b); const q = f => s.length ? s[Math.floor(f * (s.length - 1))].toFixed(3) : '-';
  console.log(`${k * 30}-${k * 30 + 30} deg  n ${s.length}  d50 ${q(0.5)} d90 ${q(0.9)} max ${q(1)}`); });
