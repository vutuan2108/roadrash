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
];

// real-world footprint width (metres) of each roadside object; used for collisions and the 3D models
const PROP_W = { tree: 7.35, pine: 5.75, palm: 6.65, bush: 2, rock: 2.2, cliff: 18.2, house: 7, pole: 1.9, fence: 2.6,
  billboard: 7.6, sign: 1.3, kmpost: 0.5, post: 0.35, lamp: 2.7, building: 13.5, gate: 12 };

const Track = {
  build(theme, level, seed) {
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
    return { segs, startZ: 30 * L, finishZ: finishIdx * L };
  },
};
