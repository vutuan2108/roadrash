// Authored multi-part .glb -> packed HB_GLB data with one mesh per colour category. Each part is welded (positions
// only; normals are rebuilt in the game with a crease angle), simplified with meshoptimizer to an absolute error,
// and appended to its category. usage: node build_multi.js cfg.js [err]
const fs = require('fs'), path = require('path');
const { load } = require('./glbfull');
const { MeshoptSimplifier } = require('F:/hb_tmp/nodetools/node_modules/meshoptimizer');
const C = require(path.resolve(process.argv[2])), ERR = +(process.argv[3] || C.err || 0.0012);
(async () => {
  await MeshoptSimplifier.ready;
  const { parts } = load(C.glb, C.s, C.frame);
  const catOf = new Map(); for (const [k, ids] of Object.entries(C.cats)) for (const id of ids) catOf.set(id, k);
  const Q = 16000, b64 = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
  const level = ERR => {
  const groups = {}; let before = 0, after = 0;
  for (const p of parts) {
    const cat = catOf.get(p.id) || 'other'; if (cat === 'drop') continue;
    // weld by position (0.05 mm)
    const map = new Map(), P = [], remap = new Uint32Array(p.P.length / 3);
    for (let i = 0; i < remap.length; i++) {
      const k = Math.round(p.P[i * 3] * 20000) + ',' + Math.round(p.P[i * 3 + 1] * 20000) + ',' + Math.round(p.P[i * 3 + 2] * 20000);
      let j = map.get(k); if (j === undefined) { j = P.length / 3; map.set(k, j); P.push(p.P[i * 3], p.P[i * 3 + 1], p.P[i * 3 + 2]); } remap[i] = j;
    }
    let I = Uint32Array.from(p.I, i => remap[i]);
    I = Uint32Array.from((function* () { for (let t = 0; t < I.length; t += 3) if (I[t] !== I[t + 1] && I[t + 1] !== I[t + 2] && I[t] !== I[t + 2]) yield* [I[t], I[t + 1], I[t + 2]]; })());
    const Pf = new Float32Array(P);
    let out = I;
    if (I.length > 300) [out] = MeshoptSimplifier.simplify(I, Pf, 3, Math.max(36, Math.floor(I.length * 0.01 / 3) * 3), ERR, ['ErrorAbsolute']);
    before += p.tris; after += out.length / 3;
    const g = groups[cat] || (groups[cat] = { P: [], I: [] }), base = g.P.length / 3;
    // compact the part's used vertices
    const used = new Map();
    for (const i of out) { let j = used.get(i); if (j === undefined) { j = base + used.size; used.set(i, j); g.P.push(Pf[i * 3], Pf[i * 3 + 1], Pf[i * 3 + 2]); } g.I.push(j); }
  }
  console.log('tris', before, '->', after, 'err', ERR);
  const out = [];
  for (const [cat, g] of Object.entries(groups)) {
    const pq = Int16Array.from(g.P, v => Math.round(v * Q)), nv = g.P.length / 3;
    const iq = nv < 65536 ? Uint16Array.from(g.I) : Uint32Array.from(g.I);
    out.push({ cat, n32: nv >= 65536 ? 1 : 0, pos: b64(pq), idx: b64(iq) });
    if (process.env.VERBOSE) console.log(' ', cat.padEnd(12), 'verts', nv, 'tris', g.I.length / 3);
  }
  return out;
  };
  // full detail, plus a coarse level for bikes in the distance (C.errLo)
  let data = { q: Q, groups: level(ERR) };
  if (C.errLo) data.lo = level(C.errLo);
  if (C.cls && fs.existsSync(C.cls)) { const cls = JSON.parse(fs.readFileSync(C.cls, 'utf8')); Object.assign(data, { k: cls.k, c: cls.c, crop: cls.crop, rle: cls.rle, boxes: cls.boxes || [] }); }
  else { const TW = 64, TH = 32, runs = []; for (let y = 0; y < TH; y++) runs.push(((1 << 12) | TW) >> 8, ((1 << 12) | TW) & 255);
    Object.assign(data, { k: [TW / 2.2, 0], c: [TW / 2, TH], crop: { CX: 0, CY: 0, SC: 1, TW, TH }, rle: Buffer.from(runs).toString('base64'), boxes: [] }); }
  fs.writeFileSync(C.out, (C.header || '') + 'window.HB_GLB = window.HB_GLB || {};\nHB_GLB.' + C.name + ' = ' + JSON.stringify(data) + ';\n');
  console.log('wrote', C.out, fs.statSync(C.out).size, 'bytes');
})().catch(e => { console.error(e); process.exit(1); });
