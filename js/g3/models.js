'use strict';
// ============ 3D models built from primitives: riders on motorbikes, cars, roadside props ============
// Model space: +Z forward, +Y up, +X = left side (right = -X). Units: metres. Origin on the ground.
const Models = (() => {
  const T = THREE, { Mesher, lin, mix, mul } = G3;
  const v3 = (x, y, z) => new T.Vector3(x, y, z);
  const _q = new T.Quaternion(), _e = new T.Euler(), _s = new T.Vector3(), _p = new T.Vector3(), _d = new T.Vector3(), _up = new T.Vector3(0, 1, 0);
  function M4(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    return new T.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
  }
  // unit-height, Y-centred geometry stretched from a to b; rx/rz = cross-section scale
  function link(a, b, rx, rz = rx, out) {
    _d.copy(b).sub(a); const len = _d.length() || 1e-4;
    _q.setFromUnitVectors(_up, _d.multiplyScalar(1 / len));
    return (out || new T.Matrix4()).compose(_p.copy(a).add(b).multiplyScalar(0.5), _q, _s.set(rx, len, rz));
  }
  const GEO = {
    cyl: new T.CylinderGeometry(1, 1, 1, 10), cyl6: new T.CylinderGeometry(1, 1, 1, 6), cyl16: new T.CylinderGeometry(1, 1, 1, 18),
    sph: new T.SphereGeometry(1, 14, 10), sphLo: new T.SphereGeometry(1, 8, 6), box: new T.BoxGeometry(1, 1, 1),
    tire: new T.TorusGeometry(0.235, 0.068, 8, 22), cone: new T.ConeGeometry(1, 1, 8), ico: new T.IcosahedronGeometry(1, 1),
    ico0: new T.IcosahedronGeometry(1, 0), plane: new T.PlaneGeometry(1, 1),
  };
  const tapers = {};
  const taper = (bot, top, seg = 10) => tapers[bot + '|' + top + '|' + seg] || (tapers[bot + '|' + top + '|' + seg] = new T.CylinderGeometry(top, bot, 1, seg));

  // smooth the normals of a non-indexed geometry across faces that meet at less than `crease` degrees
  function soften(g, crease = 55) {
    const P = g.attributes.position.array, N = g.attributes.normal.array, n = P.length / 3, cos = Math.cos(crease * Math.PI / 180);
    const fn = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 3) {
      const ax = P[i * 3 + 3] - P[i * 3], ay = P[i * 3 + 4] - P[i * 3 + 1], az = P[i * 3 + 5] - P[i * 3 + 2];
      const bx = P[i * 3 + 6] - P[i * 3], by = P[i * 3 + 7] - P[i * 3 + 1], bz = P[i * 3 + 8] - P[i * 3 + 2];
      const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, l = Math.hypot(nx, ny, nz) || 1;
      for (let k = 0; k < 3; k++) { fn[(i + k) * 3] = nx / l; fn[(i + k) * 3 + 1] = ny / l; fn[(i + k) * 3 + 2] = nz / l; }
    }
    const groups = new Map(), key = i => Math.round(P[i * 3] * 2000) + ',' + Math.round(P[i * 3 + 1] * 2000) + ',' + Math.round(P[i * 3 + 2] * 2000);
    for (let i = 0; i < n; i++) { const k = key(i); let a = groups.get(k); if (!a) groups.set(k, a = []); a.push(i); }
    for (const a of groups.values()) for (const i of a) {
      let sx = 0, sy = 0, sz = 0;
      for (const j of a) {
        const d = fn[i * 3] * fn[j * 3] + fn[i * 3 + 1] * fn[j * 3 + 1] + fn[i * 3 + 2] * fn[j * 3 + 2];
        if (d >= cos) { sx += fn[j * 3]; sy += fn[j * 3 + 1]; sz += fn[j * 3 + 2]; }
      }
      const l = Math.hypot(sx, sy, sz) || 1; N[i * 3] = sx / l; N[i * 3 + 1] = sy / l; N[i * 3 + 2] = sz / l;
    }
    return g;
  }
  // side profile (z, y) extruded across x, centred; bevel rounds the edges
  function prof(pts, width, bevel = 0.03, smooth = false, crease = 50) {
    const sh = new T.Shape();
    sh.moveTo(pts[0][0], pts[0][1]);
    if (smooth) sh.splineThru(pts.slice(1).concat([pts[0]]).map(p => new T.Vector2(p[0], p[1])));
    else for (const p of pts.slice(1)) sh.lineTo(p[0], p[1]);
    const g = new T.ExtrudeGeometry(sh, { depth: width, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.85,
      bevelSegments: 2, curveSegments: smooth ? 3 : 1, steps: 1 });
    g.applyMatrix4(new T.Matrix4().makeRotationY(-Math.PI / 2));
    g.translate(width / 2, 0, 0);
    return soften(g, crease);
  }
  const profCache = {};
  const P = (k, f) => profCache[k] || (profCache[k] = f());

  // =====================================================================================
  // Motorbikes — real 600–1000 cc proportions: wheelbase 1.41 m, 120/70-17 front and 190/55-17 rear tyres,
  // ~22° rake, seat at 0.85 m, forward-inclined inline-four, upside-down fork, twin 320 mm floating discs with
  // radial calipers. The bodywork is made like the real thing: separate glossy panels with crisp edges laid over
  // black inner panels (so panel gaps, vents and the frame read through), a livery accent and LED lights.
  // =====================================================================================
  const RUBBER = lin('#151517'), DARK = lin('#1e1f24'), METAL = lin('#5e626c'), ALU = lin('#aeb2ba'), CHROME = lin('#d4d8e0'),
    SEAT = lin('#141416'), CARBON = lin('#2a2b31'), GOLD = lin('#d6a02a'), BRAKE = lin('#c81e1e'), ENGINE = lin('#3a3c44');
  const BLACK = lin('#0e0f12'), PLASTIC = lin('#1a1b1f'), STEEL = lin('#b4b8c0'), TI = lin('#8f98a6'), LED_T = lin('#ff2a14'),
    LENS_T = lin('#5a0606'), LED_H = lin('#f4f8ff'), LENS_H = lin('#5e6878'), AMB = lin('#ff9a10'), SMOKE = lin('#0e141c'), TFT = lin('#4a8ae0');
  const FW = { z: 0.70, y: 0.30, r: 0.30, w: 0.12 }, RW = { z: -0.705, y: 0.32, r: 0.32, w: 0.19 };
  // 0 naked streetfighter, 1 supersport, 2 sport-tourer, 3 superbike
  const STYLE = [
    { hip: [0.95, -0.28], sh: [1.40, -0.03], head: [1.575, 0.06], grip: [1.035, 0.40], gripW: 0.37, knee: 0.235 },
    { hip: [0.95, -0.30], sh: [1.32, 0.12], head: [1.47, 0.26], grip: [0.93, 0.43], gripW: 0.30, knee: 0.215 },
    { hip: [0.96, -0.30], sh: [1.38, 0.04], head: [1.55, 0.15], grip: [0.99, 0.41], gripW: 0.33, knee: 0.23 },
    { hip: [0.96, -0.31], sh: [1.31, 0.13], head: [1.455, 0.27], grip: [0.92, 0.44], gripW: 0.29, knee: 0.21 },
  ];
  function posture(st) {
    const S = STYLE[st];
    return { hip: v3(0, ...S.hip), sh: v3(0, ...S.sh), head: v3(0, ...S.head), grip: v3(0, ...S.grip), gripW: S.gripW,
      kneeX: S.knee, knee: v3(0, 0.80, 0.10), ankle: v3(0, 0.47, -0.235), toe: v3(0, 0.405, -0.11) };
  }
  // tail / head lamp centres [y, z] per style (night glow sprites)
  const BIKE_LIGHTS = [[[0.965, -0.875], [0.928, 0.665]], [[0.99, -0.99], [0.85, 0.89]], [[0.935, -1.005], [0.86, 0.88]], [[1.03, -0.995], [0.84, 0.905]]];

  // ---- shape builders ----
  // sweep closed rings (arrays of [x,y,z] with a .c centre) into a solid; faces are oriented outwards
  function sweep(rings, caps = true) {
    const pos = [];
    const put = (a, b, c, ctr) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const gx = (a[0] + b[0] + c[0]) / 3 - ctr[0], gy = (a[1] + b[1] + c[1]) / 3 - ctr[1], gz = (a[2] + b[2] + c[2]) / 3 - ctr[2];
      if (nx * gx + ny * gy + nz * gz < 0) pos.push(...a, ...c, ...b); else pos.push(...a, ...b, ...c);
    };
    for (let k = 0; k < rings.length - 1; k++) {
      const A = rings[k], B = rings[k + 1], n = A.length, ctr = A.c.map((v, i) => (v + B.c[i]) / 2);
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; put(A[i], B[i], A[j], ctr); put(A[j], B[i], B[j], ctr); }
    }
    if (caps) for (const [k, kn] of [[0, 1], [rings.length - 1, rings.length - 2]]) {
      const A = rings[k], n = A.length;
      for (let i = 0; i < n; i++) put(A.c, A[i], A[(i + 1) % n], rings[kn].c);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    return g;
  }
  // body panel lofted through stations [z, halfWidth, yTop, yBottom, roundness(2=ellipse..6=boxy), xCentre]
  function loft(st, n = 16, crease = 42) {
    const rings = st.map(([z, w, yt, yb, p = 2.6, x0 = 0]) => {
      const r = [], yc = (yt + yb) / 2, h = (yt - yb) / 2;
      for (let i = 0; i < n; i++) {
        const a = (i + 0.5) / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        r.push([x0 + w * Math.sign(c) * Math.pow(Math.abs(c), 2 / p), yc + h * Math.sign(s) * Math.pow(Math.abs(s), 2 / p), z]);
      }
      r.c = [x0, yc, z];
      return r;
    });
    return soften(sweep(rings), crease);
  }
  // curved strip around the X axis (mudguards): angle 0 = forward (+Z), PI/2 = up
  function arcBand(r, w, a0, a1, th = 0.012, n = 10) {
    const rings = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n, uy = Math.sin(a), uz = Math.cos(a), ring = [];
      for (const [x, d] of [[-w, th], [w, th], [w, -th], [-w, -th]]) ring.push([x, (r + d) * uy, (r + d) * uz]);
      ring.c = [0, r * uy, r * uz]; rings.push(ring);
    }
    return soften(sweep(rings), 30);
  }
  function latheX(pts, segs) {
    const g = new T.LatheGeometry(pts.map(([r, x]) => new T.Vector2(r, x)), segs);
    g.rotateZ(-Math.PI / 2);
    return g;
  }
  function tyreGeo(R, w, segs) {   // rounded sport-tyre cross-section revolved around the axle
    const rr = 0.212, hw = w / 2, d = R - rr;
    return latheX([[rr, -hw * 0.82], [rr + d * 0.3, -hw * 0.98], [rr + d * 0.68, -hw], [R - d * 0.13, -hw * 0.8], [R - d * 0.025, -hw * 0.42],
      [R, 0], [R - d * 0.025, hw * 0.42], [R - d * 0.13, hw * 0.8], [rr + d * 0.68, hw], [rr + d * 0.3, hw * 0.98], [rr, hw * 0.82]], segs);
  }
  function rimGeo(w, segs) {
    const hw = w / 2;
    return latheX([[0.188, -hw], [0.214, -hw - 0.006], [0.221, -hw + 0.004], [0.211, -hw + 0.012], [0.211, hw - 0.012], [0.221, hw - 0.004],
      [0.214, hw + 0.006], [0.188, hw], [0.188, -hw]], segs);
  }
  const C = (k, f) => profCache[k] || (profCache[k] = f());
  const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const span = (a, b, n) => { const r = []; for (let i = 0; i <= n; i++) r.push(a + (b - a) * i / n); return r; };
  // smooth curve through keys [[z, v], ...] sorted by z (cubic Hermite with Catmull-Rom slopes); a number is a constant
  function kc(K, z) {
    if (typeof K === 'number') return K;
    const n = K.length;
    if (z <= K[0][0]) return K[0][1];
    if (z >= K[n - 1][0]) return K[n - 1][1];
    let i = 1; while (z > K[i][0]) i++;
    const sl = j => { const a = K[Math.max(0, j - 1)], b = K[Math.min(n - 1, j + 1)]; return (b[1] - a[1]) / (b[0] - a[0]); };
    const z0 = K[i - 1][0], h = K[i][0] - z0, t = (z - z0) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * K[i - 1][1] + (t3 - 2 * t2 + t) * h * sl(i - 1) + (3 * t2 - 2 * t3) * K[i][1] + (t3 - t2) * h * sl(i);
  }
  // body section at z from keyed specs: yt / yb top and bottom, w half-width, t / b top and bottom width as a share of w, p squareness
  const secK = S => z => {
    const w = Math.max(0.004, kc(S.w, z));
    return { yt: kc(S.yt, z), yb: kc(S.yb, z), wm: w, wt: w * kc(S.t === undefined ? 0.7 : S.t, z), wb: w * kc(S.b === undefined ? 0.85 : S.b, z),
      p: kc(S.p === undefined ? 2.6 : S.p, z) };
  };
  // x of a keyed body's surface at (z, y); 0 outside it
  const surfX = (S, z0, z1) => { const f = secK(S); return (z, y) => z < z0 || z > z1 ? 0 : sideX(f(z), y); };
  // lofted body through keyed sections; cls(angle, x, y, z) names each quad's part ('a' when omitted) -> { part: geometry }
  function bodyParts(key, S, z0, z1, n, step, cls, crease = 40) {
    return C('bp|' + key + '|' + n + '|' + step, () => {
      const ex = (S.cuts || []).slice();
      for (const k of ['yt', 'yb', 'w']) if (Array.isArray(S[k])) for (const q of S[k]) ex.push(q[0]);
      return loftParts(zSamples(z0, z1, step, ex), secK(S), n, cls || (() => 'a'), crease);
    });
  }
  function addParts(m, parts, map) { for (const k in parts) if (map[k]) m.add(parts[k], M4(), map[k][0], map[k][1]); }
  // thick shell between an outer grid O[i][j] and an inner grid I[i][j]: smooth faces, crisp edge walls
  function shellGrid(O, I) {
    const out = { face: [], back: [], edge: [] }, nu = O.length - 1, nv = O[0].length - 1;
    const tri = (o, a, b, c, r) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * r[0] + ny * r[1] + nz * r[2] < 0) o.push(...a, ...c, ...b); else o.push(...a, ...b, ...c);
    };
    const quad = (o, a, b, c, d, r) => { tri(o, a, b, c, r); tri(o, a, c, d, r); };
    const dif = (...p) => { const r = [0, 0, 0]; for (let k = 0; k < p.length; k += 2) for (let q = 0; q < 3; q++) r[q] += p[k][q] - p[k + 1][q]; return r; };
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const r = dif(O[i][j], I[i][j], O[i + 1][j], I[i + 1][j], O[i][j + 1], I[i][j + 1], O[i + 1][j + 1], I[i + 1][j + 1]);
      quad(out.face, O[i][j], O[i + 1][j], O[i + 1][j + 1], O[i][j + 1], r);
      quad(out.back, I[i][j], I[i + 1][j], I[i + 1][j + 1], I[i][j + 1], [-r[0], -r[1], -r[2]]);
    }
    for (let i = 0; i < nu; i++) {
      quad(out.edge, O[i][0], O[i + 1][0], I[i + 1][0], I[i][0], dif(O[i][0], O[i][1], O[i + 1][0], O[i + 1][1]));
      quad(out.edge, O[i][nv], O[i + 1][nv], I[i + 1][nv], I[i][nv], dif(O[i][nv], O[i][nv - 1], O[i + 1][nv], O[i + 1][nv - 1]));
    }
    for (let j = 0; j < nv; j++) {
      quad(out.edge, O[0][j], O[0][j + 1], I[0][j + 1], I[0][j], dif(O[0][j], O[1][j], O[0][j + 1], O[1][j + 1]));
      quad(out.edge, O[nu][j], O[nu][j + 1], I[nu][j + 1], I[nu][j], dif(O[nu][j], O[nu - 1][j], O[nu][j + 1], O[nu - 1][j + 1]));
    }
    const res = {};
    for (const k in out) {
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(out[k], 3)); g.computeVertexNormals();
      res[k] = soften(g, k === 'edge' ? 35 : 50);
    }
    return res;
  }
  // panel lying `off` above the side surface x = env(z, y) on side s (+1 left, -1 right), `th` thick; its outline runs
  // between top(z) and bot(z) at the stations zs (top == bot gives a pointed end)
  function envPanel(env, s, zs, top, bot, off, th, nv) {
    const O = [], I = [];
    for (const z of zs) {
      const yt = top(z), yb = Math.min(bot(z), yt), ro = [], ri = [];
      for (let j = 0; j <= nv; j++) {
        const y = yt + (yb - yt) * j / nv, x = env(z, y) + off;
        ro.push([s * (x + th), y, z]); ri.push([s * x, y, z]);
      }
      O.push(ro); I.push(ri);
    }
    return shellGrid(O, I);
  }
  // the panel on both sides: face + edges in col, the inside in `back` (null = none)
  function panels(m, key, env, zs, top, bot, off, th, nv, col, mat, back = BLACK) {
    for (const s of [-1, 1]) {
      const g = C('pn|' + key + '|' + s + '|' + zs.length + '|' + nv, () => envPanel(env, s, zs, top, bot, off, th, nv));
      m.add(g.face, M4(), col, mat); m.add(g.edge, M4(), mul(col, 0.8), mat);
      if (back) m.add(g.back, M4(), back, 'lam');
    }
  }
  const tube = (key, pts, r, seg, rad = 8) => C('tube|' + key + '|' + seg + '|' + rad, () => new T.TubeGeometry(new T.CatmullRomCurve3(pts), seg, r, rad, false));
  // solid swept along a smooth path that runs (mostly) in a y-z plane; sec(t) -> [half-width in x, half-height, squareness]
  function pathLoft(key, pts, sec, segs, n = 12) {
    return C('pl|' + key + '|' + segs + '|' + n, () => {
      const cv = new T.CatmullRomCurve3(pts), rings = [], X = new T.Vector3(), Uv = new T.Vector3(), Tg = new T.Vector3();
      for (let i = 0; i <= segs; i++) {
        const t = i / segs, c = cv.getPointAt(t); cv.getTangentAt(t, Tg);
        X.set(1, 0, 0).addScaledVector(Tg, -Tg.x).normalize(); Uv.crossVectors(Tg, X).normalize();
        const [w, h, p] = sec(t), r = [];
        for (let k = 0; k < n; k++) {
          const a = (k + 0.5) / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
          const px = w * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / p), py = h * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / p);
          r.push([c.x + X.x * px + Uv.x * py, c.y + X.y * px + Uv.y * py, c.z + X.z * px + Uv.z * py]);
        }
        r.c = [c.x, c.y, c.z]; rings.push(r);
      }
      return soften(sweep(rings), 40);
    });
  }
  // unit box whose +Y end is scaled by (tx, tz): tapering arms and spokes
  const tbox = (tx, tz = tx) => C('tbox|' + tx + '|' + tz, () => {
    const g = new T.BoxGeometry(1, 1, 1).toNonIndexed(), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * tx); p.setZ(i, p.getZ(i) * tz); }
    g.computeVertexNormals(); return g;
  });

  // ---- wheels: thin-spoke cast / forged rims, sport tyres, floating drilled discs, radial monoblock calipers ----
  function bikeWheel(m, W, o, front) {
    const hi = o.hi, segs = hi ? 32 : 14, rw = W.w * 0.8, hw = rw / 2, at = (r, a, x = 0) => v3(x, W.y + Math.sin(a) * r, W.z + Math.cos(a) * r);
    m.add(C('tyre' + W.r + segs, () => tyreGeo(W.r, W.w, segs)), M4(0, W.y, W.z), RUBBER, 'lam');
    m.add(C('rim' + rw + segs, () => rimGeo(rw, segs)), M4(0, W.y, W.z), o.rim, 'paint');
    m.add(GEO.cyl16, M4(0, W.y, W.z, 0, 0, Math.PI / 2, 0.05, rw * 0.95, 0.05), o.rim, 'paint');                              // hub
    m.add(GEO.cyl16, M4(0, W.y, W.z, 0, 0, Math.PI / 2, 0.02, front ? 0.25 : 0.3, 0.02), ALU, 'chrome');                       // axle
    if (hi) {
      const [ns, split] = o.spokes, r0 = 0.045, r1 = 0.2, rs = 0.125, a0 = front ? 0.25 : 0.05;
      for (let k = 0; k < ns; k++) {
        const a = a0 + k / ns * Math.PI * 2;
        if (split) {
          m.add(tbox(0.8, 0.75), link(at(r0, a), at(rs, a), rw * 0.34, 0.03), o.rim, 'paint');
          for (const d of [-1, 1]) m.add(tbox(0.75, 0.8), link(at(rs - 0.012, a), at(r1, a + d * split), rw * 0.24, 0.016), o.rim, 'paint');
        } else m.add(tbox(0.65, 0.6), link(at(r0, a), at(r1, a), rw * 0.32, 0.028), o.rim, 'paint');
      }
      if (o.rimStripe) for (const s of [-1, 1]) m.add(C('rimStripe' + segs, () => new T.RingGeometry(0.2015, 0.2095, segs).rotateY(Math.PI / 2)),
        M4(s * (hw + 0.0068), W.y, W.z, 0, s > 0 ? 0 : Math.PI, 0), o.rimStripe, 'paint');
    } else m.add(GEO.cyl16, M4(0, W.y, W.z, 0, 0, Math.PI / 2, 0.2, rw * 0.3, 0.2), mul(o.rim, 0.6), 'paint');
    const rotor = (x, R, Ri) => {
      m.add(C('rotor' + R + '|' + segs, () => latheX([[Ri, -0.0025], [R, -0.0025], [R, 0.0025], [Ri, 0.0025], [Ri, -0.0025]], segs)), M4(x, W.y, W.z), STEEL, 'chrome');
      m.add(C('carrier' + Ri + '|' + segs, () => latheX([[Ri - 0.016, -0.0035], [Ri + 0.003, -0.0035], [Ri + 0.003, 0.0035], [Ri - 0.016, 0.0035], [Ri - 0.016, -0.0035]], segs)),
        M4(x, W.y, W.z), o.carrier, 'chrome');
      if (!hi) return;
      for (let k = 0; k < 5; k++) { const a = 0.6 + k / 5 * Math.PI * 2; m.add(GEO.box, link(at(0.04, a, x), at(Ri - 0.012, a, x), 0.007, 0.02), o.carrier, 'chrome'); }
      for (let k = 0; k < 8; k++) { const p = at(Ri + 0.001, k / 8 * Math.PI * 2, x); m.add(GEO.cyl6, M4(p.x, p.y, p.z, 0, 0, Math.PI / 2, 0.0065, 0.011, 0.0065), CHROME, 'chrome'); }
      const nh = R > 0.13 ? 24 : 14;   // drilled holes
      for (let k = 0; k < nh; k++) { const p = at(Ri + (R - Ri) * (k % 2 ? 0.33 : 0.68), k / nh * Math.PI * 2, x); m.add(GEO.cyl6, M4(p.x, p.y, p.z, 0, 0, Math.PI / 2, 0.0042, 0.0064, 0.0042), BLACK, 'lam'); }
    };
    const caliper = (x, a, r, len) => {
      const p = at(r, a, x);
      m.add(GEO.box, M4(p.x, p.y, p.z, -a, 0, 0, 0.046, len, 0.052), o.cal, 'paint');
      if (hi) { const q = at(r + 0.006, a, x + Math.sign(x) * 0.0235); m.add(GEO.box, M4(q.x, q.y, q.z, -a, 0, 0, 0.002, len * 0.55, 0.018), lin('#f2f2f2'), 'lam'); }   // maker's badge
    };
    if (front) for (const s of [-1, 1]) { rotor(s * 0.066, 0.16, 0.112); caliper(s * 0.066, 2.35, 0.142, 0.13); }
    else { rotor(-0.087, 0.11, 0.075); caliper(-0.087, -1.15, 0.094, 0.085); }
  }

  // ---- upside-down fork, yokes, steering head, mudguard ----
  function frontEnd(o) {
    const { m, hi, st, top } = o, ax = v3(0, FW.y, FW.z), d = ax.clone().sub(top), len = d.length(); d.normalize();
    const rake = Math.atan2(d.z, -d.y), at = (l, x) => top.clone().addScaledVector(d, l).setX(x);
    o.fork = { d, len, rake, at };
    for (const s of [-1, 1]) {
      const x = s * 0.105;
      m.add(GEO.cyl16, link(at(-0.045, x), at(0.43, x), 0.03), o.forkUp, 'chrome');                         // outer tube
      m.add(GEO.cyl16, link(at(0.41, x), at(0.445, x), 0.0318), mul(o.forkUp, 0.55), 'chrome');              // bottom of the outer tube
      m.add(GEO.cyl16, link(at(0.44, x), at(len - 0.06, x), 0.0215), o.forkLow, 'chrome');                   // inner tube
      m.add(GEO.box, link(at(len - 0.1, x), at(len + 0.035, x), 0.05, 0.068), BLACK, 'paint');               // axle foot
      m.add(GEO.box, link(at(len - 0.16, x).add(v3(0, 0, -0.04)), at(len - 0.05, x).add(v3(0, 0, -0.06)), 0.03, 0.03), BLACK, 'paint');   // radial caliper mount
      m.add(GEO.cyl16, link(at(-0.072, x), at(-0.045, x), 0.022), o.forkCap, 'chrome');                       // preload adjuster
      if (hi) m.add(GEO.cyl6, link(at(-0.08, x), at(-0.07, x), 0.011), ALU, 'chrome');
    }
    m.add(GEO.box, M4(0, top.y + 0.002, top.z - 0.018, -rake, 0, 0, 0.29, 0.026, 0.125), st === 3 ? lin('#2a2c32') : ALU, 'chrome');   // top yoke
    m.add(GEO.cyl16, M4(0, top.y + 0.018, top.z - 0.04, -rake, 0, 0, 0.022, 0.016, 0.022), st === 3 ? GOLD : DARK, 'chrome');          // stem nut
    const ly = at(0.17, 0);
    m.add(GEO.box, M4(0, ly.y, ly.z - 0.02, -rake, 0, 0, 0.275, 0.045, 0.11), st === 1 ? ALU : DARK, 'chrome');                        // bottom yoke
    m.add(GEO.cyl16, link(at(-0.01, 0).add(v3(0, 0, -0.04)), at(0.2, 0).add(v3(0, 0, -0.04)), 0.032), o.frameCol, 'paint');            // steering head
    m.add(C('fFender', () => arcBand(FW.r + 0.018, 0.064, 0.62, 2.05, 0.005, 12)), M4(0, FW.y, FW.z), st === 0 ? BLACK : o.paint, st === 0 ? 'lam' : 'carPaint');
    if (hi) for (const s of [-1, 1]) m.add(GEO.cyl, link(at(0.18, s * 0.08).add(v3(0, 0, -0.03)), at(len - 0.15, s * 0.072).add(v3(0, 0, -0.05)), 0.0045), BLACK, 'lam');   // brake lines
  }

  // ---- forward-inclined inline-four, radiator, heat-tinted headers ----
  function engine(o) {
    const { m, hi, st } = o, up = v3(0, Math.cos(0.5), Math.sin(0.5)), B = v3(0, 0.565, 0.235);
    const P = u => B.clone().addScaledVector(up, u);
    const caseCol = st === 0 ? lin('#2a2c32') : ENGINE, cover = st === 2 ? lin('#9aa0a8') : st === 3 ? lin('#5a5048') : lin('#4c5058');
    m.add(bodyParts('crank', { yt: [[-0.17, 0.56], [0.02, 0.55], [0.2, 0.5], [0.33, 0.44]], yb: [[-0.17, 0.27], [0.0, 0.2], [0.22, 0.19], [0.33, 0.25]],
      w: [[-0.17, 0.15], [0.05, 0.172], [0.33, 0.16]], t: 0.8, b: 0.72, p: 3.6 }, -0.17, 0.33, 16, 0.06).a, M4(), caseCol, 'paint');
    const box = (u, sx, sy, sz, col, mat) => { const p = P(u); m.add(GEO.box, M4(p.x, p.y, p.z, 0.5, 0, 0, sx, sy, sz), col, mat); };
    box(0, 0.37, 0.22, 0.165, caseCol, 'paint');            // cylinder block
    box(0.155, 0.36, 0.09, 0.16, caseCol, 'paint');         // head
    box(0.225, 0.33, 0.05, 0.145, o.camCol, 'paint');       // cam cover
    if (hi) {
      for (let k = 0; k < 4; k++) box(-0.075 + k * 0.045, 0.384, 0.007, 0.171, lin('#5a5e66'), 'chrome');   // casting ribs
      for (let k = 0; k < 4; k++) { const p = P(0.252); m.add(GEO.cyl, M4(-0.135 + k * 0.09, p.y, p.z, 0.5, 0, 0, 0.017, 0.012, 0.017), BLACK, 'lam'); }   // coil caps
    }
    const cx = st === 0 ? 1 : 0.9;   // covers sit further in under a fairing
    m.add(GEO.sph, M4(-0.17 * cx, 0.36, 0.03, 0, 0, 0, 0.035 * cx, 0.115, 0.125), cover, 'chrome');      // clutch cover (right)
    m.add(GEO.sph, M4(0.168 * cx, 0.37, 0.19, 0, 0, 0, 0.032 * cx, 0.085, 0.085), cover, 'chrome');      // alternator cover (left)
    m.add(GEO.sph, M4(0.163 * cx, 0.39, -0.06, 0, 0, 0, 0.024, 0.065, 0.07), cover, 'chrome');           // sprocket cover
    // radiator, tilted back with the fork, and its core
    const rx = -0.2, rd = v3(0, 0.635, 0.415), rUp = v3(0, Math.cos(rx), Math.sin(rx)), rN = v3(0, -Math.sin(rx), Math.cos(rx));
    m.add(GEO.box, M4(rd.x, rd.y, rd.z, rx, 0, 0, 0.36, 0.28, 0.045), lin('#131417'), 'lam');
    if (hi) {
      for (let k = 0; k < 9; k++) { const p = rd.clone().addScaledVector(rUp, -0.12 + k * 0.03).addScaledVector(rN, 0.024); m.add(GEO.box, M4(p.x, p.y, p.z, rx, 0, 0, 0.34, 0.006, 0.004), lin('#3a3c42'), 'chrome'); }
      m.add(GEO.cyl16, M4(0, 0.25, 0.33, 1.1, 0, 0, 0.036, 0.07, 0.036), lin('#1a3a8a'), 'paint');   // oil filter
    }
    // four headers: heat tint from bronze at the ports through blue to steel underneath
    const BR = lin('#a07a3c'), BL = lin('#4a4a8a'), SL = lin('#8a8e98');
    const heat = (x, y) => { const t = clamp01((0.68 - y) / 0.45); return t < 0.5 ? mix(BR, BL, t * 2) : mix(BL, SL, t * 2 - 1); };
    for (const x of [-0.135, -0.045, 0.045, 0.135]) {
      const pts = [v3(x, 0.66, 0.37), v3(x * 1.04, 0.58, 0.385), v3(x, 0.46, 0.37), v3(x * 0.85, 0.32, 0.35), v3(x * 0.6, 0.21, 0.28), v3(x * 0.35, 0.165, 0.15), v3(x * 0.12, 0.155, 0.02)];
      m.add(tube('hdr' + x, pts, 0.0185, hi ? 18 : 8, hi ? 7 : 4), M4(), heat, 'chrome');
    }
  }

  // ---- frame: steel trellis (naked) or aluminium twin spar; subframe ----
  function frame(o) {
    const { m, hi, st } = o, col = o.frameCol;
    if (st === 0) for (const s of [-1, 1]) {
      const H1 = v3(s * 0.05, 0.96, 0.405), H2 = v3(s * 0.05, 0.83, 0.455), A = v3(s * 0.165, 0.87, 0.14), B = v3(s * 0.17, 0.64, 0.19),
        Cc = v3(s * 0.16, 0.83, -0.12), D = v3(s * 0.155, 0.53, -0.11), E = v3(s * 0.1, 0.87, -0.6), F = v3(s * 0.11, 0.66, -0.42);
      for (const [a, b] of [[H1, A], [H2, A], [H2, B], [A, B], [A, Cc], [B, Cc], [B, D], [Cc, D], [Cc, E], [D, F], [F, E], [Cc, F]])
        m.add(GEO.cyl, link(a, b, 0.0125), col, 'paint');
      m.add(GEO.box, M4(s * 0.158, 0.48, -0.12, 0, 0, 0, 0.022, 0.2, 0.13), ALU, 'chrome');      // swing-arm pivot plate
    } else for (const s of [-1, 1]) {
      m.add(pathLoft('spar' + s, [v3(s * 0.06, 0.885, 0.415), v3(s * 0.15, 0.84, 0.27), v3(s * 0.182, 0.765, 0.07), v3(s * 0.172, 0.63, -0.075), v3(s * 0.162, 0.5, -0.125)],
        t => [0.019, 0.058 - 0.012 * t, 4], hi ? 16 : 6, hi ? 12 : 8), M4(), col, 'chrome');
      m.add(GEO.box, M4(s * 0.16, 0.48, -0.125, 0, 0, 0, 0.034, 0.2, 0.14), col, 'chrome');
      m.add(GEO.cyl, link(v3(s * 0.15, 0.79, -0.1), v3(s * 0.085, 0.86, -0.72), 0.011), DARK, 'lam');
      m.add(GEO.cyl, link(v3(s * 0.15, 0.6, -0.13), v3(s * 0.09, 0.84, -0.56), 0.01), DARK, 'lam');
    }
  }

  // ---- swing-arm (twin banana arms, or single-sided), shock with coil spring, chain drive, hugger ----
  function swingarm(o) {
    const { m, hi, st } = o, col = o.armCol, sg = hi ? 14 : 6;
    if (st === 3) {   // single-sided arm on the left; the right side of the wheel is bare
      m.add(pathLoft('ssa', [v3(0.135, 0.48, -0.13), v3(0.145, 0.46, -0.33), v3(0.15, 0.4, -0.55), v3(0.135, 0.33, -0.705)], t => [0.03, 0.07 - 0.025 * t, 3.5], sg, 12), M4(), col, 'chrome');
      m.add(GEO.cyl16, M4(0.112, RW.y, RW.z, 0, 0, Math.PI / 2, 0.075, 0.06, 0.075), GOLD, 'chrome');               // eccentric hub carrier
      m.add(GEO.cyl6, M4(-0.083, RW.y, RW.z, 0, 0, Math.PI / 2, 0.034, 0.03, 0.034), lin('#c02020'), 'paint');      // big wheel nut
      m.add(GEO.box, M4(0.05, 0.47, -0.17, 0, 0, 0, 0.2, 0.08, 0.07), col, 'chrome');
    } else {
      for (const s of [-1, 1]) {
        const x = s * 0.135, bend = s < 0 && st !== 0 ? 0.03 : 0;
        m.add(pathLoft('arm' + s + '|' + bend, [v3(x, 0.475, -0.13), v3(x, 0.45 + bend, -0.3), v3(x, 0.395 + bend, -0.5), v3(x, 0.33, -0.7)], t => [0.02, 0.062 - 0.03 * t, 3.6], sg, 10), M4(), col, 'chrome');
        m.add(GEO.box, M4(x, RW.y + 0.005, RW.z - 0.005, 0, 0, 0, 0.042, 0.05, 0.075), ALU, 'chrome');               // chain adjuster
        if (bend && hi) m.add(pathLoft('brace', [v3(x, 0.4, -0.16), v3(x, 0.335, -0.36), v3(x, 0.33, -0.58)], () => [0.013, 0.018, 3], 8, 8), M4(), col, 'chrome');
      }
      m.add(GEO.box, M4(0, 0.455, -0.215, 0, 0, 0, 0.25, 0.065, 0.055), col, 'chrome');                               // cross member
    }
    // rear shock with its coil spring
    const s0 = v3(0, 0.4, -0.24), s1 = v3(0, 0.74, -0.13), sd = s1.clone().sub(s0).normalize(), c0 = s0.clone().lerp(s1, 0.15);
    m.add(GEO.cyl, link(s0, s1, 0.016), DARK, 'chrome');
    m.add(GEO.cyl16, link(s1.clone().addScaledVector(sd, -0.1), s1, 0.028), lin('#2a2c32'), 'chrome');
    if (hi) {
      const pts = [], sx = v3(1, 0, 0), sy = v3().crossVectors(sd, sx).normalize(), turns = 8, N = turns * 8;
      for (let i = 0; i <= N; i++) { const t = i / N, a = t * turns * Math.PI * 2; pts.push(c0.clone().addScaledVector(sd, t * 0.2).addScaledVector(sx, Math.cos(a) * 0.033).addScaledVector(sy, Math.sin(a) * 0.033)); }
      m.add(tube('spring', pts, 0.0065, N, 5), M4(), o.spring, 'paint');
    } else m.add(GEO.cyl, link(c0, c0.clone().addScaledVector(sd, 0.2), 0.037), o.spring, 'paint');
    // chain drive on the left
    const cx = 0.112, fs = v3(cx, 0.4, -0.03), rr = 0.105, fr = 0.045;
    m.add(GEO.cyl16, M4(cx, RW.y, RW.z, 0, 0, Math.PI / 2, rr, 0.008, rr), st === 3 ? GOLD : lin('#2a2c32'), 'chrome');
    m.add(GEO.cyl16, M4(cx, fs.y, fs.z, 0, 0, Math.PI / 2, fr, 0.01, fr), DARK, 'chrome');
    if (hi) for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; m.add(GEO.cyl16, M4(cx, RW.y + Math.sin(a) * 0.064, RW.z + Math.cos(a) * 0.064, 0, 0, Math.PI / 2, 0.022, 0.01, 0.022), BLACK, 'lam'); }
    const run = (sg2, t) => v3(cx, fs.y + sg2 * fr, fs.z).lerp(v3(cx, RW.y + sg2 * rr, RW.z), t);
    for (const sg2 of [1, -1]) m.add(GEO.box, link(run(sg2, 0), run(sg2, 1), 0.014, 0.01), lin('#4a4c52'), 'chrome');
    m.add(GEO.box, link(run(1, 0.3).add(v3(0.012, 0.025, 0)), run(1, 0.75).add(v3(0.012, 0.03, 0)), 0.004, 0.035), BLACK, 'lam');   // chain guard
    m.add(C('hugger', () => arcBand(RW.r + 0.03, 0.085, 0.95, 2.0, 0.006, 10)), M4(0, RW.y, RW.z), st === 3 ? CARBON : BLACK, st === 3 ? 'paint' : 'lam');
  }

  // ---- exhaust: link pipe from under the engine to a short silencer on the right ----
  function exhaust(o) {
    const { m, hi, st } = o, dark = lin('#2a2c32');
    const steel = (x, y) => mix(lin('#8a8e98'), lin('#6a6e7a'), clamp01((0.3 - y) / 0.2));
    const can = [
      [v3(-0.175, 0.24, -0.2), v3(-0.19, 0.27, -0.32), v3(-0.205, 0.31, -0.43)],
      [v3(-0.2, 0.3, -0.27), v3(-0.212, 0.37, -0.44), v3(-0.222, 0.44, -0.6)],
      [v3(-0.2, 0.31, -0.33), v3(-0.21, 0.37, -0.58), v3(-0.218, 0.43, -0.84)],
      [v3(-0.2, 0.33, -0.31), v3(-0.21, 0.42, -0.5), v3(-0.218, 0.52, -0.67)],
    ][st];
    m.add(tube('link' + st, [v3(0, 0.152, 0.0), v3(-0.07, 0.165, -0.1), v3(-0.14, 0.2, -0.17), can[0].clone().add(v3(0.01, -0.015, 0.03))], 0.027, hi ? 14 : 6, hi ? 8 : 5), M4(), steel, 'chrome');
    if (st === 0) m.add(bodyParts('prechamber', { yt: 0.26, yb: [[-0.18, 0.15], [0.0, 0.13], [0.16, 0.15]], w: [[-0.18, 0.09], [0, 0.12], [0.16, 0.1]], t: 0.95, b: 0.8, p: 3.4 },
      -0.18, 0.16, 12, 0.08).a, M4(), dark, 'chrome');
    const r = [0.062, 0.056, 0.058, 0.064][st], n = st === 3 ? 6 : hi ? 12 : 8, body = [lin('#7c818a'), TI, STEEL, lin('#8d8a9c')][st];
    m.add(pathLoft('can' + st, can, t => [r * (0.9 + 0.1 * Math.sin(Math.PI * t)), r * 1.12, st === 1 ? 2.6 : 2.2], hi ? 10 : 4, n), M4(), body, 'chrome');
    const e = can[2], dir = e.clone().sub(can[1]).normalize();
    m.add(GEO.cyl16, link(e.clone().addScaledVector(dir, -0.01), e.clone().addScaledVector(dir, 0.025), r * 0.92), st === 3 ? TI : CARBON, 'paint');   // end cap
    if (st === 3) for (const s of [-1, 1]) m.add(GEO.cyl16, link(e.clone().add(v3(0, s * 0.024, 0)).addScaledVector(dir, 0.02), e.clone().add(v3(0, s * 0.024, 0)).addScaledVector(dir, 0.04), 0.02), lin('#3a3226'), 'chrome');
    else m.add(GEO.cyl16, link(e.clone().addScaledVector(dir, 0.024), e.clone().addScaledVector(dir, 0.03), r * 0.5), lin('#050506'), 'lam');
    if (hi && st !== 2) {   // carbon heat shield on the outside of the silencer
      const a = can[0].clone().lerp(can[1], 0.4).add(v3(-r * 0.95, 0.005, 0)), b = can[1].clone().lerp(can[2], 0.6).add(v3(-r * 0.95, 0.005, 0));
      m.add(GEO.box, link(a, b, 0.006, r * 1.3), CARBON, 'paint');
    }
  }

  // ---- fuel tank: glossy, knee pads, a racing stripe along the top ----
  function tank(o, key, S, z0, z1) {
    const cls = (a, x, y, z) => a < 0 && z > 0 ? 'blk' : 'paint';
    addParts(o.m, bodyParts(key, S, z0, z1, o.n, o.step, cls, 34), { paint: [o.paint, 'carPaint'], blk: [BLACK, 'lam'] });
    const zc = z0 + (z1 - z0) * 0.68;
    o.m.add(GEO.cyl16, M4(0, kc(S.yt, zc) - 0.002, zc, 0, 0, 0, 0.042, 0.012, 0.042), ALU, 'chrome');   // fuel cap
  }
  // ---- tail unit: seat cowl with an accent band, pillion pad, LED tail lamp in its end; side covers, under-tray ----
  function tailBody(o, key, TAIL, pill) {
    const { m, hi, st, paint, acc, n, step } = o, z0 = TAIL.yt[0][0];
    const cls = (a, x, y, z) => {
      if (a < 0) return z < -0.8 ? 'tl' : 'blk';
      const s = Math.sin(a);
      if (s < -0.45) return 'blk';
      if (pill && s > 0.72 && z > -0.74 && z < -0.5) return 'seat';
      if (Math.abs(s) < 0.14 && z < -0.5 && z > z0 + 0.06) return 'acc';
      return 'paint';
    };
    addParts(m, bodyParts(key, TAIL, z0, -0.44, n, step, cls, 36), { paint: [paint, 'carPaint'], acc: [acc, 'carPaint'], seat: [SEAT, 'lam'], tl: [LENS_T, 'glass'], blk: [BLACK, 'lam'] });
    const ty = (kc(TAIL.yt, z0) + kc(TAIL.yb, z0)) / 2, tw = kc(TAIL.w, z0);
    m.add(GEO.box, M4(0, ty + 0.009, z0 - 0.003, 0, 0, 0, tw * 1.45, 0.009, 0.004), LED_T, 'light');
    for (const s of [-1, 1]) m.add(GEO.box, M4(s * tw * 0.42, ty - 0.008, z0 - 0.003, 0, 0, s * 0.42, tw * 0.7, 0.007, 0.004), LED_T, 'light');
    o.tail = { z: z0, y: ty, w: tw, yb: kc(TAIL.yb, z0) };
    const UZ = [z0 + 0.1, -0.8, -0.65, -0.5];
    m.add(bodyParts('under' + key, { yt: UZ.map(z => [z, kc(TAIL.yb, z) + 0.02]), yb: UZ.map((z, i) => [z, kc(TAIL.yb, z) - [0.03, 0.05, 0.07, 0.08][i]]),
      w: UZ.map(z => [z, kc(TAIL.w, z) * 0.72]), t: 0.9, b: 0.7, p: 3 }, UZ[0], UZ[3], 12, 0.08).a, M4(), BLACK, 'lam');
    // side covers under the seat, between the fairing and the tail
    const scX = (z, y) => kc([[-0.46, 0.125], [-0.25, 0.14], [-0.02, 0.15]], z) - (y - 0.68) * (y - 0.68) * 0.6;
    panels(m, 'scover' + key, scX, span(-0.47, -0.04, hi ? 12 : 4), z => kc([[-0.47, 0.79], [-0.04, 0.8]], z),
      z => kc([[-0.47, 0.75], [-0.3, 0.63], [-0.12, 0.56], [-0.04, 0.52]], z), 0, 0.004, hi ? 4 : 2, st === 2 ? paint : PLASTIC, st === 2 ? 'carPaint' : 'lam');
  }
  function seat(o, key, S, z0, z1) { o.m.add(bodyParts(key, S, z0, z1, o.n, o.step).a, M4(), SEAT, 'lam'); }
  function mirrorHead(o, s, p, faired) {
    const { m, hi } = o, c = v3(p.x + s * 0.03, p.y, p.z);
    m.add(GEO.sph, M4(c.x, c.y, c.z, 0, s * 0.12, 0, 0.068, 0.034, 0.03), faired ? o.paint : BLACK, faired ? 'carPaint' : 'lam');
    m.add(GEO.box, M4(c.x, c.y, c.z - 0.026, 0, s * 0.12, 0, 0.11, 0.05, 0.004), lin('#8c96a2'), 'glass');
    if (hi && faired) m.add(GEO.box, M4(c.x + s * 0.03, c.y - 0.006, c.z + 0.022, 0, s * 0.12, 0, 0.05, 0.008, 0.004), AMB, 'light');   // LED indicator
  }

  // ---- full fairing: beak nose with a bubble screen and slanted LED eyes, side panels over black inner panels ----
  function fairedBody(o) {
    const { m, hi, st, paint, acc, n, step, nu, nv } = o, K = st === 2 ? 1.07 : 1, tip = st === 3 ? 0.955 : 0.94;
    // upper cowl: a sharp beak whose top carries the screen
    const NOSE = [null,
      { yt: [[0.5, 1.0], [0.6, 1.0], [0.7, 0.985], [0.8, 0.95], [0.87, 0.9], [0.915, 0.85], [0.94, 0.81]],
        yb: [[0.5, 0.70], [0.62, 0.675], [0.78, 0.675], [0.88, 0.705], [0.94, 0.765]],
        w: [[0.5, 0.175], [0.6, 0.183], [0.7, 0.168], [0.8, 0.133], [0.88, 0.085], [0.94, 0.022]] },
      { yt: [[0.5, 1.03], [0.6, 1.035], [0.7, 1.015], [0.8, 0.97], [0.87, 0.915], [0.915, 0.86], [0.94, 0.825]],
        yb: [[0.5, 0.69], [0.62, 0.665], [0.78, 0.67], [0.88, 0.7], [0.94, 0.76]],
        w: [[0.5, 0.19], [0.6, 0.198], [0.7, 0.182], [0.8, 0.145], [0.88, 0.09], [0.94, 0.024]] },
      { yt: [[0.5, 0.99], [0.6, 0.99], [0.7, 0.975], [0.8, 0.94], [0.89, 0.885], [0.93, 0.835], [0.955, 0.8]],
        yb: [[0.5, 0.70], [0.62, 0.68], [0.8, 0.68], [0.9, 0.715], [0.955, 0.77]],
        w: [[0.5, 0.17], [0.6, 0.178], [0.7, 0.163], [0.8, 0.13], [0.9, 0.075], [0.955, 0.02]] },
    ][st];
    NOSE.t = [[0.5, 0.5], [0.75, 0.55], [tip, 0.7]]; NOSE.b = 0.78; NOSE.p = 2.6;
    const noseCls = (a, x, y, z) => a < 0 || Math.sin(a) < -0.55 || (z > tip - 0.035 && Math.sin(a) < 0.25) ? 'blk' : 'paint';
    addParts(m, bodyParts('nose' + st, NOSE, 0.5, tip, n, step * 0.8, noseCls, 36), { paint: [paint, 'carPaint'], blk: [BLACK, 'lam'] });
    const noseF = secK(NOSE), noseX = surfX(NOSE, 0.5, tip);
    // smoked bubble screen sitting on the cowl: its side edges follow the cowl's surface
    const cowlY = (z, x) => {   // height of the cowl's upper surface at (z, |x|)
      const s = noseF(z); let lo = (s.yt + s.yb) / 2, up = s.yt;
      if (x >= sideX(s, lo)) return lo;
      for (let k = 0; k < 20; k++) { const mid = (lo + up) / 2; if (sideX(s, mid) > x) lo = mid; else up = mid; }
      return lo;
    };
    const SCR = [null, { z: [0.53, 0.86], y: [[0.53, 1.125], [0.6, 1.105], [0.7, 1.055], [0.78, 1.0], [0.86, 0.925]], w: [[0.53, 0.12], [0.64, 0.135], [0.76, 0.115], [0.86, 0.045]] },
      { z: [0.52, 0.86], y: [[0.52, 1.3], [0.58, 1.265], [0.68, 1.17], [0.78, 1.05], [0.86, 0.94]], w: [[0.52, 0.15], [0.64, 0.16], [0.76, 0.13], [0.86, 0.05]] },
      { z: [0.54, 0.87], y: [[0.54, 1.105], [0.62, 1.085], [0.72, 1.035], [0.8, 0.985], [0.87, 0.91]], w: [[0.54, 0.115], [0.66, 0.13], [0.78, 0.11], [0.87, 0.04]] }][st];
    const scr = C('screen' + st + '|' + hi, () => {
      const O = [], I = [], nj = hi ? 12 : 6;
      for (const z of span(SCR.z[0], SCR.z[1], hi ? 14 : 5)) {
        const w = kc(SCR.w, z), yc = Math.max(kc(SCR.y, z), cowlY(z, 0) + 0.008), ye = cowlY(z, w) - 0.004, ro = [], ri = [];
        for (let j = 0; j <= nj; j++) {
          const v = -1 + 2 * j / nj, y = ye + (yc - ye) * Math.pow(1 - Math.pow(Math.abs(v), 2.2), 1 / 2.2);
          ro.push([w * v, y + 0.005, z]); ri.push([w * v, y, z]);
        }
        O.push(ro); I.push(ri);
      }
      return shellGrid(O, I);
    });
    m.add(scr.face, M4(), SMOKE, 'glass'); m.add(scr.back, M4(), SMOKE, 'glass'); m.add(scr.edge, M4(), BLACK, 'lam');
    // LED "eyes" on the front of the nose: black surround, lens, light guide along the top edge
    const L = [null, { z: [0.79, 0.925], top: [[0.79, 0.895], [0.925, 0.832]], bot: [[0.79, 0.858], [0.86, 0.835], [0.925, 0.815]] },
      { z: [0.78, 0.925], top: [[0.78, 0.915], [0.925, 0.842]], bot: [[0.78, 0.86], [0.925, 0.815]] },
      { z: [0.81, 0.94], top: [[0.81, 0.875], [0.94, 0.815]], bot: [[0.81, 0.852], [0.94, 0.802]] }][st];
    const lt = z => kc(L.top, z), lb = z => kc(L.bot, z), zl = span(L.z[0], L.z[1], hi ? 8 : 3);
    panels(m, 'lampS' + st, noseX, span(L.z[0] - 0.01, L.z[1] + 0.004, hi ? 8 : 3), z => lt(z) + 0.008, z => lb(z) - 0.008, 0.001, 0.003, 2, BLACK, 'lam', null);
    panels(m, 'lampL' + st, noseX, zl, lt, lb, 0.0035, 0.003, 2, LENS_H, 'glass', null);
    panels(m, 'lampD' + st, noseX, zl, z => lt(z) - 0.002, z => lt(z) - 0.002 - Math.min(0.009, (lt(z) - lb(z)) * 0.4), 0.0068, 0.001, 1, LED_H, 'light', null);
    // side fairings (their envelope closes in on the nose at the front so the panels hug it)
    const FE = { yt: 1.06, yb: 0.12, w: [[-0.2, 0.15], [-0.05, 0.185], [0.1, 0.21], [0.3, 0.222], [0.5, 0.222], [0.65, 0.205], [0.76, 0.17], [0.85, 0.12], [0.92, 0.075]].map(([z, w]) => [z, w * K]),
      t: 0.5, b: 0.72, p: 2.4 };
    const feX = surfX(FE, -1, 2), env = (z, y) => Math.max(feX(z, y), noseX(z, y) + 0.004);
    const arc = z => { const d = z - FW.z, r = 0.365; return Math.abs(d) < r ? FW.y + Math.sqrt(r * r - d * d) : 0; };
    const lip = z => z > 0.78 ? 0.62 + (z - 0.78) / 0.125 * 0.195 : 0, zr = st === 2 ? -0.1 : -0.06;
    const TOP = [[zr, 0.36], [0.02, 0.56], [0.12, 0.68], [0.25, 0.775], [0.4, 0.845], [0.55, 0.88], [0.7, 0.89], [0.8, 0.87], [0.88, 0.835], [0.905, 0.815]];
    const ptop = z => kc(TOP, z), pbot = z => Math.max(0.33, arc(z), lip(z));
    panels(m, 'sideIn' + st, env, span(zr - 0.06, 0.6, nu), z => ptop(z) - 0.035, z => Math.max(0.27, arc(z) - 0.014), 0, 0.004, nv, BLACK, 'lam', null);
    panels(m, 'side' + st, env, span(zr, 0.905, nu), ptop, pbot, 0.005, 0.005, nv, paint, 'carPaint');
    // livery: accent stripe following the top edge
    const fw = z => kc([[0.14, 0.0], [0.26, 0.02], [0.6, 0.028], [0.86, 0.008]], z);
    panels(m, 'flash' + st, env, span(0.14, 0.86, nu), z => ptop(z) - 0.022, z => ptop(z) - 0.022 - fw(z), 0.0105, 0.0012, 2, acc, 'carPaint', null);
    // vents (black, clipped to the panel)
    const vent = (key, z0, z1, top, bot) => panels(m, key + st, env, span(z0, z1, hi ? 10 : 3), z => Math.min(top(z), ptop(z) - 0.03),
      z => Math.max(bot(z), pbot(z) + 0.025), 0.0105, 0.0012, 1, BLACK, 'lam', null);
    if (st === 1) for (let k = 0; k < 3; k++) {
      const z0 = 0.1 + 0.022 * k, z1 = z0 + 0.17, y0 = 0.56 - 0.055 * k, tp = z => y0 + (z - z0) * 0.55;
      vent('gill' + k, z0, z1, tp, z => tp(z) - 0.022 * Math.sqrt(Math.sin(Math.PI * clamp01((z - z0) / (z1 - z0)))));
    } else if (st === 3) vent('duct', 0.16, 0.42, z => 0.5 + (z - 0.16) * 0.62, z => 0.5 + (z - 0.16) * 0.62 - 0.05 * Math.sqrt(Math.sin(Math.PI * clamp01((z - 0.16) / 0.26))));
    else vent('outlet', 0.22, 0.44, z => 0.665 + (z - 0.22) * 0.32, z => 0.665 + (z - 0.22) * 0.32 - 0.03 * Math.sqrt(Math.sin(Math.PI * clamp01((z - 0.22) / 0.22))));
    if (st === 3) for (const s of [-1, 1]) for (const [dy, dz, w] of [[0, 0, 0.09], [-0.045, -0.02, 0.07]]) {   // carbon winglets
      const x0 = env(0.7 + dz, 0.8 + dy);
      m.add(GEO.box, M4(s * (x0 + w / 2), 0.8 + dy, 0.7 + dz, 0.06, 0, -s * 0.12, w, 0.008, 0.11), lin('#1c1d22'), 'paint');
    }
    // belly pan
    m.add(bodyParts('belly', { yt: 0.36, yb: [[-0.14, 0.25], [-0.04, 0.17], [0.12, 0.135], [0.28, 0.15], [0.36, 0.24]],
      w: [[-0.14, 0.09], [0, 0.12], [0.2, 0.132], [0.36, 0.11]], t: 0.95, b: 0.85, p: 3.2 }, -0.14, 0.36, n, step * 2).a, M4(), st === 2 ? paint : BLACK, st === 2 ? 'carPaint' : 'lam');
    // mirrors on the fairing
    for (const s of [-1, 1]) {
      const b = v3(s * (noseX(0.63, 0.925) - 0.005), 0.925, 0.63), h = v3(s * 0.29, 0.99 + (st === 2 ? 0.04 : 0), 0.6);
      m.add(GEO.box, link(b, h, 0.014, 0.03), BLACK, 'lam');
      mirrorHead(o, s, h, true);
    }
    // tank, airbox cover, seat, tail
    tank(o, 'tank' + (st === 2 ? 2 : 1), { yt: [[-0.17, 0.86], [-0.08, 0.912], [0.02, 0.968], [0.14, 1.018], [0.25, 1.038], [0.31, 1.035], [0.35, 1.012]],
      yb: [[-0.17, 0.80], [0.0, 0.775], [0.2, 0.78], [0.35, 0.84]],
      w: [[-0.17, 0.105], [-0.07, 0.13], [0.04, 0.165], [0.18, 0.19], [0.29, 0.185], [0.35, 0.16]].map(([z, w]) => [z, w * (st === 2 ? 1.05 : 1)]),
      t: [[-0.17, 0.62], [0.1, 0.5], [0.35, 0.55]], b: 0.92, p: 3.4 }, -0.17, 0.35);
    m.add(bodyParts('airbox', { yt: [[0.33, 1.02], [0.395, 0.94]], yb: [[0.33, 0.85], [0.395, 0.87]], w: [[0.33, 0.15], [0.395, 0.1]], t: 0.7, p: 3 }, 0.33, 0.395, n, 0.03).a, M4(), BLACK, 'lam');
    const sw = st === 2 ? 1.12 : 1;
    seat(o, 'seat' + (st === 2 ? 2 : 1), { yt: [[-0.52, 0.875], [-0.44, 0.862], [-0.3, 0.853], [-0.16, 0.85], [-0.12, 0.855]], yb: 0.78,
      w: [[-0.52, 0.10 * sw], [-0.42, 0.125 * sw], [-0.22, 0.135 * sw], [-0.12, 0.115]], t: 0.82, b: 0.9, p: 3.4 }, -0.52, -0.12);
    tailBody(o, 'tail' + st, [null,
      { yt: [[-0.985, 1.02], [-0.9, 1.0], [-0.75, 0.965], [-0.62, 0.92], [-0.52, 0.875], [-0.44, 0.845]], yb: [[-0.985, 0.955], [-0.85, 0.89], [-0.7, 0.82], [-0.55, 0.775], [-0.44, 0.75]],
        w: [[-0.985, 0.05], [-0.88, 0.07], [-0.72, 0.1], [-0.56, 0.125], [-0.44, 0.13]], t: 0.7, b: 0.8, p: 2.6 },
      { yt: [[-1.0, 0.975], [-0.92, 0.985], [-0.78, 0.97], [-0.62, 0.935], [-0.5, 0.89], [-0.44, 0.86]], yb: [[-1.0, 0.89], [-0.85, 0.84], [-0.7, 0.8], [-0.55, 0.77], [-0.44, 0.75]],
        w: [[-1.0, 0.08], [-0.9, 0.11], [-0.75, 0.135], [-0.58, 0.145], [-0.44, 0.145]], t: 0.75, b: 0.85, p: 2.8 },
      { yt: [[-0.99, 1.06], [-0.9, 1.04], [-0.76, 0.995], [-0.62, 0.935], [-0.52, 0.88], [-0.44, 0.85]], yb: [[-0.99, 1.0], [-0.86, 0.92], [-0.7, 0.835], [-0.55, 0.78], [-0.44, 0.755]],
        w: [[-0.99, 0.042], [-0.88, 0.065], [-0.72, 0.095], [-0.56, 0.12], [-0.44, 0.128]], t: 0.7, b: 0.8, p: 2.6 }][st], st !== 3);
  }

  // ---- naked streetfighter: muscular tank, radiator shrouds, compact LED headlight, fly screen, short tail ----
  function nakedBody(o) {
    const { m, hi, paint, acc, n, step, nu, nv } = o;
    tank(o, 'tank0', { yt: [[-0.17, 0.87], [-0.07, 0.94], [0.05, 1.01], [0.18, 1.05], [0.29, 1.055], [0.36, 1.025]],
      yb: [[-0.17, 0.81], [0.1, 0.78], [0.36, 0.83]], w: [[-0.17, 0.11], [-0.06, 0.14], [0.07, 0.19], [0.2, 0.215], [0.3, 0.21], [0.36, 0.18]], t: [[-0.17, 0.6], [0.2, 0.5], [0.36, 0.55]], b: 0.9, p: 3.5 }, -0.17, 0.36);
    // angular radiator shrouds at the front corners of the tank
    const shX = (z, y) => kc([[0.22, 0.205], [0.34, 0.226], [0.45, 0.226], [0.53, 0.205]], z) - (y - 0.86) * (y - 0.86) * 0.6;
    const stop = z => kc([[0.22, 0.965], [0.34, 0.99], [0.44, 0.98], [0.53, 0.945]], z), sbot = z => kc([[0.22, 0.95], [0.3, 0.83], [0.38, 0.71], [0.46, 0.8], [0.53, 0.935]], z);
    panels(m, 'shroudIn', shX, span(0.2, 0.51, nu), z => stop(z) - 0.03, z => sbot(z) - 0.022, 0, 0.004, nv, BLACK, 'lam', null);
    panels(m, 'shroud', shX, span(0.22, 0.53, nu), stop, sbot, 0.005, 0.005, nv, paint, 'carPaint');
    panels(m, 'shroudAcc', shX, span(0.3, 0.5, hi ? 12 : 4), z => sbot(z) + 0.03, z => sbot(z) + 0.012, 0.0105, 0.0012, 1, acc, 'carPaint', null);
    // headlight: black housing, lens, twin projectors and a DRL bar
    const HL = { yt: [[0.5, 1.0], [0.6, 0.995], [0.655, 0.975]], yb: [[0.5, 0.86], [0.6, 0.865], [0.655, 0.88]], w: [[0.5, 0.07], [0.58, 0.098], [0.655, 0.085]], t: 0.8, b: 0.55, p: 3.2 };
    addParts(m, bodyParts('hlamp', HL, 0.5, 0.655, n, 0.03, (a, x, y, z) => a < 0 && z > 0.6 ? 'lens' : 'blk', 36), { lens: [LENS_H, 'glass'], blk: [BLACK, 'lam'] });
    for (const s of [-1, 1]) {
      m.add(GEO.box, M4(s * 0.033, 0.915, 0.657, 0, 0, s * 0.18, 0.045, 0.022, 0.004), LED_H, 'light');
      m.add(GEO.box, link(v3(s * 0.09, 0.93, 0.47), v3(s * 0.07, 0.93, 0.53), 0.012, 0.03), DARK, 'lam');   // brackets
    }
    m.add(GEO.box, M4(0, 0.957, 0.657, 0, 0, 0, 0.12, 0.008, 0.004), LED_H, 'light');
    m.add(tbox(0.7, 1), M4(0, 1.04, 0.6, -0.6, 0, 0, 0.15, 0.1, 0.005), SMOKE, 'glass');                          // fly screen
    seat(o, 'seat0', { yt: [[-0.5, 0.88], [-0.42, 0.862], [-0.28, 0.853], [-0.16, 0.85], [-0.12, 0.856]], yb: 0.79,
      w: [[-0.5, 0.1], [-0.4, 0.125], [-0.22, 0.135], [-0.12, 0.115]], t: 0.82, b: 0.9, p: 3.4 }, -0.5, -0.12);
    tailBody(o, 'tail0', { yt: [[-0.87, 0.99], [-0.78, 0.975], [-0.64, 0.935], [-0.52, 0.885], [-0.44, 0.85]], yb: [[-0.87, 0.94], [-0.74, 0.86], [-0.6, 0.8], [-0.44, 0.76]],
      w: [[-0.87, 0.035], [-0.78, 0.065], [-0.62, 0.105], [-0.44, 0.128]], t: 0.7, b: 0.8, p: 2.5 }, true);
  }

  // ---- licence plate hanger with indicators and a Vietnamese two-line plate ----
  function rearEnd(o) {
    const { m, hi } = o, t = o.tail;
    // tail tidy: a wide black plastic piece from under the tail down to the plate
    m.add(pathLoft('hanger' + o.st, [v3(0, t.yb - 0.025, t.z + 0.2), v3(0, t.yb - 0.06, t.z + 0.08), v3(0, 0.77, t.z - 0.0), v3(0, 0.7, t.z - 0.03)],
      t2 => [0.06 - 0.012 * t2, 0.011, 4], hi ? 10 : 4, 8), M4(), BLACK, 'lam');
    const pz = t.z - 0.045, py = 0.625;
    m.add(GEO.box, M4(0, py, pz, 0.25, 0, 0, 0.2, 0.15, 0.01), BLACK, 'lam');
    m.add(GEO.box, M4(0, py + 0.0013, pz - 0.0055, 0.25, 0, 0, 0.19, 0.14, 0.004), [1, 1, 1], 'lam', { uv: 'plM' + o.plate });
    m.add(GEO.box, M4(0, py + 0.088, t.z - 0.034, 0.25, 0, 0, 0.05, 0.01, 0.006), LED_H, 'light');                  // plate light
    m.add(GEO.box, M4(0, py - 0.095, t.z - 0.03, 0, 0, 0, 0.06, 0.022, 0.006), lin('#9a0a06'), 'light');             // reflector
    for (const s of [-1, 1]) {
      const p0 = v3(s * 0.04, 0.745, t.z - 0.005), p1 = v3(s * 0.115, 0.75, t.z - 0.015);
      m.add(GEO.cyl, link(p0, p1, 0.007), BLACK, 'lam');
      m.add(GEO.box, M4(p1.x + s * 0.012, p1.y, p1.z, 0, 0, 0, 0.035, 0.016, 0.022), BLACK, 'lam');
      m.add(GEO.box, M4(p1.x + s * 0.014, p1.y, p1.z - 0.012, 0, 0, 0, 0.03, 0.01, 0.003), AMB, 'light');
    }
  }

  // ---- bars, clip-ons, switchgear, levers, master cylinder, TFT dash ----
  function controls(o) {
    const { m, hi, st, pz, top } = o, f = o.fork, gw = pz.gripW, gy = pz.grip.y - 0.02, gz = pz.grip.z;
    for (const s of [-1, 1]) {
      const inner = v3(s * (gw - 0.085), gy, gz), outer = v3(s * (gw + 0.035), gy - 0.004, gz - 0.008);
      if (st === 0) {
        m.add(GEO.cyl, link(v3(s * 0.045, top.y + 0.015, top.z - 0.02), v3(s * 0.045, gy + 0.042, gz + 0.025), 0.015), DARK, 'chrome');   // risers
        m.add(GEO.cyl, link(v3(0, gy + 0.042, gz + 0.025), inner, 0.0145), DARK, 'chrome');                                                 // tapered bar
        const b = v3(s * (gw - 0.12), gy + 0.02, gz + 0.01), h = v3(s * (gw - 0.06), gy + 0.15, gz + 0.035);
        m.add(GEO.cyl, link(b, h, 0.007), DARK, 'chrome');
        mirrorHead(o, s, h, false);
      } else {
        m.add(GEO.cyl16, link(f.at(0.012, s * 0.105), f.at(0.062, s * 0.105), 0.036), DARK, 'chrome');                                     // clip-on clamp
        m.add(GEO.cyl, link(f.at(0.037, s * 0.105), inner, 0.0115), ALU, 'chrome');
      }
      m.add(GEO.cyl, link(inner, outer, 0.021), RUBBER, 'lam');                                                                             // grip
      m.add(GEO.cyl16, link(outer, outer.clone().add(v3(s * 0.022, 0, 0)), 0.017), ALU, 'chrome');                                         // bar end
      m.add(GEO.box, M4(s * (gw - 0.105), gy + 0.004, gz + 0.004, 0, 0, 0, 0.04, 0.05, 0.055), BLACK, 'lam');                               // switchgear
      if (hi) m.add(GEO.box, link(v3(s * (gw - 0.1), gy + 0.01, gz + 0.04), v3(s * (gw + 0.025), gy - 0.008, gz + 0.075), 0.011, 0.014), ALU, 'chrome');   // lever
      if (s < 0) {   // front brake master cylinder and its reservoir
        m.add(GEO.cyl, link(v3(s * (gw - 0.17), gy + 0.01, gz + 0.02), v3(s * (gw - 0.125), gy + 0.01, gz + 0.02), 0.016), BLACK, 'lam');
        if (hi) m.add(GEO.cyl16, M4(s * (gw - 0.16), gy + 0.055, gz, 0, 0, 0, 0.018, 0.04, 0.018), lin('#3a3a30'), 'glass');
      }
    }
    // TFT dash facing the rider
    const rx = -2.5, nD = v3(0, -Math.sin(rx), Math.cos(rx)), dp = st === 0 ? v3(0, top.y + 0.045, top.z + 0.02) : v3(0, top.y + 0.075, top.z + 0.035), k = st === 0 ? 0.82 : 1;
    m.add(GEO.box, M4(dp.x, dp.y, dp.z, rx, 0, 0, 0.17 * k, 0.11 * k, 0.03), BLACK, 'lam');
    const sp = dp.clone().addScaledVector(nD, 0.0155);
    m.add(GEO.box, M4(sp.x, sp.y, sp.z, rx, 0, 0, 0.14 * k, 0.08 * k, 0.004), TFT, 'light');
  }

  // ---- rear-set footrests, heel guards, gear / brake levers, pillion pegs ----
  function footrests(o) {
    const { m, hi, st } = o;
    for (const s of [-1, 1]) {
      const peg = v3(s * 0.165, 0.385, -0.165);
      m.add(tbox(1, 0.7), link(v3(s * 0.15, 0.53, -0.13), v3(s * 0.157, 0.37, -0.2), 0.008, 0.07), ALU, 'chrome');      // hanger plate
      m.add(GEO.cyl, link(peg, peg.clone().add(v3(s * 0.07, 0, 0)), 0.011), ALU, 'chrome');                         // peg
      if (hi) m.add(GEO.box, M4(s * 0.16, 0.43, -0.235, 0.35, 0, 0, 0.006, 0.08, 0.075), ALU, 'chrome');               // heel guard
      m.add(GEO.box, link(v3(s * 0.175, 0.39, -0.15), v3(s * 0.19, 0.405, -0.06), 0.009, 0.012), ALU, 'chrome');      // gear / brake lever
      if (hi && st !== 3) {
        m.add(GEO.box, link(v3(s * 0.12, 0.66, -0.4), v3(s * 0.14, 0.52, -0.5), 0.008, 0.04), BLACK, 'lam');
        m.add(GEO.cyl, link(v3(s * 0.14, 0.515, -0.5), v3(s * 0.2, 0.515, -0.5), 0.009), BLACK, 'lam');
      }
    }
  }
  function policeKit(o) {
    const { m } = o;
    for (const s of [-1, 1]) {
      m.add(C('pannier' + s, () => loft([[-0.42, 0.09, 0.88, 0.56, 4, s * 0.25], [-0.62, 0.1, 0.9, 0.55, 4, s * 0.26], [-0.84, 0.08, 0.87, 0.58, 4, s * 0.25]], 16, 42)), M4(), lin('#f2f2f2'), 'carPaint');
      m.add(GEO.box, M4(s * 0.352, 0.72, -0.63, 0, 0, 0, 0.004, 0.06, 0.42), lin('#1a3a9a'), 'paint');
      m.add(GEO.box, M4(s * 0.351, 0.785, -0.63, 0, 0, 0, 0.004, 0.012, 0.42), lin('#e8c020'), 'paint');
    }
    m.add(GEO.cyl, link(v3(0, 0.95, -0.78), v3(0, 1.16, -0.8), 0.014), DARK, 'lam');
    m.add(GEO.box, M4(0, 1.16, -0.8, 0, 0, 0, 0.24, 0.03, 0.06), DARK, 'lam');
  }

  function buildBike(m, pal, st, hi) {
    const paint = lin(pal.bike), lum = paint[0] * 0.2126 + paint[1] * 0.7152 + paint[2] * 0.0722, police = !!pal.police;
    let h = 0; for (const ch of pal.id) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const o = {
      m, hi, st, police, paint, pz: posture(st), n: hi ? 24 : 12, step: hi ? 0.04 : 0.1, nu: hi ? 22 : 8, nv: hi ? 5 : 2,
      acc: pal.stripe ? lin(pal.stripe) : lum > 0.3 ? lin('#16171b') : lin('#f2f2ef'), plate: police ? 4 : (h >>> 0) % 4,
      top: v3(0, st === 0 ? 1.0 : 0.975, 0.43),
      rim: police ? lin('#5c6068') : [lin('#18191d'), lin('#18191d'), lin('#3a3d44'), GOLD][st],
      rimStripe: police ? null : [lin('#d4501c'), paint, null, null][st],
      spokes: [[6, 0], [5, 0.17], [3, 0.3], [7, 0]][st],
      cal: [lin('#c9a22a'), BRAKE, GOLD, BRAKE][st], carrier: [DARK, ALU, ALU, GOLD][st],
      forkUp: [lin('#b67a22'), DARK, lin('#2c2e34'), GOLD][st], forkLow: st === 3 ? lin('#3b3328') : CHROME, forkCap: [GOLD, GOLD, ALU, lin('#c02020')][st],
      frameCol: [lin('#c23c18'), lin('#6c7078'), lin('#2c2e34'), lin('#24262b')][st], armCol: [lin('#6c7078'), lin('#6c7078'), lin('#2c2e34'), lin('#8e939b')][st],
      camCol: [lin('#c23c18'), lin('#202227'), lin('#8e949c'), lin('#b81c1c')][st], spring: [lin('#e0b420'), lin('#c03020'), lin('#c03020'), lin('#e8c020')][st],
    };
    bikeWheel(m, FW, o, true); bikeWheel(m, RW, o, false);
    frontEnd(o); engine(o); frame(o); swingarm(o); exhaust(o);
    if (st === 0) nakedBody(o); else fairedBody(o);
    rearEnd(o); controls(o); footrests(o);
    if (police) policeKit(o);
  }

  function buildRiderStatic(m, pal, st) {
    const pz = posture(st), jacket = lin(pal.jacket), pants = lin(pal.pants), helmet = lin(pal.helmet);
    const H = pz.hip, S = pz.sh, Hd = pz.head, sport = st === 1 || st === 3;
    m.add(GEO.sph, M4(0, H.y + 0.02, H.z, 0, 0, 0, 0.19, 0.12, 0.17), pants, 'lam');                               // pelvis
    const dirT = _d.copy(S).sub(H).normalize().clone();
    m.add(taper(0.85, 1, 12), link(H.clone().add(v3(0, 0.03, 0)), S, 0.2, 0.15), jacket, 'lam');                 // torso
    m.add(GEO.sph, M4(0, S.y - 0.02, S.z - 0.03, Math.atan2(dirT.z, dirT.y), 0, 0, 0.215, 0.13, 0.17), jacket, 'lam');
    for (const s of [-1, 1]) m.add(GEO.sph, M4(s * 0.19, S.y - 0.02, S.z - 0.02, 0, 0, 0, 0.085), jacket, 'lam'); // shoulders
    const back = v3(0, dirT.z, -dirT.y), mid = H.clone().lerp(S, 0.55);
    if (sport) {   // aero hump of a racing suit
      const hp = S.clone().addScaledVector(back, 0.12).addScaledVector(dirT, -0.1);
      m.add(GEO.sph, new T.Matrix4().compose(hp, new T.Quaternion().setFromUnitVectors(_up, dirT), v3(0.1, 0.16, 0.07)), jacket, 'lam');
    }
    if (pal.emblem) {
      const c = mid.clone().addScaledVector(back, 0.152).addScaledVector(dirT, 0.05), q = new T.Quaternion().setFromUnitVectors(_up, back);
      m.add(GEO.cyl16, new T.Matrix4().compose(c, q, v3(0.075, 0.012, 0.075)), lin(pal.emblem), 'paint');
      for (const s of [-1, 1]) m.add(GEO.cyl6, new T.Matrix4().compose(c.clone().add(v3(s * 0.1, 0, 0)), q, v3(0.075, 0.008, 0.03)), lin(pal.emblem), 'paint');
    }
    m.add(GEO.cyl, link(S.clone().add(v3(0, 0.0, 0.03)), Hd.clone().add(v3(0, -0.08, -0.04)), 0.06), lin('#222'), 'lam'); // neck
    m.add(GEO.sph, M4(Hd.x, Hd.y, Hd.z, 0.15, 0, 0, 0.145, 0.142, 0.16), helmet, 'paint');
    m.add(new T.SphereGeometry(1, 16, 8, Math.PI / 2 - 0.95, 1.9, 1.15, 0.75), M4(Hd.x, Hd.y, Hd.z, 0.15, 0, 0, 0.149, 0.146, 0.164), lin('#151a24'), 'glass');
    if (pal.stripe) m.add(GEO.sph, M4(Hd.x, Hd.y, Hd.z, 0.15, 0, 0, 0.035, 0.1445, 0.1625), lin(pal.stripe), 'paint');
    m.add(GEO.sph, M4(Hd.x, Hd.y - 0.08, Hd.z + 0.08, 0.6, 0, 0, 0.11, 0.06, 0.08), helmet, 'paint');
    m.add(GEO.sph, M4(Hd.x, Hd.y + 0.072, Hd.z - 0.125, 0.55, 0, 0, 0.058, 0.02, 0.06), helmet, 'paint');           // helmet spoiler
    if (pal.hair) {                                                                                                // pony tail blowing back
      const hc = lin(pal.hair), a = Hd.clone().add(v3(0, -0.02, -0.13)), b = Hd.clone().add(v3(0, -0.16, -0.40));
      m.add(taper(0.05, 0.035), link(a, b, 1, 0.8), hc, 'lam', { jit: 0.1 });
      m.add(GEO.sphLo, M4(b.x, b.y - 0.02, b.z - 0.03, 0, 0, 0, 0.035, 0.05, 0.06), hc, 'lam');
    }
  }

  // ---- arms + legs (dynamic: rewritten while attacking). Armed = swing the weapon; unarmed = side kick ----
  const ARM_PARTS = ['up', 'elb', 'fore', 'glove', 'club', 'cTip', 'ch0', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'thigh', 'knee', 'shin', 'ankle', 'boot', 'slider'];
  const _wp = new T.Vector3(), _wq = new T.Quaternion(), _ws = new T.Vector3(), _wn = new T.Vector3();
  function unitArrays(g) { const n = g.index ? g.toNonIndexed() : g; return { p: n.attributes.position.array, n: n.attributes.normal.array }; }
  const ARM_GEO = { up: unitArrays(taper(1, 0.85, 8)), elb: unitArrays(GEO.sphLo), fore: unitArrays(taper(1, 0.8, 8)), glove: unitArrays(GEO.sphLo),
    club: unitArrays(taper(0.8, 1.2, 6)), cTip: unitArrays(GEO.sphLo), ch: unitArrays(new T.TorusGeometry(1, 0.32, 4, 8)),
    thigh: unitArrays(taper(0.095, 0.072, 8)), knee: unitArrays(GEO.sphLo), shin: unitArrays(taper(0.066, 0.05, 8)), ankle: unitArrays(GEO.sphLo),
    boot: unitArrays(GEO.box), slider: unitArrays(GEO.box) };
  const smooth01 = x => x * x * (3 - 2 * x);
  // 0..1 envelope of an attack (used for the body roll while kicking)
  const atkEnv = t => t < 0.12 ? smooth01(t / 0.12) : t < 0.22 ? 1 : 1 - smooth01(Math.min(1, (t - 0.22) / 0.14));
  class LimbRig {
    constructor(pal, st) {
      this.pz = posture(st);
      const cols = { up: lin(pal.jacket), elb: lin(pal.jacket), fore: lin(pal.jacket), glove: lin(pal.glove || '#26242a'),
        club: lin('#6a4220'), cTip: lin('#4a2e14'), ch: lin('#b8bcc4'), thigh: lin(pal.pants), knee: lin(pal.pants), shin: lin(pal.pants),
        ankle: lin('#18161a'), boot: lin('#18161a'), slider: lin('#4a4c52') };
      this.slots = []; let n = 0;
      for (let side = 0; side < 2; side++) for (const k of ARM_PARTS) {
        const kk = k.startsWith('ch') ? 'ch' : k, g = ARM_GEO[kk];
        this.slots.push({ k, side, g, c: cols[kk], off: n }); n += g.p.length / 3;
      }
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      for (const s of this.slots) for (let i = 0; i < s.g.p.length / 3; i++) col.set(s.c, (s.off + i) * 3);
      const wuv = G3.uvRect('white');
      for (let i = 0; i < n; i++) { uv[i * 2] = (wuv[0] + wuv[2]) / 2; uv[i * 2 + 1] = (wuv[1] + wuv[3]) / 2; }
      const g = this.geo = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
      g.setAttribute('normal', new T.BufferAttribute(nor, 3).setUsage(T.DynamicDrawUsage));
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      g.setAttribute('uv', new T.BufferAttribute(uv, 2));
      g.boundingSphere = new T.Sphere(v3(0, 0.9, 0), 1.6);
      this.m = new T.Matrix4(); this.key = '';
      this.pose(0, 0, null, true);
    }
    write(slot, m) {
      const P = this.geo.attributes.position.array, N = this.geo.attributes.normal.array, e = m.elements, s = this.slots[slot];
      m.decompose(_wp, _wq, _ws);
      for (let i = 0, o = s.off * 3; i < s.g.p.length; i += 3, o += 3) {
        const x = s.g.p[i], y = s.g.p[i + 1], z = s.g.p[i + 2];
        P[o] = e[0] * x + e[4] * y + e[8] * z + e[12]; P[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; P[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        _wn.set(s.g.n[i], s.g.n[i + 1], s.g.n[i + 2]).applyQuaternion(_wq); N[o] = _wn.x; N[o + 1] = _wn.y; N[o + 2] = _wn.z;
      }
    }
    hide(slot) { const s = this.slots[slot]; this.geo.attributes.position.array.fill(0, s.off * 3, (s.off + s.g.p.length / 3) * 3); }
    // blend rest -> wind-up -> strike -> rest over the 0.36 s attack
    static phase(t, rest, up, out) {
      if (t < 0.12) return rest.clone().lerp(up, smooth01(t / 0.12));
      if (t < 0.22) return up.clone().lerp(out, smooth01((t - 0.12) / 0.1));
      return out.clone().lerp(rest, smooth01(Math.min(1, (t - 0.22) / 0.14)));
    }
    // atkSide: -1 left / +1 right / 0 none; t: attack time; weapon: 'club' | 'chain' | null (null = kick)
    pose(atkSide, t, weapon, force) {
      const key = atkSide ? atkSide + '|' + t.toFixed(3) + '|' + weapon : 'rest';
      if (key === this.key && !force) return;
      this.key = key;
      const pz = this.pz, NP = ARM_PARTS.length, ph = LimbRig.phase;
      for (let side = 0; side < 2; side++) {
        const raceSide = side ? 1 : -1, xs = -raceSide, base = side * NP, me = atkSide === raceSide;
        // ---- arm ----
        const Sh = v3(xs * 0.19, pz.sh.y - 0.01, pz.sh.z - 0.02);
        const restE = Sh.clone().add(v3(xs * 0.07, -0.19, 0.19)), restH = v3(xs * pz.gripW, pz.grip.y, pz.grip.z - 0.02);
        let E = restE, Hn = restH, wk = 0;
        const armed = me && !!weapon, kick = me && !weapon;
        if (armed) {
          const upE = Sh.clone().add(v3(xs * 0.2, 0.2, -0.04)), upH = Sh.clone().add(v3(xs * 0.24, 0.44, -0.16));
          const outE = Sh.clone().add(v3(xs * 0.3, 0.0, 0.1)), outH = Sh.clone().add(v3(xs * 0.6, -0.02, 0.16));
          E = ph(t, restE, upE, outE); Hn = ph(t, restH, upH, outH);
          wk = t < 0.12 ? smooth01(t / 0.12) : t < 0.22 ? 1 - smooth01((t - 0.12) / 0.1) * 0.8 : 0.2 * (1 - smooth01(Math.min(1, (t - 0.22) / 0.14)));
        }
        this.write(base, link(Sh, E, 0.058, 0.058, this.m));
        this.write(base + 1, this.m.compose(E, _q.identity(), _s.set(0.052, 0.052, 0.052)));
        this.write(base + 2, link(E, Hn, 0.05, 0.05, this.m));
        this.write(base + 3, this.m.compose(Hn, _q.identity(), _s.set(0.055, 0.05, 0.062)));
        const dir = Hn.clone().sub(E).normalize().add(v3(0, 0.6 + wk * 1.4, 0)).normalize();
        if (armed && weapon === 'club') {
          const tip = Hn.clone().addScaledVector(dir, 0.72);
          this.write(base + 4, link(Hn.clone().addScaledVector(dir, -0.06), tip, 0.028, 0.028, this.m));
          this.write(base + 5, this.m.compose(tip, _q.identity(), _s.set(0.04, 0.04, 0.04)));
        } else { this.hide(base + 4); this.hide(base + 5); }
        for (let k = 0; k < 6; k++) {
          if (armed && weapon === 'chain') {
            const pnt = Hn.clone().addScaledVector(dir, 0.1 + k * 0.1).add(v3(0, -0.012 * k * k * (1 - wk), 0));
            _e.set(k % 2 ? Math.PI / 2 : 0, 0, Math.atan2(dir.x, dir.y)); _q.setFromEuler(_e);
            this.write(base + 6 + k, this.m.compose(pnt, _q, _s.set(0.05, 0.05, 0.05)));
          } else this.hide(base + 6 + k);
        }
        // ---- leg: knee tucked against the tank, toes on the rear-set peg; kick = knee up, then stamp sideways ----
        const J = v3(xs * 0.13, pz.hip.y - 0.02, pz.hip.z + 0.02);
        const rK = v3(xs * pz.kneeX, pz.knee.y, pz.knee.z), rA = v3(xs * 0.17, pz.ankle.y, pz.ankle.z), rT = v3(xs * 0.17, pz.toe.y, pz.toe.z);
        let K = rK, A = rA, Tt = rT;
        if (kick) {
          const uK = J.clone().add(v3(xs * 0.2, 0.02, 0.24)), uA = uK.clone().add(v3(xs * 0.1, -0.31, -0.13)), uT = uA.clone().add(v3(xs * 0.03, -0.03, 0.14));
          const oK = J.clone().add(v3(xs * 0.39, -0.09, 0.07)), oA = J.clone().add(v3(xs * 0.81, -0.16, 0.05)), oT = oA.clone().add(v3(xs * 0.04, 0.12, 0.08));
          K = ph(t, rK, uK, oK); A = ph(t, rA, uA, oA); Tt = ph(t, rT, uT, oT);
        }
        this.write(base + 12, link(J, K, 1, 1, this.m));
        this.write(base + 13, this.m.compose(K, _q.identity(), _s.set(0.074, 0.074, 0.074)));
        this.write(base + 14, link(K, A, 1, 1, this.m));
        this.write(base + 15, this.m.compose(A, _q.identity(), _s.set(0.06, 0.07, 0.07)));
        this.write(base + 16, link(A.clone().add(v3(0, 0.03, 0)).addScaledVector(Tt.clone().sub(A).normalize(), -0.05), Tt, 0.095, 0.11, this.m));
        const ko = K.clone().add(v3(xs * 0.055, -0.03, 0.03));   // knee slider puck on the outside of the knee
        this.write(base + 17, this.m.compose(ko, _q.identity(), _s.set(0.012, 0.045, 0.06)));
      }
      this.geo.attributes.position.needsUpdate = true; this.geo.attributes.normal.needsUpdate = true;
    }
  }
  // roll of the whole bike while kicking: lean away from the kick (+ = lean right)
  function kickRoll(atk, weapon) { return atk && !weapon ? -atk.side * 0.13 * atkEnv(atk.t) : 0; }

  // ---- ragdoll shown when a rider is thrown off: centred on the hips, head along +Y ----
  function buildBody(m, pal) {
    const jacket = lin(pal.jacket), pants = lin(pal.pants), helmet = lin(pal.helmet), boot = lin('#18161a'), glove = lin(pal.glove || '#26242a');
    m.add(taper(0.85, 1, 10), link(v3(0, -0.05, 0), v3(0, 0.5, 0), 0.2, 0.14), jacket, 'lam');
    m.add(GEO.sph, M4(0, 0.5, 0, 0, 0, 0, 0.22, 0.12, 0.15), jacket, 'lam');
    m.add(GEO.sph, M4(0, 0.74, 0, 0, 0, 0, 0.145, 0.15, 0.16), helmet, 'paint');
    m.add(new T.SphereGeometry(1, 14, 6, Math.PI / 2 - 0.9, 1.8, 1.15, 0.7), M4(0, 0.74, 0, 0, 0, 0, 0.149, 0.154, 0.164), lin('#151a24'), 'glass');
    for (const s of [-1, 1]) {
      const sh = v3(s * 0.2, 0.46, 0), el = v3(s * 0.45, 0.6, 0.08), ha = v3(s * 0.66, 0.78, 0.04);
      m.add(taper(1, 0.85, 8), link(sh, el, 0.058), jacket, 'lam'); m.add(taper(1, 0.8, 8), link(el, ha, 0.05), jacket, 'lam');
      m.add(GEO.sphLo, M4(ha.x, ha.y, ha.z, 0, 0, 0, 0.055), glove, 'lam');
      const hp = v3(s * 0.12, -0.05, 0), kn = v3(s * 0.26, -0.48, 0.1), an = v3(s * 0.34, -0.9, 0);
      m.add(taper(0.095, 0.075), link(hp, kn, 1), pants, 'lam'); m.add(taper(0.068, 0.05), link(kn, an, 1), pants, 'lam');
      m.add(GEO.box, link(an, an.clone().add(v3(0, -0.04, 0.2)), 0.1, 0.12), boot, 'lam');
    }
  }

  const riderGeoCache = new Map();
  // returns { root (yaw/pitch), lean (roll), bike / bikeLo groups, rider group, arms: LimbRig, body: group, sirens, setDetail(hi) }
  function rider(pal, st) {
    const key = pal.id + '|' + st;
    let gs = riderGeoCache.get(key);
    if (!gs) {
      const mb = new Mesher(3), ml = new Mesher(3), mr = new Mesher(4), md = new Mesher(5);
      buildBike(mb, pal, st, true); buildBike(ml, pal, st, false); buildRiderStatic(mr, pal, st); buildBody(md, pal);
      gs = { bike: mb.geos(), lo: ml.geos(), rider: mr.geos(), body: md.geos() };
      riderGeoCache.set(key, gs);
    }
    const M = G3.mats, mk = (geos, cast) => {
      const g = new T.Group();
      // small chrome / glass parts (spokes, discs, levers, screen) add nothing to the soft shadow
      for (const k in geos) { const mesh = new T.Mesh(geos[k], M[k]); mesh.castShadow = cast && k !== 'light' && k !== 'chrome' && k !== 'glass'; g.add(mesh); }
      return g;
    };
    const root = new T.Group(), lean = new T.Group(), bike = mk(gs.bike, true), bikeLo = mk(gs.lo, true), rid = mk(gs.rider, true), body = mk(gs.body, true);
    root.rotation.order = 'YXZ'; body.rotation.order = 'YXZ';
    const arms = new LimbRig(pal, st), armMesh = new T.Mesh(arms.geo, M.lam); armMesh.castShadow = true;
    // wheelie pivot on the rear axle: root -> pitch (at the axle) -> piv (back to the origin) -> lean (roll)
    const pitch = new T.Group(), piv = new T.Group();
    pitch.position.set(0, RW.y, RW.z); piv.position.set(0, -RW.y, -RW.z);
    rid.add(armMesh); lean.add(bike); lean.add(bikeLo); lean.add(rid); piv.add(lean); pitch.add(piv); root.add(pitch);
    bikeLo.visible = false;
    const o = { root, pitch, lean, bike, bikeLo, rider: rid, arms, body, sirens: null, hi: true, lights: BIKE_LIGHTS[st],
      setDetail(hi) { if (hi !== this.hi) { this.hi = hi; bike.visible = hi; bikeLo.visible = !hi; } } };
    if (pal.police) {
      const red = new T.MeshBasicMaterial({ color: '#ff2020' }), blue = new T.MeshBasicMaterial({ color: '#2050ff' });
      const r = new T.Mesh(GEO.box, red), b = new T.Mesh(GEO.box, blue);
      r.scale.set(0.09, 0.05, 0.05); b.scale.set(0.09, 0.05, 0.05); r.position.set(0.07, 1.2, -0.8); b.position.set(-0.07, 1.2, -0.8);
      const r2 = r.clone(), b2 = b.clone(); r2.position.set(0.2, 0.93, 0.64); b2.position.set(-0.2, 0.93, 0.64);
      lean.add(r, b, r2, b2);
      o.sirens = { red, blue };
    }
    return o;
  }

  // =====================================================================================
  // Cars — all traffic drives our way, so the tail of every vehicle carries most of the detail. Real-world
  // proportions of vehicles common on Vietnamese roads: B-segment sedan 4.5 x 1.75 x 1.47 m, 7-seat SUV
  // 4.72 x 1.86 x 1.8 m, 16-seat minibus 5.8 x 2.0 x 2.36 m and an 8.7 m box lorry. Hi / lo detail by distance.
  // =====================================================================================
  const TRIM = lin('#0b0c0e'), PLAST = lin('#1e1f22'), TINT = lin('#0c1117'), ALLOY = lin('#b4b9c1'), UNDER = lin('#111113'),
    LENS_R = lin('#4a0606'), LED_R = lin('#ff2614'), REFL = lin('#7a0a06'), LENS_W = lin('#a7b0ba'), LED_W = lin('#eef4ff'),
    AMBER = lin('#c87412'), W1 = [1, 1, 1];
  const kf = (K, z) => {   // piecewise-linear profile through [[z, v], ...] (ascending z)
    if (z <= K[0][0]) return K[0][1];
    for (let i = 1; i < K.length; i++) if (z <= K[i][0]) { const [z0, a] = K[i - 1], [z1, b] = K[i]; return a + (b - a) * (z - z0) / (z1 - z0); }
    return K[K.length - 1][1];
  };
  // superellipse cross-section; the half-width eases wb (bottom) -> wm (middle) -> wt (top)
  function secRing(z, s, n) {
    const r = [], yc = (s.yt + s.yb) / 2, h = (s.yt - s.yb) / 2;
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      const X = Math.sign(c) * Math.pow(Math.abs(c), 2 / s.p), Y = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / s.p);
      r.push([(Y < 0 ? s.wb + (s.wm - s.wb) * (Y + 1) : s.wm + (s.wt - s.wm) * Y) * X, yc + h * Y, z]);
    }
    r.c = [0, yc, z];
    return r;
  }
  // x of that cross-section's surface at height y
  function sideX(s, y) {
    const yc = (s.yt + s.yb) / 2, h = (s.yt - s.yb) / 2, Y = (y - yc) / h;
    if (Math.abs(Y) >= 1) return 0;
    return (Y < 0 ? s.wb + (s.wm - s.wb) * (Y + 1) : s.wm + (s.wt - s.wm) * Y) * Math.pow(1 - Math.pow(Math.abs(Y), s.p), 1 / s.p);
  }
  // loft through stations zs (f(z) -> cross-section); every quad goes to the part cls(angle, x, y, z) names
  // (angle 0 = left side, PI/2 = top, -1 = end cap); null drops it. Returns { part: geometry }
  function loftParts(zs, f, n, cls, crease = 38) {
    const rings = zs.map(z => secRing(z, f(z), n)), buf = {};
    const put = (key, a, b, c, ctr) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const gx = (a[0] + b[0] + c[0]) / 3 - ctr[0], gy = (a[1] + b[1] + c[1]) / 3 - ctr[1], gz = (a[2] + b[2] + c[2]) / 3 - ctr[2];
      const o = buf[key] || (buf[key] = []);
      if (nx * gx + ny * gy + nz * gz < 0) o.push(...a, ...c, ...b); else o.push(...a, ...b, ...c);
    };
    for (let k = 0; k < rings.length - 1; k++) {
      const A = rings[k], B = rings[k + 1], ctr = A.c.map((v, i) => (v + B.c[i]) / 2);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const key = cls((i + 1) / n * Math.PI * 2, (A[i][0] + A[j][0] + B[i][0] + B[j][0]) / 4, (A[i][1] + A[j][1] + B[i][1] + B[j][1]) / 4, (A[i][2] + B[i][2]) / 2);
        if (key) { put(key, A[i], B[i], A[j], ctr); put(key, A[j], B[i], B[j], ctr); }
      }
    }
    for (const [k, kn] of [[0, 1], [rings.length - 1, rings.length - 2]]) {
      const A = rings[k], key = cls(-1, 0, A.c[1], A.c[2]);
      if (key) for (let i = 0; i < n; i++) put(key, A.c, A[i], A[(i + 1) % n], rings[kn].c);
    }
    const out = {};
    for (const key in buf) {
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(buf[key], 3)); g.computeVertexNormals();
      out[key] = soften(g, crease);
    }
    return out;
  }
  function zSamples(z0, z1, step, extra) {
    const zs = [];
    for (let z = z0; z < z1 - 1e-6; z += step) zs.push(z);
    zs.push(z1); for (const z of extra) if (z > z0 && z < z1) zs.push(z);
    zs.sort((a, b) => a - b);
    return zs.filter((z, i) => !i || z - zs[i - 1] > 0.005);
  }
  // lower body: profile keys with semicircular wheel-arch cut-outs over each axle
  const bodyFn = (B, axles, R, rA) => z => {
    let yb = kf(B.sill, z);
    for (const za of axles) { const d = z - za; if (Math.abs(d) < rA) yb = Math.max(yb, R + Math.sqrt(rA * rA - d * d)); }
    const w = kf(B.w, z);
    return { yt: kf(B.top, z), yb, wb: w - B.tuck, wm: w, wt: w - B.shoulder, p: kf(B.p, z) };
  };
  const cabinFn = Cb => z => { const wb = kf(Cb.wb, z), wt = kf(Cb.wt, z); return { yt: kf(Cb.top, z), yb: Cb.yb, wb, wm: (wb + wt) / 2, wt, p: Cb.p }; };
  // glasshouse parts: body-coloured roof between roof[0..1] (screens fore and aft of it), pillar band along the
  // upper edges, black B-pillars, C-pillar behind cz; quads below `hide` sit inside the body and are dropped
  const cabCls = o => (a, x, y, z) => {
    if (a < 0) return y > o.hide ? (o.cap || 'glass') : null;
    if (y < o.hide) return null;
    const s = Math.sin(a);
    if (s > 0.8) return z > o.roof[0] && z < o.roof[1] ? 'paint' : 'glass';
    if (s > 0.6) return 'paint';
    if (o.side) return o.side;
    if (o.bp && o.bp.some(([b0, b1]) => z > b0 && z < b1)) return 'trim';
    if (o.cz !== undefined && z < o.cz) return o.cpil || 'paint';
    return 'glass';
  };
  const PART = (paint) => ({ paint: [paint, 'carPaint'], under: [UNDER, 'lam'], glass: [TINT, 'glass'], trim: [TRIM, 'glass'], clad: [PLAST, 'lam'] });
  // lofted body + glasshouse of a spec; returns the section functions for placing details on the surface
  function shell(m, S, paint, hi) {
    const n = hi ? 20 : 14, step = hi ? 0.09 : 0.2, ext = [], ka = hi ? 10 : 6, [z0, z1] = S.len;
    for (const za of S.axles) { for (let k = 0; k <= ka; k++) ext.push(za + S.rA * Math.cos(k / ka * Math.PI)); ext.push(za - S.rA - 0.012, za + S.rA + 0.012); }
    for (const K of [S.body.top, S.body.sill, S.body.w]) for (const [z] of K) ext.push(z);
    const fb = bodyFn(S.body, S.axles, S.R, S.rA), MAT = PART(paint);
    const add = parts => { for (const k in parts) m.add(parts[k], M4(), MAT[k][0], MAT[k][1]); };
    add(loftParts(zSamples(z0, z1, step, ext), fb, n, S.bodyCls || ((a) => a >= 0 && Math.sin(a) < -0.8 ? 'under' : 'paint')));
    const fc = cabinFn(S.cabin), Ct = S.cabin.top;
    add(loftParts(zSamples(Ct[0][0], Ct[Ct.length - 1][0], step * 0.8, Ct.map(k => k[0]).concat(S.cabin.cuts || [])), fc, hi ? 24 : 12, cabCls(S.cabin.cls)));
    // dark chassis between the wheels (seen through the arches and under the sills)
    m.add(GEO.box, M4(0, S.R + 0.05, (S.axles[0] + S.axles[S.axles.length - 1]) / 2, 0, 0, 0, (S.wheel.x - S.wheel.w / 2) * 2 - 0.04, S.R * 0.9, Math.abs(S.axles[0] - S.axles[S.axles.length - 1]) + S.rA * 2), UNDER, 'lam');
    for (const za of S.axles) for (const s of [-1, 1]) carWheel(m, s, za, S.wheel, hi);
    return { fb, fc };
  }

  function carTyreGeo(R, w, ri, segs) {
    const hw = w / 2;
    return latheX([[ri, -hw * 0.84], [R - 0.06, -hw], [R - 0.014, -hw * 0.92], [R, -hw * 0.6], [R, hw * 0.6], [R - 0.014, hw * 0.92], [R - 0.06, hw], [ri, hw * 0.84]], segs);
  }
  // road wheel; side +1 = left (outer face +X). W: { R, w, ri (rim radius), x, rim colour, spokes | steel, cal }
  function carWheel(m, side, z, W, hi, xo) {
    const x = side * (xo !== undefined ? xo : W.x), y = W.R, hw = W.w / 2, segs = hi ? 20 : 10, ry = side > 0 ? 0 : Math.PI;
    const xf = x + side * hw * 0.55;   // rim face
    m.add(C(`ctyre${W.R}|${W.w}|${W.ri}|${segs}`, () => carTyreGeo(W.R, W.w, W.ri, segs)), M4(x, y, z, 0, ry, 0), RUBBER, 'lam');
    m.add(GEO.cyl16, M4(x - side * hw * 0.35, y, z, 0, 0, Math.PI / 2, W.ri * 1.01, W.w * 0.6, W.ri * 1.01), lin('#202124'), 'lam');   // barrel (behind the rim face)
    if (!hi) { m.add(GEO.cyl16, M4(xf, y, z, 0, 0, Math.PI / 2, W.ri * 0.95, 0.012, W.ri * 0.95), mul(W.rim, 0.75), 'paint'); return; }
    m.add(C(`clip${W.ri}|${segs}`, () => latheX([[W.ri * 0.84, -0.006], [W.ri * 0.99, -0.012], [W.ri * 1.02, 0.004], [W.ri * 0.9, 0.012], [W.ri * 0.84, 0.006]], segs)),
      M4(xf, y, z, 0, ry, 0), W.rim, 'paint');
    if (W.steel) {   // painted steel disc with hand holes and a big hub
      m.add(GEO.cyl16, M4(xf - side * 0.025, y, z, 0, 0, Math.PI / 2, W.ri * 0.86, 0.02, W.ri * 0.86), W.rim, 'paint');
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; m.add(GEO.cyl, M4(xf - side * 0.012, y + Math.sin(a) * W.ri * 0.6, z + Math.cos(a) * W.ri * 0.6, 0, 0, Math.PI / 2, W.ri * 0.13, 0.012, W.ri * 0.13), UNDER, 'lam'); }
      m.add(GEO.cyl16, M4(xf - side * 0.01, y, z, 0, 0, Math.PI / 2, W.ri * 0.42, 0.06, W.ri * 0.42), mul(W.rim, 0.55), 'paint');
      return;
    }
    m.add(GEO.cyl16, M4(xf - side * 0.045, y, z, 0, 0, Math.PI / 2, W.ri * 0.8, 0.012, W.ri * 0.8), METAL, 'chrome');   // brake disc
    m.add(GEO.box, M4(xf - side * 0.065, y + W.ri * 0.5, z - W.ri * 0.5, Math.PI / 4, 0, 0, 0.05, W.ri * 0.45, 0.09), W.cal || DARK, 'paint');
    for (let k = 0; k < W.spokes; k++) {
      const a = k / W.spokes * Math.PI * 2 + 0.2, r0 = 0.05, r1 = W.ri * 0.9;
      m.add(GEO.box, link(v3(xf - side * 0.004, y + Math.sin(a) * r0, z + Math.cos(a) * r0), v3(xf - side * 0.018, y + Math.sin(a) * r1, z + Math.cos(a) * r1), 0.03, W.spokes > 6 ? 0.024 : 0.048), W.rim, 'paint');
    }
    m.add(GEO.cyl16, M4(xf, y, z, 0, 0, Math.PI / 2, 0.06, 0.03, 0.06), W.rim, 'paint');
    m.add(GEO.cyl16, M4(xf + side * 0.016, y, z, 0, 0, Math.PI / 2, 0.03, 0.006, 0.03), TRIM, 'lam');
  }
  // Vietnamese long number plate (520 x 110 mm) on a black backing; face -1 = rear
  function plate(m, x, y, z, cell, face = -1) {
    m.add(GEO.box, M4(x, y, z, 0, 0, 0, 0.57, 0.15, 0.012), TRIM, 'lam');
    m.add(GEO.box, M4(x, y, z + face * 0.009, 0, 0, 0, 0.52, 0.11, 0.008), W1, 'lam', { uv: cell });
  }
  // wing mirror on a stalk at the base of the A-pillar
  function mirror(m, s, x, y, z, paint, big) {
    const k = big ? 1.5 : 1;
    m.add(GEO.box, link(v3(s * (x - 0.1), y - 0.02, z + 0.03), v3(s * (x + 0.02), y, z), 0.03, 0.03), TRIM, 'lam');
    m.add(GEO.sph, M4(s * (x + 0.07 * k), y + 0.01, z - 0.01, 0, 0, 0, 0.075 * k, 0.055 * k, 0.05 * k), paint, 'carPaint');
    m.add(GEO.box, M4(s * (x + 0.07 * k), y + 0.01, z - 0.045 * k, 0, 0, 0, 0.13 * k, 0.085 * k, 0.012), lin('#8c96a2'), 'glass');
  }
  // vertical shut line hugging the body side between y0 and y1 (follows the side's bulge)
  function shutLine(m, s, z, f, y0, y1) {
    const sec = f(z), N = 4; let prev = null;
    for (let i = 0; i <= N; i++) {
      const y = y0 + (y1 - y0) * i / N, p = v3(s * (sideX(sec, y) + 0.002), y, z);
      if (prev) m.add(GEO.box, link(prev, p, 0.004, 0.006), TRIM, 'lam');
      prev = p;
    }
  }
  function handle(m, s, z, y, f) { m.add(GEO.box, M4(s * (sideX(f(z), y) + 0.008), y, z, 0, 0, 0, 0.018, 0.026, 0.13), CHROME, 'chrome'); }

  const CAR_SPEC = {
    sedan: {
      len: [-2.26, 2.25], R: 0.31, axles: [1.33, -1.27], rA: 0.375,
      wheel: { R: 0.31, w: 0.205, ri: 0.205, x: 0.755, rim: ALLOY, spokes: 5 },
      body: { tuck: 0.05, shoulder: 0.06,
        top: [[-2.26, 0.95], [-2.215, 0.985], [-2.12, 1.0], [-1.95, 1.0], [-1.62, 0.975], [-1.4, 0.95], [0.95, 0.92], [1.3, 0.885], [1.75, 0.835], [2.05, 0.785], [2.18, 0.74], [2.25, 0.68]],
        sill: [[-2.26, 0.3], [-2.2, 0.25], [-2.05, 0.215], [2.0, 0.215], [2.17, 0.25], [2.25, 0.32]],
        w: [[-2.26, 0.8], [-2.225, 0.84], [-2.13, 0.866], [-1.9, 0.875], [1.85, 0.875], [2.1, 0.86], [2.2, 0.82], [2.25, 0.765]],
        p: [[-2.26, 5], [2.25, 5]] },
      cabin: { yb: 0.74, p: 6, cuts: [-0.9, 0.24, -0.32, -0.22, -1.02],
        top: [[-1.7, 0.94], [-1.52, 1.05], [-1.3, 1.22], [-1.05, 1.37], [-0.85, 1.43], [-0.4, 1.465], [0.05, 1.46], [0.25, 1.43], [0.45, 1.33], [0.7, 1.16], [0.92, 1.0], [1.05, 0.92]],
        wb: [[-1.7, 0.76], [-1.45, 0.82], [0.85, 0.82], [1.05, 0.78]],
        wt: [[-1.7, 0.68], [-1.3, 0.63], [-0.9, 0.62], [0.2, 0.62], [0.6, 0.65], [1.05, 0.72]],
        cls: { hide: 0.86, roof: [-0.9, 0.24], bp: [[-0.32, -0.22]], cz: -1.02 } },
    },
    suv: {
      len: [-2.36, 2.36], R: 0.385, axles: [1.43, -1.32], rA: 0.46,
      wheel: { R: 0.385, w: 0.265, ri: 0.229, x: 0.785, rim: lin('#9a9fa7'), spokes: 6 },
      body: { tuck: 0.04, shoulder: 0.05,
        top: [[-2.36, 1.15], [-2.32, 1.2], [-2.2, 1.215], [1.0, 1.19], [1.45, 1.15], [1.9, 1.1], [2.2, 1.04], [2.3, 0.97], [2.36, 0.85]],
        sill: [[-2.36, 0.46], [-2.3, 0.37], [-2.15, 0.33], [-1.95, 0.31], [2.0, 0.31], [2.25, 0.35], [2.36, 0.46]],
        w: [[-2.36, 0.86], [-2.33, 0.9], [-2.25, 0.92], [-2.0, 0.93], [2.0, 0.93], [2.25, 0.905], [2.33, 0.86], [2.36, 0.8]],
        p: [[-2.36, 5.5], [2.36, 5]] },
      bodyCls: (a, x, y) => a < 0 ? 'paint' : Math.sin(a) < -0.8 ? 'under' : y < 0.47 ? 'clad' : 'paint',
      cabin: { yb: 0.98, p: 7, cuts: [-2.16, 0.55, -0.12, -0.02, -1.62],
        top: [[-2.33, 1.16], [-2.3, 1.52], [-2.25, 1.71], [-2.15, 1.775], [-1.9, 1.795], [-0.5, 1.8], [0.35, 1.795], [0.6, 1.74], [0.9, 1.53], [1.2, 1.32], [1.42, 1.2], [1.5, 1.17]],
        wb: [[-2.33, 0.86], [-2.1, 0.9], [1.1, 0.9], [1.5, 0.86]],
        wt: [[-2.33, 0.72], [-2.1, 0.73], [0.5, 0.73], [1.0, 0.76], [1.5, 0.82]],
        cls: { hide: 1.14, roof: [-2.16, 0.55], bp: [[-0.12, -0.02]], cz: -1.62, cpil: 'trim' } },
    },
    van: {
      len: [-2.9, 2.9], R: 0.365, axles: [1.95, -1.8], rA: 0.44,
      wheel: { R: 0.365, w: 0.235, ri: 0.203, x: 0.86, rim: lin('#c9ccd0'), steel: true },
      body: { tuck: 0.03, shoulder: 0.03,
        top: [[-2.9, 1.18], [-2.86, 1.21], [1.5, 1.22], [1.7, 1.24], [2.2, 1.17], [2.6, 1.12], [2.8, 1.06], [2.88, 1.0], [2.9, 0.92]],
        sill: [[-2.9, 0.48], [-2.84, 0.38], [-2.6, 0.35], [2.55, 0.35], [2.8, 0.4], [2.9, 0.5]],
        w: [[-2.9, 0.95], [-2.86, 0.985], [-2.7, 1.0], [2.3, 1.0], [2.7, 0.95], [2.85, 0.88], [2.9, 0.8]],
        p: [[-2.9, 7], [2.3, 7], [2.9, 4.5]] },
      cabin: { yb: 1.0, p: 9, cuts: [1.05],
        top: [[-2.87, 1.25], [-2.855, 2.25], [-2.8, 2.33], [-2.6, 2.36], [0.85, 2.36], [1.05, 2.31], [1.3, 2.05], [1.55, 1.5], [1.66, 1.27], [1.7, 1.2]],
        wb: [[-2.87, 0.985], [-2.7, 0.995], [1.4, 0.995], [1.7, 0.96]],
        wt: [[-2.87, 0.92], [-2.6, 0.93], [0.9, 0.93], [1.3, 0.9], [1.7, 0.9]],
        cls: { hide: 1.16, roof: [-3, 1.05], side: 'paint', cap: 'paint' } },
    },
  };

  // flat window pane (with a black surround) on a near-vertical side wall
  function sidePane(m, s, f, z0, z1, y0, y1, frame = 0.035) {
    const zc = (z0 + z1) / 2, yc = (y0 + y1) / 2, sec = f(zc), x = sideX(sec, yc), rz = -s * Math.atan((sideX(sec, y1) - sideX(sec, y0)) / (y1 - y0));
    m.add(GEO.box, M4(s * (x + 0.003), yc, zc, 0, 0, rz, 0.01, y1 - y0 + frame * 2, z1 - z0 + frame * 2), TRIM, 'glass');
    m.add(GEO.box, M4(s * (x + 0.008), yc, zc, 0, 0, rz, 0.01, y1 - y0, z1 - z0), TINT, 'glass');
  }
  // strip hugging the body: across the end face at zA from xIn to its edge, then round the corner along the
  // side to zB (zB > zA: rear face, zB < zA: front face), `off` proud of the surface
  function surfPatch(m, s, f, zA, zB, y0, y1, xIn, off, col, key, ny = 2, nz = 6) {
    const dir = Math.sign(zB - zA), rows = [];
    for (let j = 0; j <= ny; j++) {
      const y = y0 + (y1 - y0) * j / ny, xe = sideX(f(zA), y), row = [[s * Math.min(xIn, xe - 0.004), y, zA - dir * off], [s * xe, y, zA - dir * off]];
      for (let k = 1; k <= nz; k++) { const z = zA + (zB - zA) * k / nz; row.push([s * (sideX(f(z), y) + off), y, z]); }
      rows.push(row);
    }
    const pos = [];
    const tri = (a, b, c) => {
      const n = v3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).cross(v3(c[0] - a[0], c[1] - a[1], c[2] - a[2]));
      if (n.x * s - n.z * dir < 0) pos.push(...a, ...c, ...b); else pos.push(...a, ...b, ...c);
    };
    for (let j = 0; j < ny; j++) for (let i = 0; i < rows[j].length - 1; i++) {
      const A = rows[j][i], B = rows[j][i + 1], P2 = rows[j + 1][i], Q = rows[j + 1][i + 1];
      tri(A, B, P2); tri(B, Q, P2);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    m.add(soften(g, 50), M4(), col, key);
  }
  // wrap-round tail lamp: dark red lens, lit LED light-guide, reversing lamp at the inner end
  function tailLamp(m, s, f, zr, y0, y1, xIn, wrap, hi) {
    surfPatch(m, s, f, zr, zr + wrap, y0, y1, xIn, 0.006, LENS_R, 'glass', 2, hi ? 6 : 3);
    const yl = y0 + (y1 - y0) * 0.68;
    surfPatch(m, s, f, zr, zr + wrap * 0.9, yl - 0.011, yl + 0.011, xIn + 0.02, 0.011, LED_R, 'light', 1, hi ? 6 : 2);
    if (hi) m.add(GEO.box, M4(s * (xIn + 0.06), y0 + (y1 - y0) * 0.3, zr - 0.012, 0, 0, 0, 0.09, (y1 - y0) * 0.3, 0.006), lin('#d8dce4'), 'glass');
  }
  // wrap-round headlamp with an LED daytime-running strip along its lower edge
  function headLamp(m, s, f, zf, y0, y1, xIn, wrap, hi) {
    surfPatch(m, s, f, zf, zf - wrap, y0, y1, xIn, 0.006, LENS_W, 'glass', 2, hi ? 5 : 2);
    surfPatch(m, s, f, zf, zf - wrap * 0.85, y0 + 0.01, y0 + 0.026, xIn + 0.03, 0.011, LED_W, 'light', 1, hi ? 5 : 2);
  }

  const CAR_BUILD = {
    sedan(m, paint, hi, pv) {
      const S = CAR_SPEC.sedan, { fb } = shell(m, S, paint, hi), zr = S.len[0], zf = S.len[1];
      for (const s of [-1, 1]) {
        tailLamp(m, s, fb, zr, 0.815, 0.915, 0.37, 0.22, hi);
        m.add(GEO.box, M4(s * 0.7, 0.43, zr - 0.008, 0, 0, 0, 0.13, 0.025, 0.012), REFL, 'light');       // bumper reflectors
        headLamp(m, s, fb, zf, 0.56, 0.655, 0.36, 0.32, hi);
      }
      m.add(GEO.box, M4(0, 0.8, zr - 0.008, 0, 0, 0, 0.7, 0.024, 0.012), CHROME, 'chrome');             // garnish over the plate
      plate(m, 0, 0.65, zr - 0.006, 'plW' + pv * 2);
      m.add(GEO.box, M4(0, 0.335, zr - 0.008, 0, 0, 0, 1.24, 0.075, 0.02), PLAST, 'lam');                // diffuser
      m.add(GEO.box, M4(0, 0.56, zf + 0.008, 0, 0, 0, 0.66, 0.13, 0.02), TRIM, 'lam');                   // grille
      m.add(GEO.box, M4(0, 0.4, zf + 0.004, 0, 0, 0, 0.94, 0.09, 0.02), TRIM, 'lam');                    // lower intake
      plate(m, 0, 0.44, zf + 0.016, 'plW' + (pv * 2 + 1), 1);
      if (!hi) return;
      m.add(GEO.box, M4(0, 0.59, zf + 0.02, 0, 0, 0, 0.7, 0.018, 0.012), CHROME, 'chrome');
      m.add(GEO.sph, M4(0, 0.905, zr - 0.006, 0, 0, 0, 0.055, 0.03, 0.012), CHROME, 'chrome');             // badge
      m.add(GEO.cyl, M4(-0.52, 0.29, zr + 0.04, Math.PI / 2, 0, 0, 0.035, 0.14, 0.035), CHROME, 'chrome'); // exhaust
      m.add(GEO.cyl, M4(-0.52, 0.29, zr - 0.031, Math.PI / 2, 0, 0, 0.026, 0.004, 0.026), TRIM, 'lam');
      m.add(GEO.box, M4(0, 1.475, -0.78, 0, 0, 0, 0.05, 0.05, 0.16), TRIM, 'glass');                      // shark-fin aerial
      m.add(GEO.box, M4(0, 1.43, -0.92, -0.55, 0, 0, 0.26, 0.016, 0.03), LED_R, 'light');                 // third brake lamp
      for (const s of [-1, 1]) {
        mirror(m, s, 0.86, 1.0, 0.86, paint);
        for (const z of [0.97, -0.17, -1.12]) shutLine(m, s, z, fb, 0.3, 0.9);
        handle(m, s, 0.14, 0.87, fb); handle(m, s, -0.98, 0.875, fb);
      }
    },
    suv(m, paint, hi, pv) {
      const S = CAR_SPEC.suv, { fb } = shell(m, S, paint, hi), zr = S.len[0], zf = S.len[1];
      for (const s of [-1, 1]) {
        tailLamp(m, s, fb, zr, 0.93, 1.07, 0.44, 0.24, hi);
        m.add(GEO.box, M4(s * 0.74, 0.58, zr - 0.012, 0, 0, 0, 0.16, 0.03, 0.012), REFL, 'light');
        headLamp(m, s, fb, zf, 0.7, 0.8, 0.46, 0.32, hi);
        // black fender flares round the arches
        for (const za of S.axles) m.add(C('flare' + S.rA, () => arcBand(S.rA + 0.03, 0.025, -0.05, Math.PI + 0.05, 0.03, 12)), M4(s * (S.body.w[3][1] - 0.012), S.R, za), PLAST, 'lam');
      }
      m.add(GEO.box, M4(0, 1.0, zr - 0.01, 0, 0, 0, 0.86, 0.05, 0.014), CHROME, 'chrome');              // tailgate garnish
      plate(m, 0, 0.8, zr - 0.006, 'plW' + pv * 2);
      m.add(GEO.box, M4(0, 0.52, zr - 0.01, 0, 0, 0, 1.62, 0.14, 0.03), PLAST, 'lam');                   // bumper cladding
      m.add(GEO.box, M4(0, 0.47, zr - 0.024, 0, 0, 0, 0.7, 0.05, 0.02), ALLOY, 'paint');                // skid plate
      m.add(GEO.box, M4(0, 1.78, -2.23, 0.12, 0, 0, 1.2, 0.045, 0.2), paint, 'carPaint');               // roof spoiler
      m.add(GEO.box, M4(0, 1.765, -2.33, 0, 0, 0, 0.3, 0.02, 0.012), LED_R, 'light');
      m.add(GEO.box, M4(0, 0.73, zf + 0.006, 0, 0, 0, 0.88, 0.2, 0.02), TRIM, 'lam');                   // grille
      m.add(GEO.box, M4(0, 0.5, zf + 0.004, 0, 0, 0, 1.4, 0.16, 0.03), PLAST, 'lam');
      plate(m, 0, 0.53, zf + 0.026, 'plW' + (pv * 2 + 1), 1);
      if (!hi) return;
      for (const y of [0.67, 0.73, 0.79]) m.add(GEO.box, M4(0, y, zf + 0.02, 0, 0, 0, 0.84, 0.016, 0.01), CHROME, 'chrome');
      m.add(GEO.sph, M4(0, 1.13, zr - 0.012, 0, 0, 0, 0.06, 0.035, 0.012), CHROME, 'chrome');
      m.add(GEO.box, link(v3(0.02, 1.36, -2.3), v3(-0.38, 1.62, -2.22), 0.012, 0.02), TRIM, 'lam');      // rear wiper
      for (const s of [-1, 1]) {
        mirror(m, s, 0.9, 1.25, 0.96, paint);
        for (const x of [0.6]) for (const [z0, z1] of [[-1.95, -1.6], [-1.6, 0.25], [0.25, 0.42]]) {     // roof rails with feet
          m.add(GEO.box, M4(s * x, 1.845, (z0 + z1) / 2, 0, 0, 0, 0.045, 0.03, z1 - z0), ALLOY, 'paint');
        }
        for (const z of [-1.9, 0.38]) m.add(GEO.box, M4(s * 0.6, 1.815, z, 0, 0, 0, 0.05, 0.05, 0.1), TRIM, 'lam');
        m.add(GEO.box, M4(s * 0.86, 0.43, 0.05, 0, 0, 0, 0.18, 0.035, 1.9), PLAST, 'lam');              // side step
        for (const z of [1.02, -0.07, -1.18]) shutLine(m, s, z, fb, 0.5, 1.14);
        handle(m, s, 0.2, 1.1, fb); handle(m, s, -0.95, 1.1, fb);
      }
    },
    van(m, paint, hi, pv) {
      const S = CAR_SPEC.van, { fb, fc } = shell(m, S, paint, hi), zr = S.len[0], zf = S.len[1];
      for (const s of [-1, 1]) {
        // passenger windows + front door window; the rear doors carry their own glass
        for (const [z0, z1] of [[1.05, 1.34], [0.06, 0.94], [-0.94, -0.06], [-1.94, -1.06], [-2.7, -2.06]]) sidePane(m, s, fc, z0, z1, 1.34, 1.95);
        m.add(GEO.box, M4(s * 0.45, 1.66, -2.875, 0, 0, 0, 0.74, 0.58, 0.02), TRIM, 'glass');              // rear door glass
        m.add(GEO.box, M4(s * 0.45, 1.66, -2.882, 0, 0, 0, 0.68, 0.52, 0.02), TINT, 'glass');
        m.add(GEO.box, M4(s * 0.935, 1.16, -2.88, 0, 0, 0, 0.12, 0.44, 0.04), LENS_R, 'glass');           // tall tail lamps
        m.add(GEO.box, M4(s * 0.935, 1.26, -2.902, 0, 0, 0, 0.08, 0.14, 0.008), LED_R, 'light');
        m.add(GEO.box, M4(s * 0.935, 1.03, -2.902, 0, 0, 0, 0.08, 0.08, 0.008), AMBER, 'glass');
        headLamp(m, s, fb, zf, 0.76, 0.9, 0.56, 0.4, hi);
        mirror(m, s, 0.98, 1.66, 1.5, TRIM, true);
      }
      m.add(GEO.box, M4(0, 1.3, -2.902, 0, 0, 0, 0.01, 1.7, 0.01), TRIM, 'lam');                        // rear door split
      m.add(GEO.box, M4(0, 2.29, -2.87, 0, 0, 0, 0.36, 0.035, 0.02), LED_R, 'light');                  // high brake lamp
      m.add(GEO.box, M4(0, 0.5, -2.86, 0, 0, 0, 1.92, 0.15, 0.16), PLAST, 'lam');                       // step bumper
      plate(m, 0, 0.8, -2.902, 'plY' + pv * 2);
      m.add(GEO.box, M4(0, 0.74, zf + 0.004, 0, 0, 0, 1.0, 0.2, 0.02), TRIM, 'lam');                    // grille
      m.add(GEO.box, M4(0, 0.5, zf - 0.0, 0, 0, 0, 1.76, 0.18, 0.06), PLAST, 'lam');
      plate(m, 0, 0.52, zf + 0.04, 'plY' + (pv * 2 + 1), 1);
      if (!hi) return;
      for (const s of [-1, 1]) {
        m.add(GEO.box, M4(s * 0.12, 1.28, -2.905, 0, 0, 0, 0.12, 0.03, 0.02), CHROME, 'chrome');
        for (const z of [1.0, 0.0]) shutLine(m, s, z, fb, 0.45, 1.18);
        handle(m, s, 1.05, 1.08, fb); handle(m, s, -0.05, 1.08, fb);
        m.add(GEO.box, M4(s * 0.62, 2.4, -0.5, 0, 0, 0, 0.04, 0.04, 3.6), ALLOY, 'paint');              // roof rack rails
      }
      m.add(GEO.box, M4(0, 1.12, -0.4, 0, 0, 0, 2.02, 0.05, 4.4), mul(paint, 0.8), 'carPaint');           // rubbing strip
    },
    // cab-over box lorry: painted cab, aluminium box with reflective tape, under-run bars, dual rear wheels
    truck(m, paint, hi, pv) {
      const R = 0.5, W = { R, w: 0.27, ri: 0.286, x: 0.98, rim: lin('#d4d6d8'), steel: true };
      const cab = { tuck: 0, shoulder: 0.05, top: [[2.62, 2.95], [4.02, 2.95], [4.14, 2.9], [4.2, 2.78], [4.2235, 2.7], [4.2917, 1.72], [4.3, 1.6], [4.36, 1.0]],
        sill: [[2.62, 0.95], [4.36, 0.95]], w: [[2.62, 1.15], [4.2, 1.15], [4.3, 1.13], [4.36, 1.1]], p: [[2.62, 9], [4.36, 9]] };
      const fcab = bodyFn(cab, [3.35], R, 0.6);
      const MAT = PART(paint);
      const parts = loftParts(zSamples(2.62, 4.36, hi ? 0.08 : 0.25, cab.top.map(k => k[0]).concat([3.35 - 0.61, 3.35 + 0.61, 3.0, 3.35, 3.7])), fcab, hi ? 24 : 14,
        (a, x, y, z) => a < 0 ? 'paint' : Math.sin(a) > 0.8 && z > 4.2 && y > 1.72 && y < 2.71 ? 'glass' : Math.sin(a) < -0.8 ? 'under' : 'paint');
      for (const k in parts) m.add(parts[k], M4(), MAT[k][0], MAT[k][1]);
      for (const s of [-1, 1]) {
        sidePane(m, s, fcab, 3.4, 4.08, 1.85, 2.6, 0.03);                                                 // door window
        m.add(GEO.box, M4(s * 0.86, 0.78, 4.4, 0, 0, 0, 0.4, 0.2, 0.06), LENS_W, 'glass');                  // headlamps in the bumper
        m.add(GEO.box, M4(s * 0.86, 0.72, 4.43, 0, 0, 0, 0.36, 0.03, 0.01), LED_W, 'light');
        m.add(GEO.box, link(v3(s * 1.1, 2.45, 4.0), v3(s * 1.36, 2.36, 4.12), 0.035, 0.035), TRIM, 'lam');  // mirror arm + mirror
        m.add(GEO.box, M4(s * 1.38, 2.14, 4.12, 0, 0, 0, 0.07, 0.42, 0.2), TRIM, 'lam');
        m.add(GEO.box, M4(s * 1.38, 2.14, 4.0, 0, 0, 0, 0.06, 0.38, 0.012), lin('#8c96a2'), 'glass');
        for (const z of [3.35]) carWheel(m, s, z, W, hi);
        for (const xo of [0.8, 1.1]) carWheel(m, s, -1.95, W, hi, xo);                                    // dual rear wheels
        m.add(GEO.box, M4(s * 1.0, 0.5, -2.55, 0, 0, 0, 0.5, 0.5, 0.02), TRIM, 'lam');                    // mud flaps
        for (const y of [0.56, 0.84]) m.add(GEO.box, M4(s * 1.17, y, 0.62, 0, 0, 0, 0.03, 0.07, 3.6), ALLOY, 'paint');   // side guards
        // rear lamp clusters on the under-run bracket: indicator, tail, reversing
        for (const [dx, col, key] of [[0.24, AMBER, 'glass'], [0.1, LED_R, 'light'], [-0.04, lin('#d8dce4'), 'glass']]) {
          m.add(GEO.box, M4(s * (0.86 + dx), 0.86, -4.33, 0, 0, 0, 0.13, 0.11, 0.05), col, key);
        }
        m.add(GEO.box, M4(s * 0.92, 0.86, -4.3, 0, 0, 0, 0.5, 0.17, 0.04), TRIM, 'lam');
      }
      m.add(GEO.box, M4(0, 1.3, 4.37, 0, 0, 0, 1.5, 0.52, 0.03), TRIM, 'lam');                            // grille
      m.add(GEO.box, M4(0, 0.66, 4.33, 0, 0, 0, 2.3, 0.36, 0.2), PLAST, 'lam');                           // front bumper
      plate(m, 0, 0.62, 4.44, 'plY' + (pv * 2 + 1), 1);
      m.add(GEO.box, M4(0, 0.88, 0.0, 0, 0, 0, 0.9, 0.2, 8.3), UNDER, 'lam');                             // chassis rails
      // aluminium box body: textured sides / doors, corner posts, top and bottom rails
      const bx = 1.225, y0 = 1.05, y1 = 3.65, z0 = -4.32, z1 = 2.48, BL = z1 - z0, BH = y1 - y0, zc = (z0 + z1) / 2, yc = (y0 + y1) / 2;
      m.add(GEO.box, M4(0, yc, zc, 0, 0, 0, bx * 2 - 0.02, BH - 0.02, BL - 0.02), lin('#e6e9ed'), 'lam');
      m.add(GEO.plane, M4(bx, yc, zc, 0, Math.PI / 2, 0, BL, BH, 1), W1, 'lam', { uv: 'lorryS' });
      m.add(GEO.plane, M4(-bx, yc, zc, 0, -Math.PI / 2, 0, BL, BH, 1), W1, 'lam', { uv: 'lorryS' });
      m.add(GEO.plane, M4(0, yc, z0 - 0.002, 0, Math.PI, 0, bx * 2, BH, 1), W1, 'lam', { uv: 'lorryB' });
      for (const s of [-1, 1]) {
        for (const z of [z0, z1]) m.add(GEO.box, M4(s * bx, yc, z, 0, 0, 0, 0.09, BH + 0.06, 0.09), ALLOY, 'paint');
        for (const y of [y0, y1]) m.add(GEO.box, M4(s * bx, y, zc, 0, 0, 0, 0.07, 0.08, BL), ALLOY, 'paint');
      }
      m.add(GEO.box, M4(0, y1, z0, 0, 0, 0, bx * 2, 0.1, 0.09), ALLOY, 'paint');
      m.add(GEO.box, M4(0, y0 - 0.06, zc, 0, 0, 0, bx * 2 - 0.1, 0.1, BL - 0.1), UNDER, 'lam');
      for (let k = 0; k < 11; k++) m.add(GEO.box, M4(-1.0 + k * 0.2, 0.55, -4.25, 0, 0, 0, 0.2, 0.13, 0.1), k % 2 ? lin('#f2f2f2') : lin('#d01818'), 'lam');   // rear under-run bar
      plate(m, 0, 0.82, -4.3, 'plY' + pv * 2);
      if (!hi) return;
      for (const x of [-0.9, -0.3, 0.3, 0.9]) m.add(GEO.cyl, M4(x, yc, z0 - 0.03, 0, 0, 0, 0.018, BH - 0.2, 0.018), CHROME, 'chrome');   // door lock rods
      for (const s of [-1, 1]) for (const y of [1.5, 2.35, 3.2]) m.add(GEO.box, M4(s * (bx - 0.04), y, z0 - 0.03, 0, 0, 0, 0.1, 0.07, 0.03), ALLOY, 'paint');   // hinges
      for (let k = 0; k < 5; k++) m.add(GEO.box, M4(-0.5 + k * 0.25, 2.93, 4.12, 0, 0, 0, 0.1, 0.05, 0.06), AMBER, 'light');   // cab marker lamps
      m.add(GEO.cyl16, M4(-0.95, 0.72, 1.6, Math.PI / 2, 0, 0, 0.24, 1.0, 0.24), ALLOY, 'chrome');        // fuel tank
      m.add(GEO.box, M4(0.95, 0.72, 1.7, 0, 0, 0, 0.3, 0.4, 0.6), PLAST, 'lam');                         // battery box
      for (const y of [1.12, 1.24, 1.36, 1.48]) m.add(GEO.box, M4(0, y, 4.39, 0, 0, 0, 1.4, 0.03, 0.01), ALLOY, 'paint');
      for (const s of [-1, 1]) {
        for (const z of [4.15, 3.0]) shutLine(m, s, z, fcab, 1.15, 2.75);
        handle(m, s, 3.15, 1.9, fcab);
        m.add(GEO.box, M4(s * 1.08, 0.82, 4.0, 0, 0, 0, 0.18, 0.04, 0.32), ALLOY, 'paint');             // door step
      }
    },
  };
  // geometry is shared by every paint colour (paint parts are baked white and tinted by a per-colour material);
  // two number-plate variants per type. Building takes tens of ms, so prebuildCars() runs while a stage loads.
  const carGeoCache = new Map(), paintMats = new Map();
  function carGeo(type, pv) {
    const key = type + '|' + pv;
    let gs = carGeoCache.get(key);
    if (!gs) {
      gs = {};
      for (const hi of [true, false]) { const m = new Mesher(9); CAR_BUILD[type](m, W1, hi, pv); gs[hi ? 'hi' : 'lo'] = m.geos(); }
      carGeoCache.set(key, gs);
    }
    return gs;
  }
  function prebuildCars() { for (const type in CAR_BUILD) for (let pv = 0; pv < 2; pv++) carGeo(type, pv); }
  function paintMat(col) {
    let mt = paintMats.get(col);
    if (!mt) { mt = G3.mats.carPaint.clone(); mt.color.set(col); paintMats.set(col, mt); }
    return mt;
  }
  function setCarEnv(env) { G3.mats.carPaint.envMap = env; for (const mt of paintMats.values()) mt.envMap = env; }
  function car(type, col) {
    let h = 0; for (const ch of col) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const gs = carGeo(type, (h >>> 0) % 2), g = new T.Group(), sub = {};
    for (const lod of ['hi', 'lo']) {
      const grp = sub[lod] = new T.Group();
      // only the body, glasshouse and tyres throw shadows (rims, chrome and lamps are hidden inside them anyway)
      for (const k in gs[lod]) {
        const mesh = new T.Mesh(gs[lod][k], k === 'carPaint' ? paintMat(col) : G3.mats[k]);
        mesh.castShadow = k === 'carPaint' || k === 'glass' || k === 'lam'; grp.add(mesh);
      }
      g.add(grp);
    }
    sub.lo.visible = false;
    g.userData.hi = true;
    g.userData.setDetail = hi => { if (hi !== g.userData.hi) { g.userData.hi = hi; sub.hi.visible = hi; sub.lo.visible = !hi; } };
    return g;
  }
  // [z, y, x] of each type's tail lamps (night glow sprites)
  const CAR_LIGHTS = { sedan: [-2.27, 0.87, 0.6], suv: [-2.37, 1.0, 0.72], van: [-2.9, 1.2, 0.93], truck: [-4.35, 0.86, 0.96] };

  // =====================================================================================
  // Roadside props -> prototypes (merged per chunk through G3.Bag)
  // =====================================================================================
  const BARK = lin('#5a3c24'), WHITE = [1, 1, 1], PINE_CONE = new T.ConeGeometry(1, 1, 7);
  const protoCache = new Map();
  function proto(name, v) {
    const k = name + '|' + v;
    let p = protoCache.get(k);
    if (!p) { const m = new Mesher(31 + v * 7 + name.length); (PROPS[name] || PROPS.none)(m, v); p = m.proto(); protoCache.set(k, p); }
    return p;
  }
  const leafCols = [['#3f8a2e', '#4f9a38', '#2f7228'], ['#2f7a3a', '#3e8a3e', '#26622c'], ['#5a8a2a', '#6a9a34', '#4a7a26']];
  const PROPS = {
    none() {},
    pine(m, v) {
      m.add(taper(0.24, 0.1, 5), M4(0, 2.2, 0, 0, 0, 0, 1, 5, 1), BARK, 'lam');
      const c = [lin('#24563a'), lin('#2c6a3e'), lin('#1f4a30')][v % 3];
      for (let k = 0; k < 3; k++) {
        const r = 2.6 - k * 0.7, h = 4.0 - k * 0.5, y = 2.3 + k * 2.4 + h / 2;
        m.add(PINE_CONE, M4(0, y, 0, 0, k * 0.7, 0, r, h, r), mul(c, 0.82 + k * 0.1), 'lam', { flat: true, jit: 0.12 });
      }
    },
    tree(m, v) {
      const rnd = U.rng(v * 13 + 1), lc = leafCols[v % 3].map(lin);
      m.add(taper(0.3, 0.18, 7), M4(0, 1.8, 0, 0, 0, 0, 1, 3.6, 1), BARK, 'lam');
      m.add(taper(0.14, 0.07, 5), link(v3(0, 3.0, 0), v3(1.4, 4.6, 0.3), 1), BARK, 'lam');
      m.add(taper(0.14, 0.07, 5), link(v3(0, 3.2, 0), v3(-1.2, 4.8, -0.5), 1), BARK, 'lam');
      for (let i = 0; i < 5; i++) {
        const a = rnd() * Math.PI * 2, d = rnd() * 1.4, r = 1.7 + rnd() * 1.0;
        m.add(GEO.ico, M4(Math.cos(a) * d, 5.2 + rnd() * 1.6 - d * 0.3, Math.sin(a) * d, rnd(), rnd(), 0, r, r * 0.85, r), lc[i % 3], 'lam', { flat: true, jit: 0.14 });
      }
    },
    palm(m, v) {
      const rnd = U.rng(v * 7 + 3), lean = (v % 2 ? 1 : -1) * (0.8 + v * 0.35), top = v3(lean, 8.4 - Math.abs(lean) * 0.2, 0);
      let prev = v3(0, -0.2, 0);
      for (let i = 1; i <= 6; i++) {
        const t = i / 6, p = v3(lean * t * t, top.y * t, 0);
        m.add(taper(0.24 - t * 0.08, 0.22 - t * 0.08, 6), link(prev, p, 1), i % 2 ? lin('#8a6a46') : lin('#76583a'), 'lam');
        prev = p;
      }
      for (const [x, z] of [[0.18, 0.1], [-0.12, 0.16], [0.02, -0.18]]) m.add(GEO.ico0, M4(top.x + x, top.y - 0.25, z, 0, 0, 0, 0.17), lin('#6b4a20'), 'lam', { flat: true });
      for (let f = 0; f < 8; f++) {
        const a = f / 8 * Math.PI * 2 + rnd() * 0.4, len = 3.4 + rnd() * 0.8, droop = 1.6 + rnd() * 1.2;
        const g = frondGeo(len, droop), mm = M4(top.x, top.y, 0, 0, a, 0);
        m.add(g, mm, f % 2 ? lin('#4c9a30') : lin('#3e8a2a'), 'lam', { jit: 0.08 });
      }
    },
    bush(m, v) {
      const rnd = U.rng(v * 5 + 2), lc = v === 0 ? lin('#8aa83a') : lin('#3f8a34');
      for (let i = 0; i < 4; i++) {
        const r = 0.55 + rnd() * 0.35;
        m.add(GEO.ico, M4((rnd() - 0.5) * 1.1, r * 0.6, (rnd() - 0.5) * 1.0, rnd(), rnd(), 0, r, r * 0.75, r), mul(lc, 0.85 + rnd() * 0.3), 'lam', { flat: true, jit: 0.15 });
      }
      if (v > 0) for (let i = 0; i < 9; i++) {
        const a = rnd() * 6.28, d = rnd() * 0.7;
        m.add(GEO.ico0, M4(Math.cos(a) * d, 0.85 + rnd() * 0.35, Math.sin(a) * d, rnd(), rnd(), 0, 0.11), v === 1 ? lin('#ffd21a') : lin('#f070c0'), 'lam', { flat: true });
      }
    },
    rock(m, v) {
      const g = GEO.ico.clone(), p = g.attributes.position, rnd = U.rng(v * 3 + 9);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.75 + G3.hash(Math.round(x * 50) + v * 31, Math.round(y * 50) * 7 + Math.round(z * 50)) * 0.45;
        p.setXYZ(i, x * k, y * k, z * k);
      }
      m.add(g, M4(0, 0.45, 0, rnd(), rnd(), 0, 1.15, 0.8, 1.0), v % 2 ? lin('#8a8478') : lin('#7a6c58'), 'lam', { flat: true, jit: 0.1 });
    },
    house(m, v) {
      const wall = lin(['#f0e2b0', '#d8e8f0', '#f2c8a0', '#e8e8e0', '#c8e0b8'][v % 5]), roof = lin(['#b8452a', '#a83a22', '#5a6a7a', '#c05a30', '#8a3a2a'][v % 5]);
      m.add(GEO.box, M4(0, 1.6, -0.3, 0, 0, 0, 6, 3.2, 6.2), wall, 'lam');
      m.add(P('roofGable', () => prof([[3.6, 3.1], [0, 5.3], [-3.6, 3.1]], 6.8, 0.04)), M4(0, 0, -0.3), roof, 'lam', { jit: 0.05 });
      m.add(GEO.box, M4(0, 2.95, 3.4, 0.25, 0, 0, 6.6, 0.1, 1.6), roof, 'lam');                                 // veranda roof
      for (const s of [-1, 1]) m.add(GEO.cyl, M4(s * 2.9, 1.4, 4.0, 0, 0, 0, 0.08, 2.8, 0.08), lin('#e8e8e0'), 'lam');
      if (v % 5 === 0) m.add(GEO.plane, M4(0, 1.3, 2.81, 0, 0, 0, 4.4, 2.2, 1), WHITE, 'lam', { uv: 'shop' });
      else {
        m.add(GEO.box, M4(0, 1.05, 2.82, 0, 0, 0, 1.2, 2.1, 0.06), lin('#5a3418'), 'lam');
        for (const s of [-1, 1]) {
          m.add(GEO.box, M4(s * 1.9, 1.6, 2.82, 0, 0, 0, 1.0, 1.0, 0.05), lin('#2a5a8a'), 'lam');
          m.add(GEO.box, M4(s * 1.9, 1.6, 2.84, 0, 0, 0, 0.06, 1.0, 0.04), lin('#e8e8e0'), 'lam');
        }
      }
      m.add(GEO.box, M4(0, 0.08, 1.0, 0, 0, 0, 7.2, 0.16, 7.0), lin('#a8a49a'), 'lam');
    },
    pole(m) {
      m.add(taper(0.17, 0.1, 8), M4(0, 4.2, 0, 0, 0, 0, 1, 8.6, 1), lin('#a8a8a2'), 'lam');
      m.add(GEO.box, M4(0, 7.9, 0, 0, 0, 0, 0.12, 0.12, 1.9), lin('#8a8a86'), 'lam');
      for (const z of [-0.8, 0, 0.8]) m.add(GEO.cyl, M4(0, 8.04, z, 0, 0, 0, 0.05, 0.16, 0.05), lin('#f0f0f0'), 'lam');
      m.add(GEO.cyl, M4(0.25, 6.6, 0, 0, 0, 0, 0.22, 0.6, 0.22), lin('#7a7e86'), 'lam');                         // transformer pot
    },
    fence(m) {
      for (const x of [-4, 0, 4]) m.add(GEO.box, M4(x, 0.55, 0, 0, 0, 0, 0.12, 1.1, 0.12), lin('#7a5a36'), 'lam');
      for (const y of [0.45, 0.88]) m.add(GEO.box, M4(0, y, 0.07, 0, 0, 0, 8.34, 0.1, 0.05), lin('#8a6a42'), 'lam', { jit: 0.05 });
    },
    billboard(m, v) {
      for (const s of [-1, 1]) m.add(GEO.cyl, M4(s * 2.4, 1.7, -0.2, 0, 0, 0, 0.16, 3.4, 0.16), lin('#6a6e74'), 'lam');
      m.add(GEO.box, M4(0, 4.7, -0.2, 0, 0, 0, 7.5, 3.4, 0.25), lin('#3a3c42'), 'lam');
      m.add(GEO.plane, M4(0, 4.7, -0.07, 0, 0, 0, 7.2, 3.15, 1), WHITE, 'lam', { uv: 'bb' + v });
      m.add(GEO.box, M4(0, 3.0, 0.3, 0, 0, 0, 7.2, 0.08, 0.7), lin('#5a5e66'), 'lam');                            // catwalk
      for (const x of [-2.4, 0, 2.4]) m.add(GEO.box, M4(x, 6.55, 0.35, 0.5, 0, 0, 0.12, 0.08, 0.7), lin('#4a4e56'), 'lam');
    },
    sign(m, v) {
      m.add(GEO.cyl, M4(0, 0.8, 0, 0, 0, 0, 0.045, 1.6, 0.045), lin('#9aa0a8'), 'lam');
      m.add(GEO.box, M4(0, 1.75, -0.03, 0, 0, 0, 1.06, 1.06, 0.04), lin('#5a5e66'), 'lam');
      m.add(GEO.plane, M4(0, 1.75, -0.005, 0, 0, 0, 1.0, 1.0, 1), WHITE, 'lam', { uv: v > 0 ? 'chev1' : 'chev0' });
    },
    kmpost(m) {
      m.add(GEO.box, M4(0, 0.4, 0, 0, 0, 0, 0.42, 0.8, 0.2), lin('#f0f0ea'), 'lam');
      m.add(GEO.cyl16, M4(0, 0.8, 0, Math.PI / 2, 0, 0, 0.21, 0.2, 0.21), lin('#d02020'), 'lam');
      m.add(GEO.plane, M4(0, 0.45, 0.101, 0, 0, 0, 0.4, 0.8, 1), WHITE, 'lam', { uv: 'km' });
    },
    post(m) {
      m.add(GEO.box, M4(0, 0.45, 0, 0, 0, 0, 0.16, 0.9, 0.16), lin('#f2f2ee'), 'lam');
      m.add(GEO.box, M4(0, 0.75, 0.0, 0, 0, 0, 0.17, 0.12, 0.17), lin('#e02020'), 'lam');
    },
    lamp(m) {
      m.add(taper(0.13, 0.08, 8), M4(0, 4.0, 0, 0, 0, 0, 1, 8, 1), lin('#3a3e46'), 'lam');
      m.add(taper(0.06, 0.05, 6), link(v3(0, 7.7, 0), v3(0, 8.1, 1.2), 1), lin('#3a3e46'), 'lam');
      m.add(taper(0.05, 0.05, 6), link(v3(0, 8.1, 1.2), v3(0, 8.0, 2.4), 1), lin('#3a3e46'), 'lam');
      m.add(GEO.box, M4(0, 7.98, 2.45, 0, 0, 0, 0.34, 0.12, 0.7), lin('#4a4e56'), 'lam');
      m.add(GEO.box, M4(0, 7.91, 2.45, 0, 0, 0, 0.26, 0.03, 0.58), WHITE, 'lam', { uv: 'glow' });
    },
    building(m, v) {
      const F = G3.FAC_FLOORS[v], Hh = F * 3.4, wall = lin(['#e8c95a', '#e6a0a8', '#9cc4e0', '#a8d8b8', '#f0ece0', '#f0a050', '#b8b8c0', '#e8d8a0', '#c8a0d8', '#d8e8a0'][v]);
      m.add(GEO.box, M4(0, Hh / 2, 0, 0, 0, 0, 5.6, Hh, 13.5), mul(wall, 0.8), 'lam');
      const r = G3.uvRect('fac' + v); r[3] = r[1] + (r[3] - r[1]) * F / 8;
      m.add(GEO.plane, M4(0, Hh / 2, 6.76, 0, 0, 0, 5.6, Hh, 1), WHITE, 'lam', { uv: r });
      m.add(GEO.box, M4(0, Hh + 0.4, 6.6, 0, 0, 0, 5.7, 0.8, 0.3), mul(wall, 0.9), 'lam');                          // parapet
      m.add(GEO.box, M4(0, 3.1, 7.5, 0.3, 0, 0, 5.4, 0.08, 1.6), lin(['#c82020', '#2060c0', '#20a040', '#e0a020', '#8a2ab0'][v % 5]), 'lam'); // awning
      m.add(GEO.cyl16, M4(1.6, Hh + 0.9, -2, 0, 0, Math.PI / 2, 0.55, 1.6, 0.55), lin('#d8dce4'), 'lam');         // rooftop water tank
      m.add(GEO.cyl, M4(-1.8, Hh + 1.5, 1.5, 0, 0, 0, 0.03, 3, 0.03), lin('#666'), 'lam');
    },
    gate(m, v) {
      const red = lin(v ? '#202020' : '#d01818');
      for (const s of [-1, 1]) {
        m.add(GEO.box, M4(s * 6.4, 3.0, 0, 0, 0, 0, 0.7, 6.0, 0.7), red, 'lam');
        m.add(GEO.box, M4(s * 6.4, 0.25, 0, 0, 0, 0, 1.1, 0.5, 1.1), lin('#e8e8e8'), 'lam');
      }
      m.add(GEO.box, M4(0, 6.2, 0, 0, 0, 0, 13.6, 1.8, 0.5), red, 'lam');
      m.add(GEO.plane, M4(0, 6.2, 0.26, 0, 0, 0, 12.8, 1.7, 1), WHITE, 'lam', { uv: 'gate' + v });
      m.add(GEO.plane, M4(0, 6.2, -0.26, 0, Math.PI, 0, 12.8, 1.7, 1), WHITE, 'lam', { uv: 'gate' + v });
    },
    // ---- decoration only (no collision) ----
    hut(m, v) {
      m.add(GEO.box, M4(0, 1.2, 0, 0, 0, 0, 3.6, 2.4, 3.2), lin(['#c8a878', '#d8c8a0', '#b8a888'][v % 3]), 'lam', { jit: 0.04 });
      m.add(P('hutRoof', () => prof([[2.1, 2.3], [0, 3.8], [-2.1, 2.3]], 4.2, 0.03)), M4(), lin('#8a7a4a'), 'lam', { jit: 0.08 });
      m.add(GEO.box, M4(0, 0.9, 1.61, 0, 0, 0, 0.8, 1.8, 0.04), lin('#4a3018'), 'lam');
    },
    basket(m, v) {   // "thúng chai" round basket boat
      m.add(new T.SphereGeometry(1, 14, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M4(0, 0.5, 0, 0, 0, 0, 1.0, 0.55, 1.0), lin('#3a2a1a'), 'lam');
      m.add(GEO.cyl16, M4(0, 0.5, 0, 0, 0, 0, 1.02, 0.08, 1.02), lin(['#2a6ab0', '#c03030', '#2a9a5a'][v % 3]), 'lam');
    },
    boat(m, v) {
      m.add(P('hull', () => prof([[3.2, 0.9], [2.4, 0.2], [-2.4, 0.2], [-2.9, 0.9]], 1.5, 0.08)), M4(), lin(['#2a5ab0', '#2a8a5a', '#c04a20'][v % 3]), 'lam');
      m.add(GEO.box, M4(0, 0.92, 0, 0, 0, 0, 1.62, 0.1, 6.0), lin('#c02020'), 'lam');
      m.add(GEO.box, M4(0, 1.5, -1.2, 0, 0, 0, 1.2, 1.0, 1.4), lin('#e8e0d0'), 'lam');
      m.add(GEO.cyl, M4(0, 3, 0.6, 0, 0, 0, 0.05, 4, 0.05), lin('#6a4a2a'), 'lam');
    },
    shrub(m, v) {
      const rnd = U.rng(v * 9 + 4);
      for (let i = 0; i < 3; i++) {
        const r = 0.8 + rnd() * 0.7;
        m.add(GEO.ico0, M4((rnd() - 0.5) * 1.6, r * 0.6, (rnd() - 0.5) * 1.6, rnd(), rnd(), 0, r, r * 0.7, r), lin(['#5a7a32', '#6a8a3a', '#4a6a2a'][i]), 'lam', { flat: true, jit: 0.15 });
      }
    },
  };
  function frondGeo(len, droop) {   // a folded, drooping palm leaf (double-sided ribbon)
    const pos = [], N = 5;
    const pt = (t, side) => {
      const w = 0.55 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.05)), 0.7);
      return [side * w, 0.9 * t * len * 0.35 - droop * t * t - Math.abs(side) * w * 0.25, t * len];
    };
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N;
      for (const s of [-1, 1]) {
        const a = pt(t0, 0), b = pt(t1, 0), c = pt(t1, s), d = pt(t0, s);
        const tri = s > 0 ? [a, c, b, a, d, c] : [a, b, c, a, c, d];
        for (const p of tri) pos.push(...p);
        for (let k = tri.length - 1; k >= 0; k--) pos.push(...tri[k]);   // back face
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }

  // ----- props that face a particular way: 'road' = front looks at the road, 'traffic' = faces oncoming riders, 'along' = runs along the road
  const FACING = { house: 'road', building: 'road', lamp: 'road', hut: 'road', pole: 'along', fence: 'along', billboard: 'traffic',
    sign: 'traffic', kmpost: 'traffic', post: 'traffic', gate: 'traffic' };
  return { rider, car, prebuildCars, setCarEnv, proto, M4, v3, link, GEO, FACING, CAR_LIGHTS, posture, kickRoll };
})();
1
