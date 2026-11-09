// Load the POSITION + indices of a single-mesh .glb, converted to the game's bike frame:
// game x = -mesh z (x = left side), game y = mesh y, game z = mesh x (forward). Node transforms are identity here.
const fs = require('fs');
function load(file) {
  const buf = fs.readFileSync(file);
  let off = 12, json, bin;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off), type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type.startsWith('JSON')) json = JSON.parse(data.toString('utf8')); else bin = data;
    off += 8 + len;
  }
  const p = json.meshes[0].primitives[0];
  const acc = i => {
    const a = json.accessors[i], bv = json.bufferViews[a.bufferView], o = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const n = a.count * ({ SCALAR: 1, VEC3: 3 })[a.type];
    const ab = bin.buffer.slice(bin.byteOffset + o, bin.byteOffset + o + n * (a.componentType === 5126 || a.componentType === 5125 ? 4 : 2));
    return a.componentType === 5126 ? new Float32Array(ab) : a.componentType === 5125 ? new Uint32Array(ab) : new Uint16Array(ab);
  };
  const P0 = acc(p.attributes.POSITION), I = Array.from(acc(p.indices));
  const nv = P0.length / 3, P = new Float64Array(nv * 3);
  for (let i = 0; i < nv; i++) { P[i * 3] = -P0[i * 3 + 2]; P[i * 3 + 1] = P0[i * 3 + 1]; P[i * 3 + 2] = P0[i * 3]; }
  return { P, I, nv, nt: I.length / 3 };
}
module.exports = { load };
