'use strict';
// ============ Drift mode: cars, drift maps (mountain passes + a night arena), car physics, drift scoring ============
// The car moves freely on the ground plane in world metres (X / Z like the 3D world). Heading psi: forward = (sin psi,
// cos psi), psi grows when turning left. Body frame: u forward, v left, yaw rate w (+ = turning left), steer + = left.
// The tracks are chains of road segments like the bike races (so World / Path build them unchanged); the car is
// projected back onto the centre line for the walls, the surface, progress and laps.

// ---------------- cars ----------------
// Real drift favourites in drift-build trim (about 45% more power than stock), tuned for an arcade feel. a / b: centre of mass to the front / rear axle (m), h: its
// height, torque (Nm) at the peak of the curve (pk = fraction of the redline), gears + final drive, R: tyre radius,
// drag: 1/2 rho Cd A, mu / pk: tyre grip and the slip angle (rad) of its peak, slide: grip left once a tyre slides,
// lock: steering lock (rad), steerIn: how far the keys steer at walking pace, maxAng: drift angle the assist holds to,
// len / hw: body ends and half width for the walls. voice: engine sound (see Sound.engine). real: the real car in one line
// (the garage), vmax: the game's top speed (km/h, measured flat out for 40 s; the garage)
const DRIFT_CARS = [
  { name: 'Toyota AE86 Trueno', model: 'ae86', price: 0, color: '#f2f2f0', hp: 190, kg: 950, vmax: 231, real: '4A-GE 1.6L 4 máy · zin 130 mã lực · 200 km/h',
    mass: 960, a: 1.12, b: 1.28, h: 0.48, torque: 230, pk: 0.74, redline: 7800, idle: 950, gears: [3.59, 2.02, 1.38, 1.0, 0.86],
    final: 4.3, R: 0.29, drag: 0.352, muF: 1.08, muR: 1.14, pkF: 0.13, pkR: 0.11, slide: 0.84, lock: 0.8, steerIn: 0.62, brake: 1.0,
    maxAng: 1.0, turbo: false, voice: [30, 250, 330, 2300, 0.26, 2] },
  { name: 'Nissan Silvia S15', model: 's15', price: 18000, color: '#f0c419', hp: 360, kg: 1240, vmax: 312, real: 'SR20DET 2.0L 4 máy turbo · zin 250 mã lực · 250 km/h',
    mass: 1240, a: 1.15, b: 1.375, h: 0.48, torque: 435, pk: 0.62, redline: 7500, idle: 900, gears: [3.32, 1.9, 1.31, 1.0, 0.76, 0.59],
    final: 4.08, R: 0.31, drag: 0.28, muF: 1.1, muR: 1.16, pkF: 0.12, pkR: 0.105, slide: 0.84, lock: 0.82, steerIn: 0.6, brake: 1.05,
    maxAng: 1.02, turbo: true, voice: [29, 240, 310, 2200, 0.22, 2] },
  { name: 'Mazda RX-7 FD3S', model: 'fd', price: 26000, color: '#c0161e', hp: 405, kg: 1280, vmax: 310, real: '13B-REW rotary twin-turbo · zin 280 mã lực · 250 km/h',
    mass: 1280, a: 1.21, b: 1.21, h: 0.46, torque: 465, pk: 0.7, redline: 8000, idle: 1000, gears: [3.48, 2.02, 1.39, 1.0, 0.76],
    final: 4.1, R: 0.32, drag: 0.264, muF: 1.1, muR: 1.16, pkF: 0.12, pkR: 0.105, slide: 0.85, lock: 0.84, steerIn: 0.62, brake: 1.08,
    maxAng: 1.05, turbo: true, voice: [40, 320, 420, 2900, 0.12, 3] },
  { name: 'Toyota Supra A80', model: 'supra', price: 40000, color: '#e8650f', hp: 465, kg: 1500, vmax: 337, real: '2JZ-GTE 3.0L 6 máy twin-turbo · zin 320 mã lực · 250 km/h',
    mass: 1510, a: 1.2, b: 1.35, h: 0.49, torque: 680, pk: 0.55, redline: 7000, idle: 850, gears: [3.83, 2.36, 1.69, 1.31, 1.0, 0.79],
    final: 3.27, R: 0.33, drag: 0.288, muF: 1.1, muR: 1.16, pkF: 0.12, pkR: 0.105, slide: 0.84, lock: 0.82, steerIn: 0.58, brake: 1.1,
    maxAng: 0.98, turbo: true, voice: [33, 270, 340, 2400, 0.1, 1.5] },
  { name: 'Ford Mustang GT', model: 'mustang', price: 55000, color: '#1f6fd0', hp: 650, kg: 1720, vmax: 354, real: 'Coyote 5.0L V8 · zin 460 mã lực · 250 km/h',
    mass: 1720, a: 1.28, b: 1.44, h: 0.52, torque: 810, pk: 0.6, redline: 7400, idle: 750, gears: [3.66, 2.43, 1.69, 1.32, 1.0, 0.65],
    final: 3.55, R: 0.35, drag: 0.336, muF: 1.12, muR: 1.18, pkF: 0.12, pkR: 0.105, slide: 0.84, lock: 0.8, steerIn: 0.56, brake: 1.12,
    maxAng: 1.0, turbo: false, voice: [24, 200, 250, 1500, 0.44, 1.5] },
  // from the player's own 3D models (car/*.glb -> js/g3/gr86.js, s15c.js). GR86 (ZN8) stock: 2.4 L FA24 boxer, 228 hp at
  // 7000 rpm, 250 Nm, 1270 kg, the real 6-speed and 4.30 final drive; here with a turbo kit like the others (+45 %)
  { name: 'Toyota GR86 Pandem', model: 'gr86', price: 14000, color: '#c0161e', hp: 330, kg: 1280, vmax: 281, real: 'FA24 2.4L 4 máy boxer · zin 228 mã lực · 226 km/h',
    mass: 1280, a: 1.21, b: 1.365, h: 0.46, torque: 360, pk: 0.6, redline: 7500, idle: 800, gears: [3.626, 2.188, 1.541, 1.213, 1.0, 0.767],
    final: 4.3, R: 0.328, drag: 0.3, muF: 1.1, muR: 1.16, pkF: 0.12, pkR: 0.105, slide: 0.84, lock: 0.84, steerIn: 0.62, brake: 1.08,
    maxAng: 1.02, turbo: true, voice: [27, 230, 300, 2100, 0.3, 2] },
  // S15 pro-am drift build: SR20DET with a big turbo (about 350 hp on the street, +45 % here like the others), stripped
  // with a cage (1190 kg), angle kit, 4.3 final drive on the Spec-R 6-speed
  { name: 'Nissan Silvia S15 Custom', model: 's15c', price: 60000, color: '#f2f2f0', hp: 500, kg: 1190, vmax: 340, real: 'SR20DET độ turbo lớn · ~350 mã lực ngoài đời',
    mass: 1190, a: 1.135, b: 1.39, h: 0.47, torque: 560, pk: 0.62, redline: 8000, idle: 950, gears: [3.32, 1.9, 1.31, 1.0, 0.76, 0.59],
    final: 4.3, R: 0.342, drag: 0.33, muF: 1.12, muR: 1.18, pkF: 0.12, pkR: 0.105, slide: 0.84, lock: 0.9, steerIn: 0.62, brake: 1.12,
    maxAng: 1.08, turbo: true, voice: [31, 250, 330, 2400, 0.3, 2] },
  // ---- from the player's 3D models in car/ (built into js/g3/<model>.js). Real figures in `real`; in the game the
  // drift-build rule as above (about +45 % power and torque), gears / final drive / redline / weight as the real cars
  // Datsun 280Z (S30): L28E 2.8 L six, 170 hp (early rating) at 5600 rpm, 221 Nm at 4400 rpm, about 1270 kg; 5-speed
  { name: 'Datsun 280Z', model: 'z280', price: 9000, color: '#e8650f', hp: 250, kg: 1270, vmax: 236, real: 'L28E 2.8L 6 máy thẳng hàng · zin 170 mã lực · 205 km/h',
    mass: 1270, a: 1.083, b: 1.222, h: 0.5, torque: 320, pk: 0.68, redline: 6500, idle: 750, gears: [3.321, 2.077, 1.308, 1.0, 0.864],
    final: 3.9, R: 0.324, drag: 0.36, muF: 1.08, muR: 1.14, pkF: 0.13, pkR: 0.11, slide: 0.84, lock: 0.82, steerIn: 0.62, brake: 1.0,
    maxAng: 1.0, turbo: true, voice: [26, 220, 290, 1900, 0.3, 2] },
  // Nissan Skyline GT-R R34: RB26DETT 2.6 L twin-turbo six, 280 PS at 6800 rpm, 392 Nm, 1560 kg, Getrag 6-speed
  // 3.827 / 2.360 / 1.685 / 1.312 / 1.000 / 0.793, final 3.545. Four-wheel drive in real life - rear drive here (drift build)
  { name: 'Nissan Skyline GT-R R34', model: 'r34', price: 45000, color: '#1f6fd0', hp: 400, kg: 1560, vmax: 336, real: 'RB26DETT 2.6L 6 máy twin-turbo · zin 280 mã lực · 250 km/h',
    mass: 1560, a: 1.2, b: 1.465, h: 0.5, torque: 570, pk: 0.55, redline: 8000, idle: 900, gears: [3.827, 2.36, 1.685, 1.312, 1.0, 0.793],
    final: 3.545, R: 0.328, drag: 0.31, muF: 1.12, muR: 1.18, pkF: 0.12, pkR: 0.105, slide: 0.84, lock: 0.82, steerIn: 0.6, brake: 1.12,
    maxAng: 1.0, turbo: true, voice: [33, 260, 330, 2400, 0.22, 2] },
  // Mazda RX-7 FD3S, VeilSide Fortune kit: 13B-REW twin-rotor sequential twin-turbo, 280 PS stock (6500 rpm, 314 Nm),
  // about 400 hp as the tuned show car; 5-speed 3.483 / 2.015 / 1.391 / 1.000 / 0.719, final 4.1
  { name: 'Mazda RX-7 VeilSide Fortune', model: 'rx7vs', price: 52000, color: '#e8650f', hp: 580, kg: 1310, vmax: 348, real: '13B-REW rotary twin-turbo độ · ~400 mã lực · 280 km/h',
    mass: 1310, a: 1.2125, b: 1.2125, h: 0.46, torque: 650, pk: 0.62, redline: 8000, idle: 1000, gears: [3.483, 2.015, 1.391, 1.0, 0.719],
    final: 4.1, R: 0.34, drag: 0.29, muF: 1.12, muR: 1.18, pkF: 0.12, pkR: 0.105, slide: 0.85, lock: 0.86, steerIn: 0.62, brake: 1.1,
    maxAng: 1.05, turbo: true, voice: [40, 320, 420, 2900, 0.12, 3] },
  // Mazda RX-7 FD3S, BN Sports BLS kit: built 13B rotary, about 600 hp on the street (BN Sports BLS build); capped here
  { name: 'Mazda RX-7 BN Sports', model: 'rx7bn', price: 75000, color: '#c0161e', hp: 700, kg: 1250, vmax: 331, real: '13B rotary độ lớn · ~600 mã lực (bản BN Sports BLS)',
    mass: 1250, a: 1.2125, b: 1.2125, h: 0.46, torque: 720, pk: 0.65, redline: 8500, idle: 1100, gears: [3.483, 2.015, 1.391, 1.0, 0.719],
    final: 4.3, R: 0.319, drag: 0.32, muF: 1.14, muR: 1.2, pkF: 0.12, pkR: 0.105, slide: 0.85, lock: 0.9, steerIn: 0.62, brake: 1.15,
    maxAng: 1.08, turbo: true, voice: [42, 330, 440, 3000, 0.16, 3] },
  // Porsche 911 GT2 (993): 3.6 L twin-turbo flat six, 430 PS at 5750 rpm, 540 Nm, 1295 kg, rear drive, 6-speed
  // (ratios estimated from the 993 Turbo box), 0-100 4.4 s, 295 km/h. Rear engine: 38 % of the weight on the front
  { name: 'Porsche 911 GT2 (993)', model: 'gt2', price: 65000, color: '#f0c419', hp: 615, kg: 1295, vmax: 321, real: '3.6L 6 máy boxer twin-turbo · zin 430 mã lực · 295 km/h',
    mass: 1295, a: 1.409, b: 0.863, h: 0.48, torque: 780, pk: 0.66, redline: 6800, idle: 900, gears: [3.82, 2.15, 1.56, 1.21, 0.97, 0.75],
    final: 3.44, R: 0.323, drag: 0.3, muF: 1.12, muR: 1.2, pkF: 0.12, pkR: 0.105, slide: 0.84, lock: 0.8, steerIn: 0.58, brake: 1.15,
    maxAng: 0.98, turbo: true, voice: [30, 240, 320, 2100, 0.28, 2] },
  // Ferrari F40, Liberty Walk kit: 2.9 L twin-turbo V8, 478 PS at 7000 rpm, 577 Nm at 4000 rpm, about 1250 kg, 5-speed
  // (ratios estimated to its 324 km/h at the 7750 redline), 0-100 4.1 s. Mid engine: 42 % on the front
  { name: 'Ferrari F40 LB-Works', model: 'f40', price: 90000, color: '#c0161e', hp: 685, kg: 1254, vmax: 313, real: '2.9L V8 twin-turbo · zin 478 mã lực · 324 km/h',
    mass: 1254, a: 1.421, b: 1.029, h: 0.45, torque: 835, pk: 0.52, redline: 7750, idle: 950, gears: [2.077, 1.474, 1.13, 0.917, 0.759],
    final: 3.9, R: 0.317, drag: 0.3, muF: 1.14, muR: 1.2, pkF: 0.12, pkR: 0.105, slide: 0.84, lock: 0.8, steerIn: 0.58, brake: 1.15,
    maxAng: 1.0, turbo: true, voice: [28, 230, 310, 2100, 0.26, 2] },
];
// body ends (rear, front) and half width of each model, for the walls
const DRIFT_BODY = { ae86: [-2.0, 2.18, 0.83], s15: [-2.2, 2.25, 0.86], fd: [-2.1, 2.19, 0.88], supra: [-2.24, 2.28, 0.9], mustang: [-2.36, 2.43, 0.96],
  gr86: [-2.22, 2.17, 0.97], s15c: [-2.4, 2.2, 0.98], z280: [-2.1, 2.18, 0.88], r34: [-2.38, 2.22, 0.95], rx7vs: [-2.2, 2.13, 0.97],
  rx7bn: [-2.25, 2.2, 0.98], gt2: [-1.88, 2.3, 0.93], f40: [-1.92, 2.5, 1.0] };
