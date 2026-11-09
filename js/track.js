'use strict';
// ============ Themes (tracks) + track generator ============
// light/dark: alternating bands. shoulder = dirt/gravel strip, lane = centre line (light bands only)
const side = rnd => (rnd() < 0.5 ? -1 : 1);
const THEMES = [
  {
    id: 'coast', name: 'Ven biển Mũi Né', desc: 'Hàng dừa, đồi cát, gió biển',
    sky: ['#3a76d0', '#b4defa'], fog: '#c4e2f4', curvy: 0.9, hilly: 0.7, km: true,
    light: { road: '#8a8a8c', grass: '#e2c48c', shoulder: '#cdb68e', lane: '#f2f2f2' },
    dark: { road: '#828284', grass: '#d8b97e', shoulder: '#c2ab82' },
    bg: { sea: 34, islands: '#6f9ab0', islandComps: [[9, 3, 0], [7, 7, 1], [5, 13, 2]],
      near: '#d9b26a', nearComps: [[7, 3, 0.4], [4, 8, 2]], nearBase: 6 },
    place(n, rnd, put) {
      if (n % 4 === 0 && rnd() < 0.6) put('palm', rnd() * 4 | 0, -(1.35 + rnd() * 1.8), 0.14);
      if (n % 4 === 2 && rnd() < 0.5) put('palm', rnd() * 4 | 0, 1.35 + rnd() * 1.8, 0.14);
      if (n % 16 === 8) put('pole', 0, 1.3, 0.3);
      if (rnd() < 0.05) put('bush', 0, side(rnd) * (1.2 + rnd() * 2), 0);
      if (n % 230 === 115) put('billboard', rnd() * 6 | 0, side(rnd) * 1.45, 0.95);
      if (rnd() < 0.007) put('house', rnd() * 5 | 0, side(rnd) * (1.7 + rnd()), 0.9);
    },
  },
  {
    id: 'forest', name: 'Rừng thông Đà Lạt', desc: 'Đồi thông, hoa dã quỳ, dốc cao',
    sky: ['#5a8ed6', '#d6ecff'], fog: '#cadde8', curvy: 1.0, hilly: 1.1, km: true,
    light: { road: '#727276', grass: '#4c9a3e', shoulder: '#9c8a68', lane: '#f2f2f2' },
    dark: { road: '#6c6c70', grass: '#448f38', shoulder: '#907e5e' },
    bg: { far: '#7f9cc0', farComps: [[30, 2, 0.5], [18, 5, 1.2], [8, 11, 2]], farBase: 40,
      near: '#2e6b34', nearComps: [[10, 3, 0.3], [6, 7, 2], [3, 17, 1]], nearBase: 10, nearTrees: '#1d4f24' },
    place(n, rnd, put) {
      if (rnd() < 0.3) put('pine', rnd() * 2 | 0, side(rnd) * (1.3 + rnd() * 2.6), 0.18);
      if (rnd() < 0.04) put('tree', rnd() * 2 | 0, side(rnd) * (1.45 + rnd() * 2), 0.18);
      if (rnd() < 0.08) put('bush', 1 + (rnd() * 2 | 0), side(rnd) * (1.18 + rnd() * 1.4), 0);
      if (n % 16 === 0) put('pole', 0, -1.3, 0.3);
      if (n % 9 === 4 && (n / 400 | 0) % 2) put('fence', 0, 1.22, 0.9, true);
      if (rnd() < 0.005) put('house', rnd() * 5 | 0, side(rnd) * (1.7 + rnd()), 0.9);
      if (n % 300 === 150) put('billboard', rnd() * 6 | 0, side(rnd) * 1.45, 0.95);
    },
  },
  {
    id: 'pass', name: 'Đèo Hải Vân', desc: 'Vách đá, cua tay áo, mây núi',
    sky: ['#3d7fe0', '#c8e6ff'], fog: '#d0e4f2', curvy: 1.25, hilly: 1.3, km: true,
    light: { road: '#7a7a7e', grass: '#7c9a44', shoulder: '#a49274', lane: '#f5d000' },
    dark: { road: '#747478', grass: '#72903e', shoulder: '#98886a' },
    bg: { far: '#5f8a8e', farComps: [[40, 2, 1], [20, 4, 0.2], [10, 9, 2.5]], farBase: 50,
      near: '#4f6a3a', nearComps: [[12, 3, 2], [6, 6, 0.7], [3, 15, 1]], nearBase: 6, nearTrees: '#3a5228' },
    place(n, rnd, put) {
      if (n % 5 === 0) put('cliff', rnd() * 3 | 0, -(1.55 + rnd() * 0.05), 0.95);
      if (n % 3 === 0) put('post', 0, 1.14, 0.8, true);
      if (rnd() < 0.03) put('rock', rnd() * 2 | 0, 1.5 + rnd() * 2, 0.8);
      if (rnd() < 0.05) put(rnd() < 0.5 ? 'pine' : 'tree', rnd() * 2 | 0, 1.7 + rnd() * 2.5, 0.18);
    },
  },
  {
    id: 'city', name: 'Sài Gòn về đêm', desc: 'Phố đông, đèn neon, xe tải',
    sky: ['#07051a', '#3b1d5e'], fog: '#2a1a40', curvy: 0.8, hilly: 0.5, km: false, night: true,
    light: { road: '#46464e', grass: '#6e6e78', shoulder: '#a0a0a8', lane: '#e8e070' },
    dark: { road: '#414149', grass: '#686872', shoulder: '#94949c' },
    bg: { far: 'city', near: 'city' },
    place(n, rnd, put) {
      if (n % 6 === 0) put('building', (n / 6 | 0) % 10, -(1.7 + rnd() * 0.5), 0.9);
      if (n % 6 === 3) put('building', (n / 6 + 5 | 0) % 10, 1.7 + rnd() * 0.5, 0.9);
      if (n % 10 === 0) put('lamp', -1, -1.16, 0.15);
      if (n % 10 === 5) put('lamp', 1, 1.16, 0.15);
      if (rnd() < 0.008) put('billboard', rnd() * 6 | 0, side(rnd) * 1.4, 0.95);
      if (rnd() < 0.02) put('tree', rnd() * 2 | 0, side(rnd) * 1.35, 0.18);
    },
  },
  // ---- closed circuits, MotoGP style: raced over several laps; kerbs, gravel traps, barriers, grandstands, no traffic.
  // pts = corner points [x, y, radius] in metres on the map (y up; driving clockwise = right-hand corners), start = where
  // the start line sits on the main straight (the first edge), hills = elevation waves [metres, phase] round the lap.
  // edge = half width of the tarmac (x5 m), wall = where the barrier stands (x5 m from the centre line)
  {
    id: 'gpIsland', name: 'Trường đua Phú Quốc', desc: 'Ven biển, vòng 4,8 km, thẳng gần 1 km, cua tốc độ cao, kẹp tóc',
    circuit: true, edge: 1.4, wall: 4.4, start: 576, hills: [[1.4, 0.4], [0.7, 2.1], [0.35, 4]],
    pts: [[0, 0, 50], [0, 1050, 28], [130, 1110, 26], [230, 880, 70], [520, 740, 150], [860, 880, 45], [1080, 760, 40], [1000, 500, 90],
      [1060, 330, 24], [990, 260, 24], [1150, 30, 60], [1300, -150, 35], [1150, -300, 26], [700, -260, 110], [420, -120, 60], [300, 40, 40]],
  },
  {
    id: 'gpHills', name: 'Trường đua Tam Đảo', desc: 'Giữa núi rừng, vòng 3,8 km, lên dốc xuống dốc, kẹp tóc, cua chữ S',
    circuit: true, edge: 1.4, wall: 4.4, start: 565, hills: [[16, 0.3], [7, 2.4], [3, 1.1]],
    pts: [[0, 0, 40], [0, 1000, 20], [-140, 1040, 20], [-210, 780, 45], [-430, 700, 50], [-340, 500, 40], [-430, 410, 22], [-780, 390, 30],
      [-900, 200, 45], [-760, 40, 35], [-860, -120, 60], [-560, -220, 40], [-200, -90, 90]],
  },
  {
    id: 'gpNight', name: 'Trường đua đêm Sài Gòn', desc: 'Đua đêm dưới đèn pha, vòng 4,2 km, thẳng dài 1,2 km',
    circuit: true, night: true, edge: 1.4, wall: 4.4, start: 867, hills: [[1, 0], [0.5, 1.3]],
    pts: [[0, 0, 60], [0, 1300, 30], [260, 1380, 55], [390, 1120, 40], [680, 1170, 80], [830, 910, 28], [620, 620, 70], [800, 310, 45],
      [550, 50, 120], [340, -30, 24], [260, -145, 24], [100, -160, 35]],
  },
];

