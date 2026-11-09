// Detailed .glb summary for authored models: asset info/licence, extensions, scene tree (with world bounds per mesh),
// materials (colour, textures), images, triangle counts
const fs = require('fs');
const buf = fs.readFileSync(process.argv[2]);
let off = 12, g, bin;
while (off < buf.length) { const len = buf.readUInt32LE(off), type = buf.toString('ascii', off + 4, off + 8); const d = buf.subarray(off + 8, off + 8 + len);
  if (type.startsWith('JSON')) g = JSON.parse(d.toString('utf8')); else bin = d; off += 8 + len; }
console.log('asset', JSON.stringify(g.asset));
if (g.extras) console.log('extras', JSON.stringify(g.extras).slice(0, 600));
console.log('extensionsUsed', g.extensionsUsed || [], 'required', g.extensionsRequired || []);
console.log('counts', ['scenes', 'nodes', 'meshes', 'materials', 'textures', 'images', 'samplers', 'accessors', 'bufferViews', 'animations', 'skins'].map(k => k + '=' + (g[k] ? g[k].length : 0)).join(' '));
// materials
(g.materials || []).forEach((m, i) => { const p = m.pbrMetallicRoughness || {};
  console.log(`mat#${i} "${m.name || ''}" base ${JSON.stringify((p.baseColorFactor || [1, 1, 1, 1]).map(v => +v.toFixed(3)))} tex ${p.baseColorTexture ? p.baseColorTexture.index : '-'} mr ${p.metallicFactor ?? 1}/${p.roughnessFactor ?? 1}${p.metallicRoughnessTexture ? ' mrTex' : ''}${m.normalTexture ? ' normal' : ''}${m.emissiveTexture ? ' emisTex' : ''}${m.emissiveFactor ? ' emis ' + JSON.stringify(m.emissiveFactor) : ''} ${m.alphaMode || ''}${m.doubleSided ? ' 2side' : ''}${m.extensions ? ' ext ' + Object.keys(m.extensions) : ''}`); });
(g.images || []).forEach((im, i) => { const bv = im.bufferView !== undefined ? g.bufferViews[im.bufferView] : null; let dim = '';
  if (bv) { const b = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    if (b[0] === 0x89) dim = b.readUInt32BE(16) + 'x' + b.readUInt32BE(20);
    else if (b[0] === 0xff) { let o = 2; while (o < b.length) { const mk = b[o + 1], ln = b.readUInt16BE(o + 2); if (mk >= 0xc0 && mk <= 0xc2) { dim = b.readUInt16BE(o + 7) + 'x' + b.readUInt16BE(o + 5); break; } o += 2 + ln; } } }
  console.log(`img#${i} "${im.name || ''}" ${im.mimeType || im.uri} ${bv ? (bv.byteLength / 1024).toFixed(0) + 'KB' : ''} ${dim}`); });
// node tree with world transforms
const T = require('path'); const mul = (a, b) => { const r = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return r; };
const compose = n => { if (n.matrix) return n.matrix; const t = n.translation || [0, 0, 0], q = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1];
  const [x, y, z, w] = q; return [(1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0, 2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0, 2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0, t[0], t[1], t[2], 1]; };
let totalTris = 0; const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; const lines = [];
const walk = (i, M, d) => { const n = g.nodes[i], W = mul(M, compose(n)); let info = '';
  if (n.mesh !== undefined) { const me = g.meshes[n.mesh]; let tris = 0; const bl = [1e9, 1e9, 1e9], bh = [-1e9, -1e9, -1e9];
    for (const p of me.primitives) { const a = g.accessors[p.attributes.POSITION]; tris += (p.indices !== undefined ? g.accessors[p.indices].count : a.count) / 3;
      if (a.min) for (let cx = 0; cx < 2; cx++) for (let cy = 0; cy < 2; cy++) for (let cz = 0; cz < 2; cz++) { const v = [cx ? a.max[0] : a.min[0], cy ? a.max[1] : a.min[1], cz ? a.max[2] : a.min[2]];
        const w = [0, 1, 2].map(k => W[k] * v[0] + W[4 + k] * v[1] + W[8 + k] * v[2] + W[12 + k]); for (let k = 0; k < 3; k++) { bl[k] = Math.min(bl[k], w[k]); bh[k] = Math.max(bh[k], w[k]); lo[k] = Math.min(lo[k], w[k]); hi[k] = Math.max(hi[k], w[k]); } } }
    totalTris += tris; info = ` mesh#${n.mesh} "${me.name || ''}" tris ${tris} prims ${me.primitives.length} mats ${me.primitives.map(p => p.material).join(',')} bounds ${bl.map(v => v.toFixed(2))}..${bh.map(v => v.toFixed(2))}`; }
  lines.push('  '.repeat(d) + '- ' + (n.name || 'node' + i) + info);
  (n.children || []).forEach(c => walk(c, W, d + 1)); };
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
for (const s of g.scenes) s.nodes.forEach(i => walk(i, I, 0));
console.log(lines.slice(0, +(process.argv[3] || 80)).join('\n')); if (lines.length > (+(process.argv[3] || 80))) console.log('... nodes', lines.length);
console.log('TOTAL tris', totalTris, 'world bounds', lo.map(v => v.toFixed(3)), hi.map(v => v.toFixed(3)));
