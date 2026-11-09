// Load an authored multi-mesh .glb into parts in the game frame (x = left, y = up, z = forward, metres):
// { id, mesh, name, mat, matName, P: Float32Array, N: Float32Array, I: Uint32Array, lo, hi, tris }
// frame(x, y, z) maps glTF coordinates to the game frame (before scale s).
const fs = require('fs');
function load(file, s, frame) {
  const buf = fs.readFileSync(file);
  let off = 12, g, bin;
  while (off < buf.length) { const len = buf.readUInt32LE(off), type = buf.toString('ascii', off + 4, off + 8); const d = buf.subarray(off + 8, off + 8 + len);
    if (type.startsWith('JSON')) g = JSON.parse(d.toString('utf8')); else bin = d; off += 8 + len; }
  const CT = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }, NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const acc = i => { const a = g.accessors[i], bv = g.bufferViews[a.bufferView], o = bin.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0), C = CT[a.componentType];
    return new C(bin.buffer.slice(o, o + a.count * NC[a.type] * C.BYTES_PER_ELEMENT)); };
  const mul = (a, b) => { const r = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return r; };
  const compose = n => { if (n.matrix) return n.matrix; const t = n.translation || [0, 0, 0], q = n.rotation || [0, 0, 0, 1], sc = n.scale || [1, 1, 1], [x, y, z, w] = q;
    return [(1 - 2 * (y * y + z * z)) * sc[0], 2 * (x * y + z * w) * sc[0], 2 * (x * z - y * w) * sc[0], 0, 2 * (x * y - z * w) * sc[1], (1 - 2 * (x * x + z * z)) * sc[1], 2 * (y * z + x * w) * sc[1], 0,
      2 * (x * z + y * w) * sc[2], 2 * (y * z - x * w) * sc[2], (1 - 2 * (x * x + y * y)) * sc[2], 0, t[0], t[1], t[2], 1]; };
  const parts = [];
  const walk = (ni, M) => { const n = g.nodes[ni], W = mul(M, compose(n));
    if (n.mesh !== undefined) g.meshes[n.mesh].primitives.forEach((p, pi) => {
      const src = acc(p.attributes.POSITION), nsrc = p.attributes.NORMAL !== undefined ? acc(p.attributes.NORMAL) : null, nv = src.length / 3;
      const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      for (let i = 0; i < nv; i++) {
        const x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2];
        const w = [W[0] * x + W[4] * y + W[8] * z + W[12], W[1] * x + W[5] * y + W[9] * z + W[13], W[2] * x + W[6] * y + W[10] * z + W[14]];
        const q = frame(w[0], w[1], w[2]);
        for (let k = 0; k < 3; k++) { P[i * 3 + k] = q[k] * s; lo[k] = Math.min(lo[k], P[i * 3 + k]); hi[k] = Math.max(hi[k], P[i * 3 + k]); }
        if (nsrc) { const a = nsrc[i * 3], b = nsrc[i * 3 + 1], c = nsrc[i * 3 + 2];
          const m = [W[0] * a + W[4] * b + W[8] * c, W[1] * a + W[5] * b + W[9] * c, W[2] * a + W[6] * b + W[10] * c], r = frame(m[0], m[1], m[2]), l = Math.hypot(...r) || 1;
          N[i * 3] = r[0] / l; N[i * 3 + 1] = r[1] / l; N[i * 3 + 2] = r[2] / l; }
      }
      const I = p.indices !== undefined ? Uint32Array.from(acc(p.indices)) : Uint32Array.from({ length: nv }, (_, i) => i);
      parts.push({ id: parts.length, mesh: n.mesh, prim: pi, name: g.meshes[n.mesh].name || n.name, mat: p.material, matName: (g.materials[p.material] || {}).name, P, N, I, lo, hi, tris: I.length / 3 });
    });
    (n.children || []).forEach(c => walk(c, W)); };
  const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const sc of g.scenes) sc.nodes.forEach(i => walk(i, I4));
  return { parts, json: g };
}
module.exports = { load };
