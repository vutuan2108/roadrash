// Measure the Winner X mesh in the game frame: ground, tyre circles, widths, handlebar, seat
const { load } = require('./glbmesh');
const M = load(process.argv[2]);
const { P, nv } = M;
const X = i => P[i * 3], Y = i => P[i * 3 + 1], Z = i => P[i * 3 + 2];
let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i * 3 + k]); mx[k] = Math.max(mx[k], P[i * 3 + k]); }
console.log('bounds x', mn[0].toFixed(3), mx[0].toFixed(3), 'y', mn[1].toFixed(3), mx[1].toFixed(3), 'z', mn[2].toFixed(3), mx[2].toFixed(3));

// circle fit (Kasa) on points [[z,y]]
function fit(pts) {
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0; const n = pts.length;
  for (const [x, y] of pts) { const z = x * x + y * y; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z; }
  // solve [sxx sxy sx; sxy syy sy; sx sy n] [a b c] = [sxz syz sz]
  const A = [[sxx, sxy, sx, sxz], [sxy, syy, sy, syz], [sx, sy, n, sz]];
  for (let c = 0; c < 3; c++) { let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 3; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 4; k++) A[r][k] -= f * A[c][k]; } }
  const a = A[0][3] / A[0][0], b = A[1][3] / A[1][1], c = A[2][3] / A[2][2];
  const cz = a / 2, cy = b / 2; return { cz, cy, r: Math.sqrt(c + cz * cz + cy * cy) };
}
// tyre: outermost slab points per angle bin over the lower half, around an iterated centre
function tyre(zlo, zhi, slab) {
  const pts = []; for (let i = 0; i < nv; i++) if (Z(i) > zlo && Z(i) < zhi && Math.abs(X(i)) < slab) pts.push([Z(i), Y(i), X(i)]);
  let c = { cz: (zlo + zhi) / 2, cy: 0.3, r: 0.3 };
  for (let it = 0; it < 8; it++) {
    const bins = new Map();
    for (const [z, y] of pts) {
      const a = Math.atan2(y - c.cy, z - c.cz); if (a > -0.15 || a < -Math.PI + 0.15) continue;   // lower half only
      const r = Math.hypot(z - c.cz, y - c.cy), b = Math.floor(a / 0.05);
      if (!bins.has(b) || bins.get(b)[2] < r) bins.set(b, [z, y, r]);
    }
    const out = [...bins.values()]; c = fit(out);
  }
  // width: z-extent of points close to the tread
  let xs = []; for (const [z, y, x] of pts) { const r = Math.hypot(z - c.cz, y - c.cy); if (r > c.r - 0.02 && r < c.r + 0.01 && y < c.cy) xs.push(x); }
  xs.sort((a, b) => a - b);
  const q = f => xs[Math.floor(f * (xs.length - 1))];
  return { ...c, n: pts.length, tread: xs.length, x05: q(0.02), x50: q(0.5), x95: q(0.98) };
}
const ground = mn[1];
const F = tyre(0.25, 1.2, 0.08), R = tyre(-1.2, -0.25, 0.1);
const show = (k, t) => console.log(k, 'centre z', t.cz.toFixed(3), 'y', (t.cy - ground).toFixed(3), 'r', t.r.toFixed(3), 'bottom', (t.cy - t.r - ground).toFixed(3),
  'tread x', t.x05.toFixed(3), t.x50.toFixed(3), t.x95.toFixed(3), 'pts', t.n, t.tread);
show('front', F); show('rear ', R);
console.log('wheelbase', (F.cz - R.cz).toFixed(3), 'ground', ground.toFixed(3));
// widest points (grips / mirrors), seat top, footpegs
const top = (pred) => { let b = -1; for (let i = 0; i < nv; i++) if (pred(i) && (b < 0 || Y(i) > Y(b))) b = i; return b; };
const wide = (pred) => { let b = -1; for (let i = 0; i < nv; i++) if (pred(i) && (b < 0 || Math.abs(X(i)) > Math.abs(X(b)))) b = i; return b; };
const pr = (k, i) => console.log(k, 'x', X(i).toFixed(3), 'y', (Y(i) - ground).toFixed(3), 'z', Z(i).toFixed(3));
for (const s of [1, -1]) pr('grip end ' + (s > 0 ? 'L' : 'R'), wide(i => Math.sign(X(i)) === s && Y(i) - ground > 0.8 && Y(i) - ground < 1.05 && Z(i) > 0.1 && Z(i) < 0.6));
for (const s of [1, -1]) pr('mirror top ' + (s > 0 ? 'L' : 'R'), top(i => Math.sign(X(i)) === s && Math.abs(X(i)) > 0.15));
for (let z = -0.8; z <= 0.65; z += 0.1) { const i = top(j => Math.abs(Z(j) - z) < 0.03 && Math.abs(X(j)) < 0.05); if (i >= 0) pr('top @z' + z.toFixed(2), i); }
for (const s of [1, -1]) pr('peg ' + (s > 0 ? 'L' : 'R'), wide(i => Math.sign(X(i)) === s && Y(i) - ground > 0.2 && Y(i) - ground < 0.42 && Z(i) > -0.4 && Z(i) < 0.1));
for (const s of [1, -1]) pr('widest low ' + (s > 0 ? 'L' : 'R'), wide(i => Math.sign(X(i)) === s && Y(i) - ground < 0.6));
