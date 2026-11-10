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
  // bikes (style = index in BIKES), modelled on the real ones: 0 Kawasaki Z900, 1 Yamaha YZF-R1, 2 Kawasaki Ninja 1000SX,
  // 3 BMW S 1000 RR, 4 Kawasaki W800, 5 Honda CRF1100L Africa Twin, 6 Honda Rebel 1100. Wheels per style (rr = rim
  // radius): the sport bikes share 17" rims; the W800 rolls on 18" wire wheels, the Africa Twin on a 21" / 18" pair,
  // the Rebel on an 18" front and a fat 180/65-16 rear
  const WHEELS = [
    { FW, RW }, { FW, RW }, { FW, RW }, { FW, RW },
    { FW: { z: 0.72, y: 0.33, r: 0.33, w: 0.10, rr: 0.241 }, RW: { z: -0.73, y: 0.33, r: 0.33, w: 0.13, rr: 0.229 } },
    { FW: { z: 0.79, y: 0.36, r: 0.36, w: 0.10, rr: 0.267 }, RW: { z: -0.73, y: 0.345, r: 0.345, w: 0.16, rr: 0.229 } },
    { FW: { z: 0.80, y: 0.32, r: 0.32, w: 0.13, rr: 0.229 }, RW: { z: -0.72, y: 0.32, r: 0.32, w: 0.18, rr: 0.203 } },
    // 7-9 the 150 cc underbones (90/80-17 and 120/70-17; the Winner X's axles where its mesh has them, 1.278 m apart),
    // 10 the R15 V4 (the R1's at 0.92 scale), 11 the SH 160i (16")
    { FW: { z: 0.639, y: 0.287, r: 0.287, w: 0.09, rr: 0.216 }, RW: { z: -0.639, y: 0.294, r: 0.294, w: 0.12, rr: 0.216 } },
    ...[0, 1].map(() => ({ FW: { z: 0.63, y: 0.285, r: 0.285, w: 0.09, rr: 0.216 }, RW: { z: -0.66, y: 0.295, r: 0.295, w: 0.12, rr: 0.216 } })),
    { FW: { z: 0.644, y: 0.276, r: 0.276, w: 0.11 }, RW: { z: -0.649, y: 0.294, r: 0.294, w: 0.175 } },
    { FW: { z: 0.67, y: 0.285, r: 0.285, w: 0.1, rr: 0.203 }, RW: { z: -0.68, y: 0.3, r: 0.3, w: 0.12, rr: 0.203 } },
    // 12 CBR250RR (110/70-17 and 140/70-17), axles where its mesh has them
    { FW: { z: 0.6105, y: 0.296, r: 0.296, w: 0.11, rr: 0.216 }, RW: { z: -0.6105, y: 0.322, r: 0.322, w: 0.14, rr: 0.216 } },
    // 13 CBR1000RR Fireblade (its model's own wheels: 120/70-17 and 190/50-17, 1.41 m apart)
    { FW: { z: 0.708, y: 0.305, r: 0.305, w: 0.12, rr: 0.216 }, RW: { z: -0.703, y: 0.31, r: 0.31, w: 0.19, rr: 0.216 } },
  ];
  // riding positions; legs = [knee, ankle, toe] as [y, z] (default: rear-set pegs). The W800 and Africa Twin riders sit
  // upright on mid pegs, the Rebel rider low with his feet forward
  const STYLE = [
    { hip: [0.95, -0.28], sh: [1.40, -0.03], head: [1.575, 0.06], grip: [1.035, 0.40], gripW: 0.37, knee: 0.235 },
    { hip: [0.95, -0.30], sh: [1.32, 0.12], head: [1.47, 0.26], grip: [0.93, 0.43], gripW: 0.30, knee: 0.215 },
    { hip: [0.96, -0.30], sh: [1.38, 0.04], head: [1.55, 0.15], grip: [0.99, 0.41], gripW: 0.33, knee: 0.23 },
    { hip: [0.96, -0.31], sh: [1.31, 0.13], head: [1.455, 0.27], grip: [0.92, 0.44], gripW: 0.29, knee: 0.21 },
    { hip: [0.93, -0.30], sh: [1.42, -0.13], head: [1.595, -0.06], grip: [1.03, 0.33], gripW: 0.37, knee: 0.21,
      legs: [[0.78, 0.07], [0.44, -0.15], [0.39, -0.03]] },
    { hip: [1.0, -0.27], sh: [1.47, -0.14], head: [1.645, -0.07], grip: [1.14, 0.32], gripW: 0.40, knee: 0.225,
      legs: [[0.86, 0.06], [0.50, -0.18], [0.45, -0.05]] },
    { hip: [0.80, -0.26], sh: [1.32, -0.2], head: [1.50, -0.14], grip: [1.0, 0.3], gripW: 0.39, knee: 0.22,
      legs: [[0.76, 0.14], [0.42, 0.21], [0.37, 0.33]] },
    // the underbones: leaning forward a little on a small bike, feet on mid pegs. The Winner X rider is fitted to its
    // mesh: seat top 0.834 m, bar ends at y 1.046 / z 0.19, pegs at y ~0.235 / z ~-0.09, shrouds 0.215 m either side
    { hip: [0.925, -0.21], sh: [1.38, -0.1], head: [1.555, -0.02], grip: [1.035, 0.19], gripW: 0.29, knee: 0.23,
      legs: [[0.64, 0.08], [0.3, -0.17], [0.25, -0.06]] },
    ...[0, 1].map(() => ({ hip: [0.87, -0.2], sh: [1.33, -0.03], head: [1.5, 0.05], grip: [0.99, 0.31], gripW: 0.33, knee: 0.2,
      legs: [[0.68, 0.13], [0.36, -0.1], [0.31, 0.02]] })),
    // R15 V4: the R1's crouch at 0.92 scale
    { hip: [0.874, -0.276], sh: [1.214, 0.11], head: [1.352, 0.239], grip: [0.856, 0.396], gripW: 0.276, knee: 0.198,
      legs: [[0.736, 0.092], [0.432, -0.216], [0.373, -0.101]] },
    // SH 160i: upright, feet flat on the floorboard
    { hip: [0.87, -0.3], sh: [1.37, -0.2], head: [1.55, -0.14], grip: [1.06, 0.29], gripW: 0.33, knee: 0.17,
      legs: [[0.67, 0.16], [0.47, 0.06], [0.41, 0.18]] },
    // CBR250RR, fitted to its mesh: seat top 0.91 m at z -0.35, clip-ons at y 0.88 / z 0.2, rear-set pegs
    { hip: [0.975, -0.36], sh: [1.33, 0.05], head: [1.48, 0.18], grip: [0.88, 0.2], gripW: 0.36, knee: 0.26,
      legs: [[0.78, 0.02], [0.47, -0.27], [0.41, -0.15]] },
    // CBR1000RR Fireblade, fitted to its model: seat top 0.86 m, clip-ons at y 0.9 / z 0.36, pegs at y 0.38 / z -0.28
    { hip: [0.93, -0.32], sh: [1.30, 0.10], head: [1.45, 0.24], grip: [0.90, 0.36], gripW: 0.25, knee: 0.22,
      legs: [[0.76, 0.05], [0.49, -0.30], [0.40, -0.19]] },
  ];
  // full lean at the grip limit (radians) per bike: the sport bikes go past 55°, the cruiser scrapes its pegs at ~35°;
  // and how far the rider hangs off the inside (sport bikes: knee on the tarmac; upright bikes barely move)
  const LEAN_MAX = [0.95, 1.02, 0.93, 1.02, 0.72, 0.8, 0.6, 0.85, 0.85, 0.85, 0.98, 0.72, 0.98, 1.02], HANG = [0.85, 1, 0.75, 1, 0.3, 0.4, 0.15, 0.6, 0.6, 0.6, 0.95, 0.12, 0.95, 1];
  // hanging off (h -1..1, + = into a right-hand bend): the upper body slides to the inside of the seat, rolls further in
  // and turns towards the corner, pivoting on the hips
  const _hp = new T.Vector3(), _hs = new T.Vector3(1, 1, 1), _hq = new T.Quaternion(), _he = new T.Euler(0, 0, 0, 'YXZ'), _hm = new T.Matrix4();
  function hangMatrix(pz, h, out) {
    const s = Math.sign(h), a = Math.abs(h), P = pz.hip;
    _hq.setFromEuler(_he.set(0, -s * 0.14 * a, s * 0.22 * a));
    out.compose(_hp.set(-s * 0.13 * a, -0.05 * a, 0).add(P), _hq, _hs);
    return out.multiply(_hm.makeTranslation(-P.x, -P.y, -P.z));
  }
  function posture(st) {
    const S = STYLE[st] || STYLE[0], L = S.legs || [[0.80, 0.10], [0.47, -0.235], [0.405, -0.11]];
    return { hip: v3(0, ...S.hip), sh: v3(0, ...S.sh), head: v3(0, ...S.head), grip: v3(0, ...S.grip), gripW: S.gripW,
      kneeX: S.knee, knee: v3(0, ...L[0]), ankle: v3(0, ...L[1]), toe: v3(0, ...L[2]) };
  }
  // tail / head lamp centres [y, z] per style (night glow sprites)
  const BIKE_LIGHTS = [[[0.965, -0.875], [0.928, 0.665]], [[0.99, -0.99], [0.85, 0.89]], [[0.935, -1.005], [0.86, 0.88]], [[1.03, -0.995], [0.84, 0.905]],
    [[0.606, -0.976], [0.86, 0.69]], [[0.86, -0.985], [1.0, 0.68]], [[0.585, -0.985], [0.915, 0.70]],
    [[0.864, -0.865], [0.74, 0.74]], [[0.842, -0.95], [0.78, 0.62]], [[0.842, -1.0], [0.785, 0.65]], [[0.911, -0.911], [0.782, 0.819]], [[0.775, -0.99], [1.055, 0.5]], [[0.855, -0.905], [0.74, 0.757]], [[0.82, -0.9], [0.8, 0.79]]];
  // factory colour schemes, used when a bike wears its stock main colour (BIKES[i].color); a rival's own paint keeps the
  // generic scheme. side / flash / tailBand: fairing side panels, the stripe on them and the tail band
  const LIVERY = [
    { acc: '#16171b', frame: '#2a2c30', forkUp: '#1e1f24', rim: '#141518', rimStripe: '#5fb52a', cal: '#2a2c32', cam: '#18191d', can: '#1e1f24' },   // Kawasaki Z900
    { side: '#a9aeb6', flash: '#1d3ea8', tailBand: '#a9aeb6', fender: '#1d3ea8', rim: '#1d3ea8', rimStripe: null, forkUp: '#d6a02a',
      cal: '#2a2c32', frame: '#7a7e86', acc: '#16171b', can: '#b8bcc2' },                                                                     // Yamaha YZF-R1
    { acc: '#16171b', belly: '#16171b', rim: '#141518', rimStripe: null, can: '#1e1f24', frame: '#2c2e34' },                                     // Kawasaki Ninja 1000SX
    { side: '#1d3c8f', flash: '#d4202c', tailBand: '#1d3c8f', fender: '#1d3c8f', rim: '#141518', rimStripe: '#2c6ad6', cal: '#2c6ad6',
      forkUp: '#d6a02a', frame: '#2a2c30', roundel: true },                                                                                   // BMW S 1000 RR
    { tankBand: '#c8ccd2', pin: '#a88a40' },                                                                                                 // Kawasaki W800
    { acc: '#c8102e', acc2: '#1f3f9a', seat: '#1f3c9c', rim: '#c99a2e', hub: '#1a1b20', frame: '#b81c26', forkUp: '#a87a3a' },              // Honda Africa Twin
    {},                                                                                                                                      // Honda Rebel 1100
    { acc: '#1f3fae', acc2: '#f4f4f4', rim: '#16171b', rimStripe: '#d0202a', cal: '#c9a22a', body: '#c8121f' },                         // Honda Winner X (HRC tricolor)
    { acc: '#f4f4f4', acc2: '#f4f4f4', side2: '#c4c8ce', rim: '#16171b', cal: '#c9a22a' },                                                 // Yamaha Exciter 155 (GP blue)
    { acc: '#d01c24', acc2: '#f4f4f4', rim: '#16171b' },                                                                                   // Suzuki Raider R150
    { flash: '#e8ecf0', tailBand: '#16171b', fender: '#1f47bd', rim: '#1f47bd', rimStripe: null, forkUp: '#d6a02a', frame: '#2a2c32',
      can: '#2a2c32', cal: '#2a2c32', acc: '#16171b', belly: '#16171b' },                                                                     // Yamaha YZF-R15 V4
    { trim: '#3c3f46' },                                                                                                                     // Honda SH 160i
    { rim: '#16171b', rimStripe: '#d0202a', cal: '#c9a22a', body: '#c8121f' },                                                             // Honda CBR250RR (HRC tricolor)
    { body: '#c8121f' },                                                                                                                     // Honda CBR1000RR Fireblade (HRC tricolor)
  ];

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
  function tyreGeo(R, w, segs, rr = 0.212) {   // rounded sport-tyre cross-section revolved around the axle
    const hw = w / 2, d = R - rr;
    return latheX([[rr, -hw * 0.82], [rr + d * 0.3, -hw * 0.98], [rr + d * 0.68, -hw], [R - d * 0.13, -hw * 0.8], [R - d * 0.025, -hw * 0.42],
      [R, 0], [R - d * 0.025, hw * 0.42], [R - d * 0.13, hw * 0.8], [rr + d * 0.68, hw], [rr + d * 0.3, hw * 0.98], [rr, hw * 0.82]], segs);
  }
  function rimGeo(w, segs, k = 1) {   // k scales the 17" rim to other sizes
    const hw = w / 2;
    return latheX([[0.188 * k, -hw], [0.214 * k, -hw - 0.006], [0.221 * k, -hw + 0.004], [0.211 * k, -hw + 0.012], [0.211 * k, hw - 0.012], [0.221 * k, hw - 0.004],
      [0.214 * k, hw + 0.006], [0.188 * k, hw], [0.188 * k, -hw]], segs);
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
      p: kc(S.p === undefined ? 2.6 : S.p, z), f: S.f || null };
  };
  // faceted cross-sections, like moulded bodywork: flat panels meeting at crisp character lines instead of a rounded
  // superellipse. Right half, top to bottom, in units of the half width / half height (mirrored for the left)
  const FACET = {
    blade: [[0, 1], [0.6, 0.9], [0.93, 0.45], [1, 0.05], [0.9, -0.5], [0.55, -0.92], [0, -1]],      // cowls and shrouds
    side: [[0, 1], [0.5, 0.97], [0.86, 0.72], [1, 0.3], [0.97, -0.25], [0.85, -0.72], [0.5, -0.97], [0, -1]],   // fairing flanks
    tail: [[0, 1], [0.45, 0.93], [0.9, 0.4], [1, -0.15], [0.78, -0.78], [0, -1]],                    // seat units and tails
    ridge: [[0, 1], [0.72, 0.5], [1, 0], [0.82, -0.62], [0, -1]],                                     // beaks with a centre crease
    box: [[0, 1], [0.72, 0.93], [0.97, 0.6], [1, -0.4], [0.82, -0.92], [0, -1]],                      // scooter shields, bar covers
    tank: [[0, 1], [0.55, 0.94], [0.9, 0.6], [1, 0.1], [0.95, -0.45], [0.7, -0.9], [0, -1]],          // sculpted tanks
  };
  // distance from the centre to a facet outline along (c, s) (normalised section space)
  function facetRay(F, c, s) {
    const ac = Math.abs(c); let best = Infinity;
    for (let i = 0; i < F.length - 1; i++) {
      const [x0, y0] = F[i], [x1, y1] = F[i + 1], dx = x1 - x0, dy = y1 - y0, det = dx * s - ac * dy;
      if (Math.abs(det) < 1e-12) continue;
      const t = (dx * y0 - x0 * dy) / det, k = (ac * y0 - s * x0) / det;
      if (t > 0 && k >= -1e-6 && k <= 1 + 1e-6 && t < best) best = t;
    }
    return best === Infinity ? 1 : best;
  }
  // half width of a facet outline at normalised height Y
  function facetX(F, Y) {
    let best = 0;
    for (let i = 0; i < F.length - 1; i++) {
      const [u0, v0] = F[i], [u1, v1] = F[i + 1];
      if (v0 !== v1 && (Y - v0) * (Y - v1) <= 0) best = Math.max(best, u0 + (u1 - u0) * (Y - v0) / (v1 - v0));
    }
    return best;
  }
  // x of a keyed body's surface at (z, y); 0 outside it
  const surfX = (S, z0, z1) => { const f = secK(S); return (z, y) => z < z0 || z > z1 ? 0 : sideX(f(z), y); };
  // lofted body through keyed sections; cls(angle, x, y, z) names each quad's part ('a' when omitted) -> { part: geometry }
  function bodyParts(key, S, z0, z1, n, step, cls, crease = 40) {
    return C('bp|' + key + '|' + n + '|' + step, () => {
      const ex = (S.cuts || []).slice();
      for (const k of ['yt', 'yb', 'w']) if (Array.isArray(S[k])) for (const q of S[k]) ex.push(q[0]);
      return loftParts(zSamples(z0, z1, step, ex), secK(S), n, cls || (() => 'a'), S.f ? Math.min(crease, 24) : crease);   // facets keep their edges
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
      res[k] = soften(g, k === 'edge' ? 35 : 30);
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
    const hi = o.hi, segs = hi ? 32 : 14, rw = W.w * 0.8, hw = rw / 2, k = (W.rr || 0.216) / 0.216, at = (r, a, x = 0) => v3(x, W.y + Math.sin(a) * r, W.z + Math.cos(a) * r);
    m.add(C('tyre' + W.r + '|' + W.w + '|' + k + '|' + segs, () => tyreGeo(W.r, W.w, segs, 0.212 * k)), M4(0, W.y, W.z), RUBBER, 'lam');
    m.add(C('rim' + rw + '|' + k + '|' + segs, () => rimGeo(rw, segs, k)), M4(0, W.y, W.z), o.rim, o.wire ? 'chrome' : 'paint');
    m.add(GEO.cyl16, M4(0, W.y, W.z, 0, 0, Math.PI / 2, 0.02, W.w + 0.13, 0.02), ALU, 'chrome');                                // axle
    if (o.knobs && hi) for (const j of [-1, 1]) for (let i = 0; i < 30; i++) {   // knobbly dual-sport tread
      const a = (i + (j > 0 ? 0.5 : 0)) / 30 * Math.PI * 2, p = at(W.r - 0.003, a, j * W.w * 0.2);
      m.add(GEO.box, M4(p.x, p.y, p.z, -a, 0, 0, W.w * 0.34, 0.034, 0.018), RUBBER, 'lam');
    }
    if (o.wire) {   // laced wire wheel: big hub with flanges and 36 crossed spokes
      m.add(GEO.cyl16, M4(0, W.y, W.z, 0, 0, Math.PI / 2, 0.05, rw * 0.9, 0.05), o.hub, 'chrome');
      for (const s of [-1, 1]) m.add(GEO.cyl16, M4(s * 0.038, W.y, W.z, 0, 0, Math.PI / 2, 0.068, 0.008, 0.068), o.hub, 'chrome');
      if (hi) for (let i = 0; i < 36; i++) {
        const s = i % 2 ? 1 : -1, a = i / 36 * Math.PI * 2, lace = (i % 4 < 2 ? 1 : -1) * 0.5;
        m.add(GEO.cyl6, link(at(0.062, a + lace, s * 0.038), at(0.188 * k, a, s * 0.01), 0.0024), STEEL, 'chrome');
      } else m.add(GEO.cyl16, M4(0, W.y, W.z, 0, 0, Math.PI / 2, 0.18 * k, rw * 0.15, 0.18 * k), mul(STEEL, 0.45), 'paint');
    } else m.add(GEO.cyl16, M4(0, W.y, W.z, 0, 0, Math.PI / 2, 0.05, rw * 0.95, 0.05), o.rim, 'paint');                         // hub
    if (o.wire) { /* spokes done */ } else if (hi) {
      const [ns, split] = o.spokes, r0 = 0.045, r1 = 0.2 * k, rs = 0.125 * k, a0 = front ? 0.25 : 0.05;
      for (let k = 0; k < ns; k++) {
        const a = a0 + k / ns * Math.PI * 2;
        if (split) {
          m.add(tbox(0.8, 0.75), link(at(r0, a), at(rs, a), rw * 0.34, 0.03), o.rim, 'paint');
          for (const d of [-1, 1]) m.add(tbox(0.75, 0.8), link(at(rs - 0.012, a), at(r1, a + d * split), rw * 0.24, 0.016), o.rim, 'paint');
        } else m.add(tbox(0.65, 0.6), link(at(r0, a), at(r1, a), rw * 0.32, 0.028), o.rim, 'paint');
      }
      if (o.rimStripe) for (const s of [-1, 1]) m.add(C('rimStripe' + k + '|' + segs, () => new T.RingGeometry(0.2015 * k, 0.2095 * k, segs).rotateY(Math.PI / 2)),
        M4(s * (hw + 0.0068), W.y, W.z, 0, s > 0 ? 0 : Math.PI, 0), o.rimStripe, 'paint');
    } else m.add(GEO.cyl16, M4(0, W.y, W.z, 0, 0, Math.PI / 2, 0.2 * k, rw * 0.3, 0.2 * k), mul(o.rim, 0.6), 'paint');
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
    const fx = Math.max(0.066, hw + 0.018), rx = hw + 0.011;   // discs sit just outside the rim
    const dr = o.discR || 0.16;
    if (front) for (const s of o.singleDisc ? [o.discSide || 1] : [-1, 1]) { rotor(s * fx, dr, dr * 0.7); caliper(s * fx, 2.35, dr - 0.018, dr * 0.8); }
    else { rotor(-rx, 0.11, 0.075); caliper(-rx, -1.15, 0.094, 0.085); }
  }

  // ---- upside-down fork, yokes, steering head, mudguard ----
  function frontEnd(o) {
    const { m, hi, st, top } = o, FWs = o.FW, ax = v3(0, FWs.y, FWs.z), d = ax.clone().sub(top), len = d.length(); d.normalize();
    const rake = Math.atan2(d.z, -d.y), at = (l, x) => top.clone().addScaledVector(d, l).setX(x), fw = o.forkW || 0.105;
    o.fork = { d, len, rake, at, w: fw };
    if (o.forkType === 'conv') for (const s of [-1, 1]) {
      const x = s * fw;
      const fk = o.forkK || 1;
      m.add(GEO.cyl16, link(at(-0.03, x), at(len - 0.3, x), 0.021 * fk), CHROME, 'chrome');                           // stanchion
      m.add(taper(1, 0.8, 14), link(at(len + 0.035, x), at(len - 0.34, x), 0.034 * fk), o.forkLow, 'paint');          // slider
      m.add(GEO.cyl16, link(at(-0.05, x), at(-0.03, x), 0.024), CHROME, 'chrome');                                     // cap
      if (o.gaiters) for (let k = 0; k < 6; k++) m.add(GEO.cyl16, link(at(len - 0.42 + k * 0.016, x), at(len - 0.408 + k * 0.016, x), 0.03), RUBBER, 'lam');
      if (o.shrouds) m.add(GEO.cyl16, link(at(0.02, x), at(0.24, x), 0.034), o.shrouds, 'chrome');                    // cruiser fork covers
    } else for (const s of [-1, 1]) {
      const x = s * fw;
      m.add(GEO.cyl16, link(at(-0.045, x), at(0.43, x), 0.03), o.forkUp, 'chrome');                         // outer tube
      m.add(GEO.cyl16, link(at(0.41, x), at(0.445, x), 0.0318), mul(o.forkUp, 0.55), 'chrome');              // bottom of the outer tube
      m.add(GEO.cyl16, link(at(0.44, x), at(len - 0.06, x), 0.0215), o.forkLow, 'chrome');                   // inner tube
      m.add(GEO.box, link(at(len - 0.1, x), at(len + 0.035, x), 0.05, 0.068), BLACK, 'paint');               // axle foot
      m.add(GEO.box, link(at(len - 0.16, x).add(v3(0, 0, -0.04)), at(len - 0.05, x).add(v3(0, 0, -0.06)), 0.03, 0.03), BLACK, 'paint');   // radial caliper mount
      m.add(GEO.cyl16, link(at(-0.072, x), at(-0.045, x), 0.022), o.forkCap, 'chrome');                       // preload adjuster
      if (hi) m.add(GEO.cyl6, link(at(-0.08, x), at(-0.07, x), 0.011), ALU, 'chrome');
    }
    m.add(GEO.box, M4(0, top.y + 0.002, top.z - 0.018, -rake, 0, 0, fw * 2 + 0.08, 0.026, 0.125), st === 3 ? lin('#2a2c32') : ALU, 'chrome');   // top yoke
    m.add(GEO.cyl16, M4(0, top.y + 0.018, top.z - 0.04, -rake, 0, 0, 0.022, 0.016, 0.022), st === 3 ? GOLD : DARK, 'chrome');          // stem nut
    const ly = at(0.17, 0);
    m.add(GEO.box, M4(0, ly.y, ly.z - 0.02, -rake, 0, 0, fw * 2 + 0.065, 0.045, 0.11), st === 1 ? ALU : DARK, 'chrome');                // bottom yoke
    m.add(GEO.cyl16, link(at(-0.01, 0).add(v3(0, 0, -0.04)), at(0.2, 0).add(v3(0, 0, -0.04)), 0.032), o.frameCol, 'paint');            // steering head
    if (o.fender !== false) m.add(C('fFender' + FWs.r, () => arcBand(FWs.r + 0.018, 0.064, 0.62, 2.05, 0.005, 12)), M4(0, FWs.y, FWs.z), o.L.fender || (st === 0 ? BLACK : o.paint), st === 0 && !o.L.fender ? 'lam' : 'carPaint');
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
    const { m, hi, st } = o, col = o.armCol, sg = hi ? 14 : 6, RWs = o.RW, piv = o.piv || v3(0, 0.475, -0.13), ax = o.armX || 0.135;
    if (o.ssa) {   // single-sided arm on the left; the right side of the wheel is bare
      m.add(pathLoft('ssa', [v3(0.135, 0.48, -0.13), v3(0.145, 0.46, -0.33), v3(0.15, 0.4, -0.55), v3(0.135, 0.33, -0.705)], t => [0.03, 0.07 - 0.025 * t, 3.5], sg, 12), M4(), col, 'chrome');
      m.add(GEO.cyl16, M4(0.112, RWs.y, RWs.z, 0, 0, Math.PI / 2, 0.075, 0.06, 0.075), GOLD, 'chrome');               // eccentric hub carrier
      m.add(GEO.cyl6, M4(-0.083, RWs.y, RWs.z, 0, 0, Math.PI / 2, 0.034, 0.03, 0.034), lin('#c02020'), 'paint');      // big wheel nut
      m.add(GEO.box, M4(0.05, 0.47, -0.17, 0, 0, 0, 0.2, 0.08, 0.07), col, 'chrome');
    } else {
      const axle = v3(0, RWs.y + 0.01, RWs.z + 0.005), P = (x, t, up) => v3(x, piv.y + (axle.y - piv.y) * t + up, piv.z + (axle.z - piv.z) * t);
      const h0 = o.tubeArm ? 0.022 : 0.062, h1 = o.tubeArm ? 0.02 : 0.032, w0 = o.tubeArm ? 0.02 : 0.02;
      for (const s of [-1, 1]) {
        const x = s * ax, bend = s < 0 && st > 0 && st < 4 ? 0.03 : 0;
        m.add(pathLoft('arm' + s + '|' + bend + '|' + st, [P(x, 0, 0), P(x, 0.3, 0.019 + bend), P(x, 0.65, 0.015 + bend), P(x, 1, 0)],
          t => [w0, h0 + (h1 - h0) * t, o.tubeArm ? 2 : 3.6], sg, 10), M4(), col, 'chrome');
        m.add(GEO.box, M4(x, RWs.y + 0.005, RWs.z - 0.005, 0, 0, 0, 0.042, 0.05, 0.075), o.tubeArm ? CHROME : ALU, 'chrome');   // chain adjuster
        if (bend && hi) m.add(pathLoft('brace', [v3(x, 0.4, -0.16), v3(x, 0.335, -0.36), v3(x, 0.33, -0.58)], () => [0.013, 0.018, 3], 8, 8), M4(), col, 'chrome');
      }
      m.add(GEO.box, M4(0, piv.y - 0.02, piv.z - 0.085, 0, 0, 0, ax * 2 - 0.02, 0.065, 0.055), col, 'chrome');      // cross member
    }
    const spring = (key, a, b, r, frac) => {   // coil-over: damper body and a coil spring round it
      const d = b.clone().sub(a), L = d.length(); d.normalize();
      const c0 = a.clone().lerp(b, 0.15), sx = Math.abs(d.x) > 0.9 ? v3(0, 1, 0) : v3(1, 0, 0), sy = v3().crossVectors(d, sx).normalize();
      sx.crossVectors(sy, d).normalize();
      if (hi) {
        const pts = [], turns = 8, N = turns * 8;
        for (let i = 0; i <= N; i++) { const t = i / N, an = t * turns * Math.PI * 2; pts.push(c0.clone().addScaledVector(d, t * L * frac).addScaledVector(sx, Math.cos(an) * r).addScaledVector(sy, Math.sin(an) * r)); }
        m.add(tube('spring|' + key, pts, 0.0065, N, 5), M4(), o.spring, o.springMat || 'paint');
      } else m.add(GEO.cyl, link(c0, c0.clone().addScaledVector(d, L * frac), r + 0.004), o.spring, 'paint');
    };
    if (o.twinShock) for (const s of [-1, 1]) {   // classic twin shocks from the arm ends up to the frame
      const a = v3(s * (ax + 0.03), RWs.y + 0.05, RWs.z + 0.09), b = v3(s * (ax + 0.02), o.twinShock[0], o.twinShock[1]), d = b.clone().sub(a).normalize();
      m.add(GEO.cyl16, link(a, b, 0.016), o.shockCol || CHROME, 'chrome');
      m.add(GEO.cyl16, link(b.clone().addScaledVector(d, -0.08), b, 0.024), o.shockCol || CHROME, 'chrome');
      spring('t' + s + '|' + st, a, b, 0.03, 0.58);
    } else {   // monoshock behind the engine
      const s0 = v3(0, piv.y - 0.075, piv.z - 0.11), s1 = v3(0, piv.y + 0.265, piv.z), sd = s1.clone().sub(s0).normalize();
      m.add(GEO.cyl, link(s0, s1, 0.016), DARK, 'chrome');
      m.add(GEO.cyl16, link(s1.clone().addScaledVector(sd, -0.1), s1, 0.028), lin('#2a2c32'), 'chrome');
      spring('m|' + st, s0, s1, 0.033, 0.56);
    }
    // final drive on the left: chain and sprockets, or a toothed belt and a big pulley
    const cx = ax - 0.023, fs = v3(cx, piv.y - 0.075, piv.z + 0.1), rr = o.belt ? 0.16 : 0.105, fr = o.belt ? 0.065 : 0.045;
    m.add(GEO.cyl16, M4(cx, RWs.y, RWs.z, 0, 0, Math.PI / 2, rr, o.belt ? 0.03 : 0.008, rr), o.ssa ? GOLD : o.belt ? CHROME : lin('#2a2c32'), 'chrome');
    m.add(GEO.cyl16, M4(cx, fs.y, fs.z, 0, 0, Math.PI / 2, fr, 0.01, fr), DARK, 'chrome');
    if (hi) for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; m.add(GEO.cyl16, M4(cx, RWs.y + Math.sin(a) * rr * 0.6, RWs.z + Math.cos(a) * rr * 0.6, 0, 0, Math.PI / 2, rr * 0.21, 0.034, rr * 0.21), BLACK, 'lam'); }
    const run = (sg2, t) => v3(cx, fs.y + sg2 * fr, fs.z).lerp(v3(cx, RWs.y + sg2 * rr, RWs.z), t);
    for (const sg2 of [1, -1]) m.add(GEO.box, link(run(sg2, 0), run(sg2, 1), o.belt ? 0.026 : 0.014, 0.01), o.belt ? lin('#25201c') : lin('#4a4c52'), o.belt ? 'lam' : 'chrome');
    m.add(GEO.box, link(run(1, 0.3).add(v3(0.012, 0.025, 0)), run(1, 0.75).add(v3(0.012, 0.03, 0)), 0.004, 0.035), o.belt ? CHROME : BLACK, o.belt ? 'chrome' : 'lam');   // chain / belt guard
    if (o.hugger !== false) m.add(C('hugger' + RWs.r, () => arcBand(RWs.r + 0.03, 0.085, 0.95, 2.0, 0.006, 10)), M4(0, RWs.y, RWs.z), st === 3 ? CARBON : BLACK, st === 3 ? 'paint' : 'lam');
  }

  // ---- exhaust: link pipe from under the engine to a short silencer on the right ----
  function exhaust(o) {
    const { m, hi, st } = o, dark = lin('#2a2c32');
    const steel = (x, y) => mix(lin('#8a8e98'), lin('#6a6e7a'), clamp01((0.3 - y) / 0.2));
    const can = [
      [v3(-0.175, 0.24, -0.2), v3(-0.19, 0.27, -0.32), v3(-0.205, 0.31, -0.43)],
      [v3(-0.2, 0.3, -0.27), v3(-0.214, 0.4, -0.48), v3(-0.224, 0.5, -0.66)],
      [v3(-0.2, 0.31, -0.33), v3(-0.21, 0.37, -0.58), v3(-0.218, 0.43, -0.84)],
      [v3(-0.2, 0.31, -0.29), v3(-0.21, 0.38, -0.44), v3(-0.218, 0.45, -0.58)],
    ][st];
    m.add(tube('link' + st, [v3(0, 0.152, 0.0), v3(-0.07, 0.165, -0.1), v3(-0.14, 0.2, -0.17), can[0].clone().add(v3(0.01, -0.015, 0.03))], 0.027, hi ? 14 : 6, hi ? 8 : 5), M4(), steel, 'chrome');
    if (st === 0) m.add(bodyParts('prechamber', { yt: 0.26, yb: [[-0.18, 0.15], [0.0, 0.13], [0.16, 0.15]], w: [[-0.18, 0.09], [0, 0.12], [0.16, 0.1]], t: 0.95, b: 0.8, p: 3.4 },
      -0.18, 0.16, 12, 0.08).a, M4(), dark, 'chrome');
    const r = [0.062, 0.056, 0.058, 0.062][st], n = hi ? 12 : 8, body = o.L.can || [lin('#7c818a'), TI, STEEL, TI][st];
    m.add(pathLoft('can' + st, can, t => [r * (0.9 + 0.1 * Math.sin(Math.PI * t)), r * 1.12, st === 1 ? 2.6 : 2.2], hi ? 10 : 4, n), M4(), body, 'chrome');
    const e = can[2], dir = e.clone().sub(can[1]).normalize();
    m.add(GEO.cyl16, link(e.clone().addScaledVector(dir, -0.01), e.clone().addScaledVector(dir, 0.025), r * 0.92), CARBON, 'paint');   // end cap
    m.add(GEO.cyl16, link(e.clone().addScaledVector(dir, 0.024), e.clone().addScaledVector(dir, 0.03), r * 0.5), lin('#050506'), 'lam');
    if (hi && st !== 2) {   // carbon heat shield on the outside of the silencer
      const a = can[0].clone().lerp(can[1], 0.4).add(v3(-r * 0.95, 0.005, 0)), b = can[1].clone().lerp(can[2], 0.6).add(v3(-r * 0.95, 0.005, 0));
      m.add(GEO.box, link(a, b, 0.006, r * 1.3), CARBON, 'paint');
    }
  }

  // ---- fuel tank: glossy, knee pads, a racing stripe along the top ----
  function tank(o, key, S, z0, z1) {
    if (S.f === undefined) S.f = FACET.tank;
    const cls = (a, x, y, z) => a < 0 && z > 0 ? 'blk' : 'paint';
    addParts(o.m, bodyParts(key, S, z0, z1, o.n, o.step, cls, 34), { paint: [o.paint, 'carPaint'], blk: [BLACK, 'lam'] });
    const zc = z0 + (z1 - z0) * 0.68;
    o.m.add(GEO.cyl16, M4(0, kc(S.yt, zc) - 0.002, zc, 0, 0, 0, 0.042, 0.012, 0.042), ALU, 'chrome');   // fuel cap
  }
  // ---- tail unit: seat cowl with an accent band, pillion pad, LED tail lamp in its end; side covers, under-tray ----
  function tailBody(o, key, TAIL, pill) {
    if (TAIL.f === undefined) TAIL.f = FACET.tail;
    const { m, hi, st, paint, acc, n, step } = o, z0 = TAIL.yt[0][0];
    const cls = (a, x, y, z) => {
      if (a < 0) return z < -0.8 ? 'tl' : 'blk';
      const s = Math.sin(a);
      if (s < -0.45) return 'blk';
      if (pill && s > 0.72 && z > -0.74 && z < -0.5) return 'seat';
      if (Math.abs(s) < 0.14 && z < -0.5 && z > z0 + 0.06) return 'acc';
      return 'paint';
    };
    addParts(m, bodyParts(key, TAIL, z0, -0.44, n, step, cls, 36), { paint: [paint, 'carPaint'], acc: [o.L.tailBand || acc, 'carPaint'], seat: [SEAT, 'lam'], tl: [LENS_T, 'glass'], blk: [BLACK, 'lam'] });
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
    const { m, hi } = o, k = o.mirrorK || 1, c = v3(p.x + s * 0.03 * k, p.y, p.z);
    m.add(GEO.sph, M4(c.x, c.y, c.z, 0, s * 0.12, 0, 0.068 * k, 0.034 * k, 0.03), faired ? o.paint : BLACK, faired ? 'carPaint' : 'lam');
    m.add(GEO.box, M4(c.x, c.y, c.z - 0.026, 0, s * 0.12, 0, 0.11 * k, 0.05 * k, 0.004), lin('#8c96a2'), 'glass');
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
    NOSE.t = [[0.5, 0.5], [0.75, 0.55], [tip, 0.7]]; NOSE.b = 0.78; NOSE.p = 2.6; NOSE.f = FACET.blade;
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
    const L = [null, { z: [0.8, 0.885], top: [[0.8, 0.928], [0.885, 0.882]], bot: [[0.8, 0.912], [0.885, 0.868]] },
      { z: [0.78, 0.925], top: [[0.78, 0.915], [0.925, 0.842]], bot: [[0.78, 0.86], [0.925, 0.815]] },
      { z: [0.81, 0.94], top: [[0.81, 0.875], [0.94, 0.815]], bot: [[0.81, 0.852], [0.94, 0.802]] }][st];
    const lt = z => kc(L.top, z), lb = z => kc(L.bot, z), zl = span(L.z[0], L.z[1], hi ? 8 : 3);
    panels(m, 'lampS' + st, noseX, span(L.z[0] - 0.01, L.z[1] + 0.004, hi ? 8 : 3), z => lt(z) + 0.008, z => lb(z) - 0.008, 0.001, 0.003, 2, BLACK, 'lam', null);
    panels(m, 'lampL' + st, noseX, zl, lt, lb, 0.0035, 0.003, 2, LENS_H, 'glass', null);
    panels(m, 'lampD' + st, noseX, zl, z => lt(z) - 0.002, z => lt(z) - 0.002 - Math.min(0.009, (lt(z) - lb(z)) * 0.4), 0.0068, 0.001, 1, LED_H, 'light', null);
    if (st === 1) for (const s of [-1, 1]) {   // YZF-R1: the main beams are projectors inside the central air intake
      m.add(GEO.cyl16, M4(s * 0.024, 0.786, tip - 0.012, Math.PI / 2, 0, 0, 0.016, 0.01, 0.016), LED_H, 'light');
      m.add(GEO.cyl16, M4(s * 0.024, 0.786, tip - 0.018, Math.PI / 2, 0, 0, 0.021, 0.008, 0.021), CHROME, 'chrome');
    }
    // side fairings (their envelope closes in on the nose at the front so the panels hug it)
    const FE = { yt: 1.06, yb: 0.12, w: [[-0.2, 0.15], [-0.05, 0.185], [0.1, 0.21], [0.3, 0.222], [0.5, 0.222], [0.65, 0.205], [0.76, 0.17], [0.85, 0.12], [0.92, 0.075]].map(([z, w]) => [z, w * K]),
      t: 0.5, b: 0.72, p: 2.4, f: FACET.side };
    const feX = surfX(FE, -1, 2), env = (z, y) => Math.max(feX(z, y), noseX(z, y) + 0.004);
    const arc = z => { const d = z - FW.z, r = 0.365; return Math.abs(d) < r ? FW.y + Math.sqrt(r * r - d * d) : 0; };
    const lip = z => z > 0.78 ? 0.62 + (z - 0.78) / 0.125 * 0.195 : 0, zr = st === 2 ? -0.1 : -0.06;
    const TOP = [[zr, 0.36], [0.02, 0.56], [0.12, 0.68], [0.25, 0.775], [0.4, 0.845], [0.55, 0.88], [0.7, 0.89], [0.8, 0.87], [0.88, 0.835], [0.905, 0.815]];
    const ptop = z => kc(TOP, z), pbot = z => Math.max(0.33, arc(z), lip(z));
    panels(m, 'sideIn' + st, env, span(zr - 0.06, 0.6, nu), z => ptop(z) - 0.035, z => Math.max(0.27, arc(z) - 0.014), 0, 0.004, nv, BLACK, 'lam', null);
    panels(m, 'side' + st, env, span(zr, 0.905, nu), ptop, pbot, 0.005, 0.005, nv, o.L.side || paint, 'carPaint');
    // livery: accent stripe following the top edge
    const fw = z => kc([[0.14, 0.0], [0.26, 0.02], [0.6, 0.028], [0.86, 0.008]], z);
    panels(m, 'flash' + st, env, span(0.14, 0.86, nu), z => ptop(z) - 0.022, z => ptop(z) - 0.022 - fw(z), 0.0105, 0.0012, 2, o.L.flash || acc, 'carPaint', null);
    if (o.L.roundel) for (const s of [-1, 1]) {   // round blue-and-white badge on the side panel
      const z = 0.6, y = 0.74, x = env(z, y) + 0.0115, M = (r, d, col, mat) => m.add(GEO.cyl16, M4(s * (x + d), y, z, 0, 0, Math.PI / 2, r, 0.002, r), col, mat);
      M(0.034, 0, BLACK, 'lam'); M(0.025, 0.0015, lin('#f4f4f4'), 'paint');
      for (const [dy, dz] of [[1, 1], [-1, -1]]) m.add(GEO.box, M4(s * (x + 0.003), y + dy * 0.0062, z + dz * 0.0062, 0, 0, 0, 0.002, 0.0124, 0.0124), lin('#2c6ad6'), 'paint');
    }
    // vents (black, clipped to the panel)
    const vent = (key, z0, z1, top, bot) => panels(m, key + st, env, span(z0, z1, hi ? 10 : 3), z => Math.min(top(z), ptop(z) - 0.03),
      z => Math.max(bot(z), pbot(z) + 0.025), 0.0105, 0.0012, 1, BLACK, 'lam', null);
    if (st === 1) vent('r1duct', 0.34, 0.5, z => Math.min(0.74 + (z - 0.34) * 0.25, ptop(z) - 0.06), z => 0.6 + (z - 0.34) * 0.4);   // R1's side outlet, below the stripe
    else if (st === 3) vent('duct', 0.16, 0.42, z => 0.5 + (z - 0.16) * 0.62, z => 0.5 + (z - 0.16) * 0.62 - 0.05 * Math.sqrt(Math.sin(Math.PI * clamp01((z - 0.16) / 0.26))));
    else vent('outlet', 0.22, 0.44, z => 0.665 + (z - 0.22) * 0.32, z => 0.665 + (z - 0.22) * 0.32 - 0.03 * Math.sqrt(Math.sin(Math.PI * clamp01((z - 0.22) / 0.22))));
    if (st === 3) for (const s of [-1, 1]) for (const [dy, dz, w] of [[0, 0, 0.09], [-0.045, -0.02, 0.07]]) {   // carbon winglets
      const x0 = env(0.7 + dz, 0.8 + dy);
      m.add(GEO.box, M4(s * (x0 + w / 2), 0.8 + dy, 0.7 + dz, 0.06, 0, -s * 0.12, w, 0.008, 0.11), lin('#1c1d22'), 'paint');
    }
    // belly pan
    m.add(bodyParts('belly', { yt: 0.36, yb: [[-0.14, 0.25], [-0.04, 0.17], [0.12, 0.135], [0.28, 0.15], [0.36, 0.24]],
      w: [[-0.14, 0.09], [0, 0.12], [0.2, 0.132], [0.36, 0.11]], t: 0.95, b: 0.85, p: 3.2 }, -0.14, 0.36, n, step * 2).a, M4(), o.L.belly || (st === 2 ? paint : BLACK), o.L.belly || st !== 2 ? 'lam' : 'carPaint');
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
    for (const s of [-1, 1]) {   // Z900 "Sugomi" face: four LED lenses under angled light-guide brows
      m.add(GEO.box, M4(s * 0.022, 0.928, 0.657, 0, 0, s * 0.12, 0.03, 0.022, 0.004), LED_H, 'light');
      m.add(GEO.box, M4(s * 0.054, 0.912, 0.656, 0, 0, s * 0.3, 0.03, 0.02, 0.004), LED_H, 'light');
      m.add(GEO.box, M4(s * 0.044, 0.954, 0.657, 0, 0, -s * 0.32, 0.062, 0.006, 0.004), LED_H, 'light');
      m.add(GEO.box, link(v3(s * 0.09, 0.93, 0.47), v3(s * 0.07, 0.93, 0.53), 0.012, 0.03), DARK, 'lam');   // brackets
    }
    m.add(tbox(0.7, 1), M4(0, 1.04, 0.6, -0.6, 0, 0, 0.15, 0.1, 0.005), SMOKE, 'glass');                          // fly screen
    seat(o, 'seat0', { yt: [[-0.5, 0.88], [-0.42, 0.862], [-0.28, 0.853], [-0.16, 0.85], [-0.12, 0.856]], yb: 0.79,
      w: [[-0.5, 0.1], [-0.4, 0.125], [-0.22, 0.135], [-0.12, 0.115]], t: 0.82, b: 0.9, p: 3.4 }, -0.5, -0.12);
    tailBody(o, 'tail0', { yt: [[-0.87, 0.99], [-0.78, 0.975], [-0.64, 0.935], [-0.52, 0.885], [-0.44, 0.85]], yb: [[-0.87, 0.94], [-0.74, 0.86], [-0.6, 0.8], [-0.44, 0.76]],
      w: [[-0.87, 0.035], [-0.78, 0.065], [-0.62, 0.105], [-0.44, 0.128]], t: 0.7, b: 0.8, p: 2.5 }, true);
  }

  // ---- licence plate hanger with indicators and a Vietnamese two-line plate ----
  function rearEnd(o) {
    const { m, hi } = o, t = o.tail, py = t.plateY || 0.625;
    // tail tidy: a wide black plastic piece from under the tail down to the plate
    m.add(pathLoft('hanger' + o.st, [v3(0, t.yb - 0.025, t.z + 0.2), v3(0, t.yb - 0.06, t.z + 0.08), v3(0, py + 0.145, t.z - 0.0), v3(0, py + 0.075, t.z - 0.03)],
      t2 => [0.06 - 0.012 * t2, 0.011, 4], hi ? 10 : 4, 8), M4(), BLACK, 'lam');
    const pz = t.z - 0.045;
    m.add(GEO.box, M4(0, py, pz, 0.25, 0, 0, 0.2, 0.15, 0.01), BLACK, 'lam');
    m.add(GEO.box, M4(0, py + 0.0013, pz - 0.0055, 0.25, 0, 0, 0.19, 0.14, 0.004), [1, 1, 1], 'lam', { uv: 'plM' + o.plate });
    m.add(GEO.box, M4(0, py + 0.088, t.z - 0.034, 0.25, 0, 0, 0.05, 0.01, 0.006), LED_H, 'light');                  // plate light
    m.add(GEO.box, M4(0, py - 0.095, t.z - 0.03, 0, 0, 0, 0.06, 0.022, 0.006), lin('#9a0a06'), 'light');             // reflector
    for (const s of [-1, 1]) {
      const p0 = v3(s * 0.04, py + 0.12, t.z - 0.005), p1 = v3(s * 0.115, py + 0.125, t.z - 0.015);
      m.add(GEO.cyl, link(p0, p1, 0.007), BLACK, 'lam');
      m.add(GEO.box, M4(p1.x + s * 0.012, p1.y, p1.z, 0, 0, 0, 0.035, 0.016, 0.022), BLACK, 'lam');
      m.add(GEO.box, M4(p1.x + s * 0.014, p1.y, p1.z - 0.012, 0, 0, 0, 0.03, 0.01, 0.003), AMB, 'light');
    }
  }

  // ---- bars (risers, clip-ons, wide adventure bars, cruiser pull-backs), switchgear, levers, mirrors, dash ----
  function controls(o) {
    const { m, hi, st, pz, top } = o, f = o.fork, gw = pz.gripW, gy = pz.grip.y - 0.02, gz = pz.grip.z, bar = o.bar || (st === 0 ? 'riser' : 'clip');
    const barCol = o.barCol || (bar === 'pull' ? CHROME : bar === 'adv' ? lin('#2a2c32') : DARK);
    for (const s of [-1, 1]) {
      const inner = v3(s * (gw - 0.085), gy, gz), outer = v3(s * (gw + 0.035), gy - 0.004, gz - 0.008);
      if (bar === 'clip') {
        m.add(GEO.cyl16, link(f.at(0.012, s * f.w), f.at(0.062, s * f.w), 0.036), DARK, 'chrome');                                       // clip-on clamp
        m.add(GEO.cyl, link(f.at(0.037, s * f.w), inner, 0.0115), st === 4 ? DARK : ALU, 'chrome');
      } else {   // one-piece bar on risers clamped to the top yoke
        const rTop = v3(s * 0.045, bar === 'pull' ? top.y + 0.1 : gy + 0.042, bar === 'pull' ? top.z - 0.03 : gz + 0.025);
        m.add(GEO.cyl, link(v3(s * 0.045, top.y + 0.015, top.z - 0.02), rTop, 0.016), barCol, 'chrome');                                // risers
        if (bar === 'pull') m.add(tube('pullbar' + s + st, [v3(0, rTop.y, rTop.z), v3(s * 0.2, rTop.y + 0.02, rTop.z - 0.02), v3(s * (gw - 0.12), gy + 0.03, gz + 0.08), inner], 0.0135, hi ? 10 : 4, 8), M4(), barCol, 'chrome');
        else m.add(GEO.cyl, link(v3(0, rTop.y, rTop.z), inner, 0.0145), barCol, 'chrome');                                               // tapered bar
      }
      m.add(GEO.cyl, link(inner, outer, 0.021), RUBBER, 'lam');                                                                             // grip
      m.add(GEO.cyl16, link(outer, outer.clone().add(v3(s * 0.022, 0, 0)), 0.017), bar === 'pull' ? CHROME : ALU, 'chrome');              // bar end
      m.add(GEO.box, M4(s * (gw - 0.105), gy + 0.004, gz + 0.004, 0, 0, 0, 0.04, 0.05, 0.055), bar === 'pull' ? CHROME : BLACK, bar === 'pull' ? 'chrome' : 'lam');   // switchgear
      if (hi) m.add(GEO.box, link(v3(s * (gw - 0.1), gy + 0.01, gz + 0.04), v3(s * (gw + 0.025), gy - 0.008, gz + 0.075), 0.011, 0.014), bar === 'pull' ? CHROME : ALU, 'chrome');   // lever
      if (s < 0) {   // front brake master cylinder and its reservoir
        m.add(GEO.cyl, link(v3(s * (gw - 0.17), gy + 0.01, gz + 0.02), v3(s * (gw - 0.125), gy + 0.01, gz + 0.02), 0.016), BLACK, 'lam');
        if (hi) m.add(GEO.cyl16, M4(s * (gw - 0.16), gy + 0.055, gz, 0, 0, 0, 0.018, 0.04, 0.018), lin('#3a3a30'), 'glass');
      }
      if (bar === 'adv') {   // hand guards wrapped round the levers
        m.add(GEO.box, M4(s * (gw - 0.03), gy + 0.03, gz + 0.085, -0.15, s * 0.3, 0, 0.17, 0.075, 0.012), o.acc2 || o.paint, 'carPaint');
        m.add(tube('guard' + s, [v3(s * (gw - 0.13), gy + 0.01, gz + 0.03), v3(s * (gw - 0.05), gy + 0.02, gz + 0.1), v3(s * (gw + 0.05), gy, gz + 0.03), outer.clone().add(v3(s * 0.02, 0, 0))], 0.008, hi ? 8 : 3, 6), M4(), DARK, 'chrome');
      }
      // mirrors on the bars (the faired bikes carry theirs on the fairing)
      if (bar === 'riser' || bar === 'adv' || bar === 'pull') {
        const b = v3(s * (gw - 0.12), gy + 0.02, gz + 0.01), h = bar === 'adv' ? v3(s * (gw - 0.04), gy + 0.24, gz + 0.02) : bar === 'pull' ? v3(s * (gw - 0.02), gy + 0.26, gz + 0.06) : v3(s * (gw - 0.06), gy + 0.15 * (o.mirrorK || 1), gz + 0.035);
        const round = bar === 'pull' || o.roundMirrors;
        m.add(GEO.cyl, link(b, h, 0.007), round ? barCol : DARK, 'chrome');
        if (round) {   // round mirror
          m.add(GEO.cyl16, M4(h.x + s * 0.02, h.y + 0.03, h.z, Math.PI / 2, 0, 0, 0.055, 0.02, 0.055), barCol, 'chrome');
          m.add(GEO.cyl16, M4(h.x + s * 0.02, h.y + 0.03, h.z - 0.011, Math.PI / 2, 0, 0, 0.048, 0.004, 0.048), lin('#8c96a2'), 'glass');
        } else mirrorHead(o, s, h, false);
      } else if (st === 4) {   // café racer: round bar-end mirrors
        const h = outer.clone().add(v3(s * 0.06, 0.012, -0.01));
        m.add(GEO.cyl, link(outer.clone().add(v3(s * 0.02, 0, 0)), h, 0.007), CHROME, 'chrome');
        m.add(GEO.cyl16, M4(h.x + s * 0.035, h.y, h.z, Math.PI / 2, 0, 0, 0.042, 0.018, 0.042), CHROME, 'chrome');
        m.add(GEO.cyl16, M4(h.x + s * 0.035, h.y, h.z - 0.01, Math.PI / 2, 0, 0, 0.036, 0.004, 0.036), lin('#8c96a2'), 'glass');
      }
    }
    const rx = -2.5, nD = v3(0, -Math.sin(rx), Math.cos(rx));
    if (o.dash === 'twin') for (const s of [-1, 1]) {   // café racer: twin chrome-rimmed round clocks
      const c = v3(s * 0.065, top.y + 0.06, top.z - 0.005);
      m.add(GEO.cyl16, M4(c.x, c.y, c.z, rx + Math.PI / 2, 0, 0, 0.05, 0.05, 0.05), CHROME, 'chrome');
      const fc = c.clone().addScaledVector(nD, 0.026);
      m.add(GEO.cyl16, M4(fc.x, fc.y, fc.z, rx + Math.PI / 2, 0, 0, 0.043, 0.003, 0.043), lin('#e8e4d8'), 'light');
      if (hi) { const nd = fc.clone().addScaledVector(nD, 0.003); m.add(GEO.box, M4(nd.x + s * 0.01, nd.y + 0.008, nd.z, rx, 0, s * 0.8, 0.004, 0.035, 0.002), lin('#d02010'), 'light'); }
    } else if (o.dash === 'round') {   // single small round LCD on the bars
      const c = v3(0, top.y + 0.05, top.z + 0.01), fc = c.clone().addScaledVector(nD, 0.014);
      m.add(GEO.cyl16, M4(c.x, c.y, c.z, rx + Math.PI / 2, 0, 0, 0.045, 0.026, 0.045), lin('#16171b'), 'paint');
      m.add(GEO.cyl16, M4(fc.x, fc.y, fc.z, rx + Math.PI / 2, 0, 0, 0.038, 0.003, 0.038), lin('#9fb8c8'), 'light');
    } else if (o.dash !== 'none') {   // TFT facing the rider
      const dp = st === 0 ? v3(0, top.y + 0.045, top.z + 0.02) : st === 5 ? v3(0, top.y + 0.12, top.z + 0.06) : v3(0, top.y + 0.075, top.z + 0.035), k = st === 0 ? 0.82 : 1;
      m.add(GEO.box, M4(dp.x, dp.y, dp.z, rx, 0, 0, 0.17 * k, 0.11 * k, 0.03), BLACK, 'lam');
      const sp = dp.clone().addScaledVector(nD, 0.0155);
      m.add(GEO.box, M4(sp.x, sp.y, sp.z, rx, 0, 0, 0.14 * k, 0.08 * k, 0.004), TFT, 'light');
    }
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

  // =====================================================================================
  // The non-sport bikes: Kawasaki W800 (classic twin), Honda CRF1100L Africa Twin (adventure) and Honda Rebel 1100
  // (bobber), each with its own frame, engine, exhaust and riding position
  // =====================================================================================
  // parallel twin: air-cooled and finned (café racer) or liquid-cooled (adventure); dy lifts it in a taller frame
  function twinEngine(o, air, dy) {
    const { m, hi } = o, tilt = air ? 0.26 : 0.36, up = v3(0, Math.cos(tilt), Math.sin(tilt)), B = v3(0, 0.56 + dy, air ? 0.16 : 0.2);
    const P = u => B.clone().addScaledVector(up, u), caseCol = air ? lin('#b4b8be') : lin('#2a2c32'), cover = air ? CHROME : lin('#4c5058');
    m.add(bodyParts('twinCase' + (air ? 'a' : 'l'), { yt: [[-0.17, 0.56 + dy], [0.05, 0.54 + dy], [0.3, 0.46 + dy]], yb: [[-0.17, 0.3 + dy], [0.0, 0.24 + dy], [0.3, 0.26 + dy]],
      w: [[-0.17, 0.13], [0.05, 0.16], [0.3, 0.15]], t: 0.8, b: 0.75, p: 3.4 }, -0.17, 0.3, 16, 0.06).a, M4(), caseCol, air ? 'chrome' : 'paint');
    const box = (u, sx, sy, sz, col, mat) => { const p = P(u); m.add(GEO.box, M4(p.x, p.y, p.z, tilt, 0, 0, sx, sy, sz), col, mat); };
    box(0, 0.27, 0.2, 0.15, air ? lin('#5a5e66') : caseCol, 'paint');                                       // barrels
    if (air) for (let k = 0; k < (hi ? 8 : 4); k++) box(-0.085 + k * (hi ? 0.024 : 0.048), 0.31, 0.007, 0.19, lin('#c4c8ce'), 'chrome');   // cooling fins
    box(0.14, 0.3, 0.08, 0.17, air ? lin('#b4b8be') : caseCol, air ? 'chrome' : 'paint');                  // head
    box(0.2, 0.27, 0.045, 0.145, air ? CHROME : o.paint, air ? 'chrome' : 'carPaint');                    // valve / cam cover
    m.add(GEO.cyl16, M4(0.155, 0.4 + dy, 0.12, 0, 0, Math.PI / 2, 0.08, 0.03, 0.08), cover, 'chrome');      // alternator cover
    m.add(GEO.cyl16, M4(-0.16, 0.38 + dy, 0.0, 0, 0, Math.PI / 2, 0.1, 0.035, 0.1), cover, 'chrome');      // clutch cover
    if (air) for (const s of [-1, 1]) {   // carburettors with chrome velocity stacks behind the barrels
      const c = P(0.1).add(v3(s * 0.075, 0.0, -0.12));
      m.add(GEO.cyl16, link(c, c.clone().add(v3(0, 0.0, -0.05)), 0.032), lin('#9ca0a8'), 'chrome');
      m.add(taper(0.8, 1.15, 14), link(c.clone().add(v3(0, 0.0, -0.05)), c.clone().add(v3(0, 0.01, -0.1)), 0.034), CHROME, 'chrome');
    }
    const fwd = v3(0, -Math.sin(tilt), Math.cos(tilt));
    return P(0.14).addScaledVector(fwd, 0.085);   // centre of the exhaust ports
  }
  // 45-degree V-twin: finned black barrels, chrome rocker boxes, primary cover and air cleaner, pushrod tubes
  function vtwinEngine(o) {
    const { m, hi } = o, blk = lin('#1c1d22');
    m.add(bodyParts('vtCase', { yt: [[-0.2, 0.5], [0.0, 0.5], [0.26, 0.44]], yb: [[-0.2, 0.26], [0.0, 0.2], [0.26, 0.24]],
      w: [[-0.2, 0.1], [0.05, 0.12], [0.26, 0.11]], t: 0.85, b: 0.8, p: 3.4 }, -0.2, 0.26, 16, 0.06).a, M4(), blk, 'paint');
    m.add(GEO.sph, M4(0.125, 0.31, -0.1, 0, 0, 0, 0.04, 0.13, 0.25), CHROME, 'chrome');                    // primary cover (left)
    m.add(GEO.sph, M4(0.13, 0.36, 0.12, 0, 0, 0, 0.03, 0.08, 0.08), CHROME, 'chrome');                     // timing cover
    m.add(GEO.cyl16, M4(-0.16, 0.62, 0.04, 0, 0, Math.PI / 2, 0.11, 0.05, 0.11), CHROME, 'chrome');        // air cleaner (right)
    m.add(GEO.cyl16, M4(-0.187, 0.62, 0.04, 0, 0, Math.PI / 2, 0.055, 0.008, 0.055), o.paint, 'carPaint');
    const heads = [];
    for (const [th, base] of [[0.39, v3(0, 0.47, 0.1)], [-0.39, v3(0, 0.47, -0.04)]]) {
      const u = v3(0, Math.cos(th), Math.sin(th)), at = l => base.clone().addScaledVector(u, l);
      m.add(GEO.cyl16, link(at(0), at(0.2), 0.072), blk, 'paint');                                        // barrel
      for (let k = 0; k < (hi ? 8 : 3); k++) { const l = 0.02 + k * (hi ? 0.021 : 0.06); m.add(GEO.cyl16, link(at(l), at(l + 0.007), 0.094), lin('#3c3e44'), 'chrome'); }   // fins
      m.add(GEO.cyl16, link(at(0.2), at(0.26), 0.088), blk, 'paint');                                     // head
      m.add(GEO.cyl16, link(at(0.26), at(0.31), 0.078), CHROME, 'chrome');                                // rocker box
      m.add(GEO.sph, M4(at(0.31).x, at(0.31).y, at(0.31).z, th, 0, 0, 0.078, 0.025, 0.078), CHROME, 'chrome');
      if (hi) for (const dz of [-0.018, 0.018]) m.add(GEO.cyl, link(v3(-0.05, 0.42, 0.03 + dz), at(0.24).add(v3(-0.05, 0, dz)), 0.008), CHROME, 'chrome');   // pushrod tubes
      heads.push(at(0.23));
    }
    return heads;
  }
  // a simple tube frame from polylines (one per side)
  function tubeFrame(m, lines, r, col) {
    for (const s of [-1, 1]) for (const L of lines) for (let i = 0; i < L.length - 1; i++)
      m.add(GEO.cyl, link(v3(s * L[i][0], L[i][1], L[i][2]), v3(s * L[i + 1][0], L[i + 1][1], L[i + 1][2]), r), col, 'paint');
  }
  // round headlight in a chrome bucket with an LED halo
  function roundLamp(m, c, r, hi, bucket) {
    m.add(GEO.sph, M4(c.x, c.y, c.z, 0, 0, 0, r, r, r * 0.82), bucket || CHROME, bucket ? 'paint' : 'chrome');
    m.add(GEO.cyl16, M4(c.x, c.y, c.z + r * 0.74, Math.PI / 2, 0, 0, r * 0.93, 0.012, r * 0.93), LENS_H, 'glass');
    m.add(C('halo' + r, () => new T.RingGeometry(r * 0.62, r * 0.76, 24)), M4(c.x, c.y, c.z + r * 0.75 + 0.002), LED_H, 'light');
    m.add(GEO.cyl16, M4(c.x, c.y, c.z + r * 0.75, Math.PI / 2, 0, 0, r * 0.3, 0.008, r * 0.3), LED_H, 'light');
  }

  // ---- Kawasaki W800: classic standard — round lamp and twin clocks, tank with a contrast band and a gold pinstripe,
  // tuck-and-roll seat, wire wheels with gaitered forks, air-cooled vertical twin with its bevel-drive tower up the
  // right side, twin peashooter silencers, chrome-sprung twin shocks ----
  function w800Bike(o) {
    const { m, hi, paint, acc, n, step } = o, FWs = o.FW, RWs = o.RW;
    const port = twinEngine(o, true, 0);
    m.add(GEO.cyl16, link(v3(-0.118, 0.44, 0.13), v3(-0.118, 0.74, 0.215), 0.021), CHROME, 'chrome');               // bevel-drive tower
    for (const [y, z] of [[0.44, 0.13], [0.745, 0.215]]) m.add(GEO.sph, M4(-0.118, y, z, 0, 0, 0, 0.034, 0.032, 0.034), CHROME, 'chrome');
    tubeFrame(m, [[[0.04, 0.87, 0.4], [0.09, 0.8, 0.05], [0.1, 0.78, -0.18], [0.085, 0.8, -0.62], [0.06, 0.77, -0.66]],
      [[0.05, 0.78, 0.42], [0.09, 0.45, 0.36], [0.1, 0.22, 0.25], [0.1, 0.2, -0.05], [0.1, 0.45, -0.12], [0.1, 0.78, -0.18]],
      [[0.1, 0.45, -0.12], [0.09, 0.78, -0.45]]], 0.013, o.frameCol);
    // tank: contrast band low on each side under a gold pinstripe, rubber knee pads, chrome filler cap
    const TK = { yt: [[-0.14, 0.875], [-0.05, 0.94], [0.08, 0.99], [0.24, 1.0], [0.35, 0.975], [0.4, 0.94]], yb: [[-0.14, 0.8], [0.1, 0.78], [0.4, 0.84]],
      w: [[-0.14, 0.11], [-0.04, 0.14], [0.1, 0.168], [0.3, 0.16], [0.4, 0.12]], t: 0.72, b: 0.85, p: 2.3 };
    addParts(m, bodyParts('w800Tank', TK, -0.14, 0.4, n, step, (a, x, y, z) => {
      if (a < 0) return 'paint';
      const s = Math.sin(a), c = Math.abs(Math.cos(a));
      if (c > 0.96 && Math.abs(s) < 0.22 && z > 0.02 && z < 0.11) return 'pad';
      if (s < -0.12 && s > -0.8 && z > -0.08 && z < 0.36) return 'band';
      if (s >= -0.12 && s < 0.08 && z > -0.06 && z < 0.34) return 'pin';
      return 'paint';
    }, 34), { paint: [paint, 'carPaint'], band: [o.L.tankBand || acc, 'carPaint'], pin: [o.L.pin || GOLD, 'carPaint'], pad: [PLASTIC, 'lam'] });
    m.add(GEO.cyl16, M4(0, kc(TK.yt, 0.22) + 0.004, 0.22, 0, 0, 0, 0.042, 0.014, 0.042), CHROME, 'chrome');
    // tuck-and-roll dual seat, black oval side covers
    m.add(bodyParts('w800Seat', { yt: [[-0.64, 0.878], [-0.5, 0.872], [-0.3, 0.866], [-0.13, 0.862]], yb: 0.8, w: [[-0.64, 0.11], [-0.48, 0.13], [-0.2, 0.13], [-0.13, 0.11]],
      t: 0.85, b: 0.9, p: 3.2 }, -0.64, -0.13, n, step).a, M4(), SEAT, 'lam');
    if (hi) for (let k = 0; k < 9; k++) m.add(GEO.box, M4(0, 0.873, -0.58 + k * 0.05, 0, 0, 0, 0.25, 0.004, 0.006), lin('#050506'), 'lam');
    for (const s of [-1, 1]) m.add(GEO.cyl16, M4(s * 0.112, 0.64, -0.3, 0, 0, Math.PI / 2, 0.075, 0.012, 0.105), PLASTIC, 'lam');
    // short painted fenders; oval tail lamp and the plate on the end of the rear one
    m.add(C('w8FenderF', () => arcBand(FWs.r + 0.024, 0.062, 0.45, 2.15, 0.004, 12)), M4(0, FWs.y, FWs.z), paint, 'carPaint');
    m.add(C('w8FenderR', () => arcBand(RWs.r + 0.035, 0.075, 0.95, 2.5, 0.004, 12)), M4(0, RWs.y, RWs.z), paint, 'carPaint');
    const tl = v3(0, RWs.y + 0.37 * Math.sin(2.3), RWs.z + 0.37 * Math.cos(2.3));
    m.add(GEO.sph, M4(tl.x, tl.y, tl.z, 0, 0, 0, 0.05, 0.03, 0.035), CHROME, 'chrome');
    m.add(GEO.sph, M4(tl.x, tl.y, tl.z - 0.022, 0, 0, 0, 0.042, 0.024, 0.016), LED_T, 'light');
    m.add(GEO.box, link(tl.clone().add(v3(0, -0.02, -0.01)), v3(0, 0.57, -1.07), 0.02, 0.012), DARK, 'lam');
    m.add(GEO.box, M4(0, 0.505, -1.075, 0.15, 0, 0, 0.2, 0.15, 0.01), BLACK, 'lam');
    m.add(GEO.box, M4(0, 0.505, -1.081, 0.15, 0, 0, 0.19, 0.14, 0.004), [1, 1, 1], 'lam', { uv: 'plM' + o.plate });
    for (const s of [-1, 1]) {   // indicators front and rear
      m.add(GEO.cyl, link(v3(s * 0.05, 0.6, -0.9), v3(s * 0.12, 0.6, -0.92), 0.007), CHROME, 'chrome');
      m.add(GEO.sph, M4(s * 0.13, 0.6, -0.925, 0, 0, 0, 0.022, 0.022, 0.03), AMB, 'light');
      m.add(GEO.cyl, link(o.fork.at(0.2, s * 0.1), v3(s * 0.15, 0.83, 0.55), 0.007), CHROME, 'chrome');
      m.add(GEO.sph, M4(s * 0.155, 0.83, 0.565, 0, 0, 0, 0.022, 0.022, 0.03), AMB, 'light');
    }
    roundLamp(m, v3(0, 0.86, 0.585), 0.088, hi);
    for (const s of [-1, 1]) m.add(GEO.box, link(o.fork.at(0.24, s * 0.1), v3(s * 0.07, 0.86, 0.57), 0.012, 0.02), CHROME, 'chrome');   // lamp ears
    // twin peashooters, one each side
    for (const s of [-1, 1]) {
      const pts = [v3(s * 0.075, port.y, port.z), v3(s * 0.1, 0.6, 0.35), v3(s * 0.14, 0.4, 0.33), v3(s * 0.17, 0.27, 0.2), v3(s * 0.195, 0.26, -0.05), v3(s * 0.205, 0.28, -0.3)];
      m.add(tube('w8Hdr' + s, pts, 0.022, hi ? 18 : 8, hi ? 8 : 5), M4(), CHROME, 'chrome');
      m.add(pathLoft('pea' + s, [v3(s * 0.205, 0.28, -0.3), v3(s * 0.21, 0.305, -0.58), v3(s * 0.215, 0.33, -0.87)],
        t => { const r = t < 0.82 ? 0.036 : 0.036 - (t - 0.82) / 0.18 * 0.016; return [r, r, 2]; }, hi ? 10 : 4, hi ? 14 : 8), M4(), CHROME, 'chrome');
      m.add(GEO.cyl16, M4(s * 0.215, 0.331, -0.872, Math.PI / 2 - 0.09, 0, 0, 0.016, 0.006, 0.016), BLACK, 'lam');
      // mid-mounted rubber footrests
      m.add(GEO.box, link(v3(s * 0.1, 0.4, -0.08), v3(s * 0.16, 0.37, -0.12), 0.02, 0.02), DARK, 'chrome');
      m.add(GEO.cyl, link(v3(s * 0.155, 0.37, -0.12), v3(s * 0.235, 0.37, -0.12), 0.016), RUBBER, 'lam');
      m.add(GEO.box, link(v3(s * 0.16, 0.38, -0.08), v3(s * 0.17, 0.4, 0.02), 0.009, 0.012), CHROME, 'chrome');
    }
  }

  // ---- adventure tourer ----
  function advBike(o) {
    const { m, hi, paint, acc, n, step, nu, nv } = o, FWs = o.FW;
    const port = twinEngine(o, false, 0.06);
    // radiator, bash plate, crash bars, frame
    m.add(GEO.box, M4(0, 0.72, 0.43, -0.25, 0, 0, 0.34, 0.3, 0.05), lin('#131417'), 'lam');
    if (hi) for (let k = 0; k < 9; k++) m.add(GEO.box, M4(0, 0.6 + k * 0.03, 0.455 + k * 0.0077, -0.25, 0, 0, 0.32, 0.006, 0.004), lin('#3a3c42'), 'chrome');
    m.add(bodyParts('bash', { yt: 0.31, yb: [[-0.15, 0.25], [0.0, 0.2], [0.3, 0.21], [0.4, 0.29]], w: [[-0.15, 0.1], [0.1, 0.13], [0.4, 0.11]], t: 0.95, b: 0.9, p: 3.5 },
      -0.15, 0.4, 14, 0.08).a, M4(), ALU, 'chrome');
    for (const s of [-1, 1]) m.add(tube('crashbar' + s, [v3(s * 0.1, 0.93, 0.4), v3(s * 0.245, 0.85, 0.38), v3(s * 0.275, 0.6, 0.33), v3(s * 0.245, 0.38, 0.22), v3(s * 0.14, 0.3, 0.1)], 0.012, hi ? 14 : 6, 6), M4(), lin('#9ea3ab'), 'chrome');
    tubeFrame(m, [[[0.06, 1.0, 0.43], [0.15, 0.86, 0.15], [0.14, 0.62, -0.1]], [[0.14, 0.86, -0.1], [0.1, 0.92, -0.78]], [[0.14, 0.62, -0.1], [0.1, 0.88, -0.55]]], 0.013, o.frameCol);
    // headers into a high silencer on the right
    for (const x of [-0.07, 0.07]) m.add(tube('advHdr' + x, [v3(x, port.y, port.z), v3(x * 1.1, 0.68, 0.385), v3(x, 0.48, 0.38), v3(x * 0.8, 0.3, 0.33), v3(x * 0.5, 0.23, 0.18), v3(-0.03, 0.22, 0.0)], 0.02, hi ? 16 : 6, hi ? 7 : 4), M4(), (x2, y) => mix(lin('#a07a3c'), lin('#7a7e88'), clamp01((0.75 - y) / 0.4)), 'chrome');
    m.add(tube('advLink', [v3(-0.03, 0.22, 0.0), v3(-0.12, 0.27, -0.2), v3(-0.18, 0.38, -0.33)], 0.03, hi ? 10 : 4, 7), M4(), lin('#8a8e98'), 'chrome');
    m.add(pathLoft('advCan', [v3(-0.185, 0.395, -0.33), v3(-0.198, 0.46, -0.48), v3(-0.205, 0.52, -0.63)], t => [0.058, 0.066, 2.6], hi ? 8 : 3, hi ? 12 : 8), M4(), TI, 'chrome');
    m.add(GEO.cyl16, link(v3(-0.205, 0.52, -0.63), v3(-0.207, 0.53, -0.66), 0.055), CARBON, 'paint');
    // upper fairing: angular nose with stacked LED lights, tall screen, beak over the front wheel
    const NS = { yt: [[0.42, 1.12], [0.55, 1.12], [0.64, 1.07], [0.68, 1.02]], yb: [[0.42, 0.9], [0.55, 0.89], [0.68, 0.93]],
      w: [[0.42, 0.17], [0.55, 0.165], [0.64, 0.13], [0.68, 0.09]], t: 0.75, b: 0.75, p: 3.2, f: FACET.box };
    addParts(m, bodyParts('advNose', NS, 0.42, 0.68, n, step * 0.6, (a, x, y, z) => a < 0 ? (z > 0.6 ? 'lens' : 'blk') : Math.sin(a) < -0.5 ? 'blk' : 'paint', 36),
      { paint: [paint, 'carPaint'], lens: [LENS_H, 'glass'], blk: [BLACK, 'lam'] });
    for (const s of [-1, 1]) {
      m.add(GEO.box, M4(s * 0.035, 1.0, 0.684, 0, 0, s * 0.35, 0.05, 0.022, 0.004), LED_H, 'light');
      m.add(GEO.box, M4(s * 0.035, 0.96, 0.684, 0, 0, -s * 0.35, 0.05, 0.022, 0.004), LED_H, 'light');
    }
    const scr = C('advScreen|' + hi, () => {
      const O = [], I = [], nj = hi ? 10 : 5;
      for (const z of span(0.47, 0.6, hi ? 8 : 3)) {
        const yc = kc([[0.47, 1.42], [0.535, 1.27], [0.6, 1.1]], z), w = kc([[0.47, 0.17], [0.6, 0.125]], z), ro = [], ri = [];
        for (let j = 0; j <= nj; j++) { const v = -1 + 2 * j / nj, y = yc - 0.045 * v * v; ro.push([w * v, y, z + 0.005]); ri.push([w * v, y, z]); }
        O.push(ro); I.push(ri);
      }
      return shellGrid(O, I);
    });
    m.add(scr.face, M4(), SMOKE, 'glass'); m.add(scr.back, M4(), SMOKE, 'glass'); m.add(scr.edge, M4(), BLACK, 'lam');
    addParts(m, bodyParts('beak', { yt: [[0.6, 0.96], [0.75, 0.9], [0.9, 0.85], [0.96, 0.825]], yb: [[0.6, 0.86], [0.75, 0.835], [0.9, 0.815], [0.96, 0.808]],
      w: [[0.6, 0.12], [0.75, 0.11], [0.9, 0.085], [0.96, 0.06]], t: 0.85, b: 0.95, p: 3.2, f: FACET.ridge }, 0.6, 0.96, n, step, (a) => a >= 0 && Math.abs(Math.sin(a)) < 0.2 ? 'acc' : 'a', 34),
      { a: [paint, 'carPaint'], acc: [o.L.acc2 || acc, 'carPaint'] });
    m.add(C('advFender', () => arcBand(FWs.r + 0.02, 0.055, 0.75, 1.9, 0.004, 10)), M4(0, FWs.y, FWs.z), BLACK, 'lam');
    // tank with big side shrouds (two-tone graphics), seat, luggage
    tank(o, 'advTank', { yt: [[-0.12, 0.93], [-0.02, 1.0], [0.12, 1.07], [0.28, 1.09], [0.4, 1.06]], yb: [[-0.12, 0.86], [0.1, 0.84], [0.4, 0.88]],
      w: [[-0.12, 0.12], [0.0, 0.15], [0.15, 0.19], [0.32, 0.19], [0.4, 0.15]], t: 0.6, b: 0.9, p: 3.3 }, -0.12, 0.4);
    const shX = (z, y) => kc([[0.0, 0.17], [0.2, 0.235], [0.4, 0.25], [0.56, 0.22]], z) - (y - 0.82) * (y - 0.82) * 0.5;
    const stp = z => kc([[0.04, 0.96], [0.25, 1.02], [0.45, 1.0], [0.54, 0.96]], z), sbt = z => kc([[0.04, 0.92], [0.15, 0.8], [0.32, 0.72], [0.46, 0.74], [0.54, 0.88]], z);
    panels(m, 'advShIn', shX, span(0.02, 0.52, nu), z => stp(z) - 0.03, z => sbt(z) - 0.03, 0, 0.004, nv, BLACK, 'lam', null);
    panels(m, 'advSh', shX, span(0.04, 0.54, nu), stp, sbt, 0.005, 0.005, nv, paint, 'carPaint');
    const ac1 = z => Math.min(stp(z) - 0.025, 0.79 + (z - 0.1) * 0.45), ac2 = z => Math.max(sbt(z) + 0.015, 0.76 + (z - 0.1) * 0.4);
    panels(m, 'advShAcc', shX, span(0.1, 0.48, nu), ac1, ac2, 0.0105, 0.0012, 2, acc, 'carPaint', null);
    if (o.L.acc2) panels(m, 'advShAcc2', shX, span(0.14, 0.46, nu), z => ac2(z) - 0.008, z => Math.max(sbt(z) + 0.01, ac2(z) - 0.034), 0.0105, 0.0012, 1, o.L.acc2, 'carPaint', null);
    m.add(bodyParts('advSeat', { yt: [[-0.46, 0.89], [-0.25, 0.885], [-0.1, 0.9]], yb: 0.83, w: [[-0.46, 0.14], [-0.25, 0.15], [-0.1, 0.13]], t: 0.85, b: 0.9, p: 3.3 },
      -0.46, -0.1, n, step).a, M4(), o.L.seat || SEAT, 'lam');
    m.add(bodyParts('advPill', { yt: [[-0.8, 0.935], [-0.5, 0.94]], yb: 0.87, w: [[-0.8, 0.11], [-0.5, 0.13]], t: 0.85, b: 0.9, p: 3.3 }, -0.8, -0.46, n, step).a, M4(), o.L.seat || SEAT, 'lam');
    addParts(m, bodyParts('advTail', { yt: [[-0.98, 0.9], [-0.8, 0.9], [-0.6, 0.885], [-0.4, 0.86]], yb: [[-0.98, 0.83], [-0.6, 0.78], [-0.4, 0.74]],
      w: [[-0.98, 0.06], [-0.8, 0.1], [-0.6, 0.13], [-0.4, 0.14]], t: 0.8, b: 0.8, p: 2.8, f: FACET.tail }, -0.98, -0.4, n, step, (a, x, y, z) => a < 0 || Math.sin(a) < -0.5 ? 'blk' : Math.abs(Math.sin(a)) < 0.15 && z < -0.5 ? 'acc' : 'a', 34),
      { a: [paint, 'carPaint'], acc: [acc, 'carPaint'], blk: [PLASTIC, 'lam'] });
    m.add(GEO.box, M4(0, 0.865, -0.984, 0, 0, 0, 0.1, 0.022, 0.006), LED_T, 'light');
    o.tail = { z: -0.98, y: 0.865, w: 0.06, yb: 0.83, plateY: 0.66 };
    // rear rack with a black top box
    for (const s of [-1, 1]) m.add(tube('advRack' + s, [v3(s * 0.12, 0.9, -0.48), v3(s * 0.13, 0.95, -0.7), v3(s * 0.11, 0.96, -0.98), v3(0, 0.96, -1.0)], 0.011, hi ? 8 : 3, 6), M4(), DARK, 'chrome');
    m.add(bodyParts('advTopBox', { yt: [[-1.06, 1.17], [-0.9, 1.22], [-0.7, 1.2]], yb: 0.96, w: [[-1.06, 0.17], [-0.9, 0.2], [-0.7, 0.17]], t: 0.75, b: 0.95, p: 3.6 },
      -1.06, -0.7, 16, 0.05).a, M4(), lin('#1a1b1f'), 'paint');
    m.add(GEO.box, M4(0, 1.06, -1.062, 0, 0, 0, 0.14, 0.03, 0.006), LED_T, 'light');
    for (const s of [-1, 1]) {
      // wide serrated off-road pegs
      const peg = v3(s * 0.165, 0.44, -0.16);
      m.add(GEO.box, link(v3(s * 0.15, 0.58, -0.12), v3(s * 0.155, 0.43, -0.18), 0.01, 0.06), DARK, 'chrome');
      m.add(GEO.box, M4(peg.x + s * 0.04, peg.y, peg.z, 0, 0, 0, 0.08, 0.016, 0.04), ALU, 'chrome');
      m.add(GEO.box, link(v3(s * 0.175, 0.44, -0.15), v3(s * 0.19, 0.455, -0.05), 0.009, 0.012), ALU, 'chrome');
    }
    rearEnd(o);
  }

  // ---- Honda Rebel 1100: blacked-out bobber — round LED lamp, teardrop tank, low solo seat, bobbed fenders, fat tyres,
  // liquid-cooled parallel twin with its radiator up front, piggyback twin shocks, long low silencer on the right ----
  function rebelBike(o) {
    const { m, hi, paint, n, step } = o, FWs = o.FW, RWs = o.RW, blk = lin('#16171b');
    const port = twinEngine(o, false, -0.02);
    m.add(GEO.box, M4(0, 0.6, 0.41, -0.3, 0, 0, 0.3, 0.26, 0.05), lin('#131417'), 'lam');   // radiator between the down tubes
    if (hi) for (let k = 0; k < 8; k++) m.add(GEO.box, M4(0, 0.5 + k * 0.03, 0.434 + k * 0.0093, -0.3, 0, 0, 0.28, 0.006, 0.004), lin('#3a3c42'), 'chrome');
    tubeFrame(m, [[[0.04, 0.86, 0.4], [0.08, 0.8, 0.12], [0.09, 0.73, -0.2], [0.08, 0.72, -0.5], [0.07, 0.73, -0.76]],
      [[0.05, 0.78, 0.43], [0.08, 0.45, 0.36], [0.09, 0.22, 0.28], [0.09, 0.19, -0.1], [0.1, 0.38, -0.15], [0.09, 0.73, -0.2]],
      [[0.1, 0.38, -0.15], [0.08, 0.72, -0.5]]], 0.016, o.frameCol);
    // black headers into one long, low silencer on the right with a brushed end cap
    for (const x of [-0.07, 0.07]) m.add(tube('rebHdr' + x, [v3(x, port.y, port.z), v3(x * 1.1, 0.6, 0.37), v3(x, 0.42, 0.37), v3(x * 0.7, 0.26, 0.3), v3(-0.04, 0.2, 0.12), v3(-0.13, 0.22, -0.05)],
      0.021, hi ? 16 : 6, hi ? 7 : 4), M4(), blk, 'chrome');
    m.add(pathLoft('rebCan', [v3(-0.14, 0.225, -0.06), v3(-0.215, 0.26, -0.3), v3(-0.24, 0.3, -0.62), v3(-0.245, 0.33, -0.86)], () => [0.052, 0.058, 2.2], hi ? 10 : 4, hi ? 12 : 8),
      M4(), lin('#1c1d22'), 'chrome');
    m.add(taper(1, 0.72, 14), link(v3(-0.245, 0.33, -0.86), v3(-0.247, 0.336, -0.94), 0.05), lin('#9a9ea6'), 'chrome');
    // teardrop tank with a chrome wing badge
    const TK = { yt: [[-0.06, 0.82], [0.04, 0.9], [0.18, 0.95], [0.32, 0.95], [0.42, 0.9]], yb: [[-0.06, 0.74], [0.2, 0.72], [0.42, 0.78]],
      w: [[-0.06, 0.1], [0.06, 0.15], [0.25, 0.165], [0.42, 0.11]], t: 0.65, b: 0.9, p: 2.4, f: null };
    tank(o, 'rebTank', TK, -0.06, 0.42);
    for (const s of [-1, 1]) m.add(GEO.sph, M4(s * 0.162, 0.85, 0.2, 0, 0, 0, 0.006, 0.026, 0.07), ALU, 'chrome');
    // low solo seat, pillion pad, black side covers
    m.add(bodyParts('rebSeat', { yt: [[-0.42, 0.74], [-0.3, 0.7], [-0.16, 0.69], [-0.06, 0.72]], yb: 0.63, w: [[-0.42, 0.14], [-0.25, 0.16], [-0.06, 0.11]], t: 0.85, b: 0.9, p: 3 },
      -0.42, -0.06, n, step).a, M4(), SEAT, 'lam');
    m.add(bodyParts('rebPill', { yt: [[-0.62, 0.77], [-0.44, 0.765]], yb: 0.71, w: [[-0.62, 0.09], [-0.44, 0.11]], t: 0.85, b: 0.9, p: 3 }, -0.62, -0.44, n, step).a, M4(), SEAT, 'lam');
    panels(m, 'rebSide', (z, y) => 0.115 - (y - 0.58) * (y - 0.58) * 0.4, span(-0.36, -0.1, hi ? 8 : 3), () => 0.625, z => kc([[-0.36, 0.615], [-0.24, 0.53], [-0.1, 0.52]], z),
      0, 0.006, hi ? 3 : 1, paint, 'carPaint');
    // bobbed fenders, round tail lamp, plate on a bracket behind the tyre
    m.add(C('rebFenderR', () => arcBand(RWs.r + 0.04, 0.105, 1.15, 2.45, 0.005, 12)), M4(0, RWs.y, RWs.z), paint, 'carPaint');
    m.add(C('rebFenderF', () => arcBand(FWs.r + 0.024, 0.075, 0.75, 1.95, 0.005, 10)), M4(0, FWs.y, FWs.z), paint, 'carPaint');
    const tl = v3(0, RWs.y + 0.37 * Math.sin(2.35), RWs.z + 0.37 * Math.cos(2.35));
    m.add(GEO.cyl16, M4(tl.x, tl.y, tl.z, 2.35 - Math.PI / 2 + Math.PI / 2, 0, 0, 0.032, 0.014, 0.032), blk, 'paint');
    m.add(GEO.cyl16, M4(tl.x, tl.y - 0.006, tl.z - 0.009, Math.PI / 2 + 0.45, 0, 0, 0.026, 0.006, 0.026), LED_T, 'light');
    m.add(GEO.box, link(v3(0.0, 0.52, -0.97), v3(0, 0.53, -1.03), 0.04, 0.012), blk, 'lam');
    m.add(GEO.box, M4(0, 0.49, -1.035, 0.1, 0, 0, 0.2, 0.15, 0.01), BLACK, 'lam');
    m.add(GEO.box, M4(0, 0.49, -1.041, 0.1, 0, 0, 0.19, 0.14, 0.004), [1, 1, 1], 'lam', { uv: 'plM' + o.plate });
    for (const s of [-1, 1]) {
      m.add(GEO.cyl, link(v3(s * 0.08, 0.56, -0.96), v3(s * 0.13, 0.56, -0.97), 0.006), blk, 'lam');
      m.add(GEO.sph, M4(s * 0.14, 0.56, -0.975, 0, 0, 0, 0.018, 0.018, 0.026), AMB, 'light');
      m.add(GEO.cyl, link(o.fork.at(0.22, s * 0.11), v3(s * 0.15, 0.86, 0.5), 0.006), blk, 'lam');
      m.add(GEO.sph, M4(s * 0.155, 0.86, 0.515, 0, 0, 0, 0.018, 0.018, 0.026), AMB, 'light');
      // mid-forward footrests with the gear / brake levers
      m.add(GEO.box, link(v3(s * 0.1, 0.3, 0.1), v3(s * 0.18, 0.36, 0.17), 0.02, 0.03), blk, 'chrome');
      m.add(GEO.cyl, link(v3(s * 0.17, 0.36, 0.17), v3(s * 0.25, 0.36, 0.17), 0.016), RUBBER, 'lam');
      m.add(GEO.box, link(v3(s * 0.17, 0.37, 0.2), v3(s * 0.18, 0.38, 0.3), 0.009, 0.012), DARK, 'chrome');
    }
    roundLamp(m, v3(0, 0.915, 0.6), 0.09, hi, blk);
    for (const s of [-1, 1]) m.add(GEO.box, link(o.fork.at(0.12, s * 0.11), v3(s * 0.075, 0.915, 0.58), 0.012, 0.02), blk, 'lam');   // lamp brackets
  }


  // =====================================================================================
  // Vietnam's street favourites: Honda Winner X, Yamaha Exciter 155 VVA and Suzuki Raider R150 (150 cc "xe côn tay"
  // sport underbones: LED face on a body-mounted nose, a low spine between the knees, horizontal single, 17" Y-spoke
  // wheels), the Yamaha YZF-R15 V4 (the R1's face on a small single) and the Honda SH 160i scooter
  // =====================================================================================
  // single cylinder on its crankcase (round clutch cover right, magneto cover left); b = cylinder base, tilt = forward
  // lean from upright, w = half width. Returns the exhaust port
  function singleEngine(o, b, tilt, w, caseCol, cover) {
    const { m, hi } = o, up = v3(0, Math.cos(tilt), Math.sin(tilt)), fwd = v3(0, -Math.sin(tilt), Math.cos(tilt)), P = u => b.clone().addScaledVector(up, u);
    m.add(GEO.sph, M4(0, b.y - 0.05, b.z - 0.09, 0, 0, 0, w * 1.05, 0.13, 0.17), caseCol, 'paint');                       // crankcase
    m.add(GEO.cyl16, M4(-w - 0.01, b.y - 0.06, b.z - 0.07, 0, 0, Math.PI / 2, 0.1, 0.04, 0.1), cover, 'chrome');          // clutch cover (right)
    m.add(GEO.cyl16, M4(w + 0.008, b.y - 0.05, b.z - 0.03, 0, 0, Math.PI / 2, 0.08, 0.035, 0.08), cover, 'chrome');       // magneto cover (left)
    const box = (u, sx, sy, sz, col, mat) => { const p = P(u); m.add(GEO.box, M4(p.x, p.y, p.z, tilt, 0, 0, sx, sy, sz), col, mat); };
    box(0.08, w * 1.5, 0.13, 0.12, caseCol, 'paint');                                                                    // cylinder
    if (hi) for (let k = 0; k < 3; k++) box(0.045 + k * 0.035, w * 1.56, 0.006, 0.126, mul(caseCol, 1.35), 'paint');
    box(0.175, w * 1.6, 0.07, 0.13, caseCol, 'paint');                                                                   // head
    box(0.225, w * 1.4, 0.035, 0.11, o.camCol || caseCol, 'paint');                                                      // cam cover
    return P(0.165).addScaledVector(fwd, 0.07);
  }
  // radiator with its core, tilted back
  function radiator(m, c, tilt, w, h, hi) {
    const up = v3(0, Math.cos(tilt), Math.sin(tilt)), nrm = v3(0, -Math.sin(tilt), Math.cos(tilt));
    m.add(GEO.box, M4(c.x, c.y, c.z, tilt, 0, 0, w, h, 0.035), lin('#131417'), 'lam');
    if (hi) for (let k = 0; k < 7; k++) { const p = c.clone().addScaledVector(up, -h * 0.42 + k * h * 0.14).addScaledVector(nrm, 0.019); m.add(GEO.box, M4(p.x, p.y, p.z, tilt, 0, 0, w * 0.94, 0.005, 0.004), lin('#3a3c42'), 'chrome'); }
  }
  // the underbones share a layout: a wide front cowl carrying the LED face, a visor on the handlebar cover, shrouds that
  // slope down to a low spine, a lower cowl round the radiator, an upswept tail over a two-step seat. Each has its own
  // shapes, lamps, graphics (stripes are thin panels laid on the bodywork), engine angle and silencer.
  // nose / low / tail: keyed body sections; lens = headlamp band [z from, y0, y1]; stripes = [part, top line keys, height]
  const UB = {
    7: {   // Honda Winner X in HRC tricolor: red, a blue band edged in white along the shroud and the tail, white chin,
      // black mask with a V headlamp under a pointed red beak, black top, smoked visor, big silver silencer guard,
      // black wheels with a red pinstripe
      key: 'wx3', tz: -0.98, topBlack: 0.36, lowY: 0, eng: [0.85, '#1e1f23', '#2c2e33', '#b4b8be'], pipe: 'shield', bar: 'visor', ind: 'clear', face: 'wx',
      nose: { yt: [[-0.06, 0.75], [0.05, 0.775], [0.15, 0.835], [0.25, 0.905], [0.35, 0.96], [0.43, 0.975], [0.5, 0.95], [0.56, 0.915], [0.6, 0.89]],
        yb: [[-0.06, 0.5], [0.04, 0.42], [0.12, 0.3], [0.22, 0.24], [0.3, 0.26], [0.35, 0.35], [0.4, 0.47], [0.46, 0.58], [0.53, 0.68], [0.6, 0.745]],
        w: [[-0.06, 0.09], [0.05, 0.12], [0.15, 0.15], [0.28, 0.18], [0.4, 0.19], [0.5, 0.18], [0.56, 0.165], [0.6, 0.15]], t: 0.55, b: 0.9, p: 3, f: FACET.blade },
      beak: { yt: [[0.5, 0.955], [0.6, 0.905], [0.665, 0.87]], yb: [[0.5, 0.88], [0.6, 0.85], [0.665, 0.855]], w: [[0.5, 0.14], [0.6, 0.11], [0.665, 0.025]], t: 0.8, b: 0.9, p: 2.6, f: FACET.ridge },
      chin: 0.41,
      tail: { yt: [[-0.98, 0.965], [-0.88, 0.955], [-0.72, 0.9], [-0.5, 0.82], [-0.3, 0.78], [-0.1, 0.755], [-0.02, 0.75]],
        yb: [[-0.98, 0.905], [-0.86, 0.865], [-0.7, 0.78], [-0.5, 0.64], [-0.36, 0.52], [-0.2, 0.47], [-0.02, 0.48]],
        w: [[-0.98, 0.03], [-0.86, 0.065], [-0.7, 0.105], [-0.45, 0.13], [-0.2, 0.13], [-0.02, 0.11]], t: 0.75, b: 0.75, p: 2.8, f: FACET.tail },
      seat: { yt: [[-0.72, 0.93], [-0.48, 0.865], [-0.36, 0.82], [-0.12, 0.81], [-0.02, 0.79]], yb: 0.73,
        w: [[-0.72, 0.07], [-0.55, 0.11], [-0.4, 0.13], [-0.15, 0.13], [-0.02, 0.08]], t: 0.85, b: 0.95, p: 3.2 },
      stripes: [['nose', [[0.04, 0.705], [0.3, 0.755], [0.52, 0.815]], 0.062], ['tail', [[-0.84, 0.885], [-0.5, 0.8], [-0.2, 0.735]], 0.034]] },
    8: {   // Yamaha Exciter 155 VVA in GP blue: blue over a silver lower shroud and chin, white pinstripes, twin LED eyes in a
      // black mask, body-colour handlebar cover, short black silencer with a big silver cap
      key: 'ex3', tz: -0.95, topBlack: 0, lowY: 0.6, eng: [1.1, '#26272c', '#3a3d44', '#3a3d44'], pipe: 'stub', bar: 'paint', ind: 'amber', face: 'ex',
      nose: { yt: [[-0.06, 0.745], [0.05, 0.765], [0.15, 0.82], [0.25, 0.89], [0.35, 0.945], [0.43, 0.96], [0.5, 0.94], [0.56, 0.9], [0.6, 0.875]],
        yb: [[-0.06, 0.5], [0.04, 0.43], [0.12, 0.33], [0.22, 0.28], [0.3, 0.29], [0.35, 0.36], [0.4, 0.47], [0.46, 0.58], [0.53, 0.67], [0.6, 0.735]],
        w: [[-0.06, 0.085], [0.05, 0.115], [0.15, 0.145], [0.28, 0.17], [0.4, 0.175], [0.5, 0.165], [0.56, 0.15], [0.6, 0.135]], t: 0.55, b: 0.9, p: 2.8, f: FACET.blade },
      beak: { yt: [[0.52, 0.93], [0.6, 0.89], [0.645, 0.865]], yb: [[0.52, 0.87], [0.6, 0.845], [0.645, 0.848]], w: [[0.52, 0.12], [0.6, 0.1], [0.645, 0.03]], t: 0.8, b: 0.9, p: 2.6, f: FACET.ridge },
      chin: 0,
      tail: { yt: [[-0.95, 0.93], [-0.86, 0.92], [-0.7, 0.87], [-0.5, 0.81], [-0.3, 0.77], [-0.1, 0.75], [-0.02, 0.745]],
        yb: [[-0.95, 0.875], [-0.84, 0.83], [-0.7, 0.76], [-0.5, 0.63], [-0.36, 0.52], [-0.2, 0.47], [-0.02, 0.48]],
        w: [[-0.95, 0.03], [-0.84, 0.065], [-0.7, 0.1], [-0.45, 0.125], [-0.2, 0.125], [-0.02, 0.105]], t: 0.75, b: 0.75, p: 2.8, f: FACET.tail },
      seat: { yt: [[-0.7, 0.9], [-0.48, 0.85], [-0.36, 0.81], [-0.12, 0.8], [-0.02, 0.78]], yb: 0.72,
        w: [[-0.7, 0.07], [-0.55, 0.11], [-0.4, 0.125], [-0.15, 0.125], [-0.02, 0.08]], t: 0.85, b: 0.95, p: 3.2 },
      stripes: [['nose', [[0.06, 0.67], [0.3, 0.74], [0.5, 0.8]], 0.014], ['tail', [[-0.8, 0.85], [-0.45, 0.775], [-0.18, 0.725]], 0.014]] },
    9: {   // Suzuki Raider R150 Fi: long, low and slim, black with red and white graphics, one sharp lamp under a long pointed
      // beak, open bars with a small meter pod, silver engine and swing-arm, chrome upswept silencer
      key: 'rd3', tz: -1.0, topBlack: 0, lowY: 0, eng: [1.2, '#8e9299', '#b4b8be', '#b4b8be'], pipe: 'up', bar: 'pod', ind: 'amber', face: 'rd',
      nose: { yt: [[-0.06, 0.73], [0.05, 0.745], [0.15, 0.79], [0.25, 0.85], [0.35, 0.895], [0.43, 0.91], [0.5, 0.895], [0.57, 0.86], [0.62, 0.83]],
        yb: [[-0.06, 0.51], [0.04, 0.47], [0.12, 0.43], [0.22, 0.4], [0.3, 0.4], [0.36, 0.42], [0.42, 0.5], [0.5, 0.62], [0.56, 0.69], [0.62, 0.745]],
        w: [[-0.06, 0.08], [0.05, 0.1], [0.15, 0.125], [0.28, 0.145], [0.4, 0.15], [0.5, 0.135], [0.57, 0.11], [0.62, 0.09]], t: 0.55, b: 0.9, p: 2.6, f: FACET.blade },
      beak: { yt: [[0.54, 0.875], [0.62, 0.845], [0.695, 0.81]], yb: [[0.54, 0.82], [0.62, 0.8], [0.695, 0.8]], w: [[0.54, 0.09], [0.62, 0.075], [0.695, 0.015]], t: 0.8, b: 0.9, p: 2.6, f: FACET.ridge },
      chin: 0,
      tail: { yt: [[-1.0, 0.92], [-0.9, 0.905], [-0.72, 0.85], [-0.5, 0.79], [-0.3, 0.76], [-0.1, 0.74], [-0.02, 0.735]],
        yb: [[-1.0, 0.875], [-0.88, 0.82], [-0.72, 0.75], [-0.5, 0.63], [-0.36, 0.52], [-0.2, 0.47], [-0.02, 0.48]],
        w: [[-1.0, 0.025], [-0.88, 0.055], [-0.7, 0.09], [-0.45, 0.115], [-0.2, 0.115], [-0.02, 0.1]], t: 0.75, b: 0.75, p: 2.8, f: FACET.tail },
      seat: { yt: [[-0.74, 0.875], [-0.5, 0.83], [-0.36, 0.8], [-0.12, 0.79], [-0.02, 0.77]], yb: 0.71,
        w: [[-0.74, 0.06], [-0.55, 0.1], [-0.4, 0.12], [-0.15, 0.12], [-0.02, 0.075]], t: 0.85, b: 0.95, p: 3.2 },
      stripes: [['nose', [[0.04, 0.66], [0.3, 0.72], [0.52, 0.79]], 0.04], ['tail', [[-0.9, 0.85], [-0.5, 0.76], [-0.2, 0.715]], 0.03]] },
  };
  function ubBike(o) {
    const { m, hi, paint, n, step, st } = o, V = UB[st], RWs = o.RW, blk = PLASTIC;
    const acc = o.acc, acc2 = o.L.acc2 || lin('#f2f2f0'), side2 = o.L.side2 || o.acc;
    const end = K => K[K.length - 1][0], tip = end(V.nose.yt), noseX = surfX(V.nose, -0.06, tip), tailX = surfX(V.tail, V.tz, -0.02);
    // engine (its cylinder leaning forward under the shrouds), radiator, frame
    o.camCol = lin(V.eng[3]);
    const port = singleEngine(o, v3(0, 0.3, 0.02), V.eng[0], 0.1, lin(V.eng[1]), lin(V.eng[2]));
    radiator(m, v3(0, 0.47, 0.3), -0.3, 0.2, 0.17, hi);
    m.add(tube('ubSpine', [v3(0, 0.84, 0.34), v3(0, 0.62, 0.3), v3(0, 0.48, 0.2), v3(0, 0.43, 0.02), v3(0, 0.4, -0.06)], 0.022, hi ? 10 : 4, 8), M4(), o.frameCol, 'paint');
    for (const s of [-1, 1]) m.add(tube('ubRail' + s, [v3(s * 0.06, 0.4, -0.06), v3(s * 0.075, 0.55, -0.3), v3(s * 0.08, 0.72, -0.64)], 0.014, hi ? 6 : 3, 6), M4(), o.frameCol, 'paint');
    // front cowl and shrouds, ending in a flat black mask; black underside ahead of and behind the lower cowl, black top
    // panel over the face (Winner X), silver lower shroud (Exciter)
    addParts(m, bodyParts(V.key + 'Nose', V.nose, -0.06, tip, n, step * 0.7, (a, _x, _y, z) => {
      if (a < 0) return z > 0.3 ? 'mask' : 'blk';
      const s = Math.sin(a);
      if (s < -0.8) return 'blk';
      if (V.topBlack && s > 0.82 && z > V.topBlack) return 'top';
      return 'paint';
    }, 36), { paint: [paint, 'carPaint'], top: [lin('#121316'), 'carPaint'], mask: [lin('#0d0e11'), 'paint'], blk: [blk, 'lam'] });
    // silver lower shroud (Exciter): a panel laid on the cowl so its edge stays crisp
    if (V.lowY) panels(m, V.key + 'Shroud2', noseX, span(-0.04, tip - 0.06, hi ? 18 : 6), z => Math.min(V.lowY, kc(V.nose.yt, z) - 0.05),
      z => kc(V.nose.yb, z) + 0.004, 0.003, 0.002, hi ? 3 : 1, side2, 'carPaint', null);
    // pointed beak over the lamps
    addParts(m, bodyParts(V.key + 'Beak', V.beak, V.beak.yt[0][0], end(V.beak.yt), n, 0.025, (a) => a >= 0 && Math.sin(a) < -0.3 ? 'blk' : 'paint', 34),
      { paint: [paint, 'carPaint'], blk: [lin('#0d0e11'), 'paint'] });
    // white chin on the lower part of the shroud (Winner X), a black trim along its bottom edge, and the seam where the
    // upper cowl meets the lower shroud
    if (V.chin) panels(m, V.key + 'Chin', noseX, span(0.08, 0.4, hi ? 14 : 5), () => V.chin, z => kc(V.nose.yb, z) + 0.04, 0.003, 0.002, hi ? 3 : 1, acc2, 'carPaint', null);
    panels(m, V.key + 'Trim', noseX, span(0.0, 0.4, hi ? 16 : 5), z => kc(V.nose.yb, z) + 0.035, z => kc(V.nose.yb, z) + 0.012, 0.0032, 0.002, 1, lin('#121316'), 'paint', null);
    const seam = z => kc([[0.06, 0.46], [0.3, 0.56], [0.5, 0.67]], z);
    panels(m, V.key + 'Seam', noseX, span(0.06, 0.5, hi ? 14 : 5), seam, z => seam(z) - 0.006, 0.0042, 0.001, 1, lin('#0b0b0d'), 'lam', null);
    // the face: headlamp lenses and LEDs on the mask
    const fy = (kc(V.nose.yt, tip) + kc(V.nose.yb, tip)) / 2, fz = tip + 0.004, onNose = (s, z, y, d = 0.003) => v3(s * (noseX(z, y) + d), y, z);
    if (V.face === 'wx') {   // Winner X: a V-shaped lamp (two LED projectors) with position lights along its upper edges
      for (const s of [-1, 1]) {
        m.add(GEO.box, M4(s * 0.052, fy - 0.022, fz, 0, 0, s * 0.3, 0.1, 0.045, 0.01), LENS_H, 'glass');
        m.add(GEO.box, M4(s * 0.032, fy - 0.028, fz + 0.006, 0, 0, s * 0.3, 0.036, 0.022, 0.006), LED_H, 'light');
        m.add(GEO.box, M4(s * 0.07, fy + 0.012, fz + 0.004, 0, 0, s * 0.3, 0.075, 0.007, 0.004), LED_H, 'light');
      }
    } else if (V.face === 'ex') {   // Exciter: two LED eyes set wide in the mask, a small centre lamp
      for (const s of [-1, 1]) {
        m.add(GEO.box, M4(s * 0.065, fy - 0.008, fz, 0, 0, -s * 0.22, 0.08, 0.04, 0.01), LENS_H, 'glass');
        m.add(GEO.box, M4(s * 0.068, fy - 0.004, fz + 0.006, 0, 0, -s * 0.22, 0.06, 0.012, 0.005), LED_H, 'light');
      }
      m.add(GEO.box, M4(0, fy - 0.03, fz + 0.004, 0, 0, 0, 0.04, 0.018, 0.005), LED_H, 'light');
    } else {   // Raider: one sharp lamp, small position lights in its corners
      m.add(GEO.box, M4(0, fy - 0.01, fz, 0, 0, 0, 0.11, 0.045, 0.01), LENS_H, 'glass');
      m.add(GEO.box, M4(0, fy - 0.012, fz + 0.006, 0, 0, 0, 0.045, 0.026, 0.006), LED_H, 'light');
      for (const s of [-1, 1]) m.add(GEO.box, M4(s * 0.05, fy + 0.012, fz + 0.005, 0, 0, s * 0.35, 0.03, 0.007, 0.004), LED_H, 'light');
    }
    for (const s of [-1, 1]) {   // indicators on the shrouds (clear lenses on the Winner X), the maker's badge
      const p = onNose(s, 0.46, 0.72, 0.006);
      m.add(GEO.sph, M4(p.x, p.y, p.z, 0, s * 0.3, 0, 0.012, 0.016, 0.034), V.ind === 'clear' ? lin('#d8dde2') : AMB, V.ind === 'clear' ? 'glass' : 'light');
      if (V.face === 'wx') { const b = onNose(s, 0.43, 0.79, 0.006); m.add(GEO.box, M4(b.x, b.y, b.z, 0, 0, 0, 0.003, 0.03, 0.04), lin('#f2f2f2'), 'paint'); }
    }
    // seat, tail and its LED lamp
    seat(o, V.key + 'Seat', V.seat, V.seat.yt[0][0], end(V.seat.yt));
    addParts(m, bodyParts(V.key + 'Tail', V.tail, V.tz, -0.02, n, step, (a, _x, _y, z) =>
      a < 0 ? (z < -0.5 ? 'tl' : 'blk') : Math.sin(a) < -0.4 ? 'blk' : 'paint', 36),
      { paint: [paint, 'carPaint'], tl: [LENS_T, 'glass'], blk: [blk, 'lam'] });
    // black side panel under the front of the seat
    panels(m, V.key + 'SeatPanel', tailX, span(-0.5, -0.04, hi ? 14 : 5), z => Math.min(0.52 + (z + 0.5) * 0.25, kc(V.tail.yt, z) - 0.04),
      z => kc(V.tail.yb, z) + 0.004, 0.003, 0.002, hi ? 3 : 1, blk, 'lam', null);
    const ty = (kc(V.tail.yt, V.tz) + kc(V.tail.yb, V.tz)) / 2;
    m.add(GEO.box, M4(0, ty, V.tz - 0.004, 0, 0, 0, 0.05, 0.03, 0.004), LED_T, 'light');
    o.tail = { z: V.tz, y: ty, w: 0.03, yb: kc(V.tail.yb, V.tz), plateY: 0.6 };
    m.add(C('ubFenderR', () => arcBand(RWs.r + 0.03, 0.065, 1.35, 2.35, 0.004, 10)), M4(0, RWs.y, RWs.z), BLACK, 'lam');   // inner mudguard
    // graphics: a band in the accent colour edged with thin lines in the second colour
    for (const [part, K, h] of V.stripes) {
      const env = part === 'nose' ? noseX : tailX, zs = span(K[0][0], end(K), hi ? 16 : 5), top = z => kc(K, z);
      panels(m, V.key + part + 'Band', env, zs, top, z => top(z) - h, 0.004, 0.0015, 2, acc, 'carPaint', null);
      if (h > 0.02) {
        panels(m, V.key + part + 'EdgeT', env, zs, z => top(z) + 0.011, top, 0.004, 0.0015, 1, acc2, 'carPaint', null);
        panels(m, V.key + part + 'EdgeB', env, zs, z => top(z) - h, z => top(z) - h - 0.011, 0.004, 0.0015, 1, acc2, 'carPaint', null);
      }
    }
    // handlebar cover with the LCD meter: smoked visor (Winner X), body colour (Exciter) or just a meter pod (Raider)
    if (V.bar === 'pod') {
      m.add(GEO.box, M4(0, 1.0, 0.36, -0.9, 0, 0, 0.13, 0.08, 0.06), lin('#18191d'), 'lam');
      m.add(GEO.box, M4(0, 1.012, 0.335, -0.9, 0, 0, 0.11, 0.06, 0.004), lin('#9fc4dc'), 'light');
    } else {
      addParts(m, bodyParts(V.key + 'BarCov', { yt: [[0.22, 1.0], [0.32, 1.045], [0.44, 1.02], [0.5, 0.98]], yb: [[0.22, 0.92], [0.5, 0.92]],
        w: [[0.22, 0.1], [0.32, 0.145], [0.44, 0.12], [0.5, 0.07]], t: 0.7, b: 0.9, p: 2.8, f: FACET.box }, 0.22, 0.5, n, 0.03,
        (a) => a >= 0 && Math.sin(a) > 0.75 ? (V.bar === 'visor' ? 'blk' : 'paint') : a >= 0 && Math.sin(a) > -0.2 ? 'paint' : 'blk', 34),
        { paint: [paint, 'carPaint'], blk: [lin('#16171a'), 'lam'] });
      m.add(GEO.box, M4(0, 1.012, 0.245, -0.95, 0, 0, 0.12, 0.065, 0.004), lin('#9fc4dc'), 'light');
      if (V.bar === 'visor') m.add(tbox(0.65, 1), M4(0, 1.065, 0.445, -0.85, 0, 0, 0.15, 0.085, 0.006), SMOKE, 'glass');
    }
    // exhaust: header under the engine to a silencer on the right
    const dark = lin('#2a2c32');
    m.add(tube(V.key + 'Hdr', [port, v3(-0.01, 0.2, port.z - 0.02), v3(-0.05, 0.15, 0.06), v3(-0.12, 0.17, -0.1), v3(-0.19, 0.26, -0.22)], 0.02, hi ? 14 : 6, hi ? 7 : 4), M4(), dark, 'chrome');
    if (V.pipe === 'up') {   // Raider: chrome upswept silencer
      const can = [v3(-0.19, 0.26, -0.22), v3(-0.2, 0.34, -0.45), v3(-0.21, 0.47, -0.74)];
      m.add(pathLoft('rdCan2', can, t => [0.045 + 0.008 * t, 0.05 + 0.008 * t, 2.2], hi ? 10 : 4, hi ? 12 : 8), M4(), CHROME, 'chrome');
      m.add(GEO.cyl16, link(can[2], can[2].clone().add(v3(-0.002, 0.016, -0.03)), 0.05), lin('#9a9ea6'), 'chrome');
    } else if (V.pipe === 'shield') {   // Winner X: a big silver-guarded silencer rising under the seat, black end
      const can = [v3(-0.19, 0.27, -0.22), v3(-0.205, 0.38, -0.46), v3(-0.215, 0.5, -0.68)];
      m.add(pathLoft('wxCan', can, t => [0.055, 0.065 - 0.012 * t, 2.6], hi ? 10 : 4, hi ? 12 : 8), M4(), lin('#b8bcc4'), 'chrome');
      const d = can[2].clone().sub(can[1]).normalize();
      m.add(taper(1, 0.7, 14), link(can[2], can[2].clone().addScaledVector(d, 0.06), 0.05), dark, 'chrome');
    } else {   // Exciter: short black silencer with a big silver end cap
      const can = [v3(-0.19, 0.26, -0.22), v3(-0.2, 0.29, -0.34), v3(-0.205, 0.32, -0.46)];
      m.add(pathLoft('exCan', can, () => [0.055, 0.06, 2.4], hi ? 8 : 3, hi ? 12 : 8), M4(), dark, 'chrome');
      const e = can[2], d = e.clone().sub(can[1]).normalize();
      m.add(taper(1, 0.75, 16), link(e, e.clone().addScaledVector(d, 0.1), 0.066), lin('#b8bcc4'), 'chrome');
    }
    // footrests: one silver casting per side carries the rider's and the passenger's pegs
    for (const s of [-1, 1]) {
      m.add(tbox(1, 0.7), link(v3(s * 0.12, 0.46, -0.08), v3(s * 0.15, 0.29, -0.07), 0.009, 0.07), ALU, 'chrome');
      m.add(tbox(0.8, 0.7), link(v3(s * 0.12, 0.5, -0.22), v3(s * 0.15, 0.39, -0.38), 0.009, 0.06), ALU, 'chrome');
      m.add(GEO.cyl, link(v3(s * 0.15, 0.29, -0.07), v3(s * 0.22, 0.29, -0.07), 0.011), RUBBER, 'lam');
      m.add(GEO.box, link(v3(s * 0.17, 0.3, -0.04), v3(s * 0.19, 0.31, 0.07), 0.008, 0.012), ALU, 'chrome');
      m.add(GEO.cyl, link(v3(s * 0.15, 0.39, -0.38), v3(s * 0.21, 0.39, -0.38), 0.009), RUBBER, 'lam');
    }
    rearEnd(o);
  }

  // ---- Yamaha YZF-R15 V4: the R1's face, fairing and tail at about 0.92 scale on a single-cylinder engine ----
  function r15Bike(o) {
    const S = new T.Matrix4().makeScale(0.92, 0.92, 0.92), M0 = o.m;
    const sm = { add(g, M, c, k, opt) { M0.add(g, S.clone().multiply(M), c, k, opt); return sm; } };
    const p = Object.assign({}, o, { m: sm, st: 1, pz: posture(1), FW: WHEELS[1].FW, RW: WHEELS[1].RW });
    bikeWheel(sm, p.FW, p, true); bikeWheel(sm, p.RW, p, false);
    frontEnd(p); swingarm(p); frame(p);
    const port = singleEngine(p, v3(0, 0.45, 0.17), 0.5, 0.11, lin('#2a2c32'), lin('#3a3c44'));
    radiator(sm, v3(0, 0.62, 0.41), -0.2, 0.3, 0.26, p.hi);
    sm.add(tube('r15Hdr', [port, v3(0, 0.46, 0.4), v3(0, 0.32, 0.37), v3(0, 0.2, 0.28), v3(0, 0.16, 0.12), v3(0, 0.155, 0.0)], 0.022, p.hi ? 14 : 6, p.hi ? 7 : 4), M4(),
      (x, y) => mix(lin('#a07a3c'), lin('#7a7e88'), clamp01((0.6 - y) / 0.35)), 'chrome');
    exhaust(p); fairedBody(p); rearEnd(p); footrests(p); controls(p);
  }

  // ---- Honda SH 160i: front shield with a chrome V garnish and wing badge, LED headlamp in the handlebar cover,
  // flat floorboard, long two-step seat, grab rail, silver unit-swing engine on the left, twin shocks, silencer right ----
  function shBike(o) {
    const { m, hi, paint, n, step } = o, RWs = o.RW, trim = o.L.trim || lin('#3c3f46'), dark = lin('#26272c');
    const SH = { yt: [[0.22, 0.98], [0.32, 1.02], [0.42, 0.98], [0.5, 0.86], [0.56, 0.7]], yb: [[0.22, 0.36], [0.32, 0.36], [0.42, 0.42], [0.5, 0.5], [0.56, 0.6]],
      w: [[0.22, 0.22], [0.32, 0.235], [0.42, 0.215], [0.5, 0.16], [0.56, 0.08]], t: 0.65, b: 0.55, p: 2.6, f: FACET.box };
    addParts(m, bodyParts('shShield', SH, 0.22, 0.56, n, step * 0.7, (a, x, y, z) => {
      if (a < 0) return z < 0.3 ? 'inner' : 'paint';
      if (Math.sin(a) < -0.5) return 'inner';
      if (z > 0.44 && Math.abs(x) < 0.05 && y > 0.56 && y < 0.74) return 'grille';
      return 'paint';
    }, 36), { paint: [paint, 'carPaint'], inner: [trim, 'lam'], grille: [dark, 'lam'] });
    for (const s of [-1, 1]) {
      m.add(GEO.cyl, link(v3(s * 0.12, 0.94, 0.452), v3(s * 0.008, 0.71, 0.552), 0.007), CHROME, 'chrome');      // chrome V garnish
      m.add(GEO.box, link(v3(s * 0.135, 0.935, 0.448), v3(s * 0.022, 0.71, 0.55), 0.008, 0.004), LED_H, 'light'); // LED position strip beside it
      m.add(GEO.box, M4(s * 0.15, 0.9, 0.44, 0, s * 0.5, 0, 0.05, 0.03, 0.012), AMB, 'light');                      // indicators
    }
    m.add(GEO.box, M4(0, 0.78, 0.538, -0.35, 0, 0, 0.06, 0.025, 0.006), CHROME, 'chrome');                           // wing badge
    // handlebar cover with the LED headlamp in front and the meter facing the rider
    addParts(m, bodyParts('shBarCov2', { yt: [[0.22, 1.11], [0.36, 1.16], [0.48, 1.11], [0.54, 1.07]], yb: [[0.22, 1.0], [0.54, 1.0]], w: [[0.22, 0.2], [0.36, 0.25], [0.48, 0.2], [0.54, 0.12]], t: 0.7, b: 0.9, p: 2.8, f: FACET.box },
      0.22, 0.54, n, 0.03, (a, _x, y, z) => a >= 0 && z > 0.47 && y > 1.02 && y < 1.095 ? 'lens' : a >= 0 && Math.sin(a) < -0.4 ? 'blk' : 'paint', 34),
      { paint: [paint, 'carPaint'], lens: [LENS_H, 'glass'], blk: [trim, 'lam'] });
    for (const s of [-1, 1]) m.add(GEO.box, M4(s * 0.055, 1.058, 0.545, -0.5, s * 0.4, 0, 0.085, 0.024, 0.006), LED_H, 'light');
    m.add(GEO.box, M4(0, 1.125, 0.27, -1.0, 0, 0, 0.18, 0.08, 0.004), lin('#9fc4dc'), 'light');
    // floorboard and the skirt under it
    m.add(GEO.box, M4(0, 0.385, 0.06, 0, 0, 0, 0.36, 0.02, 0.36), dark, 'lam');
    if (hi) for (let k = 0; k < 6; k++) m.add(GEO.box, M4(0, 0.397, -0.08 + k * 0.055, 0, 0, 0, 0.3, 0.005, 0.012), lin('#3a3b40'), 'lam');
    m.add(bodyParts('shSkirt', { yt: 0.38, yb: [[-0.14, 0.25], [0.1, 0.22], [0.26, 0.3]], w: 0.19, t: 0.95, b: 0.8, p: 3.5 }, -0.14, 0.26, n, step).a, M4(), trim, 'lam');
    // rear body under the seat (body colour above, grey trim below), seat, tail lamp, grab rail
    addParts(m, bodyParts('shBody', { yt: [[-0.99, 0.8], [-0.9, 0.82], [-0.7, 0.8], [-0.4, 0.78], [-0.18, 0.76], [-0.08, 0.6]],
      yb: [[-0.99, 0.71], [-0.8, 0.69], [-0.5, 0.64], [-0.38, 0.56], [-0.25, 0.36], [-0.08, 0.3]],
      w: [[-0.99, 0.06], [-0.85, 0.12], [-0.6, 0.17], [-0.25, 0.18], [-0.08, 0.16]], t: 0.8, b: 0.75, p: 2.8, f: FACET.tail }, -0.99, -0.08, n, step, (a, x, y, z) => {
      if (a < 0) return z < -0.5 ? 'tl' : 'trim';
      const s = Math.sin(a);
      if (s < -0.25) return 'trim';
      if (z < -0.86 && s > -0.25 && s < 0.5) return 'tl';
      return 'paint';
    }, 36), { paint: [paint, 'carPaint'], trim: [trim, 'lam'], tl: [LENS_T, 'glass'] });
    m.add(GEO.box, M4(0, 0.775, -0.993, 0, 0, 0, 0.09, 0.03, 0.004), LED_T, 'light');
    for (const s of [-1, 1]) m.add(GEO.box, M4(s * 0.085, 0.76, -0.95, 0, s * 0.7, 0, 0.05, 0.02, 0.006), AMB, 'light');
    seat(o, 'shSeat', { yt: [[-0.86, 0.85], [-0.75, 0.865], [-0.58, 0.835], [-0.45, 0.815], [-0.2, 0.83], [-0.07, 0.8]], yb: 0.76,
      w: [[-0.86, 0.1], [-0.6, 0.15], [-0.3, 0.16], [-0.07, 0.12]], t: 0.85, b: 0.95, p: 3.2 }, -0.86, -0.07);
    for (const s of [-1, 1]) m.add(tube('shRail' + s, [v3(s * 0.16, 0.8, -0.55), v3(s * 0.15, 0.84, -0.75), v3(s * 0.1, 0.85, -0.9), v3(0, 0.85, -0.95)], 0.013, hi ? 10 : 4, 6), M4(), ALU, 'chrome');
    o.tail = { z: -0.99, y: 0.775, w: 0.06, yb: 0.71, plateY: 0.52 };
    // unit-swing engine: crankcase under the seat front, long silver belt case on the left up to the rear hub, air box,
    // twin black shocks, black silencer with a chrome guard on the right
    m.add(GEO.box, M4(0, 0.29, -0.12, 0, 0, 0, 0.22, 0.16, 0.26), lin('#2a2c32'), 'paint');
    m.add(bodyParts('shCvt', { yt: [[-0.68, 0.37], [-0.35, 0.41], [-0.08, 0.41]], yb: [[-0.68, 0.22], [-0.35, 0.2], [-0.08, 0.22]], w: 0.045, t: 0.85, b: 0.85, p: 3.6 },
      -0.68, -0.08, 16, 0.06).a, M4(0.105), lin('#b4b8c0'), 'chrome');
    m.add(GEO.cyl16, M4(0.155, RWs.y, RWs.z + 0.03, 0, 0, Math.PI / 2, 0.085, 0.02, 0.085), lin('#c8ccd2'), 'chrome');
    m.add(bodyParts('shAir', { yt: [[-0.5, 0.5], [-0.2, 0.52]], yb: [[-0.5, 0.42], [-0.2, 0.42]], w: 0.05, t: 0.8, b: 0.9, p: 3 }, -0.5, -0.2, 12, 0.06).a, M4(0.1), lin('#1c1d22'), 'lam');
    for (const s of [-1, 1]) {
      const a = v3(s * 0.13, RWs.y + 0.03, RWs.z + 0.06), b = v3(s * 0.12, 0.66, -0.52);
      m.add(GEO.cyl16, link(a, b, 0.015), DARK, 'chrome');
      m.add(GEO.cyl16, link(a.clone().lerp(b, 0.15), a.clone().lerp(b, 0.75), 0.03), lin('#1c1d22'), 'paint');
    }
    const can = [v3(-0.13, 0.27, -0.22), v3(-0.16, 0.31, -0.45), v3(-0.17, 0.37, -0.68)];
    m.add(tube('shHdr', [v3(0, 0.24, 0.0), v3(-0.05, 0.18, -0.08), v3(-0.13, 0.25, -0.2)], 0.022, hi ? 8 : 4, 6), M4(), dark, 'chrome');
    m.add(pathLoft('shCan', can, () => [0.05, 0.065, 2.4], hi ? 8 : 3, hi ? 12 : 8), M4(), lin('#1c1d22'), 'chrome');
    m.add(GEO.box, link(can[0].clone().lerp(can[1], 0.3).add(v3(-0.055, 0.02, 0)), can[1].clone().lerp(can[2], 0.7).add(v3(-0.055, 0.02, 0)), 0.006, 0.07), CHROME, 'chrome');
    m.add(GEO.cyl16, link(can[2], can[2].clone().add(v3(-0.004, 0.012, -0.03)), 0.045), lin('#9a9ea6'), 'chrome');
    m.add(C('shFenderR', () => arcBand(RWs.r + 0.03, 0.07, 1.4, 2.5, 0.004, 10)), M4(0, RWs.y, RWs.z), BLACK, 'lam');
    rearEnd(o);
  }

  // =====================================================================================
  // Mesh bodies: models made outside the game (the user's .glb files) packed by tools/glb into HB_GLB (js/g3/winnerx.js,
  // js/g3/cbr.js): quantised positions + indices with the wheels cut out, and a livery map in side view (taken from a
  // photo, or painted), one class per texel, run-length coded. UVs are the side projection onto that map. The map's
  // alpha marks the paint, where the vertex colour (the bike's paint) shows instead, so rivals' own colours still work.
  // The shader adds what a side view cannot show: the headlamp mask on the nose, the tail lamp, the seat tops and the
  // bars, and on the left side it reads copies of the lettering that are mirrored back so they do not read backwards.
  // =====================================================================================
  const GLB_LIV = ['#151517', '#c8121f', '#1c3d9e', '#2f93e0', '#eeeeee', '#151517', '#3a3b3e', '#b8bcc2', '#c9a22a', '#151517'];
  // per model: xf = mesh -> model frame (scale, centring, wheels on the ground); sh = the shader extras in centred mesh
  // units: mask { z0, y0, y1, xw, led } on forward faces, seat { z0, z1, y0 } on upward faces, tail { z1, y0, y1, ly, xw }
  // on rearward faces, bars { x, y0, z0 } (everything further out); bike = wheel/brake options for the game's wheels
  const GLB_CFG = {
    // Winner X: real size (1.278 m wheelbase), centred (the generator left it 2 cm to the left)
    winnerx: { xf: { s: 1.278 / 1.23, ox: -0.0203, oy: -0.0403, oz: -0.0322 }, bike: { discSide: -1 },
      sh: { mask: { z0: 0.6, y0: 0.64, y1: 0.83, xw: 0.1, led: { y: 0.745, slope: 0.3, x0: 0.02, x1: 0.105 } }, seat: { z0: -0.8, z1: 0, y0: 0.78 },
        tail: { z1: -0.68, y0: 0.8, y1: 0.95, ly: 0.872 } } },
    // CBR250RR: kept at the generator's size (seat 0.91 m; its wheelbase came out short at 1.22 m)
    cbr: { xf: { s: 1, ox: -0.01, oy: -0.005, oz: -0.0035 }, bike: { singleDisc: true, discSide: -1, discR: 0.155, spokes: [5, 0.15] },
      sh: { mask: { z0: 0.6, y0: 0.64, y1: 0.84, xw: 0.12, led: { y: 0.745, slope: 0.28, x0: 0.025, x1: 0.115 } }, seat: { z0: -0.9, z1: -0.18, y0: 0.84 },
        tail: { z1: -0.82, y0: 0.78, y1: 0.95, ly: 0.86, xw: 0.11 }, bars: { x: 0.235, y0: 0.82, z0: 0.05 } } },
    // CBR1000RR Fireblade: an authored model in parts (scaled, centred and simplified by the build), its own wheels,
    // lights, seat and mirrors, so only the paint needs the livery
    c1k: { xf: { s: 1, ox: 0, oy: 0, oz: 0 }, ownWheels: true, sh: {} },
  };
  const GLB_STYLE = { 7: 'winnerx', 12: 'cbr', 13: 'c1k' };
  // colour categories of the parts of authored models: [material key, colour]
  const GLB_CAT = { seat: ['lam', '#141416'], rubber: ['lam', '#151517'], rim: ['paint', '#16171b'], alu: ['chrome', '#aeb2ba'],
    engine: ['paint', '#2a2c31'], black: ['lam', '#18191c'], exhaust: ['chrome', '#9aa0a8'], disc: ['chrome', '#b4b8c0'], sprocket: ['paint', '#2a2b30'],
    caliper: ['paint', '#c9a22a'], fork: ['chrome', '#c8a040'], screen: ['glass', '#1a222c'], lens: ['glass', '#c8d0d8'], mirrorGlass: ['chrome', '#8c96a2'],
    mirror: ['carPaint', '#121316'], reflector: ['chrome', '#d4d8e0'], headLed: ['light', '#eef4ff'], tailLed: ['light', '#ff2a14'], other: ['paint', '#3a3c42'] };
  const glbCache = {};
  function glbBody(name) {
    if (name in glbCache) return glbCache[name];
    const D = typeof HB_GLB !== 'undefined' && HB_GLB[name], cfg = GLB_CFG[name];
    if (!G3.mats) return null;   // before the renderer is up
    if (!D || !cfg) return (glbCache[name] = null);
    const xf = cfg.xf, key = 'glb_' + name, M = M4(xf.ox, xf.oy, xf.oz, 0, 0, 0, xf.s);
    const bin = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
    const [kr, ki] = D.k, [cr, ci] = D.c, { CX, CY, SC, TW, TH } = D.crop;
    const proj = P => {   // side projection: photo px = k * (z, -y) + c as complex numbers, then into the cropped map
      const n = P.length / 3, UV = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { const z = P[i * 3 + 2], y = -P[i * 3 + 1]; UV[i * 2] = (kr * z - ki * y + cr - CX) * SC / TW; UV[i * 2 + 1] = (kr * y + ki * z + ci - CY) * SC / TH; }
      return UV;
    };
    // livery classes -> sRGB texels, alpha 0 = paint
    const rle = new Uint8Array(bin(D.rle)), px = new Uint8Array(TW * TH * 4), c = new T.Color();
    const sc = GLB_LIV.map(h => { c.set(h).convertLinearToSRGB(); return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)]; });
    for (let i = 0, o = 0; i < rle.length; i += 2) {
      const w = (rle[i] << 8) | rle[i + 1], k = w >> 12, e = o + (w & 4095), s = sc[k], a = k === 1 ? 0 : 255;
      for (; o < e; o++) { px[o * 4] = s[0]; px[o * 4 + 1] = s[1]; px[o * 4 + 2] = s[2]; px[o * 4 + 3] = a; }
    }
    const tx = new T.DataTexture(px, TW, TH);
    tx.encoding = T.sRGBEncoding; tx.generateMipmaps = true; tx.minFilter = T.LinearMipmapLinearFilter; tx.magFilter = T.LinearFilter;
    tx.anisotropy = G3.aniso; tx.needsUpdate = true;
    G3.mats[key] = glbMaterial(tx, D, cfg, name);
    if (D.groups) {   // an authored model in parts: one mesh per colour category, crisp normals at its hard edges
      const build = list => list.map(G => {
        const pos = new Int16Array(bin(G.pos)), idx = G.n32 ? new Uint32Array(bin(G.idx)) : new Uint16Array(bin(G.idx));
        let g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(Float32Array.from(pos, v => v / D.q), 3)); g.setIndex(new T.BufferAttribute(idx, 1));
        g = g.toNonIndexed(); g.computeVertexNormals(); soften(g, 40);
        if (G.cat === 'paint') g.setAttribute('uv', new T.BufferAttribute(proj(g.attributes.position.array), 2));
        return { cat: G.cat, geo: g };
      });
      return (glbCache[name] = { key, M, hi: build(D.groups), lo: D.lo ? build(D.lo) : null });
    }
    const pos = new Int16Array(bin(D.pos)), idx = new Uint16Array(bin(D.idx)), n = pos.length / 3, P = new Float32Array(n * 3);
    for (let i = 0; i < pos.length; i++) P[i] = pos[i] / D.q;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('uv', new T.BufferAttribute(proj(P), 2));
    g.setIndex(new T.BufferAttribute(idx, 1)); g.computeVertexNormals();
    // even out the generator's lumpy surface in the shading only (moving the vertices pushes its thin double-walled
    // panels through each other): average each normal with its neighbours twice
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
    return (glbCache[name] = { geo: g.toNonIndexed(), key, M });
  }
  function glbMaterial(tx, D, cfg, name) {
    const m = new T.MeshStandardMaterial({ vertexColors: true, map: tx, roughness: 0.32, metalness: 0.2 });
    Object.defineProperty(m, 'envMap', { get: () => G3.mats.carPaint.envMap, set() {} });   // same reflections as the car paint
    const v3s = h => { const c = new T.Color(h); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; };
    const { xf, sh } = cfg, nb = D.boxes.length, f = v => (+v).toFixed(6), parts = [];
    if (sh.mask) {   // nose: black V mask with LED headlamps sloping up to the sides, on the forward-facing faces
      const k = sh.mask, L = k.led;
      parts.push(`float fm = smoothstep(0.38, 0.62, mn.z) * step(${f(k.z0)}, vMP.z) * step(${f(k.y0)}, vMP.y) * step(vMP.y, ${f(k.y1)}) * (1.0 - smoothstep(${f(k.xw)}, ${f(k.xw + 0.025)}, ax));`,
        L ? `float led = step(${f(L.x0)}, ax) * step(ax, ${f(L.x1)}) * (1.0 - smoothstep(0.008, 0.013, abs(vMP.y - ${f(L.y)} - ${f(L.slope)} * (ax - ${f(L.x0)}))));` : 'float led = 0.0;',
        `col = mix(col, mix(${v3s('#0e0f12')}, ${v3s('#eef4ff')}, led), fm);`);
    }
    if (sh.seat) {   // seat and pillion pad: a side view only shows their edge (and the tail's stripe), so their tops are black
      const k = sh.seat;
      parts.push(`col = mix(col, ${v3s('#131315')}, smoothstep(0.55, 0.8, mn.y) * step(${f(k.z0)}, vMP.z) * step(vMP.z, ${f(k.z1)}) * step(${f(k.y0)}, vMP.y));`);
    }
    if (sh.bars) {   // clip-ons, levers and mirrors sticking out past the bodywork
      const k = sh.bars;
      parts.push(`col = mix(col, ${v3s('#141416')}, step(${f(k.x)}, ax) * step(${f(k.y0)}, vMP.y) * step(${f(k.z0)}, vMP.z));`);
    }
    if (sh.tail) {   // tail lamp on the rear-facing end of the tail
      const k = sh.tail;
      parts.push(`float tl = smoothstep(-0.38, -0.62, mn.z) * step(vMP.z, ${f(k.z1)}) * step(${f(k.y0)}, vMP.y) * step(vMP.y, ${f(k.y1)}) * step(ax, ${f(k.xw || 1)});`,
        `col = mix(col, mix(${v3s('#5a0606')}, ${v3s('#ff2a14')}, 1.0 - smoothstep(0.008, 0.012, abs(vMP.y - ${f(k.ly)}))), tl);`);
    }
    m.onBeforeCompile = (s, ren) => {
      // vMP: model position back in (centred) mesh units, where the thresholds were measured
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
    m.customProgramCacheKey = () => 'glb|' + name;
    return m;
  }
  // a bike whose body is a mesh: the game's wheels (front disc on the right like the real bike) and front mudguard
  // (the mesh had it fused to the tyre), everything else from the mesh
  function glbBike(o, B) {
    const { m } = o;
    if (B.hi) {   // in parts, with its own wheels: the paint takes the livery, everything else its category colour
      for (const p of (o.hi || !B.lo ? B.hi : B.lo)) {
        if (p.cat === 'paint') m.add(p.geo, B.M, o.body, B.key, { raw: true });
        else { const [k, col] = GLB_CAT[p.cat] || GLB_CAT.other; m.add(p.geo, B.M, lin(col), k); }
      }
      return;
    }
    bikeWheel(m, o.FW, o, true); bikeWheel(m, o.RW, o, false);
    m.add(C('glbFender' + o.FW.r, () => arcBand(o.FW.r + 0.02, 0.058, 0.6, 1.92, 0.005, 14)), M4(0, o.FW.y, o.FW.z), o.body, 'carPaint');
    m.add(B.geo, B.M, o.body, B.key, { raw: true });
  }

  function buildBike(m, pal, st, hi) {
    const paint = lin(pal.bike), lum = paint[0] * 0.2126 + paint[1] * 0.7152 + paint[2] * 0.0722, police = !!pal.police;
    let h = 0; for (const ch of pal.id) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const sd = st === 10 ? 1 : Math.min(st, 3);   // sport-bike defaults below (the R15 borrows the R1's)
    const o = {
      m, hi, st, police, paint, pz: posture(st), n: hi ? 24 : 12, step: hi ? 0.04 : 0.1, nu: hi ? 22 : 8, nv: hi ? 5 : 2,
      acc: pal.stripe ? lin(pal.stripe) : lum > 0.3 ? lin('#16171b') : lin('#f2f2ef'), plate: police ? 4 : (h >>> 0) % 4,
      top: v3(0, st === 0 ? 1.0 : 0.975, 0.43),
      rim: police ? lin('#5c6068') : [lin('#18191d'), lin('#18191d'), lin('#3a3d44'), GOLD][sd],
      rimStripe: police ? null : [lin('#d4501c'), paint, null, null][sd],
      spokes: [[6, 0], [5, 0.17], [3, 0.3], [7, 0]][sd],
      cal: [lin('#c9a22a'), BRAKE, GOLD, BRAKE][sd], carrier: [DARK, ALU, ALU, ALU][sd],
      forkUp: [lin('#b67a22'), DARK, lin('#2c2e34'), GOLD][sd], forkLow: sd === 3 ? lin('#3b3328') : CHROME, forkCap: [GOLD, GOLD, ALU, lin('#c02020')][sd],
      frameCol: [lin('#c23c18'), lin('#6c7078'), lin('#2c2e34'), lin('#24262b')][sd], armCol: [lin('#6c7078'), lin('#6c7078'), lin('#2c2e34'), lin('#8e939b')][sd],
      camCol: [lin('#c23c18'), lin('#202227'), lin('#8e949c'), lin('#b81c1c')][sd], spring: [lin('#e0b420'), lin('#c03020'), lin('#c03020'), lin('#e8c020')][sd],
    };
    o.FW = WHEELS[st].FW; o.RW = WHEELS[st].RW;
    if (st === 4) Object.assign(o, { top: v3(0, 0.96, 0.44), forkType: 'conv', forkW: 0.1, gaiters: true, forkLow: ALU, fender: false, wire: true, rim: ALU, hub: ALU,
      rimStripe: null, cal: lin('#2a2c32'), carrier: ALU, frameCol: lin('#16171b'), armCol: lin('#1c1d22'), tubeArm: true, twinShock: [0.76, -0.5],
      spring: CHROME, springMat: 'chrome', shockCol: lin('#2a2c30'), piv: v3(0, 0.45, -0.13), armX: 0.115, bar: 'riser', barCol: CHROME, roundMirrors: true, dash: 'twin' });
    if (st === 5) Object.assign(o, { top: v3(0, 1.12, 0.47), forkUp: GOLD, forkLow: lin('#2a2c32'), forkCap: ALU, forkW: 0.1, fender: false, wire: true, knobs: true,
      rim: lin('#1a1b20'), hub: lin('#c89a2c'), rimStripe: null, cal: lin('#2a2c32'), carrier: ALU, frameCol: lin('#2c2e34'), armCol: lin('#9ca1a8'),
      piv: v3(0, 0.53, -0.12), armX: 0.13, bar: 'adv', acc2: paint, spring: lin('#e0b420') });
    if (st === 6) Object.assign(o, { top: v3(0, 0.98, 0.45), forkType: 'conv', forkW: 0.11, forkLow: lin('#18191d'), shrouds: lin('#18191d'), fender: false, rim: lin('#16171b'),
      rimStripe: null, spokes: [5, 0.12], cal: lin('#18191d'), carrier: ALU, frameCol: lin('#18191d'), armCol: lin('#18191d'), tubeArm: true, twinShock: [0.66, -0.46],
      spring: lin('#1c1d22'), shockCol: lin('#2a2c30'), hugger: false, piv: v3(0, 0.38, -0.15), armX: 0.15, bar: 'riser', barCol: lin('#16171b'), roundMirrors: true, dash: 'round' });
    if (st >= 7 && st <= 9) Object.assign(o, { top: v3(0, 0.92, 0.36), forkType: 'conv', forkW: 0.08, forkK: 0.78, forkLow: lin('#2a2c32'), fender: true,
      rim: lin('#16171b'), rimStripe: null, spokes: [[5, 0.15], [5, 0.15], [6, 0]][st - 7], singleDisc: true, discR: 0.13, cal: lin('#c02020'), carrier: ALU,
      frameCol: lin('#2a2c30'), armCol: [lin('#1c1d22'), lin('#1c1d22'), ALU][st - 7], piv: v3(0, 0.4, -0.06), armX: 0.105, hugger: false,
      spring: [lin('#c02020'), lin('#e0a020'), lin('#c02020')][st - 7], bar: 'riser', barCol: lin('#1c1d22'), dash: 'none', camCol: lin('#2a2c32'), mirrorK: 0.72 });
    if (st === 10) Object.assign(o, { singleDisc: true, discR: 0.15 });
    if (st === 11) Object.assign(o, { top: v3(0, 0.98, 0.33), forkType: 'conv', forkW: 0.075, forkK: 0.8, forkLow: lin('#8a8e96'), rim: lin('#2c2e34'), rimStripe: null,
      spokes: [5, 0.14], singleDisc: true, discR: 0.13, cal: lin('#2a2c32'), carrier: ALU, frameCol: lin('#2a2c30'), noArm: true, bar: 'riser', barCol: lin('#1c1d22'), dash: 'none', mirrorK: 0.8 });
    // the factory livery when the bike wears its stock colour (rivals' own paint keeps the generic scheme above)
    const LV = !police && pal.bike === BIKES[st].color ? LIVERY[st] : {}, lv = k => LV[k] ? lin(LV[k]) : null;
    o.L = { side: lv('side'), flash: lv('flash'), tailBand: lv('tailBand'), fender: lv('fender'), belly: lv('belly'), seat: lv('seat'), tankBand: lv('tankBand'),
      pin: lv('pin'), acc2: lv('acc2'), can: lv('can'), side2: lv('side2'), trim: lv('trim'), roundel: !!LV.roundel };
    for (const [k, f] of [['acc', 'acc'], ['frame', 'frameCol'], ['forkUp', 'forkUp'], ['rim', 'rim'], ['cal', 'cal'], ['cam', 'camCol'], ['hub', 'hub']]) if (LV[k]) o[f] = lin(LV[k]);
    if ('rimStripe' in LV) o.rimStripe = LV.rimStripe ? lin(LV.rimStripe) : null;
    if (GLB_STYLE[st] && !police) {   // the user's own models (Winner X, CBR) when their data files are loaded
      const B = glbBody(GLB_STYLE[st]);
      if (B) {
        Object.assign(o, GLB_CFG[GLB_STYLE[st]].bike);
        if (!LV.rim) { o.rim = lin('#18191d'); o.rimStripe = null; }
        o.body = LV.body ? lin(LV.body) : paint; glbBike(o, B); return;
      }
    }
    if (st === 10 || st >= 12) { r15Bike(o); return; }   // built at R1 proportions inside a scaled mesher (also the CBRs' stand-in)
    bikeWheel(m, o.FW, o, true); bikeWheel(m, o.RW, o, false);
    frontEnd(o); if (!o.noArm) swingarm(o);
    if (st <= 3) {
      engine(o); frame(o); exhaust(o);
      if (st === 0) nakedBody(o); else fairedBody(o);
      rearEnd(o); footrests(o);
    } else [w800Bike, advBike, rebelBike, ubBike, ubBike, ubBike, null, shBike][st - 4](o);
    controls(o);
    if (police) policeKit(o);
  }

  // =====================================================================================
  // Riders: one-piece leathers with contrast side panels and armour, full-face helmets with a paint scheme of their
  // own, a mirrored visor and a rear spoiler. On the bike: static upper body + LimbRig (arms and legs, rewritten while
  // attacking). Off the bike: FootRig (thrown, getting up, running back to the bike, standing it up).
  // =====================================================================================
  const hashStr = s => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return h >>> 0; };
  const lum = c => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  // suit trim: the helmet colour when it stands out against the jacket, otherwise white or black
  function suitAccent(pal) {
    const j = lin(pal.jacket), h = lin(pal.helmet);
    if (Math.abs(lum(h) - lum(j)) > 0.2) return h;
    return lum(j) > 0.35 ? lin('#16171b') : lin('#ececec');
  }
  // two-bone IK: the joint between a and c (segment lengths l1, l2), bent towards pole
  function ik2(a, c, l1, l2, pole) {
    const d = c.clone().sub(a), L = Math.min(d.length(), l1 + l2 - 1e-3); d.normalize();
    const x = (l1 * l1 - l2 * l2 + L * L) / (2 * L), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    const p = pole.clone().addScaledVector(d, -pole.dot(d)).normalize();
    return a.clone().addScaledVector(d, x).addScaledVector(p, h);
  }

  // ---- full-face helmet ----
  const VISORS = ['#141a24', '#2f7de0', '#e0a020', '#d83a20', '#c0c8d2', '#38c070', '#9a4ae0'];
  // unit sphere -> helmet shell (metres, around the head centre): chin bar pushed forward and down, flat neck opening
  function helmetPt(nx, ny, nz, k) {
    const jaw = Math.max(0, -ny - 0.08) * Math.max(0, nz + 0.25), crown = Math.max(0, ny) * Math.max(0, -nz);
    const x = nx * 0.13 * (1 - jaw * 0.2), z = nz * 0.16 + jaw * 0.07 - crown * 0.012;
    let y = ny * 0.138 - jaw * 0.018;
    if (y < -0.11) y = -0.11 + (y + 0.11) * 0.3;
    return [x * k, y * k, z * k];
  }
  function helmetGeo(key, seg, ring, phi0, phiL, th0, thL, k) {
    return C(key, () => {
      const g = new T.SphereGeometry(1, seg, ring, phi0, phiL, th0, thL), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const q = helmetPt(p.getX(i), p.getY(i), p.getZ(i), k); p.setXYZ(i, q[0], q[1], q[2]); }
      g.computeVertexNormals(); return g;
    });
  }
  function helmet(m, pal, c, tilt, peak) {
    const h = hashStr(pal.id), A = lin(pal.helmet), J = lin(pal.jacket);
    const B = pal.stripe ? lin(pal.stripe) : Math.abs(lum(J) - lum(A)) > 0.2 ? J : lum(A) > 0.4 ? lin('#16171b') : lin('#f0f0f0');
    const W2 = lum(A) > 0.6 ? lin('#16171b') : lin('#f4f4f4');
    const Mh = new T.Matrix4().compose(c, new T.Quaternion().setFromEuler(new T.Euler(tilt, 0, 0)), v3(1, 1, 1)), inv = Mh.clone().invert(), lp = new T.Vector3();
    const L = (x, y, z, rx, sx, sy, sz, rz = 0) => Mh.clone().multiply(M4(x, y, z, rx, 0, rz, sx, sy, sz));
    // paint scheme per rider (broad areas only, so vertex colours stay crisp): wide centre stripe with a pinstripe,
    // two-tone split, contrasting side panels, or a dark lower half with a centre stripe
    const pat = pal.police ? 0 : h % 4;
    const scheme = (x, y, z) => {
      lp.set(x, y, z).applyMatrix4(inv);
      const ax = Math.abs(lp.x), Y = lp.y, Z = lp.z;
      if (pat === 0) return ax < 0.034 ? B : ax < 0.046 ? W2 : A;
      if (pat === 1) return Y + Z * 0.55 > 0.02 ? A : B;
      if (pat === 2) return ax > 0.085 && Y > -0.03 ? B : A;
      return (Y < -0.005 && Z < 0.12) || ax < 0.03 ? B : A;
    };
    m.add(helmetGeo('hShell2', 28, 20, 0, Math.PI * 2, 0, Math.PI, 1), Mh, scheme, 'paint');
    const vi = (h >> 3) % VISORS.length;   // smoked, or a mirrored iridium tint
    m.add(helmetGeo('hGasket2', 24, 10, Math.PI / 2 - 1.22, 2.44, 0.93, 0.71, 1.016), Mh, lin('#121316'), 'lam');   // rubber visor gasket
    m.add(helmetGeo('hVisor2', 22, 8, Math.PI / 2 - 1.15, 2.3, 0.98, 0.6, 1.03), Mh, lin(VISORS[vi]), vi ? 'chrome' : 'glass');
    m.add(GEO.box, L(0, -0.07, 0.168, 0.35, 0.045, 0.018, 0.012), BLACK, 'lam');                          // chin vent
    m.add(GEO.cyl16, L(0, -0.11, -0.005, 0, 0.112, 0.012, 0.13), lin('#18191d'), 'lam');                  // neck roll
    if (peak) m.add(GEO.box, L(0, 0.118, 0.13, 0.22, 0.19, 0.008, 0.12), A, 'paint');                    // adventure sun peak
  }
  // leather suit from the hips to the collar, shoulder armour, back protector, helmet (H hips, S shoulder line, Hd head)
  function upperBody(m, pal, key, H, S, Hd, tilt, opt) {
    const jacket = lin(pal.jacket), pants = lin(pal.pants), acc = suitAccent(pal);
    m.add(GEO.sph, M4(0, H.y + 0.02, H.z, 0, 0, 0, 0.19, 0.12, 0.17), pants, 'lam');                                     // pelvis
    const up = S.clone().sub(H).normalize(), back = v3(0, up.z, -up.y), chest = H.clone().lerp(S, 0.62).addScaledVector(back, -0.01);
    m.add(pathLoft('torso|' + key, [H.clone().addScaledVector(up, 0.03), chest, S.clone().addScaledVector(up, 0.02)],
      t => [0.16 + 0.05 * Math.sin(Math.min(1, t * 1.25) * Math.PI / 2) - 0.03 * Math.max(0, t - 0.8) / 0.2, 0.112 + 0.03 * Math.sin(t * Math.PI), 2.5], 8, 16),
      M4(), (x) => Math.abs(x) > 0.198 ? acc : jacket, 'lam');                                                           // torso, contrast stripe down the sides
    for (const s of [-1, 1]) {
      m.add(GEO.sph, M4(s * 0.19, S.y - 0.015, S.z - 0.02, 0, 0, s * 0.3, 0.09, 0.075, 0.09), jacket, 'lam');                 // shoulder
      m.add(GEO.sph, M4(s * 0.205, S.y + 0.03, S.z - 0.02, 0, 0, s * 0.45, 0.055, 0.022, 0.06), acc, 'lam');                  // armour plate
    }
    m.add(GEO.cyl16, link(S.clone(), S.clone().addScaledVector(up, 0.07), 0.068), lin('#18191d'), 'lam');                 // collar
    if (opt.hump) {   // aero back protector of a racing suit
      const hp = S.clone().addScaledVector(back, 0.12).addScaledVector(up, -0.1);
      m.add(GEO.sph, new T.Matrix4().compose(hp, new T.Quaternion().setFromUnitVectors(_up, up), v3(0.1, 0.16, 0.075)), jacket, 'lam');
    }
    if (pal.emblem) {
      const mid = H.clone().lerp(S, 0.55), c = mid.clone().addScaledVector(back, 0.152).addScaledVector(up, 0.05), q = new T.Quaternion().setFromUnitVectors(_up, back);
      m.add(GEO.cyl16, new T.Matrix4().compose(c, q, v3(0.075, 0.012, 0.075)), lin(pal.emblem), 'paint');
      for (const s of [-1, 1]) m.add(GEO.cyl6, new T.Matrix4().compose(c.clone().add(v3(s * 0.1, 0, 0)), q, v3(0.075, 0.008, 0.03)), lin(pal.emblem), 'paint');
    }
    helmet(m, pal, Hd, tilt, opt.peak);
    if (pal.hair) {   // pony tail: blowing back on the bike, hanging down on foot
      const hc = lin(pal.hair), a = Hd.clone().add(v3(0, -0.04, -0.14)), b = Hd.clone().add(opt.hairDown ? v3(0, -0.24, -0.2) : v3(0, -0.16, -0.40));
      m.add(taper(0.05, 0.035), link(a, b, 1, 0.8), hc, 'lam', { jit: 0.1 });
      m.add(GEO.sphLo, M4(b.x, b.y - 0.02, b.z - 0.03, 0, 0, 0, 0.035, 0.05, 0.06), hc, 'lam');
    }
  }
  function buildRiderStatic(m, pal, st) {
    const pz = posture(st);
    upperBody(m, pal, 's' + st, pz.hip, pz.sh, pz.head, 0.15, { hump: st === 1 || st === 3 || st === 4 || st === 10, peak: st === 5 });
  }

  // ---- dynamic limbs: unit parts transformed into one buffer every time the pose changes ----
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
  const limbCols = pal => {
    const acc = suitAccent(pal), J = lin(pal.jacket), Pn = lin(pal.pants), boot = lin('#18161a');
    return { up: J, elb: acc, fore: J, glove: lin(pal.glove || '#26242a'), club: lin('#6a4220'), cTip: lin('#4a2e14'), ch: lin('#b8bcc4'),
      thigh: Pn, knee: acc, shin: Pn, ankle: boot, boot, slider: lin('#4a4c52') };
  };
  class DynRig {
    constructor(parts, cols, bound) {   // two copies of the parts, one per side
      this.slots = []; let n = 0;
      for (let side = 0; side < 2; side++) for (const k of parts) {
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
      g.boundingSphere = bound;
      this.m = new T.Matrix4();
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
    flush() { this.geo.attributes.position.needsUpdate = true; this.geo.attributes.normal.needsUpdate = true; }
    // arm (shoulder S, elbow E, hand Hn) and leg (hip J, knee K, ankle A, toe Tt) of one side
    limbs(base, S, E, Hn, J, K, A, Tt, idx) {
      this.write(base + idx[0], link(S, E, 0.058, 0.058, this.m));
      this.write(base + idx[1], this.m.compose(E, _q.identity(), _s.set(0.052, 0.052, 0.052)));
      this.write(base + idx[2], link(E, Hn, 0.05, 0.05, this.m));
      this.write(base + idx[3], this.m.compose(Hn, _q.identity(), _s.set(0.058, 0.052, 0.066)));
      this.write(base + idx[4], link(J, K, 1, 1, this.m));
      this.write(base + idx[5], this.m.compose(K, _q.identity(), _s.set(0.076, 0.076, 0.076)));
      this.write(base + idx[6], link(K, A, 1, 1, this.m));
      this.write(base + idx[7], this.m.compose(A, _q.identity(), _s.set(0.06, 0.075, 0.07)));
      this.write(base + idx[8], link(A.clone().add(v3(0, 0.03, 0)).addScaledVector(Tt.clone().sub(A).normalize(), -0.05), Tt, 0.095, 0.11, this.m));
    }
  }
  // ---- arms + legs on the bike (dynamic: rewritten while attacking). Armed = swing the weapon; unarmed = side kick ----
  const LIMB_IDX = [0, 1, 2, 3, 12, 13, 14, 15, 16];
  class LimbRig extends DynRig {
    constructor(pal, st) {
      super(ARM_PARTS, limbCols(pal), new T.Sphere(v3(0, 0.9, 0), 1.6));
      this.pz = posture(st); this.key = ''; this.hm = new T.Matrix4();
      this.pose(0, 0, null, 0, 0, true);
    }
    // blend rest -> wind-up -> strike -> rest over the 0.36 s attack
    static phase(t, rest, up, out) {
      if (t < 0.12) return rest.clone().lerp(up, smooth01(t / 0.12));
      if (t < 0.22) return up.clone().lerp(out, smooth01((t - 0.12) / 0.1));
      return out.clone().lerp(rest, smooth01(Math.min(1, (t - 0.22) / 0.14)));
    }
    // atkSide: -1 left / +1 right / 0 none; t: attack time; weapon: 'club' | 'chain' | null (null = kick);
    // h: hanging off (see hangMatrix); roll: the bike's lean angle (keeps the inside knee just on the tarmac)
    pose(atkSide, t, weapon, h, roll, force) {
      const key = (atkSide ? atkSide + '|' + t.toFixed(3) + '|' + weapon : 'rest') + '|' + h + '|' + roll;
      if (key === this.key && !force) return;
      this.key = key;
      const pz = this.pz, NP = ARM_PARTS.length, ph = LimbRig.phase, Mh = hangMatrix(pz, h, this.hm), a = Math.abs(h), xin = -Math.sign(h);
      for (let side = 0; side < 2; side++) {
        const raceSide = side ? 1 : -1, xs = -raceSide, base = side * NP, me = atkSide === raceSide, inner = a > 0 && xs === xin;
        // ---- arm: elbows out and down towards the grips (the outside arm stretches over the tank when hanging off) ----
        const Sh = v3(xs * 0.19, pz.sh.y - 0.01, pz.sh.z - 0.02).applyMatrix4(Mh);
        const restH = v3(xs * pz.gripW, pz.grip.y, pz.grip.z - 0.02), reach = Math.max(1, Sh.distanceTo(restH) / 0.585);
        const restE = ik2(Sh, restH, 0.3 * reach, 0.29 * reach, inner ? v3(xs * 0.6, -0.8, -0.2) : v3(xs * 0.7, -0.6, -0.3));
        let E = restE, Hn = restH, wk = 0;
        const armed = me && !!weapon, kick = me && !weapon;
        if (armed) {
          const upE = Sh.clone().add(v3(xs * 0.2, 0.2, -0.04)), upH = Sh.clone().add(v3(xs * 0.24, 0.44, -0.16));
          const outE = Sh.clone().add(v3(xs * 0.3, 0.0, 0.1)), outH = Sh.clone().add(v3(xs * 0.6, -0.02, 0.16));
          E = ph(t, restE, upE, outE); Hn = ph(t, restH, upH, outH);
          wk = t < 0.12 ? smooth01(t / 0.12) : t < 0.22 ? 1 - smooth01((t - 0.12) / 0.1) * 0.8 : 0.2 * (1 - smooth01(Math.min(1, (t - 0.22) / 0.14)));
        }
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
        // ---- leg: knee tucked against the tank, toes on the peg; kick = knee up, then stamp sideways.
        // Hanging off, the inside knee swings out and down until its slider skims the tarmac ----
        const J0 = v3(xs * 0.13, pz.hip.y - 0.02, pz.hip.z + 0.02), J = J0.clone().applyMatrix4(Mh);
        const rK = v3(xs * pz.kneeX, pz.knee.y, pz.knee.z), rA = v3(xs * 0.17, pz.ankle.y, pz.ankle.z), rT = v3(xs * 0.17, pz.toe.y, pz.toe.z);
        let K = rK, A = rA, Tt = rT;
        if (a > 0) {
          const Kh = ik2(J, rA, J0.distanceTo(rK), rK.distanceTo(rA), inner ? v3(xs * 0.75, -0.2, 0.75) : v3(xs * 0.3, 0.15, 1));
          K = rK.clone().lerp(Kh, inner ? a : a * 0.7);
          if (inner) {
            const sn = Math.sin(roll), cs = Math.cos(roll), hgt = K.x * sn + K.y * cs + 0.09 * (1 - cs);
            if (hgt < 0.05) K.add(v3(sn, cs, 0).multiplyScalar(0.05 - hgt));
          }
        }
        if (kick) {
          const uK = J.clone().add(v3(xs * 0.2, 0.02, 0.24)), uA = uK.clone().add(v3(xs * 0.1, -0.31, -0.13)), uT = uA.clone().add(v3(xs * 0.03, -0.03, 0.14));
          const oK = J.clone().add(v3(xs * 0.39, -0.09, 0.07)), oA = J.clone().add(v3(xs * 0.81, -0.16, 0.05)), oT = oA.clone().add(v3(xs * 0.04, 0.12, 0.08));
          K = ph(t, rK, uK, oK); A = ph(t, rA, uA, oA); Tt = ph(t, rT, uT, oT);
        }
        this.limbs(base, Sh, E, Hn, J, K, A, Tt, LIMB_IDX);
        const ko = K.clone().add(v3(xs * 0.055, -0.03, 0.03));   // knee slider puck on the outside of the knee
        this.write(base + 17, this.m.compose(ko, _q.identity(), _s.set(0.012, 0.045, 0.06)));
      }
      this.flush();
    }
  }
  // roll of the whole bike while kicking: lean away from the kick (+ = lean right)
  function kickRoll(atk, weapon) { return atk && !weapon ? -atk.side * 0.13 * atkEnv(atk.t) : 0; }

  // ---- the rider on foot: origin at the hips, +Y up, +Z the way he faces; the upper body pivots at the waist ----
  const FOOT_PARTS = ['up', 'elb', 'fore', 'glove', 'thigh', 'knee', 'shin', 'ankle', 'boot'], FOOT_IDX = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  class FootRig extends DynRig {
    constructor(pal, upper) {
      super(FOOT_PARTS, limbCols(pal), new T.Sphere(v3(0, 0, 0), 1.3));
      this.root = new T.Group(); this.root.rotation.order = 'YXZ'; this.upper = new T.Group();
      for (const k in upper) { const mesh = new T.Mesh(upper[k], G3.mats[k]); mesh.castShadow = k !== 'light'; this.upper.add(mesh); }
      const lm = new T.Mesh(this.geo, G3.mats.lam); lm.castShadow = true;
      this.root.add(this.upper, lm); this.bob = 0; this.key = '';
      this.pose(0, 0, 0);
    }
    // mode 0 thrown / lying (limbs flung out), 1 getting up (k 0..1), 2 running (t seconds), 3 standing the bike up (k 0..1)
    pose(mode, t, k) {
      const key = mode + '|' + (mode === 2 ? t.toFixed(3) : k.toFixed(3));
      if (key === this.key) return;
      this.key = key;
      const bend = mode === 1 ? 1.0 - 0.8 * k : mode === 2 ? 0.25 : mode === 3 ? 0.95 - 0.55 * k : 0, ph = t * Math.PI * 2 * 1.5;
      this.bob = mode === 2 ? 0.035 * Math.abs(Math.cos(ph)) : 0;
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1, J = v3(s * 0.1, -0.04, 0), S = v3(s * 0.19, 0.47 * Math.cos(bend), 0.47 * Math.sin(bend));
        let E, Hn, K, A, Tt;
        if (mode === 0) {
          E = v3(s * 0.4, 0.58, 0.06); Hn = v3(s * 0.62, 0.74, 0.03); K = v3(s * 0.22, -0.46, 0.08); A = v3(s * 0.3, -0.88, 0);
        } else if (mode === 1) {   // hands push off the knees, legs straighten
          K = v3(s * 0.14, -0.28 - 0.16 * k, 0.3 * (1 - k) + 0.04); A = v3(s * 0.15, -0.86, -0.06 * (1 - k));
          Hn = K.clone().add(v3(s * 0.05, 0.07, 0.05)).lerp(v3(s * 0.24, -0.3, 0.06), k); E = ik2(S, Hn, 0.29, 0.28, v3(s, -0.3, -0.6));
        } else if (mode === 2) {   // running stride: thigh swing, knee folding on the recovery, arms pumping
          const ps = ph + (i ? Math.PI : 0), th1 = 0.7 * Math.sin(ps), th2 = th1 - 0.25 - 1.2 * Math.max(0, Math.cos(ps + Math.PI / 4));
          K = J.clone().add(v3(0, -0.43 * Math.cos(th1), 0.43 * Math.sin(th1))); A = K.clone().add(v3(0, -0.43 * Math.cos(th2), 0.43 * Math.sin(th2)));
          const ta = -0.75 * Math.sin(ps), tf = ta + 1.45;
          E = S.clone().add(v3(s * 0.04, -0.28 * Math.cos(ta), 0.28 * Math.sin(ta))); Hn = E.clone().add(v3(-s * 0.02, -0.27 * Math.cos(tf), 0.27 * Math.sin(tf)));
        } else {   // bent over the bike, hands on it, legs braced
          Hn = v3(s * 0.22, -0.28 + 0.42 * k, 0.42 - 0.05 * k); E = ik2(S, Hn, 0.29, 0.28, v3(s * 0.8, -0.5, -0.2));
          K = v3(s * 0.17, -0.4 + 0.05 * k, 0.16 - 0.08 * k); A = v3(s * 0.2, -0.86, -0.04);
        }
        Tt = A.clone().add(v3(0, -0.03, 0.17));
        this.limbs(i * FOOT_PARTS.length, S, E, Hn, J, K, A, Tt, FOOT_IDX);
      }
      this.upper.rotation.x = bend;
      this.flush();
    }
  }

  const riderGeoCache = new Map();
  // returns { root (yaw/pitch), lean (roll), bike / bikeLo groups, rider group, arms: LimbRig, foot: FootRig, body (= foot.root), sirens, setDetail(hi) }
  function rider(pal, st) {
    const key = pal.id + '|' + st;
    let gs = riderGeoCache.get(key);
    if (!gs) {
      const mb = new Mesher(3), ml = new Mesher(3), mr = new Mesher(4), mf = new Mesher(5);
      buildBike(mb, pal, st, true); buildBike(ml, pal, st, false); buildRiderStatic(mr, pal, st);
      upperBody(mf, pal, 'foot', v3(0, 0, 0), v3(0, 0.5, 0), v3(0, 0.755, 0.02), 0, { peak: st === 5, hairDown: true });
      gs = { bike: mb.geos(), lo: ml.geos(), rider: mr.geos(), foot: mf.geos() };
      riderGeoCache.set(key, gs);
    }
    const M = G3.mats, mk = (geos, cast) => {
      const g = new T.Group();
      // small chrome / glass parts (spokes, discs, levers, screen) add nothing to the soft shadow
      for (const k in geos) { const mesh = new T.Mesh(geos[k], M[k]); mesh.castShadow = cast && k !== 'light' && k !== 'chrome' && k !== 'glass'; g.add(mesh); }
      return g;
    };
    const root = new T.Group(), lean = new T.Group(), bike = mk(gs.bike, true), bikeLo = mk(gs.lo, true), upper = mk(gs.rider, true), rid = new T.Group();
    const foot = new FootRig(pal, gs.foot), body = foot.root;
    root.rotation.order = 'YXZ'; upper.matrixAutoUpdate = false;
    const arms = new LimbRig(pal, st), armMesh = new T.Mesh(arms.geo, M.lam); armMesh.castShadow = true;
    rid.add(upper);
    // wheelie pivot on the rear axle: root -> pitch (at the axle) -> piv (back to the origin) -> lean (roll)
    const pitch = new T.Group(), piv = new T.Group(), R = WHEELS[st].RW;
    pitch.position.set(0, R.y, R.z); piv.position.set(0, -R.y, -R.z);
    rid.add(armMesh); lean.add(bike); lean.add(bikeLo); lean.add(rid); piv.add(lean); pitch.add(piv); root.add(pitch);
    bikeLo.visible = false;
    const pzr = posture(st), hk = HANG[st];
    const o = { root, pitch, lean, bike, bikeLo, rider: rid, arms, foot, body, sirens: null, hi: true, lights: BIKE_LIGHTS[st],
      leanMax: LEAN_MAX[st], hang: 0,
      setDetail(hi) { if (hi !== this.hi) { this.hi = hi; bike.visible = hi; bikeLo.visible = !hi; } },
      // rider on the bike: lean = race lean (1 = full), roll = the bike's actual lean angle (radians)
      pose(atkSide, t, weapon, leanN, roll) {
        const k = smooth01(U.clamp((Math.abs(leanN) - 0.18) / 0.62, 0, 1)) * hk, h = Math.round(Math.sign(leanN) * k * 25) / 25;
        if (h !== this.hang) { this.hang = h; hangMatrix(pzr, h, upper.matrix); upper.matrixWorldNeedsUpdate = true; }
        arms.pose(atkSide, t, weapon, h, h ? Math.round(roll * 25) / 25 : 0);
      } };
    hangMatrix(pzr, 0, upper.matrix);
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
      let X, Y;
      if (s.f) { const t = facetRay(s.f, c, sn); X = c * t; Y = sn * t; }
      else { X = Math.sign(c) * Math.pow(Math.abs(c), 2 / s.p); Y = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / s.p); }
      r.push([(Y < 0 ? s.wb + (s.wm - s.wb) * (Y + 1) : s.wm + (s.wt - s.wm) * Y) * X, yc + h * Y, z]);
    }
    r.c = [0, yc, z];
    return r;
  }
  // x of that cross-section's surface at height y
  function sideX(s, y) {
    const yc = (s.yt + s.yb) / 2, h = (s.yt - s.yb) / 2, Y = (y - yc) / h;
    if (Math.abs(Y) >= 1) return 0;
    return (Y < 0 ? s.wb + (s.wm - s.wb) * (Y + 1) : s.wm + (s.wt - s.wm) * Y) * (s.f ? facetX(s.f, Y) : Math.pow(1 - Math.pow(Math.abs(Y), s.p), 1 / s.p));
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
  // Drift cars from authored .glb models (tools/glb/build_car.js -> HB_GLB.<model>): the body in colour categories
  // (near and far detail), the model's own wheels. Car object: root (place / yaw / slope) > tilt (body roll and pitch
  // about a point 0.5 m up) > body; four wheel pivots (steer about y) carrying the spinning wheels
  // =====================================================================================
  // category -> [material key, colour]: 'carPaint' takes the car's paint, 'brake' is the tail lamps (lit by the brakes)
  const CAR_CAT = {
    paint: ['carPaint', '#ffffff'], black: ['paint', '#111215'], trim: ['paint', '#1c1d21'], carbon: ['paint', '#16171a'],
    grille: ['lam', '#0b0b0d'], under: ['lam', '#0a0a0b'], glass: ['glass', '#0a0d11'], alu: ['chrome', '#b4b8c0'],
    white: ['paint', '#e6e6e2'], exhaust: ['chrome', '#8c7c6a'], strap: ['lam', '#2a4ad0'],
    head: ['light', '#eef2ff'], tail: ['brake', '#ff2a18'], amber: ['light', '#ff8a18'],
    tyre: ['lam', '#161618'], rim: ['chrome', '#3a3d44'], rimLip: ['chrome', '#c4c8ce'], lug: ['chrome', '#9aa0a8'],
    disc: ['chrome', '#8a8e96'], caliper: ['paint', '#c89a1c'], calDark: ['paint', '#1e1f22'],
    rimDark: ['paint', '#18191c'], rimAccent: ['paint', '#b01818'],
  };
  // every drift car has a data file js/g3/<model>.js: loaded on demand (a few hundred KB each), all of them in the
  // background after start-up (preloadCars), and before a race that needs them (loadCar resolves once the file is in)
  const CAR_FILES = ['z280', 'n180', 'm65', 'gr86', 'boss', 'supra', 'r34', 'rx7vs', 'gtr', 's15c', 'gt2', 'rx7bn', 'r35', 'f40', 'wis'];
  const carLoads = {};
  const hasCar = model => typeof HB_GLB !== 'undefined' && !!HB_GLB[model];
  function loadCar(model) {
    if (!CAR_FILES.includes(model) || hasCar(model)) return Promise.resolve(hasCar(model));
    return carLoads[model] || (carLoads[model] = new Promise(res => {
      const s = document.createElement('script');
      s.src = 'js/g3/' + model + '.js'; s.async = true;
      s.onload = () => res(hasCar(model)); s.onerror = () => res(false);
      document.head.appendChild(s);
    }));
  }
  function preloadCars() { return CAR_FILES.reduce((p, m) => p.then(() => loadCar(m)), Promise.resolve()); }
  const glbCarCache = {};
  function glbCarGeo(model) {
    if (glbCarCache[model]) return glbCarCache[model];
    const D = typeof HB_GLB !== 'undefined' && HB_GLB[model];
    if (!D || !D.wheels) return null;
    const bin = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
    // one geometry per material key: the categories' colours ride along as vertex colours
    const build = list => {
      const by = {};
      for (const G of list) {
        const [key, hex] = CAR_CAT[G.cat] || CAR_CAT.trim, col = lin((D.spec.colors || {})[G.cat] || hex);   // (the model's own colours first)
        const pos = new Int16Array(bin(G.pos)), idx = G.n32 ? new Uint32Array(bin(G.idx)) : new Uint16Array(bin(G.idx));
        let g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(Float32Array.from(pos, v => v / D.q), 3)); g.setIndex(new T.BufferAttribute(idx, 1));
        g = g.toNonIndexed(); g.computeVertexNormals(); soften(g, 40);
        (by[key] || (by[key] = [])).push([g, col]);
      }
      const out = {};
      for (const key in by) {   // merge
        let n = 0; for (const [g] of by[key]) n += g.attributes.position.count;
        const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3);
        let o = 0;
        for (const [g, c] of by[key]) {
          P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3);
          for (let i = 0; i < g.attributes.position.count; i++) C.set(c, (o + i) * 3);
          o += g.attributes.position.count; g.dispose();
        }
        const m = new T.BufferGeometry();
        m.setAttribute('position', new T.BufferAttribute(P, 3)); m.setAttribute('normal', new T.BufferAttribute(N, 3)); m.setAttribute('color', new T.BufferAttribute(C, 3));
        m.computeBoundingSphere();
        out[key] = m;
      }
      return out;
    };
    const split = list => [build(list.filter(G => G.cat !== 'caliper' && G.cat !== 'calDark')), build(list.filter(G => G.cat === 'caliper' || G.cat === 'calDark'))];
    const S = D.spec;
    return (glbCarCache[model] = { S: Object.assign({}, S, { R: S.wheel.R }), hi: build(D.groups), lo: D.lo ? build(D.lo) : null,
      wf: split(D.wheels.f), wr: split(D.wheels.r) });
  }
  function glbCar(model, col) {
    const G = glbCarGeo(model);
    if (!G) return null;
    const S = G.S, root = new T.Group(), tilt = new T.Group(), body = new T.Group();
    root.rotation.order = 'YXZ'; tilt.position.y = 0.5; body.position.y = -0.5; tilt.add(body); root.add(tilt);
    const paint = G3.mats.carPaint.clone(); paint.color.set(col);
    const brake = new T.MeshBasicMaterial({ vertexColors: true });
    const mat = k => k === 'carPaint' ? paint : k === 'brake' ? brake : G3.mats[k];
    const level = geos => { const grp = new T.Group(); for (const k in geos) { const ms = new T.Mesh(geos[k], mat(k)); ms.castShadow = k !== 'light' && k !== 'brake'; ms.receiveShadow = true; grp.add(ms); } body.add(grp); return grp; };
    const hi = level(G.hi), lo = G.lo ? level(G.lo) : null;
    if (lo) lo.visible = false;
    const wheels = [];
    for (const [hub, q, [spinG, calG], front] of [[S.hub.f, S.hub.qf, G.wf, true], [S.hub.r, S.hub.qr, G.wr, false]]) for (const side of [1, -1]) {
      // pivot (steers, about the caster-tilted axis) > mirror (the right side is the left wheel mirrored) > lean (camber
      // and toe: the model's own camber until the car's wheel alignment is set) > spin (rolls about the wheel's own
      // axle) + the calipers (do not)
      const pivot = new T.Group(), mir = new T.Group(), lean = new T.Group(), spin = new T.Group();
      pivot.position.set(side * hub[0], hub[1], hub[2]); mir.scale.x = side;
      if (q) lean.quaternion.set(q[0], q[1], q[2], q[3]);
      for (const k in spinG) { const ms = new T.Mesh(spinG[k], mat(k)); ms.castShadow = k === 'lam'; spin.add(ms); }
      for (const k in calG) lean.add(new T.Mesh(calG[k], mat(k)));
      lean.add(spin); mir.add(lean); pivot.add(mir); root.add(pivot); wheels.push({ pivot, spin, lean, front, side });
    }
    const o = alignable({ root, tilt, body, wheels, paint, brake, pods: null, spec: S, glb: true,
      setPaint(c) { paint.color.set(c); },
      setBrake(on) { brake.color.setScalar(on ? 1 : 0.3); },
      setNight() {},
      setDetail(near) { if (lo) { hi.visible = near; lo.visible = !near; } },
      dispose() { paint.dispose(); brake.dispose(); } });
    o.setBrake(false);
    return o;
  }
  // wheel alignment on a car's wheels (al: see ALIGN in drift.js, degrees): setAlign tilts each wheel by its camber
  // (- = the top leans in) and turns it by its toe (+ = the front points in) - the left wheel; the right one is its
  // mirror image. steer(d) turns the front wheels by d rad (+ = left) about the steering axis, which leans back at the
  // top by the caster: steered, both front wheels lean the way they turn (the outside one gains negative camber)
  const _qa = new T.Quaternion(), _qb = new T.Quaternion(), AX_Y = new T.Vector3(0, 1, 0), AX_Z = new T.Vector3(0, 0, 1);
  function alignable(o) {
    o.casAxis = new T.Vector3(0, 1, 0);
    o.setAlign = al => {
      o.align = al;
      const D = Math.PI / 180;
      for (const w of o.wheels) {
        const cam = (w.front ? al.camF : al.camR) * D, toe = (w.front ? al.toeF : al.toeR) * D;
        _qa.setFromAxisAngle(AX_Y, -toe); _qb.setFromAxisAngle(AX_Z, -cam);
        w.lean.quaternion.copy(_qa).multiply(_qb);
      }
      o.casAxis.set(0, Math.cos(al.cas * D), -Math.sin(al.cas * D));
      o.steer(o.steerA || 0);
    };
    o.steer = d => { o.steerA = d; for (const w of o.wheels) if (w.front) w.pivot.quaternion.setFromAxisAngle(o.casAxis, d); };
    return o;
  }
  // a plain stand-in (a body block, a cabin, four wheels) while a model's data file is still loading, or if it fails to
  const STAND_IN = { len: [-2.25, 2.2], hw: 0.9, top: 1.3, axles: [1.25, -1.3], wheel: { R: 0.32, w: 0.24, x: 0.78, xr: 0.78 },
    head: [0.6, 0.65, 2.1], tail: [0.62, 0.8, -2.2], exh: [[0.45, 0.28, 0.04, -2.25]], R: 0.32 };
  function standInCar(col) {
    const S = STAND_IN, root = new T.Group(), tilt = new T.Group(), body = new T.Group();
    root.rotation.order = 'YXZ'; tilt.position.y = 0.5; body.position.y = -0.5; tilt.add(body); root.add(tilt);
    const paint = G3.mats.carPaint.clone(); paint.color.set(col);
    const brake = new T.MeshBasicMaterial({ color: '#ff2a18' }), geos = [];
    const box = (mt, w, h, d, y, z) => { const g = new T.BoxGeometry(w, h, d); geos.push(g); const m = new T.Mesh(g, mt); m.position.set(0, y, z); m.castShadow = true; body.add(m); };
    box(paint, 1.76, 0.5, 4.4, 0.62, -0.02); box(G3.mats.glass, 1.4, 0.42, 2.0, 1.06, -0.25); box(brake, 1.5, 0.08, 0.04, 0.8, -2.23);
    const wg = new T.CylinderGeometry(S.wheel.R, S.wheel.R, S.wheel.w, 14); wg.rotateZ(Math.PI / 2); geos.push(wg);
    const wheels = [];
    for (const [za, front] of [[S.axles[0], true], [S.axles[1], false]]) for (const side of [1, -1]) {
      const pivot = new T.Group(), mir = new T.Group(), lean = new T.Group(), spin = new T.Group();
      pivot.position.set(side * S.wheel.x, S.wheel.R, za); mir.scale.x = side; spin.add(new T.Mesh(wg, G3.mats.lam));
      lean.add(spin); mir.add(lean); pivot.add(mir); root.add(pivot); wheels.push({ pivot, spin, lean, front, side });
    }
    return alignable({ root, tilt, body, wheels, paint, brake, pods: null, spec: S,
      setPaint(c) { paint.color.set(c); },
      setBrake(on) { brake.color.set('#ff2a18').multiplyScalar(on ? 1 : 0.3); },
      setNight() {},
      dispose() { paint.dispose(); brake.dispose(); for (const g of geos) g.dispose(); } });
  }
  // a drift car by model name: the authored model when its data is loaded, else the stand-in (and the file is fetched);
  // al: its wheel alignment (else the model's own camber stays)
  function driftCar(model, col, al) {
    let o = glbCar(model, col);
    if (!o) { loadCar(model); o = standInCar(col); }
    if (al) o.setAlign(al);
    return o;
  }

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
    // ---- circuit (MotoGP-style track) furniture ----
    // grandstand facing the track (+z): v0 = big covered stand 46 m long, v1 = open bleachers round a hairpin
    stand(m, v) {
      const L = v ? 32 : 46, D = v ? 10 : 14, top = v ? 6.5 : 10, tiles = Math.round(L / 11.5), tw = L / tiles;
      const concrete = lin('#b8b8b0'), steel = lin('#6a7280'), slope = Math.atan2(top - 1.4, D - 2), sl = Math.hypot(top - 1.4, D - 2);
      m.add(GEO.box, M4(0, 0.7, D / 2 - 0.15, 0, 0, 0, L, 1.4, 0.3), concrete, 'lam');                        // front wall
      for (let k = 0; k < L / 4 - 0.5; k++) m.add(GEO.plane, M4(-L / 2 + 2.2 + k * 4, 0.75, D / 2 + 0.01, 0, 0, 0, 3.8, 0.95, 1), WHITE, 'lam', { uv: 'ad' + ((k + v * 3) % 9) });
      for (let k = 0; k < tiles; k++)                                                                          // the crowd on the terraces
        m.add(GEO.plane, M4(-L / 2 + tw * (k + 0.5), (top + 1.4) / 2, 0, -(Math.PI / 2 - slope), 0, 0, tw, sl, 1), WHITE, 'lam', { uv: 'crowd' });
      m.add(GEO.box, M4(0, top / 2, -D / 2 + 0.2, 0, 0, 0, L, top, 0.4), concrete, 'lam');                      // back wall
      for (const s of [-1, 1]) m.add(P('standSide' + v, () => prof([[D / 2, 0], [D / 2, 1.4], [-D / 2, top + 0.4], [-D / 2, 0]], 0.5, 0.02)),
        M4(s * (L / 2 + 0.25), 0, 0), concrete, 'lam');
      if (v) { for (let k = 0; k < L / 8; k++) m.add(GEO.cyl, M4(-L / 2 + 4 + k * 8, top + 1.2, -D / 2 + 0.3, 0, 0, 0, 0.05, 2.4, 0.05), steel, 'lam'); return; }
      m.add(GEO.box, M4(0, 15.2, -0.6, -0.08, 0, 0, L + 2, 0.35, D + 1.6), lin('#e8eaee'), 'lam');                // cantilever roof
      for (let k = 0; k <= 5; k++) {
        const x = -L / 2 + k * L / 5;
        m.add(GEO.box, M4(x, 7.6, -D / 2 - 0.3, 0, 0, 0, 0.5, 15.2, 0.5), steel, 'lam');
        m.add(GEO.box, link(v3(x, 15.4, -D / 2 - 0.3), v3(x, 14.6, D / 2 + 0.4), 0.25, 0.4), steel, 'lam');
      }
      m.add(GEO.box, M4(0, 13.6, D / 2 + 0.75, 0, 0, 0, L * 0.5, 1.3, 0.12), lin('#1a2a5a'), 'lam');
      m.add(GEO.plane, M4(0, 13.6, D / 2 + 0.82, 0, 0, 0, L * 0.48, 1.15, 1), WHITE, 'lam', { uv: 'gpb' });
    },
    // pit garages (one 30 m block, team colour v) with the hospitality floor above, front on +z
    pits(m, v) {
      const team = lin(['#c81e1e', '#1f4fb0', '#1a9a4a', '#e0a020'][v % 4]), wall = lin('#dcdde0');
      m.add(GEO.box, M4(0, 2.4, 0, 0, 0, 0, 30, 4.8, 16), wall, 'lam');
      for (let k = 0; k < 3; k++) m.add(GEO.plane, M4(-10 + k * 10, 2.1, 8.01, 0, 0, 0, 8.6, 4.0, 1), team, 'lam', { uv: 'garage' });
      m.add(GEO.box, M4(0, 4.75, 8.05, 0, 0, 0, 30, 0.7, 0.12), team, 'lam');
      m.add(GEO.box, M4(0, 6.6, -1.2, 0, 0, 0, 30, 3.6, 12.6), wall, 'lam');
      m.add(GEO.plane, M4(0, 6.6, 5.11, 0, 0, 0, 30, 3.0, 1), WHITE, 'lam', { uv: 'vip' });
      m.add(GEO.box, M4(0, 8.6, 0.2, 0, 0, 0, 31, 0.4, 17.4), lin('#f0f0f0'), 'lam');
      m.add(GEO.box, M4(0, 4.95, 6.6, 0, 0, 0, 30, 0.12, 3), lin('#a8acb4'), 'lam');                          // balcony
      for (let k = 0; k < 8; k++) m.add(GEO.box, M4(-14 + k * 4, 5.4, 8.05, 0, 0, 0, 0.05, 0.9, 0.05), lin('#c8ccd4'), 'lam');
      m.add(GEO.box, M4(0, 5.85, 8.05, 0, 0, 0, 30, 0.06, 0.06), lin('#c8ccd4'), 'lam');
    },
    // start gantry over the line: two pillars, the start lights, a banner on both faces
    gantry(m) {
      const red = lin('#c81e1e'), dark = lin('#202228');
      for (const s of [-1, 1]) {
        m.add(GEO.box, M4(s * 9.9, 3.6, 0, 0, 0, 0, 0.8, 7.2, 0.8), dark, 'lam');
        m.add(GEO.box, M4(s * 9.9, 0.3, 0, 0, 0, 0, 1.4, 0.6, 1.4), lin('#e8e8e8'), 'lam');
      }
      m.add(GEO.box, M4(0, 7.1, 0, 0, 0, 0, 20.6, 1.6, 0.7), red, 'lam');
      for (const [z, ry] of [[0.36, 0], [-0.36, Math.PI]]) m.add(GEO.plane, M4(0, 7.1, z, 0, ry, 0, 19.6, 1.45, 1), WHITE, 'lam', { uv: 'gpb' });
      m.add(GEO.box, M4(0, 5.75, 0.1, 0, 0, 0, 3.4, 1.0, 0.35), dark, 'lam');
      for (let i = 0; i < 5; i++) for (const y of [5.55, 5.95])
        m.add(GEO.cyl16, M4(-1.32 + i * 0.66, y, 0.29, Math.PI / 2, 0, 0, 0.15, 0.04, 0.15), lin('#5a0a0a'), 'lam', { uv: 'glow' });
    },
    // sponsor bridge across the track and its run-offs
    bridge(m) {
      const S = 23.8, dark = lin('#30343c');
      for (const s of [-1, 1]) m.add(GEO.box, M4(s * S, 4.6, 0, 0, 0, 0, 2.0, 9.2, 2.0), lin('#c8c8c0'), 'lam');
      m.add(GEO.box, M4(0, 8.4, 0, 0, 0, 0, 2 * S + 2, 2.2, 1.6), dark, 'lam');
      for (const [z, ry] of [[0.81, 0], [-0.81, Math.PI]]) for (let k = 0; k < 11; k++)
        m.add(GEO.plane, M4(-20 + k * 4, 8.4, z, 0, ry, 0, 3.9, 1.9, 1), WHITE, 'lam', { uv: k === 5 ? 'gpb' : 'ad' + ((k * 2) % 9) });
    },
    // braking marker board (v 0..2 = 50 / 100 / 150 m to the corner)
    brk(m, v) {
      m.add(GEO.cyl, M4(0, 0.9, -0.05, 0, 0, 0, 0.05, 1.8, 0.05), lin('#9aa0a8'), 'lam');
      m.add(GEO.box, M4(0, 1.75, -0.03, 0, 0, 0, 1.0, 1.4, 0.06), lin('#1a1a1a'), 'lam');
      m.add(GEO.plane, M4(0, 1.75, 0.005, 0, 0, 0, 0.94, 1.34, 1), WHITE, 'lam', { uv: 'brk' + v });
    },
    // marshal post: a little booth on the barrier with its flag
    marshal(m) {
      m.add(GEO.box, M4(0, 1.3, 0, 0, 0, 0, 2.2, 2.6, 2.0), lin('#f2f2ee'), 'lam');
      m.add(GEO.box, M4(0, 2.0, 1.01, 0, 0, 0, 1.8, 0.9, 0.02), lin('#28323e'), 'lam');
      m.add(GEO.box, M4(0, 2.7, 0, 0, 0, 0, 2.5, 0.2, 2.4), lin('#e86a10'), 'lam');
      m.add(GEO.cyl, M4(1.0, 3.8, 1.0, 0, 0, 0, 0.03, 2.4, 0.03), lin('#c8c8c8'), 'lam');
      m.add(GEO.box, M4(1.4, 4.6, 1.0, 0, 0, 0, 0.8, 0.55, 0.02), lin('#ffd21a'), 'lam');
    },
    // floodlight tower (night circuit): lamp head angled down at the track (+z)
    flood(m) {
      m.add(taper(0.45, 0.25, 8), M4(0, 12, 0, 0, 0, 0, 1, 24, 1), lin('#8a8e96'), 'lam');
      m.add(GEO.box, M4(0, 24.2, 0.3, -0.5, 0, 0, 6.4, 3.2, 0.5), lin('#3a3e46'), 'lam');
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++)
        m.add(GEO.box, M4(-2.25 + i * 1.5, 23.5 + j * 1.35, 0.58 + j * 0.65, -0.5, 0, 0, 1.25, 1.05, 0.1), WHITE, 'lam', { uv: 'glow' });
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
    sign: 'traffic', kmpost: 'traffic', post: 'traffic', gate: 'traffic',
    stand: 'road', pits: 'road', marshal: 'road', flood: 'road', brk: 'traffic', gantry: 'traffic', bridge: 'traffic' };
  return { rider, car, prebuildCars, setCarEnv, driftCar, loadCar, hasCar, preloadCars, proto, M4, v3, link, GEO, FACING, CAR_LIGHTS, posture, kickRoll };
})();
1
