// Runtime for packed mesh bodies (HB_GLB), same code as models.js glbBody/glbMaterial (kept in step by hand):
// geometry with side-projection UVs + a livery texture whose alpha marks the paint.
const GLBRT = (() => {
  const LIV = ['#151517', '#c8121f', '#1c3d9e', '#2f93e0', '#eeeeee', '#151517', '#3a3b3e', '#b8bcc2', '#c9a22a', '#151517'];
  function decode(T, D) {
    const bin = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
    const pos = new Int16Array(bin(D.pos)), idx = new Uint16Array(bin(D.idx)), n = pos.length / 3, P = new Float32Array(n * 3);
    for (let i = 0; i < pos.length; i++) P[i] = pos[i] / D.q;
    const UV = new Float32Array(n * 2), [kr, ki] = D.k, [cr, ci] = D.c, { CX, CY, SC, TW, TH } = D.crop;
    for (let i = 0; i < n; i++) {
      const z = P[i * 3 + 2], y = -P[i * 3 + 1];
      UV[i * 2] = (kr * z - ki * y + cr - CX) * SC / TW; UV[i * 2 + 1] = (kr * y + ki * z + ci - CY) * SC / TH;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('uv', new T.BufferAttribute(UV, 2));
    g.setIndex(new T.BufferAttribute(idx, 1)); g.computeVertexNormals();
    const N = g.attributes.normal.array, nb = new Array(n);
    for (let i = 0; i < n; i++) nb[i] = [];
    for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) { const a = idx[t + e], b = idx[t + (e + 1) % 3]; nb[a].push(b); nb[b].push(a); }
    for (let it = 0; it < 2; it++) {
      const S = N.slice();
      for (let i = 0; i < n; i++) {
        let x = S[i * 3] * 2, y = S[i * 3 + 1] * 2, z = S[i * 3 + 2] * 2;
        for (const j of nb[i]) if (S[i * 3] * S[j * 3] + S[i * 3 + 1] * S[j * 3 + 1] + S[i * 3 + 2] * S[j * 3 + 2] > 0.3) { x += S[j * 3]; y += S[j * 3 + 1]; z += S[j * 3 + 2]; }
        const l = Math.hypot(x, y, z) || 1; N[i * 3] = x / l; N[i * 3 + 1] = y / l; N[i * 3 + 2] = z / l;
      }
    }
    const rle = new Uint8Array(bin(D.rle)), px = new Uint8Array(TW * TH * 4), c = new T.Color();
    const sc = LIV.map(h => { c.set(h).convertLinearToSRGB(); return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)]; });
    for (let i = 0, o = 0; i < rle.length; i += 2) {
      const w = (rle[i] << 8) | rle[i + 1], k = w >> 12, e = o + (w & 4095), s = sc[k], a = k === 1 ? 0 : 255;
      for (; o < e; o++) { px[o * 4] = s[0]; px[o * 4 + 1] = s[1]; px[o * 4 + 2] = s[2]; px[o * 4 + 3] = a; }
    }
    const tx = new T.DataTexture(px, TW, TH);
    tx.encoding = T.sRGBEncoding; tx.generateMipmaps = true; tx.minFilter = T.LinearMipmapLinearFilter; tx.magFilter = T.LinearFilter;
    tx.anisotropy = 8; tx.needsUpdate = true;
    return { g, tx };
  }
  // xf: mesh -> model { s, ox, oy, oz }; sh: what a side view cannot show, in centred mesh units:
  // mask { z0, y0, y1, xw, led: { y, slope, x0, x1 } } on forward-facing faces, seat { z0, z1, y0 } on upward faces,
  // tail { z1, y0, y1, ly } on rearward faces
  function material(T, tx, D, xf, sh) {
    const m = new T.MeshStandardMaterial({ vertexColors: true, map: tx, roughness: 0.32, metalness: 0.2 });
    const v3 = h => { const c = new T.Color(h); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; };
    const nb = D.boxes.length, f = v => (+v).toFixed(5);
    const parts = [];
    if (sh.mask) { const k = sh.mask, L = k.led;
      parts.push(`float fm = smoothstep(0.38, 0.62, mn.z) * step(${f(k.z0)}, vMP.z) * step(${f(k.y0)}, vMP.y) * step(vMP.y, ${f(k.y1)}) * (1.0 - smoothstep(${f(k.xw)}, ${f(k.xw + 0.025)}, ax));`);
      parts.push(L ? `float led = step(${f(L.x0)}, ax) * step(ax, ${f(L.x1)}) * (1.0 - smoothstep(0.008, 0.013, abs(vMP.y - ${f(L.y)} - ${f(L.slope)} * (ax - ${f(L.x0)}))));` : 'float led = 0.0;');
      parts.push(`col = mix(col, mix(${v3('#0e0f12')}, ${v3('#eef4ff')}, led), fm);`); }
    if (sh.seat) { const k = sh.seat; parts.push(`col = mix(col, ${v3('#131315')}, smoothstep(0.55, 0.8, mn.y) * step(${f(k.z0)}, vMP.z) * step(vMP.z, ${f(k.z1)}) * step(${f(k.y0)}, vMP.y));`); }
    if (sh.bars) { const k = sh.bars; parts.push(`col = mix(col, ${v3('#141416')}, step(${f(k.x)}, ax) * step(${f(k.y0)}, vMP.y) * step(${f(k.z0)}, vMP.z));`); }
    if (sh.tail) { const k = sh.tail;
      parts.push(`float tl = smoothstep(-0.38, -0.62, mn.z) * step(vMP.z, ${f(k.z1)}) * step(${f(k.y0)}, vMP.y) * step(vMP.y, ${f(k.y1)}) * step(ax, ${f(k.xw || 1)});`);
      parts.push(`col = mix(col, mix(${v3('#5a0606')}, ${v3('#ff2a14')}, 1.0 - smoothstep(0.008, 0.012, abs(vMP.y - ${f(k.ly)}))), tl);`); }
    m.onBeforeCompile = (s, ren) => {
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMP;\nvarying vec3 vMN;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\nvMP = vec3(position.x, position.y - ${f(xf.oy)}, position.z - ${f(xf.oz)}) / ${f(xf.s)};\nvMN = normal;`);
      const grad = ren && ren.capabilities && ren.capabilities.isWebGL2 && nb > 0;
      s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vMP;
varying vec3 vMN;
${grad ? `const vec4 BX[${nb}] = vec4[${nb}](${D.boxes.map(b => `vec4(${b.slice(0, 4).map(f).join(', ')})`).join(', ')});
const vec2 BO[${nb}] = vec2[${nb}](${D.boxes.map(b => `vec2(${f(b[4])}, ${f(b[5])})`).join(', ')});` : ''}`)
        .replace('#include <map_fragment>', `
  vec2 luv = vUv;
  ${grad ? `if (vMP.x > 0.0) for (int i = 0; i < ${nb}; i++) if (luv.x >= BX[i].x && luv.y >= BX[i].y && luv.x < BX[i].z && luv.y < BX[i].w) luv += BO[i];
  vec4 lv = textureGrad(map, luv, dFdx(vUv), dFdy(vUv));` : 'vec4 lv = texture2D(map, luv);'}
  vec3 col = mix(vColor, lv.rgb, lv.a);
  vec3 mn = normalize(vMN);
  float ax = abs(vMP.x);
  ${parts.join('\n  ')}
  diffuseColor.rgb = col;`)
        .replace('#include <color_fragment>', '');
    };
    m.customProgramCacheKey = () => 'glb|' + nb + '|' + xf.s + '|' + parts.length;
    return m;
  }
  return { decode, material };
})();