const DRIFT_PAINTS = ['#f2f2f0', '#14161a', '#8e949c', '#c0161e', '#e8650f', '#f0c419', '#2f8a3a', '#1f6fd0', '#16245a', '#6a2c91', '#e85aa0', '#20b8b0'];

// ---------------- maps ----------------
// Mountain passes are point-to-point: a list of moves ['S', metres] straight, ['L' | 'R', degrees, radius] corners;
// drop = metres the road falls from start to finish, waves = [metres, waves over the run, phase] of rise and fall.
// The arena is a closed circuit like the GP tracks (corner points [x, y, radius]). edge = half width of the tarmac and
// wall = the guard rail / barrier (x5 m from the centre line). grades: scores for C, B, A, S, SS
const DRIFT_MAPS = [
  {
    id: 'dMaPiLeng', name: 'Đèo Mã Pí Lèng', desc: 'Hà Giang · 5,5 km vách đá, vực Nho Quế, cua tay áo, ba đoạn zíc zắc, hai đoạn rắn lượn',
    edge: 1.8, wall: 2.15, drop: 115, waves: [[7, 4, 0.4], [3, 11, 1.3]], centre: 'double',
    grades: [40000, 105000, 210000, 350000, 540000],
    seq: [['S', 150], ['L', 55, 70], ['S', 60], ['R', 85, 38], ['S', 40], ['L', 40, 60], ['R', 45, 50], ['S', 90],
      ['L', 165, 18], ['S', 110], ['R', 150, 21], ['S', 80],
      ['L', 70, 34], ['R', 80, 30], ['L', 75, 32], ['R', 60, 36], ['S', 70],                          // zig-zag
      ['L', 35, 80], ['R', 35, 80], ['S', 110], ['R', 170, 17], ['S', 130], ['L', 160, 19], ['S', 90],
      ['R', 65, 42], ['L', 100, 27], ['S', 60], ['R', 120, 24], ['S', 80], ['L', 60, 45], ['S', 120],
      ['R', 90, 30], ['L', 90, 30], ['R', 90, 30], ['L', 90, 30], ['S', 100],                        // the snake
      ['R', 175, 20], ['S', 120], ['L', 175, 20], ['S', 150],
      ['R', 50, 40], ['L', 70, 35], ['R', 70, 35], ['L', 50, 40], ['S', 80],
      ['R', 140, 24], ['S', 70], ['L', 130, 26], ['S', 100],
      ['L', 60, 34], ['R', 75, 30], ['L', 75, 30], ['R', 60, 34], ['S', 80],                         // second zig-zag
      ['L', 170, 19], ['S', 110], ['R', 170, 19], ['S', 140],                                        // hairpin pair
      ['L', 85, 28], ['R', 90, 28], ['L', 90, 28], ['R', 85, 28], ['S', 90],                         // second snake
      ['R', 120, 24], ['S', 60], ['L', 45, 50], ['R', 45, 50], ['S', 160]],
  },
  {
    id: 'dOQuyHo', name: 'Đèo Ô Quy Hồ', desc: 'Sa Pa · 5,3 km rừng thông hoàng hôn, mười cua kẹp tóc, các khúc ngoặt liên hoàn',
    edge: 1.8, wall: 2.15, drop: 140, waves: [[6, 5, 1.1], [2.5, 12, 0.2]], centre: 'dash',
    grades: [31000, 73000, 150000, 270000, 440000],
    seq: [['S', 150], ['R', 45, 90], ['S', 50], ['L', 70, 45], ['S', 70],
      ['R', 175, 17], ['S', 150], ['L', 175, 17], ['S', 150], ['R', 175, 18], ['S', 120],
      ['L', 80, 40], ['R', 60, 45], ['L', 50, 55], ['S', 90], ['R', 110, 26], ['S', 60], ['L', 140, 22], ['S', 100],
      ['R', 40, 70], ['L', 40, 70], ['S', 80], ['L', 170, 18], ['S', 140], ['R', 170, 18], ['S', 110],
      ['L', 90, 32], ['S', 50], ['R', 75, 36], ['S', 120],
      ['L', 60, 38], ['R', 85, 32], ['L', 85, 32], ['R', 85, 32], ['L', 60, 38], ['S', 90],          // linked bends
      ['R', 160, 20], ['S', 100], ['L', 160, 20], ['S', 80],
      ['R', 45, 50], ['L', 70, 36], ['R', 90, 30], ['L', 70, 36], ['S', 100],
      ['R', 175, 18], ['S', 130], ['L', 175, 18], ['S', 130], ['R', 175, 18], ['S', 100],          // three more hairpins
      ['L', 65, 34], ['R', 85, 30], ['L', 85, 30], ['R', 85, 30], ['L', 65, 34], ['S', 90],         // linked bends
      ['R', 110, 26], ['S', 50], ['L', 110, 26], ['S', 180]],
  },
  {
    id: 'dArena', name: 'Sân drift đêm Bình Dương', desc: 'Sân kín dưới đèn pha · đường rộng 22 m · 27 khúc cua mỗi vòng, nối tiếp nhau',
    circuit: true, night: true, edge: 2.2, wall: 3.0, start: 187, laps: 3, hills: [[0.6, 0.3]],
    grades: [29000, 70000, 140000, 280000, 460000],
    // corners of 26 m and more (the barriers stand 15 m from the centre line), chicanes breaking up the straights
    pts: [[0, 0, 37], [24, 286, 26], [0, 357, 31], [48, 414, 26], [119, 433, 26], [175, 372, 26], [255, 348, 31], [212, 212, 27],
      [271, 162, 26], [348, 161, 31], [381, 233, 26], [450, 272, 34], [508, 220, 26], [586, 212, 26], [542, 127, 26], [561, 34, 37],
      [501, -27, 26], [416, -42, 26], [456, -109, 26], [450, -187, 29], [372, -249, 26], [272, -255, 34], [233, -177, 26], [161, -127, 26],
      [51, -187, 29], [-5, -102, 26], [19, -52, 26]],
  },
];

