// width of a packed body per z slice within a height band: finds flat "wings" sticking out sideways
const fs = require('fs');
const [file, name, y0, y1] = [process.argv[2], process.argv[3], +process.argv[4], +process.argv[5]];
const src = fs.readFileSync(file, 'utf8'), D = JSON.parse(src.slice(src.indexOf(name + ' = ') + name.length + 3, src.lastIndexOf(';')));
const pos = new Int16Array(new Uint8Array(Buffer.from(D.pos, 'base64')).buffer), n = pos.length / 3;
const B = new Map();
for (let i = 0; i < n; i++) {
  const x = pos[i * 3] / D.q, y = pos[i * 3 + 1] / D.q, z = pos[i * 3 + 2] / D.q; if (y < y0 || y > y1) continue;
  const k = Math.round(z * 20) / 20, b = B.get(k) || { n: 0, lo: 9, hi: -9, far: 0 }; b.n++; b.lo = Math.min(b.lo, x); b.hi = Math.max(b.hi, x); if (Math.abs(x) > 0.16) b.far++; B.set(k, b);
}
for (const [z, b] of [...B.entries()].sort((a, b) => a[0] - b[0])) console.log('z', z.toFixed(2), 'n', b.n, 'x', b.lo.toFixed(3), b.hi.toFixed(3), '|x|>0.16:', b.far);