// real-world footprint width (metres) of each roadside object; used for collisions and the 3D models
const PROP_W = { tree: 7.35, pine: 5.75, palm: 6.65, bush: 2, rock: 2.2, cliff: 18.2, house: 7, pole: 1.9, fence: 2.6,
  billboard: 7.6, sign: 1.3, kmpost: 0.5, post: 0.35, lamp: 2.7, building: 13.5, gate: 12,
  stand: 15, pits: 17, gantry: 12, bridge: 12, brk: 1.4, marshal: 3, flood: 3 };

// ---- cornering (shared by the track data, the AI and the bike physics) ----
// grip: lateral acceleration (m/s², arcade-strong) a bike with handling 1 can corner at; drift: how fast (half road-widths/s)
// a bend at the grip limit pushes the bike wide; slide / slideMax: the extra push per unit past the limit and its cap (kept
// just above what full steering holds, so a bike taken in too fast runs a little wide instead of being flung off);
// scrub: speed (x top per s, per unit past the limit) the tyres scrub off meanwhile; steer / resp: lateral speed at full
// lock and how quickly it builds (1/s); aiDecel: the braking the AI plans with (m/s²)
const CORNER = { grip: 46, drift: 1.35, slide: 2.2, slideMax: 1.0, scrub: 0.45, steer: 1.75, resp: 7, aiDecel: 16 };
const SEG_M = CFG.segL * CFG.KZ;      // metres per road segment
const CURV_M = CFG.KC / SEG_M;        // bend curvature (1/m) per unit of seg.curve

