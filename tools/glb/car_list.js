// Inventory of an authored car .glb by material: parts, triangles and where they sit (raw glTF units, node transforms
// applied). usage: node car_list.js file.glb [parts]   ("parts" also lists every part)
const { load } = require('./glbfull');
const { parts, json } = load(process.argv[2], 1, (x, y, z) => [x, y, z]);
const by = new Map();
for (const p of parts) {
  let m = by.get(p.mat); if (!m) by.set(p.mat, m = { n: 0, tris: 0, lo: [1e9, 1e9, 1e9], hi: [-1e9, -1e9, -1e9] });
  m.n++; m.tris += p.tris; for (let k = 0; k < 3; k++) { m.lo[k] = Math.min(m.lo[k], p.lo[k]); m.hi[k] = Math.max(m.hi[k], p.hi[k]); }
}
const f = v => (Math.abs(v) < 10 ? v.toFixed(3) : v.toFixed(1)).padStart(8);
let tot = 0;
for (const [mat, m] of [...by].sort((a, b) => a[0] - b[0])) {
  tot += m.tris;
  const mm = json.materials[mat] || {}, c = ((mm.pbrMetallicRoughness || {}).baseColorFactor || [1, 1, 1, 1]).map(v => v.toFixed(2)).join(',');
  console.log(`mat${String(mat).padEnd(3)} ${(mm.name || '').slice(0, 30).padEnd(30)} parts ${String(m.n).padStart(4)} tris ${String(m.tris).padStart(7)}  x${f(m.lo[0])}${f(m.hi[0])}  y${f(m.lo[1])}${f(m.hi[1])}  z${f(m.lo[2])}${f(m.hi[2])}  [${c}]`);
}
console.log('total tris', tot, 'parts', parts.length);
if (process.argv[3] === 'parts') for (const p of parts) console.log(String(p.id).padStart(4), 'mat' + String(p.mat).padEnd(3), String(p.tris).padStart(6),
  'c', [0, 1, 2].map(k => f((p.lo[k] + p.hi[k]) / 2)).join(''), 's', [0, 1, 2].map(k => f(p.hi[k] - p.lo[k])).join(''), (p.name || '').slice(0, 50));
