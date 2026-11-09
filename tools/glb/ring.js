// leftover ring check on a packed body: per 30-degree sector round an axle, points at d0..d1 (|x| < xw): count, x range, d range
const fs = require('fs');
const [file, name, z0, y0, d0, d1, xw] = [process.argv[2], process.argv[3], ...process.argv.slice(4).map(Number)];
const src = fs.readFileSync(file, 'utf8'), D = JSON.parse(src.slice(src.indexOf(name + ' = ') + name.length + 3, src.lastIndexOf(';')));
const pos = new Int16Array(new Uint8Array(Buffer.from(D.pos, 'base64')).buffer), n = pos.length / 3;
const S = Array.from({ length: 12 }, () => ({ n: 0, xl: 9, xh: -9, dl: 9, dh: 0 }));
for (let i = 0; i < n; i++) {
  const x = pos[i * 3] / D.q, y = pos[i * 3 + 1] / D.q, z = pos[i * 3 + 2] / D.q, d = Math.hypot(z - z0, y - y0);
  if (d < d0 || d > d1 || Math.abs(x) > xw) continue;
  const s = S[Math.floor(((Math.atan2(y - y0, z - z0) * 180 / Math.PI + 360) % 360) / 30)];
  s.n++; s.xl = Math.min(s.xl, x); s.xh = Math.max(s.xh, x); s.dl = Math.min(s.dl, d); s.dh = Math.max(s.dh, d);
}
S.forEach((s, k) => console.log(`${k * 30}-${k * 30 + 30}`, 'n', s.n, s.n ? `x ${s.xl.toFixed(3)} ${s.xh.toFixed(3)} d ${s.dl.toFixed(3)} ${s.dh.toFixed(3)}` : ''));