// lap of a circuit -> curve per segment (and its corners, for the decoration). Every corner is an arc with eased entry and
// exit; the edges in between are straights (shortened by the corners' tangents). The heading turns by exactly one full
// circle, so the lap closes (the few metres of rounding are spread round the lap by the 3D path).
function circuitLap(def) {
  const V = def.pts, n = V.length, out = [], corners = [];
  const C = V.map((p, k) => {
    const a = V[(k + n - 1) % n], b = V[(k + 1) % n];
    // world heading = atan2(x, z) with x = -map x (the rider's right is world -x) and z = map y
    const h0 = Math.atan2(a[0] - p[0], p[1] - a[1]), h1 = Math.atan2(p[0] - b[0], b[1] - p[1]);
    let th = h1 - h0;
    while (th > Math.PI) th -= 2 * Math.PI;
    while (th < -Math.PI) th += 2 * Math.PI;
    const A = p[2] * Math.abs(th) / SEG_M, nt = Math.round(Math.min(A * 0.4, 26)), nh = Math.max(1, Math.round(A - nt));
    return { th, R: p[2], t: p[2] * Math.tan(Math.abs(th) / 2), nt, nh };
  });
  let main = 0;
  for (let k = 0; k < n; k++) {
    const a = V[k], b = V[(k + 1) % n], ca = C[k], cb = C[(k + 1) % n];
    const len = Math.max(0, Math.hypot(b[0] - a[0], b[1] - a[1]) - ca.t - cb.t - (ca.nt + cb.nt) / 2 * SEG_M);
    for (let i = Math.round(len / SEG_M); i > 0; i--) out.push(0);
    if (k === 0) main = out.length;
    const cv = -cb.th / (cb.nt + cb.nh) / CFG.KC;   // seg.curve > 0 = right-hand bend
    corners.push({ i: out.length, n: cb.nt * 2 + cb.nh, R: cb.R, dir: Math.sign(cv) });
    for (let i = 0; i < cb.nt; i++) out.push(cv * (i + 0.5) / cb.nt);
    for (let i = 0; i < cb.nh; i++) out.push(cv);
    for (let i = 0; i < cb.nt; i++) out.push(cv * (cb.nt - i - 0.5) / cb.nt);
  }
  return { curves: out, corners, main };
}

