// Read a .glb (binary glTF 2.0) and summarise it: header, scene tree, meshes, materials, bounds.
const fs = require('fs');
const file = process.argv[2];
const buf = fs.readFileSync(file);
const magic = buf.toString('ascii', 0, 4), version = buf.readUInt32LE(4), total = buf.readUInt32LE(8);
console.log('file', file, 'size', buf.length, 'magic', magic, 'version', version, 'declared', total);
let off = 12, json = null, bin = null;
while (off < buf.length) {
  const len = buf.readUInt32LE(off), type = buf.toString('ascii', off + 4, off + 8);
  const data = buf.subarray(off + 8, off + 8 + len);
  if (type.startsWith('JSON')) json = JSON.parse(data.toString('utf8'));
  else bin = data;
  console.log('chunk', JSON.stringify(type), len);
  off += 8 + len;
}
const g = json;
console.log('asset', JSON.stringify(g.asset));
console.log('extensionsUsed', g.extensionsUsed || [], 'required', g.extensionsRequired || []);
console.log('counts', ['scenes', 'nodes', 'meshes', 'materials', 'textures', 'images', 'accessors', 'bufferViews', 'animations', 'skins', 'cameras']
  .map(k => k + '=' + (g[k] ? g[k].length : 0)).join(' '));

// scene tree
const tree = (i, d) => {
  const n = g.nodes[i];
  const bits = [];
  if (n.mesh !== undefined) bits.push('mesh#' + n.mesh + ' ' + (g.meshes[n.mesh].name || ''));
  if (n.translation) bits.push('t=' + n.translation.map(v => v.toFixed(3)).join(','));
  if (n.rotation) bits.push('r=' + n.rotation.map(v => v.toFixed(3)).join(','));
  if (n.scale) bits.push('s=' + n.scale.map(v => v.toFixed(3)).join(','));
  if (n.matrix) bits.push('matrix');
  console.log('  '.repeat(d) + '- ' + (n.name || ('node' + i)) + '  ' + bits.join('  '));
  (n.children || []).forEach(c => tree(c, d + 1));
};
(g.scenes || []).forEach((s, si) => { console.log('scene', si, s.name || ''); (s.nodes || []).forEach(i => tree(i, 1)); });

// meshes
let tris = 0, verts = 0;
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
(g.meshes || []).forEach((m, mi) => {
  m.primitives.forEach((p, pi) => {
    const pos = g.accessors[p.attributes.POSITION];
    const nIdx = p.indices !== undefined ? g.accessors[p.indices].count : pos.count;
    const mode = p.mode === undefined ? 4 : p.mode;
    const t = mode === 4 ? nIdx / 3 : 0;
    tris += t; verts += pos.count;
    if (pos.min) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], pos.min[k]); hi[k] = Math.max(hi[k], pos.max[k]); }
    console.log(`mesh#${mi} ${m.name || ''} prim${pi}: verts ${pos.count} tris ${t} mode ${mode} attrs ${Object.keys(p.attributes).join('/')} mat ${p.material}` +
      (p.extensions ? ' ext ' + Object.keys(p.extensions).join(',') : '') + (pos.min ? ` min ${pos.min.map(v => v.toFixed(3))} max ${pos.max.map(v => v.toFixed(3))}` : ''));
  });
});
console.log('TOTAL verts', verts, 'tris', tris);
console.log('local bounds (mesh space, before node transforms) min', lo.map(v => v.toFixed(3)), 'max', hi.map(v => v.toFixed(3)));
(g.materials || []).forEach((m, i) => {
  const pbr = m.pbrMetallicRoughness || {};
  console.log(`material#${i} ${m.name || ''} base ${JSON.stringify(pbr.baseColorFactor || null)} tex ${pbr.baseColorTexture ? 'yes' : 'no'} metal ${pbr.metallicFactor} rough ${pbr.roughnessFactor}` +
    (m.extensions ? ' ext ' + Object.keys(m.extensions).join(',') : ''));
});
(g.images || []).forEach((im, i) => console.log(`image#${i} ${im.name || ''} ${im.mimeType || ''} ${im.uri ? 'uri ' + im.uri.slice(0, 40) : 'bufferView ' + im.bufferView + ' bytes ' + (g.bufferViews[im.bufferView] || {}).byteLength}`));