// ---------------- track building ----------------
const DriftTrack = {
  // a pass: moves -> curve per segment; corners: { i, n, dir, R } for the chevron boards
  moves(seq) {
    const out = [], corners = [];
    for (const s of seq) {
      if (s[0] === 'S') { for (let i = Math.round(s[1] / SEG_M); i > 0; i--) out.push(0); continue; }
      const dir = s[0] === 'R' ? 1 : -1, th = s[1] * Math.PI / 180, R = s[2];
      const A = R * th / SEG_M, nt = Math.round(Math.min(A * 0.35, 22)), nh = Math.max(1, Math.round(A - nt));
      const cv = dir * th / (nt + nh) / CFG.KC;
      corners.push({ i: out.length, n: nt * 2 + nh, dir, R });
      for (let i = 0; i < nt; i++) out.push(cv * (i + 0.5) / nt);
      for (let i = 0; i < nh; i++) out.push(cv);
      for (let i = 0; i < nt; i++) out.push(cv * (nt - i - 0.5) / nt);
    }
    return { curves: out, corners };
  },
  // centre line in world metres, exactly as World's Path builds it (a lap is closed by spreading the rounding)
  centre(curves, ys, loop) {
    const N = curves.length, X = new Float64Array(N + 1), Z = new Float64Array(N + 1), Hd = new Float64Array(N + 1), Y = new Float32Array(N + 1);
    let x = 0, z = 0, h = 0;
    for (let i = 0; i < N; i++) {
      X[i] = x; Z[i] = z; Hd[i] = h; Y[i] = ys[i];
      const h2 = h - curves[i] * CFG.KC, hm = (h + h2) / 2;
      x += Math.sin(hm) * SEG_M; z += Math.cos(hm) * SEG_M; h = h2;
    }
    X[N] = x; Z[N] = z; Hd[N] = h; Y[N] = loop ? ys[0] : ys[N - 1];
    if (loop) { const ex = X[N] - X[0], ez = Z[N] - Z[0]; for (let i = 0; i <= N; i++) { X[i] -= ex * i / N; Z[i] -= ez * i / N; } }
    return { N, X, Z, H: Hd, Y, loop };
  },
  build(map, seed) {
    return map.circuit ? this.arena(map, seed) : this.pass(map, seed);
  },
  pass(map, seed) {
    const L = CFG.segL, LEAD = 40, TAIL = 320, mv = this.moves(map.seq);
    const curves = new Array(LEAD).fill(0).concat(mv.curves, new Array(TAIL).fill(0));
    const corners = mv.corners.map(c => Object.assign(c, { i: c.i + LEAD }));
    const finishIdx = LEAD + mv.curves.length, N = curves.length;
    // the road falls `drop` metres from the line to the finish, with a few rises and dips on the way
    const ym = i => {
      const f = U.clamp((i - LEAD) / (finishIdx - LEAD), 0, 1), ease = Math.sin(Math.PI * f);
      return map.drop * (1 - f) + map.waves.reduce((s, [a, n, ph]) => s + a * Math.sin(2 * Math.PI * n * f + ph) * ease, 0);
    };
    const ys = curves.map((_, i) => ym(i) / CFG.KY);
    const segs = curves.map((curve, i) => ({ index: i, curve, sprites: [], p1: { world: { y: ys[i] } }, p2: { world: { y: ys[Math.min(N - 1, i + 1)] } } }));
    const ctr = this.centre(curves, ys.map(y => y * CFG.KY), false);
    const LINE = 30;
    segs[LINE].checker = segs[LINE + 1].checker = true;
    segs[finishIdx].checker = segs[finishIdx + 1].checker = true;
    this.decoratePass(map, segs, corners, ctr, U.rng(seed), LINE, finishIdx);
    return { segs, ctr, startZ: 22 * L, lineZ: LINE * L, finishZ: finishIdx * L, lapN: 0, laps: 1, map: this.mapPts(ctr, 8), corners };
  },
  arena(map, seed) {
    const L = CFG.segL, LINE = 40, lp = circuitLap(map);
    const s0 = Math.max(0, Math.round(map.start / SEG_M) - LINE), N = lp.curves.length;
    const curves = lp.curves.slice(s0).concat(lp.curves.slice(0, s0)), at = i => ((i - s0) % N + N) % N;
    const ys = curves.map((_, i) => map.hills.reduce((y, [a, ph], k) => y + a * Math.sin(2 * Math.PI * (k + 1) * i / N + ph), 0) / CFG.KY);
    const lap = curves.map((curve, i) => ({ index: i, curve, sprites: [], p1: { world: { y: ys[i] } }, p2: { world: { y: ys[(i + 1) % N] } } }));
    raceData(lap, N, true);
    const laps = map.laps, finishIdx = LINE + laps * N, segs = [];
    for (let i = 0; i < finishIdx + 600; i++) segs.push(lap[i % N]);
    const ctr = this.centre(curves, ys.map(y => y * CFG.KY), true);
    lap[LINE].checker = lap[LINE + 1].checker = true;
    const corners = lp.corners.map(c => Object.assign({}, c, { i: at(c.i) }));
    this.decorateArena(map, lap, corners, at(lp.main), U.rng(seed));
    return { segs, ctr, startZ: (LINE - 12) * L, lineZ: LINE * L, finishZ: finishIdx * L, lapN: N, laps, map: this.mapPts(ctr, 8), corners };
  },
  mapPts(ctr, step) { const out = []; for (let i = 0; i <= ctr.N; i += step) out.push([ctr.X[i], ctr.Z[i]]); return out; },

  // ---- scenery: chevron boards round the corners, trees / rocks beyond the rails (never near another leg of the road)
  decoratePass(map, segs, corners, ctr, rnd, line, fin) {
    const N = segs.length, W = map.wall, grid = new Map(), cell = (x, z) => Math.floor(x / 40) * 100000 + Math.floor(z / 40);
    for (let i = 0; i <= ctr.N; i += 3) { const k = cell(ctr.X[i], ctr.Z[i]); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(i); }
    // is a prop of radius r (m) at a world point clear of the road: of its own stretch (it may sit just behind the rail)
    // and with a few metres to spare from any other leg (switchbacks, the inside of hairpins)
    const clear = (x, z, n, r) => {
      const own = W * CFG.KX + r - 0.3, other = W * CFG.KX + r + 3;
      for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++) {
        const a = grid.get((Math.floor(x / 40) + gx) * 100000 + Math.floor(z / 40) + gz); if (!a) continue;
        for (const i of a) if (Math.hypot(x - ctr.X[i], z - ctr.Z[i]) < (Math.abs(i - n) > 40 ? other : own)) return false;
      }
      return true;
    };
    const put = (n, name, v, off) => {   // off = inner edge, half road-widths from the centre line (+ = right)
      if (n < 0 || n >= N) return;
      const w = PROP_W[name] / CFG.KX, cx = off + Math.sign(off) * w / 2, h = ctr.H[n];
      const x = ctr.X[n] - Math.cos(h) * cx * CFG.KX, z = ctr.Z[n] + Math.sin(h) * cx * CFG.KX;
      if (!clear(x, z, n, w * CFG.KX / 2)) return;
      segs[n].sprites.push({ name, v, offset: off, col: 0, soft: false, w });
    };
    for (const c of corners) {   // chevrons on the outside of every corner, closer together on the tight ones
      const step = c.R < 30 ? 7 : 10, out = -c.dir;
      for (let k = Math.round(c.n * 0.15); k < c.n * 0.92; k += step) put(c.i + k, 'sign', c.dir, out * (W + 0.04));
    }
    const forest = map.id === 'dOQuyHo';
    for (let n = 50; n < N - 10; n++) {
      if (Math.abs(n - line) < 4 || Math.abs(n - fin) < 4) continue;
      const s = rnd() < 0.5 ? -1 : 1;
      if (forest) {
        if (rnd() < 0.2) put(n, 'pine', rnd() * 2 | 0, s * (W + 0.35 + rnd() * 2.4));
        if (rnd() < 0.03) put(n, 'tree', rnd() * 2 | 0, s * (W + 0.5 + rnd() * 2));
        if (rnd() < 0.05) put(n, 'bush', 1 + (rnd() * 2 | 0), s * (W + 0.15 + rnd() * 1.2));
        if (n % 18 === 0) put(n, 'pole', 0, W + 0.3);
      } else {
        if (rnd() < 0.035) put(n, 'rock', rnd() * 2 | 0, s * (W + 0.2 + rnd() * 1.5));
        if (rnd() < 0.05) put(n, rnd() < 0.4 ? 'pine' : 'tree', rnd() * 2 | 0, s * (W + 0.4 + rnd() * 2.5));
        if (rnd() < 0.05) put(n, 'bush', rnd() * 3 | 0, s * (W + 0.15 + rnd() * 1));
      }
    }
    // start / finish arches scaled up (k) so their posts stand outside the rails of the wide road
    const k = Math.max(1, (W * CFG.KX + 0.7) / 6.4);
    segs[line].sprites.push({ name: 'gate', v: 0, offset: 0, anchor: 'c', col: 0, w: PROP_W.gate * k / CFG.KX, k });
    segs[fin].sprites.push({ name: 'gate', v: 1, offset: 0, anchor: 'c', col: 0, w: PROP_W.gate * k / CFG.KX, k });
  },
  // the arena: start gantry, grandstands along the main straight and round the hairpins, floodlights all round
  decorateArena(map, lap, corners, mainEnd, rnd) {
    const N = lap.length, W = map.wall, seg = m => Math.round(m / SEG_M);
    const put = (i, name, v, offset) => lap[((i % N) + N) % N].sprites.push({ name, v, offset, col: 0, soft: false, w: PROP_W[name] / CFG.KX });
    const k = Math.max(1, (W * CFG.KX + 0.5) / 9.9);   // the gantry's pillars outside the barriers
    lap[40].sprites.push({ name: 'gantry', v: 0, offset: 0, anchor: 'c', col: 0, w: PROP_W.gantry * k / CFG.KX, k });
    for (let m = 40; m < 230; m += 34) put(mainEnd - seg(m), 'stand', 0, -(W + 0.6));
    for (const c of corners) {
      const out = -c.dir;
      if (c.R <= 40 && c.n * SEG_M / c.R > 0.9) put(c.i + seg(c.R * 0.6), 'stand', 1, out * (W + 0.7));   // round the sharper corners
    }
    for (let i = 0, k = 0; i < N - seg(30); i += seg(46), k++) put(i, 'flood', 0, (k % 2 ? 1 : -1) * (W + 0.35));
    for (let i = seg(25), k = 0; i < N - seg(60); i += seg(160), k++) put(i, 'marshal', 0, (k % 2 ? 1 : -1) * (W + 0.25));
  },
};

