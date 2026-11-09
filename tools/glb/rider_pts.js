// rider contact points of a packed body, in mesh units: seat profile, clip-on / bar ends, footpeg ends
const fs = require('fs');
const [file, name] = process.argv.slice(2);
const src = fs.readFileSync(file, 'utf8'), D = JSON.parse(src.slice(src.indexOf(name + ' = ') + name.length + 3, src.lastIndexOf(';')));
const pos = new Int16Array(new Uint8Array(Buffer.from(D.pos, 'base64')).buffer), n = pos.length / 3;
const V = i => [pos[i * 3] / D.q, pos[i * 3 + 1] / D.q, pos[i * 3 + 2] / D.q];
for (let z = -0.6; z <= 0.2; z += 0.05) {
  let top = null; for (let i = 0; i < n; i++) { const p = V(i); if (Math.abs(p[0]) > 0.04 || Math.abs(p[2] - z) > 0.02) continue; if (!top || p[1] > top[1]) top = p; }
  if (top) console.log('centre top z', z.toFixed(2), 'y', top[1].toFixed(3));
}
// widest points per z slab at bar height (mirrors are higher / further out)
for (let z = 0.0; z <= 0.45; z += 0.05) for (const [y0, y1] of [[0.8, 0.95], [0.95, 1.2]]) {
  let L = null, R = null;
  for (let i = 0; i < n; i++) { const p = V(i); if (p[2] < z || p[2] >= z + 0.05 || p[1] < y0 || p[1] > y1) continue;
    if (p[0] > 0 && (!L || p[0] > L[0])) L = p; if (p[0] < 0 && (!R || p[0] < R[0])) R = p; }
  if (L && R) console.log('bars z', z.toFixed(2), 'y', y0, '-', y1, 'L', L.map(v => v.toFixed(3)).join(','), 'R', R.map(v => v.toFixed(3)).join(','));
}
for (let z = -0.45; z <= -0.05; z += 0.05) {
  let L = null, R = null;
  for (let i = 0; i < n; i++) { const p = V(i); if (p[2] < z || p[2] >= z + 0.05 || p[1] < 0.22 || p[1] > 0.45) continue;
    if (p[0] > 0 && (!L || p[0] > L[0])) L = p; if (p[0] < 0 && (!R || p[0] < R[0])) R = p; }
  if (L && R) console.log('pegs z', z.toFixed(2), 'L', L.map(v => v.toFixed(3)).join(','), 'R', R.map(v => v.toFixed(3)).join(','));
}