// per-segment racing data. vlim: the speed (m/s) the AI may carry here so it can still make the bends ahead with its
// braking. Circuits also get: line = the racing line (-1..1 of the half width, + = right: outside, apex, outside again),
// kerb = red-and-white kerbs on both edges, gravel = the side (-1 left / +1 right) of a gravel trap (outside of a bend)
function raceData(segs, N, loop) {
  const c = i => segs[loop ? ((i % N) + N) % N : U.clamp(i, 0, N - 1)].curve;
  const vc = new Float64Array(N), v = new Float64Array(N), D2 = 2 * CORNER.aiDecel * SEG_M;
  for (let i = 0; i < N; i++) v[i] = vc[i] = Math.min(140, Math.sqrt(CORNER.grip / Math.max(1e-5, Math.abs(c(i)) * CURV_M)));
  for (let pass = 0; pass < (loop ? 2 : 1); pass++)
    for (let i = N - 1; i >= 0; i--) {
      const nx = i + 1 < N ? v[i + 1] : loop ? v[0] : 140;
      v[i] = Math.min(vc[i], Math.sqrt(nx * nx + D2));
    }
  for (let i = 0; i < N; i++) segs[i].vlim = v[i];
  if (!loop) return;
  const f = x => Math.tanh(x / 4), raw = new Float64Array(N);
  for (let i = 0; i < N; i++) raw[i] = 0.85 * f(c(i)) - 0.6 * f(c(i + 55)) - 0.45 * f(c(i - 45));
  for (let i = 0; i < N; i++) {
    const s = segs[i];
    let sum = 0;
    for (let k = -25; k <= 25; k++) sum += raw[(i + k + N) % N];
    s.line = U.clamp(sum / 51, -0.8, 0.8);
    let g = 0, kb = 0;
    for (let k = -80; k <= 10; k += 2) { const cc = c(i + k); if (Math.abs(cc) > Math.abs(g)) g = cc; }
    for (let k = -14; k <= 14; k += 2) kb = Math.max(kb, Math.abs(c(i + k)));
    s.gravel = Math.abs(g) > 4 ? -Math.sign(g) : 0;
    s.kerb = kb > 3;
  }
}

