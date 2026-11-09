// list long thin triangles (candidate "threads") of the packed mesh, grouped in 5 cm cells
const fs = require('fs');
const src = fs.readFileSync('F:/hb_tmp/wx/winnerx.js', 'utf8'), D = JSON.parse(src.slice(src.indexOf('winnerx = ') + 10, src.lastIndexOf(';')));
const pos = new Int16Array(new Uint8Array(Buffer.from(D.pos, 'base64')).buffer), idx = new Uint16Array(new Uint8Array(Buffer.from(D.idx, 'base64')).buffer);
const P = i => [pos[i * 3] / D.q, pos[i * 3 + 1] / D.q, pos[i * 3 + 2] / D.q];
const Lmin = +(process.argv[2] || 0.035), Hmax = +(process.argv[3] || 0.006);
const cells = new Map(); let n = 0;
for (let t = 0; t < idx.length; t += 3) {
  const a = P(idx[t]), b = P(idx[t + 1]), c = P(idx[t + 2]);
  const e = [[b, a], [c, b], [a, c]].map(([p, q]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])), L = Math.max(...e);
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const A = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2, h = 2 * A / L;
  if (L < Lmin || h > Hmax) continue; n++;
  const g = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3], k = g.map(x => Math.round(x * 20) / 20).join(',');
  const e2 = cells.get(k) || { n: 0, L: 0 }; e2.n++; e2.L = Math.max(e2.L, L); cells.set(k, e2);
}
console.log('thin tris', n, 'cells', cells.size);
for (const [k, e] of [...cells.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 40)) console.log(' ', k, 'n', e.n, 'maxL', e.L.toFixed(3));
