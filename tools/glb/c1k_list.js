// inventory of the CBR1000RR parts in the game frame (x left, y up, z forward; scale 0.59 for now)
const { load } = require('./glbfull');
const S = +(process.argv[3] || 0.59);
const { parts } = load(process.argv[2], S, (x, y, z) => [z, y, -x]);
const f = v => v.toFixed(2).padStart(5);
for (const p of parts) console.log(String(p.id).padStart(3), 'm' + String(p.mesh).padEnd(3), 'mat' + String(p.mat).padEnd(2), String(p.tris).padStart(6), 'x', f(p.lo[0]), f(p.hi[0]), 'y', f(p.lo[1]), f(p.hi[1]), 'z', f(p.lo[2]), f(p.hi[2]), (p.matName || '').slice(0, 14));