const Track = {
  build(theme, level, seed) {
    if (theme.circuit) return Track.circuit(theme, level, seed);
    const rnd = U.rng(seed), segs = [], L = CFG.segL;
    const lastY = () => segs.length ? segs[segs.length - 1].p2.world.y : 0;
    let heading = 0;   // accumulated curve (heading = -heading * KC), kept bounded so the road never loops
    function add(curve, y) {
      const n = segs.length;
      heading += curve;
      segs.push({ index: n, curve, sprites: [], p1: { world: { y: lastY(), z: n * L } }, p2: { world: { y, z: (n + 1) * L } } });
    }
    function road(enter, hold, leave, curve, hill) {
      const sy = lastY(), ey = sy + hill * L, tot = enter + hold + leave;
      for (let i = 0; i < enter; i++) add(U.easeIn(0, curve, i / enter), U.easeInOut(sy, ey, i / tot));
      for (let i = 0; i < hold; i++) add(curve, U.easeInOut(sy, ey, (enter + i) / tot));
      for (let i = 0; i < leave; i++) add(U.easeInOut(curve, 0, i / leave), U.easeInOut(sy, ey, (enter + hold + i) / tot));
    }
    // flip a curve's direction if it would turn the road too far from its overall direction
    const steer = (cv, len) => Math.abs((heading + cv * len) * CFG.KC) > CFG.headMax ? -cv : cv;
    const signs = [];
    const C = [2, 3.5, 5].map(v => v * theme.curvy), HH = [12, 25, 45].map(v => v * theme.hilly);
    road(0, 90, 0, 0, 0);
    const target = 4000 + level * 700;
    while (segs.length < target) {
      const t = rnd();
      let cv = (rnd() < 0.5 ? -1 : 1) * C[Math.min(2, Math.floor(rnd() * 3))];
      cv = steer(cv, t < 0.45 ? 100 : t < 0.6 ? 45 : 140);
      const dir = Math.sign(cv);
      let h = HH[Math.floor(rnd() * 3)] * (rnd() < 0.5 ? -1 : 1);
      if (Math.abs(lastY() / L + h) > 140) h = -h;
      if (t < 0.15) road(25, 50 + rnd() * 60 | 0, 25, 0, rnd() < 0.5 ? h : 0);
      else if (t < 0.45) { signs.push([segs.length, dir]); road(25, 40 + rnd() * 60 | 0, 25, cv, rnd() < 0.5 ? h : 0); }
      else if (t < 0.6) {
        signs.push([segs.length, dir]); road(20, 25, 20, cv, 0);
        signs.push([segs.length, -dir]); road(20, 25, 20, -cv, h);
      }
      else if (t < 0.75) { road(25, 25, 25, 0, h); road(25, 25, 25, 0, -h); }
      else if (t < 0.85) { for (let i = 0; i < 4; i++) road(8, 8, 8, 0, (i % 2 ? -1 : 1) * 4 * theme.hilly); }
      else { signs.push([segs.length, dir]); road(50, 100, 50, cv * 0.6, h); }
    }
    road(0, 120, 0, 0, 0);
    const finishIdx = segs.length;
    road(0, 700, 0, 0, 0);

    // ---- decorate ----  put(name, variant, offset, collisionFraction, soft)
    // offset = inner edge (road side) in half road-widths; w = full width in half road-widths
    const putter = s => (name, v, offset, col, soft) =>
      s.sprites.push({ name, v, offset, col, soft: !!soft, w: PROP_W[name] / CFG.KX });
    const startIdx = 40;
    for (let n = 50; n < segs.length; n++) {
      if (Math.abs(n - finishIdx) < 3) continue;
      theme.place(n, rnd, putter(segs[n]));
      if (theme.km && n % 100 === 0) putter(segs[n])('kmpost', n / 100 | 0, 1.2, 0.6);
    }
    for (const [i, d] of signs) for (let k = 0; k < 3; k++) {
      const s = segs[i + k * 8];
      if (s) putter(s)('sign', d, -d * 1.22, 0.4);
    }
    segs[startIdx].sprites.push({ name: 'gate', v: 0, offset: 0, anchor: 'c', col: 0, w: PROP_W.gate / CFG.KX });
    segs[finishIdx].sprites.push({ name: 'gate', v: 1, offset: 0, anchor: 'c', col: 0, w: PROP_W.gate / CFG.KX });
    for (const i of [startIdx, startIdx + 1, finishIdx, finishIdx + 1]) segs[i].checker = true;
    raceData(segs, segs.length, false);
    return { segs, startZ: 30 * L, finishZ: finishIdx * L };
  },

  laps: level => level >= 3 ? 3 : 2,
  // a closed circuit: one lap of segments, repeated (the same objects) for every lap and a cool-down lap after the flag.
  // The start / finish line is segment LINE of the lap; the grid lines up just behind it
  circuit(theme, level, seed) {
    const rnd = U.rng(seed), L = CFG.segL, LINE = 40, lp = circuitLap(theme);
    // rotate the lap so that the line (segment LINE) lies `start` metres into the main straight
    const s0 = Math.max(0, Math.round(theme.start / SEG_M) - LINE), N = lp.curves.length;
    const curves = lp.curves.slice(s0).concat(lp.curves.slice(0, s0)), at = i => ((i - s0) % N + N) % N;
    const ys = curves.map((_, i) => theme.hills.reduce((y, [a, ph], k) => y + a * Math.sin(2 * Math.PI * (k + 1) * i / N + ph), 0) / CFG.KY);
    const lap = curves.map((curve, i) => ({ index: i, curve, sprites: [], p1: { world: { y: ys[i], z: i * L } }, p2: { world: { y: ys[(i + 1) % N], z: (i + 1) * L } } }));
    raceData(lap, N, true);
    const laps = Track.laps(level), finishIdx = LINE + laps * N, segs = [];
    for (let i = 0; i < finishIdx + 900; i++) segs.push(lap[i % N]);
    const mainEnd = at(lp.main);   // first segment after the main straight
    Track.decorateCircuit(theme, lap, lp.corners.map(c => Object.assign({}, c, { i: at(c.i) })), mainEnd, rnd);
    lap[LINE].checker = lap[LINE + 1].checker = true;
    // the map for the HUD: every 12th point of the lap, closed the same way as the 3D path
    const map = [];
    let x = 0, z = 0, h = 0;
    for (let i = 0; i < N; i++) {
      if (i % 12 === 0) map.push([x, z]);
      const h2 = h - curves[i] * CFG.KC, hm = (h + h2) / 2;
      x += Math.sin(hm) * SEG_M; z += Math.cos(hm) * SEG_M; h = h2;
    }
    map.forEach((p, k) => { p[0] -= x * k * 12 / N; p[1] -= z * k * 12 / N; });
    // the pit lane runs beside the main straight, behind the pit wall on the right
    const pit = [((mainEnd - Math.round(670 / SEG_M)) % N + N) % N, ((mainEnd - Math.round(80 / SEG_M)) % N + N) % N];
    return { segs, startZ: 30 * L, finishZ: finishIdx * L, lapN: N, laps, lineZ: LINE * L, map, pit };
  },

  // grandstands and pit garages along the main straight, the start gantry, braking boards before the slow corners,
  // grandstands round the hairpins, marshal posts, a bridge over the longest back straight, floodlights at night
  decorateCircuit(theme, lap, corners, mainEnd, rnd) {
    const N = lap.length, W = theme.wall, E = theme.edge, seg = m => Math.round(m / SEG_M);
    const put = (i, name, v, offset, col, soft) =>
      lap[((i % N) + N) % N].sprites.push({ name, v, offset, col: col || 0, soft: !!soft, w: PROP_W[name] / CFG.KX });
    lap[40].sprites.push({ name: 'gantry', v: 0, offset: 0, anchor: 'c', col: 0, w: PROP_W.gantry / CFG.KX });
    for (let m = 90, k = 0; m < 650; m += 31, k++) put(mainEnd - seg(m), 'pits', k % 4, W + 1.9);
    for (let m = 60; m < 760; m += 48) put(mainEnd - seg(m), 'stand', 0, -(W + 0.6));
    for (const c of corners) {
      const out = -c.dir;   // outside of the bend
      if (c.R <= 60) for (const [k, d] of [[2, 150], [1, 100], [0, 50]]) put(c.i - seg(d), 'brk', k, out * (E + 0.75), 0.6, true);
      if (c.R <= 30) for (let k = 0; k < 2; k++) put(c.i + seg(10 + k * 34), 'stand', 1, out * (W + 0.7));
    }
    for (let i = 0, k = 0; i < N - seg(120); i += seg(240), k++) put(i + seg(30), 'marshal', 0, (k % 2 ? 1 : -1) * (W + 0.25));
    // the longest straight away from the pits gets a bridge
    let best = null, run = 0;
    for (let i = 0; i < N; i++) {
      run = lap[i].curve === 0 ? run + 1 : 0;
      if (run > 160 && Math.abs(i - mainEnd) > 400 && (!best || run > best.run)) best = { i: i - (run >> 1), run };
    }
    if (best) lap[best.i].sprites.push({ name: 'bridge', v: 0, offset: 0, anchor: 'c', col: 0, w: PROP_W.bridge / CFG.KX });
    if (theme.night) for (let i = 0, k = 0; i < N - seg(30); i += seg(56), k++) put(i, 'flood', 0, (k % 2 ? 1 : -1) * (W + 0.35));
  },
};
