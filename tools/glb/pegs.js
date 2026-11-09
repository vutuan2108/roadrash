// rider contact points on the packed mesh (mesh frame), printed also in the game frame (s, oy, oz)
const fs = require('fs');
const src = fs.readFileSync('F:/hb_tmp/wx/winnerx.js', 'utf8'), D = JSON.parse(src.slice(src.indexOf('winnerx = ') + 10, src.lastIndexOf(';')));
const pos = new Int16Array(new Uint8Array(Buffer.from(D.pos, 'base64')).buffer), n = pos.length / 3;
const V = i => [pos[i * 3] / D.q, pos[i * 3 + 1] / D.q, pos[i * 3 + 2] / D.q];
const s = 1.278 / 1.23, oy = -0.0403, oz = -0.0322, G = p => [p[0] * s, p[1] * s + oy, p[2] * s + oz].map(v => v.toFixed(3));
// widest point per side in z slabs at peg height
for (let z = -0.3; z <= 0.05; z += 0.05) {
  for (const sd of [1, -1]) {
    let best = null;
    for (let i = 0; i < n; i++) { const p = V(i); if (p[2] < z || p[2] >= z + 0.05 || p[1] < 0.2 || p[1] > 0.34 || Math.sign(p[0]) !== sd) continue; if (!best || Math.abs(p[0]) > Math.abs(best[0])) best = p; }
    if (best) console.log('peg slab z', z.toFixed(2), sd > 0 ? 'L' : 'R', 'mesh', best.map(v => v.toFixed(3)).join(','), 'game', G(best).join(','));
  }
}
// seat top profile along the centre line
for (let z = -0.5; z <= 0.1; z += 0.05) {
  let top = null; for (let i = 0; i < n; i++) { const p = V(i); if (Math.abs(p[0]) > 0.04 || Math.abs(p[2] - z) > 0.02) continue; if (!top || p[1] > top[1]) top = p; }
  if (top) console.log('seat z', z.toFixed(2), 'top y', top[1].toFixed(3), 'game', G(top).join(','));
}
// grips: outermost points at bar height
for (const sd of [1, -1]) {
  let best = null; for (let i = 0; i < n; i++) { const p = V(i); if (p[1] < 0.95 || p[1] > 1.1 || p[2] < 0.1 || p[2] > 0.35 || Math.sign(p[0]) !== sd) continue; if (!best || Math.abs(p[0]) > Math.abs(best[0])) best = p; }
  console.log('bar end', sd > 0 ? 'L' : 'R', 'mesh', best.map(v => v.toFixed(3)).join(','), 'game', G(best).join(','));
}
// shroud half-width at knee height
for (const y of [0.6, 0.7]) { let w = 0; for (let i = 0; i < n; i++) { const p = V(i); if (Math.abs(p[1] - y) < 0.02 && p[2] > -0.1 && p[2] < 0.3) w = Math.max(w, Math.abs(p[0])); } console.log('half width at y', y, w.toFixed(3)); }