// ---------------- physics helpers ----------------
// lateral grip of a tyre against slip / peak slip: rises to 1 at the peak, then falls a little as it slides
const tyreCurve = x => { const a = Math.abs(x), y = a < 1 ? a * (2 - a) : Math.max(0.8, 1 - (a - 1) * 0.1); return x < 0 ? -y : y; };
// engine torque (fraction of the peak) against rpm / redline
const torqueCurve = (x, pk) => U.clamp(1 - Math.pow((x - pk) / (x < pk ? pk + 0.1 : 1.3 - pk), 2) * (x < pk ? 0.55 : 0.5), 0.3, 1);
const smoothK = (a, b, x) => { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// scoring: points per second = angle factor x km/h x rate; a chain banks after `gap` s without drifting; the
// multiplier grows every multT s of drifting and with every change of direction; `wall` m from the rail = close bonus
// crash: speed (m/s) into the rail (or another car) that loses the whole chain (a softer brush only costs 30% of it)
// tandem: drifting within this many metres of another drifting car scores x1.5
const DSCORE = { minKmh: 22, minAng: 12, rate: 6, gap: 1.6, multT: 3, maxMult: 5, wall: 1.0, spin: 112, crash: 3.5, tandem: 7 };
// tyres take TRACTION x more grip straight ahead (launch, braking) than sideways; brakes BRAKE_K x the car's value
const TRACTION = 1.35, BRAKE_K = 1.3;
// a drift keeps its angle this long (s) after the keys stop pointing into the bend
const HOLD_T = 0.7, SWING_T = 0.35;
// drift assist gains (angular acceleration per radian of angle error / per rad/s of its rate)
const DASSIST = { kp: 16, kd: 6 };
// path assist while drifting: acc = most sideways pull (m/s²), base / lift = pull with no key (on / off the throttle),
// tow / away = added / taken away by the keys towards / away from the bend, k = how firmly the path follows
// scrub: speed bled off while drifting (m/s² at 72 km/h, growing with the square of the speed) per unit of sin(angle)
// and with the keys held into the bend
// feint: how long (s) the rear lets go when the wheel is held hard over in a bend taken too fast
const PATH = { acc: 17, base: 0.55, lift: 0.3, tow: 0.45, away: 1.5, k: 0.85, scrubAng: 2.2, scrubTow: 3, feint: 0.3 };
// gripping (not drifting): at speed, once the front tyres wash wide, the keys may pull the car round harder than its
// tyres alone - up to acc m/s², fading in from v0 to v1 m/s - so straightening out of a drift fast still makes the
// next bend (it never helps the rear, so the throttle can still kick the tail out)
const GRIP = { acc: 13, k: 0.8, v0: 10, v1: 22 };
// steering: keys = how fast the key input builds (1/s), rate = how fast the front wheels turn (rad/s), fade = speed (m/s)
// at which the lock the keys give is halved, drift = how far the keys turn the wheels on top of the counter-steer
const STEER = { keys: 12, rate: 6.5, fade: 24, drift: 0.19 };
// a computer driver in tandem behind the player: gap = centre to centre (m), k = how hard it closes it (m/s per m),
// follow = how far back (m) it takes the player's line and drifts
const TANDEM = { gap: 6.5, k: 0.7, follow: 30 };
// the rubber band for a computer car far behind the player: fast = how much faster it dares into the bends, boost = how
// much more its tyres / the path assist pull round a bend and how much less speed its drifts shed (x 1 + boost), push =
// the most unseen push along its way on the straights (m/s²)
const CHASE = { fast: 0.3, boost: 0.45, push: 4.5 };
const DRIFT_RANKS = ['C', 'B', 'A', 'S', 'SS'];

// computer drivers: names, the most of them, metres between grid rows. Each gets a skill 0..1 (how fast it dares into
// the bends, how tight a bend gets a handbrake flick and how long the flick is) and a line of its own across the road
const DRIFT_AI = {
  names: ['Tùng Khói', 'Khoa Lốp Mòn', 'Bảo Tay Lái', 'Hùng Phanh Tay', 'Minh Đuôi Cá', 'Long Đèo'],
  max: 5, grid: 7.5,
};

class DriftRace {
  // o: { mapIdx, carIdx, paint, ais (computer drivers), seed?, aiSeed?, net? }. net = { me, cars: [{ id, name, car, paint }] }
  // for an online race: the cars of the other players (remote: no physics here, Net moves them) in the server's grid order
  constructor(o) {
    this.drift = true; this.local = true;
    this.mapIdx = o.mapIdx; this.def = DRIFT_MAPS[o.mapIdx];
    const d = this.def;
    // what World needs to know about the stage (it keys its look by theme.id)
    this.theme = { id: d.id, name: d.name, night: !!d.night, circuit: !!d.circuit, edge: d.edge, wall: d.wall, centre: d.centre };
    const tr = DriftTrack.build(d, o.seed || (o.mapIdx * 977 + 41));
    Object.assign(this, { segs: tr.segs, startZ: tr.startZ, lineZ: tr.lineZ, finishZ: tr.finishZ, lapN: tr.lapN, laps: tr.laps,
      map: tr.map, ctr: tr.ctr });
    this.circuit = !!d.circuit; this.E = d.edge; this.wall = d.wall; this.pit = null;
    this.hwM = d.edge * CFG.KX; this.wallM = d.wall * CFG.KX;
    this.cars = []; this.bodies = []; this.police = null; this.msgs = []; this.pops = [];
    this.time = 0; this.clock = 0; this.count = 3; this.lastBeep = 4;   // (3, 2, 1, go) this.shake = 0; this.over = null; this.lapShown = 1;
    this.state = 'countdown'; this.camMode = 0;
    const spec = DRIFT_CARS[o.carIdx];
    this.carIdx = o.carIdx; this.paint = o.paint || spec.color;
    const c = this.car = this.mkCar(o.carIdx, this.paint, 'BẠN');
    c.isPlayer = true;
    this.racers = [c];
    if (o.net) {   // online: the others as remote cars, everyone on the grid in the server's order
      this.online = true; this.hold = true;   // (the countdown waits for the server's go)
      const grid = [];
      for (const n of o.net.cars) {
        if (n.id === o.net.me) { c.netId = n.id; grid.push(c); continue; }
        const r = this.mkCar(U.clamp(n.car | 0, 0, DRIFT_CARS.length - 1), n.paint, n.name);
        r.remote = true; r.netId = n.id;
        this.racers.push(r); grid.push(r);
      }
      if (!grid.includes(c)) grid.push(c);
      const front = tr.lineZ / CFG.segL - 4 / SEG_M;
      grid.forEach((r, k) => this.place(r, front - (k >> 1) * DRIFT_AI.grid / SEG_M, (k % 2 ? 1 : -1) * 2.6));
      this.player = { z: this.startZ, x: 0, speed: 0, top: 50 / CFG.KZ, pal: { id: 'dcar' }, lean: 0, pitch: 0, crash: null, isPlayer: true, lap: 1 };
      this.syncPlayer();
      return;
    }
    // the computer drivers: cars of about the player's class, a spread of skills, their own paint and line
    const rnd = o.aiSeed !== undefined ? U.rng(o.aiSeed) : Math.random, nAi = U.clamp(o.ais | 0, 0, DRIFT_AI.max);
    const names = DRIFT_AI.names.slice().sort(() => rnd() - 0.5), paints = DRIFT_PAINTS.filter(p => p !== this.paint).sort(() => rnd() - 0.5);
    // cars ranked by power to weight: the computer drivers get one a step below, the same or a step above the player's
    const rankd = DRIFT_CARS.map((_, i) => i).sort((a, b) => DRIFT_CARS[a].hp / DRIFT_CARS[a].mass - DRIFT_CARS[b].hp / DRIFT_CARS[b].mass);
    for (let k = 0; k < nAi; k++) {
      const ci = rankd[U.clamp(rankd.indexOf(o.carIdx) + Math.floor(rnd() * 3) - 1, 0, DRIFT_CARS.length - 1)];
      const a = this.mkCar(ci, paints[k % paints.length], names[k]);
      const skill = U.clamp((nAi > 1 ? 0.2 + 0.75 * k / (nAi - 1) : 0.6) + (rnd() - 0.5) * 0.15, 0, 1);
      a.ai = { skill, fast: 0.98 + 0.27 * skill, hbR: 40 + 22 * skill, hb: 0.28 + 0.22 * skill, lane: (rnd() - 0.5) * 3, hbT: 0, hbCool: 0, stuckT: 0,
        react: 0.1 + rnd() * 0.6 };   // reaction to the green light (s): the field strings out before the first bend
      this.racers.push(a);
    }
    // the grid: alone on the centre line; with company two abreast behind the line, the player in the second row
    if (this.racers.length === 1) this.place(c, tr.startZ / CFG.segL, 0);
    else {
      const front = tr.lineZ / CFG.segL - 4 / SEG_M, ps = Math.min(2, this.racers.length - 1);
      const order = this.racers.slice(1); order.splice(ps, 0, c);
      order.forEach((r, k) => this.place(r, front - (k >> 1) * DRIFT_AI.grid / SEG_M, (k % 2 ? 1 : -1) * 2.6));
    }
    this.player = { z: this.startZ, x: 0, speed: 0, top: 50 / CFG.KZ, pal: { id: 'dcar' }, lean: 0, pitch: 0, crash: null, isPlayer: true, lap: 1 };
    this.syncPlayer();
  }
  mkCar(ci, paint, name) {
    const spec = DRIFT_CARS[ci];
    return { spec, carIdx: ci, paint, name, isPlayer: false, ai: null, body: DRIFT_BODY[spec.model], I: spec.mass * spec.a * spec.b * 1.05,
      pq: {}, wq: {}, placed: false, auto: true,
      px: 0, pz: 0, psi: 0, vx: 0, vz: 0, w: 0, steer: 0, sIn: 0, ax: 0, ay: 0,
      u: 0, v: 0, beta: 0, gear: 1, nextGear: 1, shiftT: 0, revT: 0, rpm: spec.idle, spin: 0, kick: 0, clutch: false, limiter: false,
      drive: 0, brk: 0, hand: false, gas: 0, nitro: 0.5, nitroOn: false, surf: 1, seg: 0, sAbs: 0, al: 0, off: 0, h: 0, y: 0, slope: 0,
      rearSlide: 0, frontSlide: 0, wheelSpin: 0, smoke: 0, hit: 0, hitT: 0, bump: 0, bumpT: 0, near: 99, wrongT: 0, backfire: 0, lastGas: 0,
      drifting: false, dside: 1, dk: 0, dTarget: 0, pathK: 0, toward: 0, holdT: 0, awayT: 0, swing: false, fRatio: 0, bPrev: 0, feintT: 0, looseT: 0,
      score: 0, chain: null, best: { chain: 0, angle: 0, kmh: 0, time: 0 }, hits: 0, bumps: 0, fin: 0, gone: false, tan: 0, boost: 1, push: 0 };
  }
  // the player's numbers (the HUD, the results and the tests read them off the race)
  get score() { return this.car.score; }
  set score(v) { this.car.score = v; }
  get chain() { return this.car.chain; }
  get best() { return this.car.best; }
  get hits() { return this.car.hits; }
  get auto() { return this.car.auto; }
  riders() { return []; }
  msg(text, col, dur, size) { this.msgs.push({ text, col: col || '#fff', t: dur || 1.6, size }); if (this.msgs.length > 3) this.msgs.shift(); }
  pop(text, col) { this.pops.push({ text, col: col || '#7fff7f', t: 1.4 }); if (this.pops.length > 4) this.pops.shift(); }

  // put car c on segment f (fraction allowed), n metres right of the centre line, facing down the road, stopped
  place(c, f, n) {
    const C = this.ctr, i = U.clamp(Math.floor(f), 0, C.N - 1), t = f - Math.floor(f), h = C.H[i] + (C.H[i + 1] - C.H[i]) * t;
    c.px = C.X[i] + (C.X[i + 1] - C.X[i]) * t - Math.cos(h) * n; c.pz = C.Z[i] + (C.Z[i + 1] - C.Z[i]) * t + Math.sin(h) * n;
    c.psi = h; c.vx = c.vz = c.w = 0; c.steer = c.sIn = 0; c.ax = c.ay = 0; c.kick = 0; c.spin = 0; c.drifting = false; c.dk = 0; c.bPrev = 0;
    const q = this.project(c.px, c.pz, i, c.pq);
    if (!c.placed) { c.sAbs = q.i; c.placed = true; }
    else { let d = q.i - c.seg; if (C.loop) { if (d > C.N / 2) d -= C.N; if (d < -C.N / 2) d += C.N; } c.sAbs += d; }
    c.seg = q.i; c.al = q.al; c.off = q.n; c.h = q.h; c.y = q.y; c.slope = q.slope;
  }

  // nearest point of the centre line to (x, z), searching round segment `hint`: nearest point i, the segment j + t the
  // point lies on, al = along from i (in segments), offset n (m, + = right), heading h, road height y, slope
  project(x, z, hint, out) {
    const C = this.ctr, N = C.N, loop = C.loop;
    let best = -1, bd = Infinity;
    for (let k = -14; k <= 14; k++) {
      let i = hint + k;
      if (loop) i = ((i % N) + N) % N; else if (i < 0 || i > N) continue;
      const dx = x - C.X[i], dz = z - C.Z[i], d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    const h0 = C.H[best], dx = x - C.X[best], dz = z - C.Z[best];
    const along = (dx * Math.sin(h0) + dz * Math.cos(h0)) / SEG_M;
    let j = best, t = along;
    if (t < 0) { j--; t += 1; }
    if (loop) j = ((j % N) + N) % N; else if (j < 0) { j = 0; t = 0; } else if (j >= N) { j = N - 1; t = 1; }
    t = U.clamp(t, 0, 1);
    out.i = best; out.j = j; out.t = t; out.al = along; out.n = -dx * Math.cos(h0) + dz * Math.sin(h0);
    out.h = C.H[j] + (C.H[j + 1] - C.H[j]) * t;
    out.y = C.Y[j] + (C.Y[j + 1] - C.Y[j]) * t; out.slope = (C.Y[j + 1] - C.Y[j]) / SEG_M;
    return out;
  }

  static readKeys() {
    return { steer: (Input.is('right') ? 1 : 0) - (Input.is('left') ? 1 : 0), gas: Input.is('up'), brake: Input.is('down'),
      hand: Input.is('hand'), clutch: Input.is('clutch'), nitro: Input.is('nitro'),
      up: Input.pressed('gearUp'), dn: Input.pressed('gearDn'), mode: Input.pressed('gearMode'),
      cam: Input.pressed('cam'), reset: Input.pressed('reset'), horn: Input.pressed('horn') };
  }

  // inp: optional scripted input for the player (tests); otherwise the keyboard
  update(dt, inp) {
    this.shake = Math.max(0, this.shake - dt * 2);
    inp = inp || DriftRace.readKeys();
    let held = false;
    if (this.state === 'countdown') {
      if (!this.hold) this.count -= dt;   // (online: not before the server says go)
      const k = Math.ceil(this.count);
      if (k !== this.lastBeep) { this.lastBeep = k; if (k > 0) Sound.beep(440, 0.15); }
      if (this.count <= 0) { this.state = 'racing'; Sound.beep(880, 0.4); this.msg('ĐI!', '#7fff7f', 1, 56); }
      else { held = true; inp = Object.assign({}, inp, { brake: true, held: true, steer: 0 }); }   // held on the line, clutch in: the throttle only revs it (it bites at the green)
    } else { this.clock += dt; if (!this.over) this.time += dt; }
    if (this.over) inp = { steer: 0, gas: false, brake: true };
    if (inp.cam) this.camMode = (this.camMode + 1) % 3;
    if (inp.horn && Sound.horn) Sound.horn();
    if (inp.reset && this.state === 'racing' && !this.over) this.resetCar(this.car);
    const live = this.racers.filter(c => !c.gone);
    for (const c of live) {
      if (c.remote) continue;   // (another player's car: Net places it)
      const wait = held || (!c.isPlayer && this.clock < c.ai.react);
      this.control(c, c.isPlayer ? inp : wait ? { gas: true, brake: true, held: true, steer: 0 } : this.aiInput(c, dt), dt);
    }
    this.step(live, dt);
    for (const c of live) {
      if (c.remote) { this.trackRemote(c); continue; }
      this.track(c, dt);
      if (this.state === 'racing') this.scoring(c, dt);
      this.feedback(c, dt);
    }
    if (this.racers.length > 1) this.layTrail();
    this.syncPlayer();
    if (this.msgs.length) { this.msgs[0].t -= dt; if (this.msgs[0].t <= 0) this.msgs.shift(); }
    for (const p of this.pops) p.t -= dt;
    if (this.pops.length && this.pops[0].t <= 0) this.pops.shift();
    if (this.over) this.over.t += dt;
  }
  // physics in four sub-steps; the cars knock into each other after each
  step(list, dt) {
    for (let k = 0; k < 4; k++) {
      for (const c of list) if (!c.remote) this.physics(c, dt / 4);
      if (list.length > 1) this.collide(list);
    }
  }
  syncPlayer() {
    const P = this.player, c = this.car;
    P.z = (c.sAbs + c.al) * CFG.segL; P.x = c.off / CFG.KX; P.speed = Math.hypot(c.vx, c.vz) / CFG.KZ;
    P.lap = this.lapOf();
  }
  lapOf() { return this.circuit ? U.clamp(Math.floor((this.player.z - this.lineZ) / (this.lapN * CFG.segL)) + 1, 1, this.laps) : 1; }
  progress(c) { c = c || this.car; return U.clamp(((c.sAbs + c.al) * CFG.segL - this.lineZ) / (this.finishZ - this.lineZ), 0, 1); }
  resetCar(c = this.car) {
    if (c.chain) this.loseChain(c, 'ĐẶT LẠI XE');
    this.place(c, c.seg + 0.5, U.clamp(c.off, 1.5 - this.hwM, this.hwM - 1.5));
    c.gear = 1; c.shiftT = 0; c.rpm = c.spec.idle;
    if (c.isPlayer) this.msg('ĐẶT LẠI XE', '#9fe0ff', 1.2, 26);
  }

  // ---------------- a computer driver: the speed the bends ahead allow, a line of its own (round slower cars), pure
  // pursuit on the direction of travel, a handbrake flick into the tight bends ----------------
  aiInput(c, dt) {
    const A = c.ai, C = this.ctr, N = C.N, SEG = SEG_M, spd = Math.hypot(c.vx, c.vz);
    const idx = i => C.loop ? ((i % N) + N) % N : U.clamp(i, 0, N);
    const curv = i => { let d = C.H[idx(i)] - C.H[idx(i + 4)]; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d / (4 * SEG); };
    let vt = 60, lane = A.lane, brake = false;
    // the chase: gap = metres the player is ahead (+) or behind (-). Behind the player, the pace rises with the gap
    // until it has caught up; well ahead of the player, it eases off and waits, so the field stays round the player
    const P = this.car, mm = (c.sAbs + c.al) * SEG, gap = (P.sAbs + P.al) * SEG - mm;
    const chase = !c.fin && !P.fin && this.state === 'racing' && Math.abs(gap) < 400;
    // (an arcade rubber band besides: far behind, an unseen push along the way it goes - not through the tyres, so it
    // never lights them up - and drifts that shed less speed; boost 1 = none)
    let fast = A.fast;
    c.boost = 1; c.push = 0;
    if (chase) {
      if (gap > 9) { fast *= 1 + Math.min(CHASE.fast, (gap - 9) / 100); c.boost = 1 + Math.min(CHASE.boost, (gap - 9) / 60); c.push = U.clamp((gap - 25) / 6, 0, CHASE.push); }
      else if (gap < -25) fast *= Math.max(0.8, 1 + (gap + 25) / 150);
    }
    if (c.fin) { vt = 8; lane = this.hwM - 2.2; }   // finished: pull over to the right and roll to a stop
    else for (let k = 2; k < 140; k += 2) {
      const R = 1 / Math.max(Math.abs(curv(c.seg + k)), 1e-4), vc = Math.sqrt(9.81 * R) * fast;
      vt = Math.min(vt, Math.sqrt(vc * vc + 2 * 7 * k * SEG));
    }
    // close behind the player (30 m): the player's line, and a drift where the player drifted (no flicks of its own).
    // The first car behind the player (nobody between) also holds a tandem gap: about two metres between the bumpers.
    // Further back: its own driving, the rubber band and free nitro to catch up
    const la = 7 + spd * 0.55;
    let tandem = false, follow = false;
    if (chase && gap > 20) c.nitro = Math.min(1, c.nitro + dt * 0.12);
    if (chase && gap > 1.5 && gap < TANDEM.follow && Math.hypot(P.vx, P.vz) > 8) {   // (the player crawling: go past instead)
      follow = true;
      const ln = this.trailAt(mm + la), here = this.trailAt(mm + 3);
      if (ln && gap > TANDEM.gap - 0.5) lane = U.clamp(ln.off, 1.6 - this.hwM, this.hwM - 1.6);   // (alongside: keep out of its way)
      if (here && here.d && !c.drifting && spd > 12 && A.hbCool <= 0) { A.hbT = 0.28; A.hbCool = 1.5; }
      tandem = gap > TANDEM.gap - 0.5 && gap < 28 && !this.racers.some(o => o !== c && o !== P && !o.gone && !o.fin && (o.sAbs + o.al) * SEG > mm && (o.sAbs + o.al) * SEG < mm + gap);
      if (tandem) {
        const pv = Math.hypot(P.vx, P.vz), at = this.trailAt(mm), want = TANDEM.gap;
        // the speed the player carried through here (it can be done) plus a bit to close the gap, minus to open it
        const base = at ? at.v : pv;
        vt = Math.max(4, Math.min(Math.max(vt, base), base + (gap - want) * TANDEM.k));
        c.push = c.drifting ? 0 : U.clamp((gap - want) * 0.45, 0, 4);   // reel the player in (not mid-drift: it would run wide)
        // closing fast (the player braking for a bend): brake in time to stop a car's length short
        const close = spd - pv;
        if ((gap < want - 1 && close > -0.3) || (close > 0 && gap - want + 1 < close * close / 12)) { brake = true; c.push = 0; }
      }
    }
    // traffic: the nearest car in our way (alongside, or ahead and closing in). In a bend (or while either drifts) it
    // queues up behind it, a couple of car lengths back - a tandem; on the straights it goes round it on the side with
    // room, keeping a drifting car's swing apart, or waits behind it
    const me = c.sAbs + c.al, room = this.hwM - 1.9, GAP = 4.6;
    let bend = false;
    for (let k = 0; k < 40 && !bend; k += 4) bend = Math.abs(curv(c.seg + k)) > 1 / 70;
    let near = null, nd = 1e9;
    for (const o of this.racers) {
      if (o === c || o.gone || (tandem && o === P)) continue;   // (the tandem keeps its own distance to the player)
      let d = o.sAbs + o.al - me;
      if (C.loop) { d = ((d % N) + N) % N; if (d > N / 2) d -= N; }
      const dm = d * SEG, close = spd - Math.hypot(o.vx, o.vz);
      if (dm < -5 || dm > 10 + Math.max(0, close) * 1.8 || Math.abs(o.off - c.off) > GAP) continue;
      if (Math.abs(dm) < nd) { nd = Math.abs(dm); near = { o, dm, close }; }
    }
    if (near && near.dm > 0 && near.dm < 14) c.push = 0;   // (no pushing into the car ahead)
    if ((bend || c.drifting) && !tandem) c.push = Math.min(c.push, 0.6);   // (the push is for the straights: in a bend it ran them wide)
    if (near && near.dm > 0 && near.dm < 4.6) {   // alongside (overlapping): move over to the side with room and drop back
      const { o, close } = near, dl = o.off - c.off;
      let l = dl > 0 ? o.off - GAP : o.off + GAP;
      if (Math.abs(l) > room) l = dl > 0 ? o.off + GAP : o.off - GAP;
      lane = U.clamp(l, -room, room); if (close > -2) brake = true;
    } else if (near && near.dm > 0 && (bend || c.drifting || near.o.drifting)) {
      const { o, dm, close } = near, os = Math.hypot(o.vx, o.vz);
      const keep = o.drifting ? 9.5 : 8;   // (a drifting tail swings out)
      if (dm < keep || (close > 0 && dm - keep + 1 < close * close / 12)) { if (close > -1.5) brake = true; } else vt = Math.min(vt, os + (dm - keep) * 0.6);
    } else if (near) {
      const { o, dm, close } = near, dl = o.off - c.off, G2 = GAP + (o.drifting ? 1.2 : 0);   // (a drifting car swings wider)
      let l = dl > 0 ? o.off - G2 : o.off + G2;
      if (Math.abs(l) > room) l = dl > 0 ? o.off + G2 : o.off - G2;   // no room that side: the other
      if (Math.abs(l) > room) {   // no room either side: hang back
        l = U.clamp(l, -room, room);
        if (dm > 0 && close > -1 && dm < 7 + close * 1.5) brake = true; else if (dm > 0) vt = Math.min(vt, Math.hypot(o.vx, o.vz));
      } else if (dm > 0 && close > 0 && dm - 6 < close * close / 12 && Math.abs(c.off - l) > 1.5) brake = true;   // not across yet: no charging in
      lane = l;
    }
    // where to go: a point ahead on our line; analogue steering towards it
    const ti = idx(c.seg + Math.round(la / SEG)), h = C.H[ti];
    const tx = C.X[ti] - Math.cos(h) * lane, tz = C.Z[ti] + Math.sin(h) * lane;
    let e = Math.atan2(tx - c.px, tz - c.pz) - (spd > 2 ? Math.atan2(c.vx, c.vz) : c.psi);
    while (e > Math.PI) e -= 2 * Math.PI; while (e < -Math.PI) e += 2 * Math.PI;
    // a tight bend coming: a flick of the handbrake as it turns in
    A.hbCool -= dt; A.hbT -= dt;
    const R2 = 1 / Math.max(Math.abs(curv(c.seg + Math.round(18 / SEG))), 1e-4);
    // (behind the player and chasing, only into the tight ones: every drift sheds speed)
    const hbR = c.boost > 1 ? Math.min(A.hbR, 34) : A.hbR;
    if (!c.fin && !follow && R2 < hbR && spd > 12 && !c.drifting && A.hbCool <= 0) { A.hbT = A.hb; A.hbCool = 2.5; }
    // stuck against something or facing the wrong way: back on the road
    if (spd < 1.5 && this.state === 'racing' && !c.fin) A.stuckT += dt; else A.stuckT = 0;
    if (A.stuckT > 2.5 || c.wrongT > 1.2) { this.resetCar(c); A.stuckT = 0; c.wrongT = 0; }
    const nitro = !c.fin && !c.drifting && (A.skill > 0.35 || (chase && gap > 20)) && c.nitro > 0.25 && vt > spd + 6;
    // steering: drifting, a softer hand that never holds full lock into the bend (holding it scrubs a lot of speed);
    // following, never so much lock that the tail lets go (a feint) where the player did not drift
    let steer = U.clamp(-e * 3.2, c.drifting ? -0.9 : -1, c.drifting ? 0.9 : 1);
    if (!c.drifting && A.hbT <= 0 && (c.boost > 1 || (follow && !(this.trailAt(mm + 6) || {}).d))) steer = U.clamp(steer, -0.82, 0.82);
    A.vt = vt; A.mode = tandem ? 'T' : follow ? 'F' : chase && gap > 9 ? 'C' : '-';   // (for the tests)
    return { steer, gas: spd < vt && !brake, brake: spd > vt * 1.12 || brake, hand: A.hbT > 0, nitro };
  }

  // ---------------- driver controls: gears, clutch, throttle, brakes, steering ----------------
  control(c, inp, dt) {
    const S = c.spec, sn = Math.sin(c.psi), cs = Math.cos(c.psi);
    const u = c.vx * sn + c.vz * cs, v = c.vx * cs - c.vz * sn, spd = Math.hypot(c.vx, c.vz);
    c.u = u; c.v = v;
    // gearbox: automatic by default; E / Q shift (and switch to manual), T toggles automatic
    if (inp.mode) { c.auto = !c.auto; if (c.isPlayer) this.msg(c.auto ? 'SỐ TỰ ĐỘNG' : 'SỐ TAY (E lên số, Q xuống số)', '#9fe0ff', 1.6, 24); }
    if ((inp.up || inp.dn) && c.auto) { c.auto = false; if (c.isPlayer) this.msg('SỐ TAY (T: về số tự động)', '#9fe0ff', 1.4, 24); }
    const ratio = g => g > 0 ? S.gears[g - 1] : g < 0 ? -3.4 : 0;
    const kRpm = g => Math.abs(ratio(g)) * S.final / S.R * 60 / (2 * Math.PI);   // engine rpm per m/s at the rear tyres
    const shift = g => {
      if (g === c.gear || c.shiftT > 0 || g > S.gears.length || g < 1) return;
      c.nextGear = g; c.shiftT = 0.09; if (c.isPlayer && Sound.shift) Sound.shift();
    };
    if (c.shiftT > 0) { c.shiftT -= dt; if (c.shiftT <= 0) { c.gear = c.nextGear; c.shiftT = 0; } }
    if (!c.auto && c.gear >= 1) { if (inp.up) shift(c.gear + 1); if (inp.dn) shift(c.gear - 1); }
    // forward gears: up = throttle, down = brake (held while stopped: reverse); in reverse it is the other way round
    let gas = 0, brk = 0;
    if (c.gear >= 1) {
      gas = inp.gas ? 1 : 0; brk = inp.brake ? 1 : 0;
      if (inp.brake && !inp.gas && !inp.held && spd < 0.8) { c.revT += dt; if (c.revT > 0.35) { c.gear = -1; c.revT = 0; c.shiftT = 0; } } else c.revT = 0;
    } else {
      gas = inp.brake ? 1 : 0; brk = inp.gas ? 1 : 0;
      if (inp.gas && !inp.brake && spd < 0.8) { c.gear = 1; c.shiftT = 0; }
    }
    if (inp.gas && inp.brake && c.gear >= 1) { gas = 1; brk = 0.5; }   // left-foot braking
    if (inp.held) { brk = 1; }
    const rpmRoad = Math.abs(u) * kRpm(c.gear);
    // drift state (with some hysteresis): the rear is sliding with the nose turned into the bend; dside = +1 when the
    // nose points left of where the car is going (a left-hand drift)
    const beta = u > 1 ? Math.atan2(v, u) : 0, ab = Math.abs(beta);
    // it ends once the car is (nearly) straight and no longer swinging - not when the rear tyres stop spinning, which
    // with the throttle held they may never do
    if (!c.drifting) { if (u > 4 && ab > 0.17 && c.rearSlide > 0.55) { c.drifting = true; c.dside = -Math.sign(beta); c.dTarget = ab; } }
    else if (u < 3 || (ab < 0.1 && Math.abs(c.w) < 0.6 && !c.swing)) c.drifting = false;
    else if (-Math.sign(beta) !== c.dside && ab > 0.09) c.dside = -c.dside;   // flicked across to the other side
    c.dk += ((c.drifting ? 1 : 0) - c.dk) * Math.min(1, dt * 6);
    // the automatic box holds its gear through a drift (the wheels' speed says nothing then) unless it runs out of revs
    if (c.auto && c.gear >= 1 && c.shiftT <= 0 && !inp.held) {
      const up = rpmRoad > S.redline * (c.drifting ? 0.985 : 0.94), dnK = c.drifting ? 0.3 : 1;
      if (up && c.gear < S.gears.length && gas) shift(c.gear + 1);
      else if (c.gear > 1 && rpmRoad * S.gears[c.gear - 2] / S.gears[c.gear - 1] < S.redline * (gas ? 0.8 : 0.66)
        && rpmRoad < S.redline * (gas ? 0.5 : 0.4) * dnK) shift(c.gear - 1);
    }
    // clutch: held, the engine revs freely; let go with the revs up and it kicks the rear tyres loose
    const wasClutch = c.clutch;
    c.clutch = !!inp.clutch || !!inp.held;
    if (wasClutch && !c.clutch && c.gear >= 1 && c.rpm > rpmRoad + 1500) c.kick = U.clamp((c.rpm - rpmRoad) / S.redline, 0.3, 1);
    c.kick = Math.max(0, c.kick - dt * 2.4);
    // engine speed: from the rear wheels, plus their spin while they are lit up
    const free = c.clutch || c.shiftT > 0;
    const spinT = gas && c.gear >= 1 ? Math.max(0, S.redline * 0.96 - rpmRoad) * Math.max(c.wheelSpin, c.rearSlide * 0.8) * 0.8 : 0;
    c.spin += (spinT - c.spin) * Math.min(1, dt * 5);
    const tgt = free ? (gas ? S.redline * 1.02 : S.idle) : Math.max(S.idle * (gas ? 1.15 : 1), rpmRoad + c.spin);
    c.rpm += (tgt - c.rpm) * Math.min(1, dt * (free ? (gas ? 4.5 : 2.5) : 12));
    c.limiter = !free && rpmRoad >= S.redline;
    if (c.rpm >= S.redline) c.rpm = S.redline * (0.97 + Math.random() * 0.03);
    // drive force at the rear tyres
    c.nitroOn = !!inp.nitro && c.nitro > 0 && gas > 0 && c.gear >= 1 && !free;
    if (c.nitroOn) c.nitro = Math.max(0, c.nitro - dt * 0.28);
    let drive = 0;
    if (!free && !c.limiter && gas) {
      const tq = S.torque * torqueCurve(Math.min(c.rpm, S.redline) / S.redline, S.pk) * (c.nitroOn ? 1.5 : 1) * (1 + 1.5 * c.kick);
      drive = tq * ratio(c.gear) * S.final * 0.88 / S.R;
    } else if (!free && c.gear >= 1 && !gas) drive = -Math.sign(u) * S.mass * 9.81 * 0.05 * (c.rpm / S.redline);   // engine braking
    c.drive = drive; c.gas = gas; c.brk = brk; c.hand = !!inp.hand;
    // steering: gripping, the keys turn the wheels (less lock at speed). Drifting, they steer relative to where the
    // front wheels are rolling, so letting go counter-steers by itself (like a real wheel spinning back through the
    // driver's hands), and the keys trim the angle: towards the bend = more angle, away = less (a flick the other way
    // swings the car into the next bend)
    const want = -(inp.steer || 0);
    c.sIn += (want - c.sIn) * Math.min(1, dt * STEER.keys);
    const d0 = u > 1 ? Math.atan2(v + c.w * S.a, Math.max(u, 2)) : 0;
    const din = S.steerIn / (1 + spd / STEER.fade);
    const target = U.clamp(d0 * c.dk * 0.95 + c.sIn * (din * (1 - c.dk) + STEER.drift * c.dk), -S.lock, S.lock);
    c.steer += U.clamp(target - c.steer, -dt * STEER.rate, dt * STEER.rate);
    c.beta = beta;
    // the drift angle the assist aims for: throttle holds it, the keys trim it, lifting off straightens the car
    const toward = Math.max(0, c.sIn * c.dside), away = Math.max(0, -c.sIn * c.dside);
    c.toward = toward;
    // feint: the wheel held hard over at speed while the front tyres wash wide kicks the tail out, so a bend taken
    // too fast turns into a drift instead of ploughing straight on into the rail
    c.looseT = Math.max(0, c.looseT - dt);
    if (!c.drifting && !c.hand && spd > 11 && Math.abs(c.sIn) > 0.85 && c.frontSlide > 0.4 && c.u > 0) c.feintT += dt;
    else c.feintT = Math.min(0, c.feintT + dt);
    if (c.feintT > 0.12) { c.looseT = PATH.feint; c.feintT = -1.5; }
    // the angle is held while the keys point into the bend (and for HOLD_T s after the last press, so tapping the
    // keys keeps it); steer out, or let go for longer, and the car straightens and the drift ends
    if (toward > 0.05) c.holdT = HOLD_T; else c.holdT = away > 0.3 ? 0 : Math.max(0, c.holdT - dt);
    const hold = c.holdT > 0 ? (gas ? 0.42 + (c.nitroOn ? 0.1 : 0) : 0.22) + 0.34 * toward : gas ? 0.12 : 0.05;
    // holding the other way hard on the throttle (not a quick dab to straighten) swings the car across into a drift
    // the other way - linking an S-bend. A short counter-steer just straightens it
    c.awayT = away > 0.8 ? c.awayT + dt : 0;
    c.swing = !!gas && c.awayT > SWING_T;
    const aim = c.swing ? -0.35 : U.clamp(hold - 0.4 * away - (brk ? 0.12 : 0), 0, S.maxAng);
    c.dTarget += (aim - c.dTarget) * Math.min(1, dt * (aim < c.dTarget ? 2.5 : 6));
    // how hard the path curves into the bend (x PATH.acc): keys towards it = tighter, away = wider / swing across
    c.pathK = c.dside * ((gas || c.hand ? PATH.base : PATH.lift) + PATH.tow * toward - PATH.away * away);
  }

  // ---------------- one physics step of car c (bicycle model, friction circle per axle) ----------------
  physics(c, dt) {
    const S = c.spec, m = S.mass, g = 9.81, a = S.a, b = S.b, L = a + b, I = c.I;
    const sn = Math.sin(c.psi), cs = Math.cos(c.psi);
    const u = c.vx * sn + c.vz * cs, v = c.vx * cs - c.vz * sn, w = c.w;
    // axle loads with weight transfer (braking loads the front: easier to turn in; throttle loads the rear)
    const dF = U.clamp(m * c.ax * S.h / L, -0.3 * m * g, 0.3 * m * g);
    const Fzf = m * g * b / L - dF, Fzr = m * g * a / L + dF;
    const GF = S.muF * c.surf * Fzf, GR = S.muR * c.surf * Fzr * (c.looseT > 0 ? 0.45 : 1);
    // front tyres
    const d = c.steer, cd = Math.cos(d), sd = Math.sin(d);
    const vf = v + w * a, lw = u * cd + vf * sd, tw = -u * sd + vf * cd;
    const af = Math.atan2(tw, Math.max(Math.abs(lw), 1.5));
    let Fyf = -GF * tyreCurve(af / S.pkF), Fxf = 0;
    if (c.brk > 0) Fxf = -Math.sign(lw) * Math.min(c.brk * S.brake * BRAKE_K * m * g * 0.62, m * Math.abs(lw) / dt * 0.3);
    const rf = Math.hypot(Fxf / (GF * (c.drifting ? 1 : TRACTION)), Fyf / GF);
    if (rf > 1) { Fxf /= rf; Fyf /= rf; }
    c.frontSlide = smoothK(1.4, 3, Math.abs(af) / S.pkF); c.fRatio = Math.abs(af) / S.pkF;
    // rear tyres: drive, brake and cornering share the grip; the handbrake locks them
    const vr = v - w * b;
    const ar = Math.atan2(vr, Math.max(Math.abs(u), 1.5));
    let Fyr = -GR * tyreCurve(ar / S.pkR), Fxr = c.drive, slide;
    if (c.brk > 0) Fxr -= Math.sign(u) * Math.min(c.brk * S.brake * BRAKE_K * m * g * 0.38, m * Math.abs(u) / dt * 0.3);
    if (c.hand && Math.abs(u) > 0.4) {
      const sp = Math.hypot(u, vr) || 1e-6, Fk = GR * S.slide * Math.min(1, sp / 1.5);
      Fxr = -Fk * u / sp; Fyr = -Fk * vr / sp;
      slide = 1; c.wheelSpin = 0;
    } else {
      // friction ellipse: straight ahead the tyres take TRACTION x more than sideways (not while drifting)
      const GRx = GR * (c.drifting ? 1 : TRACTION), r = Math.hypot(Fxr / GRx, Fyr / GR);
      if (r > 1) { const k = (1 - (1 - S.slide) * smoothK(1, 1.3, r)) / r; Fxr *= k; Fyr *= k; }
      slide = Math.max(smoothK(0.98, 1.25, r), smoothK(1.4, 3, Math.abs(ar) / S.pkR));
      c.wheelSpin = c.drive > 0 ? smoothK(0.9, 1.3, c.drive / GRx) : 0;
    }
    c.rearSlide = slide;
    // forces on the body (body frame) and the turning moment
    const Fx = Fxf * cd - Fyf * sd + Fxr, Fy = Fxf * sd + Fyf * cd + Fyr;
    let Mz = a * (Fxf * sd + Fyf * cd) - b * Fyr;
    // drift assist: while drifting, a turning moment steers the drift angle towards dTarget (a PD loop on the angle
    // between the nose and the direction of travel); well past the car's angle the body is pulled straighter
    const beta = u > 1 ? Math.atan2(v, u) : 0, dB = (beta - c.bPrev) / dt;
    c.bPrev = beta;
    if (u > 2) {
      if (c.dk > 0.02) Mz += I * c.dk * (DASSIST.kp * (c.dside * c.dTarget + beta) + DASSIST.kd * U.clamp(dB, -8, 8));
      const ex = Math.abs(beta) - S.maxAng - 0.3;
      if (ex > 0) Mz += Math.sign(beta) * I * (ex * 14 + Math.max(0, -Math.sign(beta) * w) * 1.6);
    }
    // world-space forces: tyres, drag, rolling resistance (much more off the tarmac), gravity along the slope
    let FX = Fx * sn + Fy * cs, FZ = Fx * cs - Fy * sn;
    const spd = Math.hypot(c.vx, c.vz);
    if (spd > 0.01) {
      const k = S.drag * spd + m * g * (0.013 + (c.surf < 1 ? 0.1 : 0)) / Math.max(spd, 0.5);
      FX -= c.vx * k; FZ -= c.vz * k;
    }
    const q = c.pq;
    FX -= m * g * q.slope * Math.sin(q.h); FZ -= m * g * q.slope * Math.cos(q.h);
    // path assist (arcade): while drifting the keys steer where the car GOES, not only where its nose points. The
    // sideways pull on the path is steered towards pathK x PATH.acc (more than the tyres alone could give)
    if (c.dk > 0.02 && spd > 3) {
      const lx = c.vz / spd, lz = -c.vx / spd, aNow = (FX * lx + FZ * lz) / m;   // left of the direction of travel
      const acc = PATH.acc * c.boost;   // (more for a computer car catching up: it carries more speed round without running wide)
      const add = U.clamp(c.pathK * acc - aNow, -acc, acc) * c.dk * PATH.k;
      FX += lx * add * m; FZ += lz * add * m;
      // a car hung out sideways sheds speed, more so when it is held tight into the bend: a bend taken too fast
      // tightens up instead of running into the rail
      const scrub = c.dk * (PATH.scrubAng * Math.abs(Math.sin(c.beta)) + PATH.scrubTow * c.toward) * Math.min(1.6, (spd / 20) * (spd / 20)) / (c.boost * c.boost);   // (less for a computer car catching up)
      FX -= c.vx / spd * scrub * m; FZ -= c.vz / spd * scrub * m;
    }
    if (c.dk < 0.98 && spd > GRIP.v0 && Math.abs(c.sIn) > 0.05 && c.u > 0) {
      const lx = c.vz / spd, lz = -c.vx / spd, aNow = (FX * lx + FZ * lz) / m, want = c.sIn * GRIP.acc * c.boost;
      const add = (want - aNow) * Math.abs(c.sIn) * GRIP.k * (1 - c.dk) * smoothK(GRIP.v0, GRIP.v1, spd) * smoothK(0.8, 1.5, c.fRatio);
      if (add * c.sIn > 0) { FX += lx * add * m; FZ += lz * add * m; }   // only ever helps the turn the keys ask for
    }
    if (c.push && c.gas && spd > 3) { FX += c.vx / spd * c.push * m; FZ += c.vz / spd * c.push * m; }   // (the rubber band)
    c.vx += FX / m * dt; c.vz += FZ / m * dt;
    c.w += Mz / I * dt; c.psi += c.w * dt;
    if (spd < 0.15 && !c.drive && Math.abs(c.w) < 0.1) { c.vx *= 0.8; c.vz *= 0.8; c.w *= 0.8; }
    c.px += c.vx * dt; c.pz += c.vz * dt;
    c.ax += (Fx / m - c.ax) * Math.min(1, dt * 8); c.ay += (Fy / m - c.ay) * Math.min(1, dt * 8);
    this.walls(c);
  }
  // the four corners of the body against the rails: pushed back out, a bounce with friction along the rail, and the
  // spin the knock gives the car
  walls(c) {
    const B = c.body, I = c.I, m = c.spec.mass, q = c.wq;
    for (let k = 0; k < 4; k++) {
      const cf = B[k < 2 ? 1 : 0], cl = k % 2 ? -B[2] : B[2];
      const sn = Math.sin(c.psi), cs = Math.cos(c.psi);
      this.project(c.px + cf * sn + cl * cs, c.pz + cf * cs - cl * sn, c.seg, q);
      const pen = Math.abs(q.n) - this.wallM;
      c.near = Math.min(c.near, -pen);
      if (pen <= 0) continue;
      const s = Math.sign(q.n), nx = s * Math.cos(q.h), nz = -s * Math.sin(q.h);   // inward normal (world X, Z)
      c.px += nx * pen; c.pz += nz * pen;
      const u = c.vx * sn + c.vz * cs, v = c.vx * cs - c.vz * sn;
      const pu = u - c.w * cl, pv = v + c.w * cf;                                // contact point velocity, body frame
      const vX = pu * sn + pv * cs, vZ = pu * cs - pv * sn, vn = vX * nx + vZ * nz;
      if (vn >= 0) continue;
      const nf = nx * sn + nz * cs, nl = nx * cs - nz * sn, rn = cf * nl - cl * nf;
      const j = -(1 + 0.22) * vn / (1 / m + rn * rn / I);
      c.vx += j * nx / m; c.vz += j * nz / m; c.w += j * rn / I;
      const tx = -nz, tz = nx, vt = vX * tx + vZ * tz, tf = tx * sn + tz * cs, tl = tx * cs - tz * sn, rt = cf * tl - cl * tf;
      const jt = U.clamp(-vt / (1 / m + rt * rt / I), -0.3 * j, 0.3 * j);          // friction along the rail
      c.vx += jt * tx / m; c.vz += jt * tz / m; c.w += jt * rt / I;
      c.hit = Math.max(c.hit, -vn);
    }
  }
  // cars against each other: each body is three discs along its length; overlapping discs are pushed apart (by mass)
  // and bounce off each other with some friction, which also sets the bodies turning
  collide(list) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j], dx = A.px - B.px, dz = A.pz - B.pz;
      if (A.fin || B.fin) continue;   // a car past the finish is a ghost (it stops on the road, the others race on)
      if (dx * dx + dz * dz < 64) this.contact(A, B);
    }
  }
  discs(c) {
    const B = c.body, r = B[2], sn = Math.sin(c.psi), cs = Math.cos(c.psi);
    return [B[0] + r, (B[0] + B[1]) / 2, B[1] - r].map(f => ({ x: c.px + f * sn, z: c.pz + f * cs, r }));
  }
  contact(A, B) {
    if (A.remote && B.remote) return;   // (two other players: their own screens sort it out)
    const da = this.discs(A), db = this.discs(B), mA = A.spec.mass, mB = B.spec.mass;
    // inverse masses / inertias: a remote car is immovable here (its own player's screen moves it)
    const iA = A.remote ? 0 : 1 / mA, iB = B.remote ? 0 : 1 / mB, jA = A.remote ? 0 : 1 / A.I, jB = B.remote ? 0 : 1 / B.I;
    for (const a of da) for (const b of db) {
      let nx = a.x - b.x, nz = a.z - b.z;
      const dd = Math.hypot(nx, nz), pen = a.r + b.r - dd;
      if (pen <= 0 || dd < 1e-6) continue;
      nx /= dd; nz /= dd;                                                        // from B towards A
      const px = b.x + nx * (b.r - pen / 2), pz = b.z + nz * (b.r - pen / 2);     // the contact point
      const rax = px - A.px, raz = pz - A.pz, rbx = px - B.px, rbz = pz - B.pz;
      const kA = iA / (iA + iB), kB = iB / (iA + iB);
      A.px += nx * pen * kA; A.pz += nz * pen * kA; B.px -= nx * pen * kB; B.pz -= nz * pen * kB;
      for (const o of [a, b]) { const s = o === a ? kA : -kB; o.x += nx * pen * s; o.z += nz * pen * s; }
      // velocity of the contact point on each body: v + w x r (a turn to the left moves r = (x, z) by w (z, -x))
      const vrx = A.vx + A.w * raz - B.vx - B.w * rbz, vrz = A.vz - A.w * rax - B.vz + B.w * rbx, vn = vrx * nx + vrz * nz;
      if (vn >= 0) continue;
      const na = raz * nx - rax * nz, nb = rbz * nx - rbx * nz;
      const jn = -(1 + 0.25) * vn / (iA + iB + na * na * jA + nb * nb * jB);
      const tx = -nz, tz = nx, vt = vrx * tx + vrz * tz, ta = raz * tx - rax * tz, tb = rbz * tx - rbx * tz;
      const jt = U.clamp(-vt / (iA + iB + ta * ta * jA + tb * tb * jB), -0.3 * jn, 0.3 * jn);
      A.vx += (jn * nx + jt * tx) * iA; A.vz += (jn * nz + jt * tz) * iA; A.w += (jn * na + jt * ta) * jA;
      B.vx -= (jn * nx + jt * tx) * iB; B.vz -= (jn * nz + jt * tz) * iB; B.w -= (jn * nb + jt * tb) * jB;
      // the chain penalty goes to the car behind (it ran into the other); side by side, to both
      const ds = (A.sAbs + A.al - B.sAbs - B.al) * SEG_M;
      if (ds < 1.5) A.bump = Math.max(A.bump, -vn);
      if (ds > -1.5) B.bump = Math.max(B.bump, -vn);
    }
  }

  // another player's car (online): where it is on the road - for its height, the skid marks and the map; Net gives a
  // hint of its progress (segments) when it may have jumped further than the projection searches
  trackRemote(c) {
    const C = this.ctr;
    if (c.sHint !== undefined) {
      const i = Math.floor(c.sHint), seg = C.loop ? ((i % C.N) + C.N) % C.N : U.clamp(i, 0, C.N);
      if (Math.abs(seg - c.seg) > 10 && !(C.loop && Math.abs(seg - c.seg) > C.N - 10)) c.seg = seg;
    }
    const q = this.project(c.px, c.pz, c.seg, c.pq);
    c.seg = q.i; c.al = q.al; c.off = q.n; c.h = q.h; c.y = q.y; c.slope = q.slope;
    c.sAbs = c.sHint !== undefined ? c.sHint - q.al : c.sAbs;
    c.surf = Math.abs(q.n) > this.hwM + 0.5 ? 0.72 : 1;
  }
  // ---------------- where car c is: progress, laps, surface, knocks, wrong way, finish ----------------
  track(c, dt) {
    const q = this.project(c.px, c.pz, c.seg, c.pq), me = c.isPlayer, racing = this.state === 'racing' && !c.fin;
    let dI = q.i - c.seg;
    if (this.ctr.loop) { const N = this.ctr.N; if (dI > N / 2) dI -= N; if (dI < -N / 2) dI += N; }
    c.seg = q.i; c.sAbs += dI; c.al = q.al; c.off = q.n; c.h = q.h; c.y = q.y; c.slope = q.slope;
    c.surf = Math.abs(q.n) > this.hwM + 0.5 ? 0.72 : 1;
    c.hitT = Math.max(0, c.hitT - dt); c.bumpT = Math.max(0, c.bumpT - dt);
    if (c.hit > 1.2) {   // a knock on the rail: a brush costs part of the chain, a real hit all of it
      const fresh = c.hitT <= 0;
      if (fresh) { c.hitT = 0.35; if (me) { Sound.thud(); if (c.hit > 6) Sound.crash(); this.shake = Math.max(this.shake, Math.min(0.8, c.hit * 0.06)); } }
      if (racing && (fresh || c.hit > DSCORE.crash)) {
        if (fresh) c.hits++;
        if (c.chain && c.hit > DSCORE.crash) this.loseChain(c, 'VA CHẠM!');
        else if (c.chain && fresh) { c.chain.pts *= 0.7; if (me) this.pop('CHẠM RÀO -30%', '#ffb04a'); }
      }
    }
    c.hit = 0;
    if (c.bump > 1.0) {   // a knock against another car: the same, its own count
      const fresh = c.bumpT <= 0;
      if (fresh) { c.bumpT = 0.4; if (me) { Sound.thud(); if (c.bump > 6) Sound.crash(); this.shake = Math.max(this.shake, Math.min(0.6, c.bump * 0.05)); } }
      if (racing && (fresh || c.bump > DSCORE.crash)) {
        if (fresh) c.bumps++;
        if (c.chain && c.bump > DSCORE.crash) this.loseChain(c, 'ĐÂM XE!');
        else if (c.chain && fresh) { c.chain.pts *= 0.7; if (me) this.pop('CHẠM XE -30%', '#ffb04a'); }
      }
    }
    c.bump = 0;
    const fwd = Math.cos(c.psi - q.h) * Math.hypot(c.vx, c.vz);
    if (fwd < -2 && this.state === 'racing' && !c.fin) {
      c.wrongT += dt;
      if (me && c.wrongT > 1.5) { c.wrongT = 0; this.msg('SAI HƯỚNG! (R: đặt lại xe)', '#ff8a8a', 1.5, 26); }
    } else c.wrongT = 0;
    const z = (c.sAbs + c.al) * CFG.segL;
    if (me && this.circuit && racing) {
      const lap = U.clamp(Math.floor((z - this.lineZ) / (this.lapN * CFG.segL)) + 1, 1, this.laps);
      if (lap > this.lapShown) { this.lapShown = lap; this.msg(lap === this.laps ? 'VÒNG CUỐI!' : 'VÒNG ' + lap + '/' + this.laps, '#ffd23a', 1.8, 36); }
    }
    if (racing && z >= this.finishZ) {
      c.fin = this.clock;
      if (c.chain) this.bank(c);
      if (me) this.finish();
    }
    // a computer car that has finished pulls over and, a few seconds later, leaves the stage (out of everyone's way)
    if (!me && c.fin && this.clock - c.fin > 6) c.gone = true;
  }
  finish() {
    this.over = { t: 0, reason: 'finished' };
    this.msg('VỀ ĐÍCH!', '#ffd23a', 4, 44);
    Sound.beep(880, 0.3);
  }
  // the player's trail for the computer drivers to chase: every 0.6 m of road, where across it the player was, how
  // fast, and whether (which way) the car was drifting
  layTrail() {
    const P = this.car, T = this.trail || (this.trail = []);
    if (this.state !== 'racing' || P.fin) return;
    const s = (P.sAbs + P.al) * SEG_M, last = T[T.length - 1];
    if (last && s < last.s + 0.6) return;
    T.push({ s, off: P.off, v: Math.hypot(P.vx, P.vz), d: P.drifting ? P.dside : 0 });
    if (T.length > 3000) T.splice(0, 1000);
  }
  // the trail at s metres along the road (between two crumbs), or null off either end of it
  trailAt(s) {
    const T = this.trail;
    if (!T || T.length < 2 || s < T[0].s || s > T[T.length - 1].s) return null;
    let lo = 0, hi = T.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m].s <= s) lo = m; else hi = m; }
    const a = T[lo], b = T[hi], f = (s - a.s) / Math.max(1e-6, b.s - a.s);
    return { off: a.off + (b.off - a.off) * f, v: a.v + (b.v - a.v) * f, d: f < 0.5 ? a.d : b.d };
  }
  // the field by score, best first
  order() { return this.racers.slice().sort((a, b) => b.score - a.score || b.isPlayer - a.isPlayer); }
  // final standings: computer drivers still on the road are run on to the finish first (no rendering, no sound)
  standings() {
    const dt = 1 / 60;
    for (let t = 0; t < 240; t += dt) {
      const left = this.racers.filter(c => c.ai && !c.fin && !c.gone);
      if (!left.length) break;
      this.clock += dt;
      for (const c of left) this.control(c, this.aiInput(c, dt), dt);
      this.step(left, dt);
      for (const c of left) { this.track(c, dt); this.scoring(c, dt); }
    }
    for (const c of this.racers) if (c.chain) this.bank(c);
    return this.order().map(c => ({ name: c.name, car: c.spec.name, paint: c.paint, score: c.score, me: c.isPlayer, fin: c.fin }));
  }

  // ---------------- drift scoring (every car the same way) ----------------
  scoring(c, dt) {
    const kmh = Math.hypot(c.vx, c.vz) * 3.6, ang = Math.abs(c.beta) * 180 / Math.PI, me = c.isPlayer;
    const near = c.near; c.near = 99;
    if (c.fin) return;
    c.best.kmh = Math.max(c.best.kmh, kmh);
    if (c.u > 2 && ang > DSCORE.spin && kmh > 12) { if (c.chain) this.loseChain(c, 'XOAY XE!'); return; }
    const on = kmh > DSCORE.minKmh && c.u > 1 && ang > DSCORE.minAng && c.surf === 1;
    if (on) {
      if (!c.chain) c.chain = { pts: 0, mult: 1, t: 0, gap: 0, dir: Math.sign(c.beta), side: 0, trans: 0, near: 0, ang: 0, tan: 0 };
      const C = c.chain;
      C.gap = 0; C.t += dt; C.ang = ang; C.side += dt;
      if (Math.sign(c.beta) !== C.dir) {   // a flick from one side to the other without straightening (a transition)
        if (C.side > 0.7) { C.trans++; const b = 250 * C.mult; C.pts += b; if (me) this.pop('ĐẢO LÁI +' + b, '#9fe0ff'); }
        C.dir = Math.sign(c.beta); C.side = 0;
      }
      if (near < DSCORE.wall) { if (C.near <= 0 && me) this.pop('SÁT RÀO!', '#ffd23a'); C.near = 0.4; } else C.near = Math.max(0, C.near - dt);
      // tandem: drifting within a few metres of another car that is drifting too
      let tan = false;
      if (this.racers.length > 1) for (const o of this.racers) {
        if (o !== c && !o.gone && o.drifting && (o.px - c.px) ** 2 + (o.pz - c.pz) ** 2 < DSCORE.tandem * DSCORE.tandem) { tan = true; break; }
      }
      if (tan) { if (C.tan <= 0 && me) this.pop('SONG HÀNH! x1.5', '#ff9aff'); C.tan = 0.5; } else C.tan = Math.max(0, C.tan - dt);
      const angK = U.clamp((ang - 10) / 30, 0, 1.8);
      C.pts += dt * angK * kmh * DSCORE.rate * (C.near > 0 ? 2 : 1) * (C.tan > 0 ? 1.5 : 1);
      C.mult = Math.min(DSCORE.maxMult, 1 + Math.floor(C.t / DSCORE.multT) + C.trans);
      c.best.angle = Math.max(c.best.angle, ang);
      c.nitro = Math.min(1, c.nitro + dt * angK * 0.05);
    } else if (c.chain) {
      c.chain.gap += dt; c.chain.ang = 0;
      if (c.chain.gap > DSCORE.gap) this.bank(c);
    }
  }
  bank(c) {
    const C = c.chain, pts = Math.round(C.pts * C.mult);
    c.chain = null;
    if (pts < 50) return;
    c.score += pts;
    c.best.chain = Math.max(c.best.chain, pts); c.best.time = Math.max(c.best.time, C.t);
    if (c.isPlayer) this.pop('+' + pts.toLocaleString('en-US') + (pts > 20000 ? '  ĐỈNH CAO!' : pts > 8000 ? '  TUYỆT VỜI!' : pts > 3000 ? '  ĐẸP!' : ''), '#7fff7f');
  }
  loseChain(c, why) {
    const C = c.chain, pts = Math.round(C.pts * C.mult);
    c.chain = null;
    if (c.isPlayer) this.pop(why + (pts >= 50 ? '  MẤT ' + pts.toLocaleString('en-US') : ''), '#ff6a5a');
  }
  rank(score) { const g = this.def.grades; let r = -1; for (let i = 0; i < g.length; i++) if (score >= g[i]) r = i; return r; }

  // ---------------- tyre smoke, exhaust pops; engine and tyre sounds for the player's car ----------------
  feedback(c, dt) {
    const S = c.spec, spd = Math.hypot(c.vx, c.vz), me = c.isPlayer;
    if (me) {
      Sound.voice(S.voice);
      Sound.engine(U.clamp((c.rpm - S.idle * 0.6) / S.redline, 0, 1.05), 0.09 + 0.08 * c.gas);
      const slip = spd > 3 ? Math.max(c.rearSlide * 0.9, c.frontSlide * 0.6) : c.wheelSpin * (c.gas ? 0.7 : 0);
      if (Sound.skid) Sound.skid(slip * Math.min(1, Math.max(spd, c.wheelSpin * 8) / 10), 0.85 + Math.min(0.35, spd / 90));
    }
    c.smoke = Math.max(spd > 2.5 ? c.rearSlide : 0, c.wheelSpin * (c.gas ? 1 : 0));
    // turbo blow-off and exhaust pops when the throttle snaps shut at high revs
    if (c.lastGas && !c.gas && c.rpm > S.redline * 0.6) {
      if (me && S.turbo && Sound.blowoff) Sound.blowoff();
      if (Math.random() < 0.7) { c.backfire = 0.22; if (me && Sound.pop) Sound.pop(); }
    }
    c.lastGas = c.gas;
    c.backfire = Math.max(0, c.backfire - dt);
  }
}
