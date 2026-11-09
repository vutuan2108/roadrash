// per material: primitives, triangles, attributes present, world bounds (glTF frame)
const fs = require('fs');
const buf = fs.readFileSync(process.argv[2]);
let off = 12, g; while (off < buf.length) { const len = buf.readUInt32LE(off), type = buf.toString('ascii', off + 4, off + 8); if (type.startsWith('JSON')) g = JSON.parse(buf.subarray(off + 8, off + 8 + len).toString('utf8')); off += 8 + len; }
const attrs = new Map(), per = new Map();
for (const me of g.meshes) for (const p of me.primitives) {
  const k = Object.keys(p.attributes).sort().join('/'); attrs.set(k, (attrs.get(k) || 0) + 1);
  const m = p.material, e = per.get(m) || { prims: 0, tris: 0 }; e.prims++; e.tris += (p.indices !== undefined ? g.accessors[p.indices].count : g.accessors[p.attributes.POSITION].count) / 3; per.set(m, e);
}
console.log('attribute sets', [...attrs.entries()]);
for (const [m, e] of [...per.entries()].sort((a, b) => a[0] - b[0])) console.log('mat', m, (g.materials[m] || {}).name, 'prims', e.prims, 'tris', e.tris);
console.log('bufferViews', g.bufferViews.map(b => b.byteLength).join(','), 'componentTypes', [...new Set(g.accessors.map(a => a.componentType))]);
