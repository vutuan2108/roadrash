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
  // All from the player's 3D models in car/ (built into js/g3/<model>.js by tools/glb), cheapest first. Real figures in
  // `real`; in the game the drift-build rule (about +45 % power and torque; the pro builds capped), gears / final drive
  // / redline / weight as the real cars
  // Datsun 280Z (S30), the free starter car: L28E 2.8 L six, 170 hp (early rating) at 5600 rpm, 221 Nm at 4400 rpm, about 1270 kg; 5-speed
  { name: 'Datsun 280Z', model: 'z280', price: 0, color: '#e8650f', hp: 250, kg: 1270, vmax: 236, real: 'L28E 2.8L 6 máy thẳng hàng · zin 170 mã lực · 205 km/h',
    mass: 1270, a: 1.083, b: 1.222, h: 0.5, torque: 320, pk: 0.68, redline: 6500, idle: 750, gears: [3.321, 2.077, 1.308, 1.0, 0.864],
    final: 3.9, R: 0.324, drag: 0.36, muF: 1.08, muR: 1.14, pkF: 0.13, pkR: 0.11, slide: 0.84, lock: 0.82, steerIn: 0.62, brake: 1.0,
    maxAng: 1.0, turbo: true, voice: [26, 220, 290, 1900, 0.3, 2] },
  // Nissan 180SX (RPS13) Type X: SR20DET 2.0 L turbo four, 205 PS at 6000 rpm, 275 Nm at 4000 rpm, about 1220 kg,
  // 5-speed 3.321 / 1.902 / 1.308 / 1.000 / 0.759, final 4.083, about 230 km/h. Here with an aero kit and a wing
  { name: 'Nissan 180SX', model: 'n180', price: 8000, color: '#8e949c', hp: 295, kg: 1220, vmax: 277, real: 'SR20DET 2.0L 4 máy turbo · zin 205 mã lực · 230 km/h',
    mass: 1220, a: 1.114, b: 1.361, h: 0.48, torque: 400, pk: 0.6, redline: 7500, idle: 900, gears: [3.321, 1.902, 1.308, 1.0, 0.759],
    final: 4.083, R: 0.303, drag: 0.29, muF: 1.1, muR: 1.16, pkF: 0.12, pkR: 0.105, slide: 0.84, lock: 0.84, steerIn: 0.62, brake: 1.05,
    maxAng: 1.02, turbo: true, voice: [29, 240, 310, 2200, 0.22, 2] },
  // Ford Mustang 1965 hardtop: 289 cu in (4.7 L) V8 with the four-barrel carburettor, 225 hp at 4800 rpm, 305 lb-ft
  // (414 Nm) at 3200 rpm, about 1300 kg, 4-speed Toploader 2.78 / 1.93 / 1.36 / 1.00, about 190 km/h
  { name: 'Ford Mustang 1965', model: 'm65', price: 12000, color: '#16245a', hp: 326, kg: 1300, vmax: 217, real: '289 V8 4.7L · zin 225 mã lực · 190 km/h',
    mass: 1300, a: 1.207, b: 1.536, h: 0.52, torque: 600, pk: 0.55, redline: 6000, idle: 700, gears: [2.78, 1.93, 1.36, 1.0],
    final: 3.2, R: 0.307, drag: 0.38, muF: 1.06, muR: 1.12, pkF: 0.13, pkR: 0.11, slide: 0.84, lock: 0.78, steerIn: 0.6, brake: 0.95,
    maxAng: 1.0, turbo: false, voice: [22, 190, 240, 1400, 0.5, 1.5] },
  // Toyota GR86 (ZN8) stock: 2.4 L FA24 boxer, 228 hp at
  // 7000 rpm, 250 Nm, 1270 kg, the real 6-speed and 4.30 final drive; here with a turbo kit like the others (+45 %)
  { name: 'Toyota GR86 Pandem', model: 'gr86', price: 14000, color: '#c0161e', hp: 330, kg: 1280, vmax: 281, real: 'FA24 2.4L 4 máy boxer · zin 228 mã lực · 226 km/h',
    mass: 1280, a: 1.21, b: 1.365, h: 0.46, torque: 360, pk: 0.6, redline: 7500, idle: 800, gears: [3.626, 2.188, 1.541, 1.213, 1.0, 0.767],
    final: 4.3, R: 0.328, drag: 0.3, muF: 1.1, muR: 1.16, pkF: 0.12, pkR: 0.105, slide: 0.84, lock: 0.84, steerIn: 0.62, brake: 1.08,
    maxAng: 1.02, turbo: true, voice: [27, 230, 300, 2100, 0.3, 2] },
  // Ford Mustang Boss 302 (1970): 302 cu in (5.0 L) V8, 290 hp at 5800 rpm, 290 lb-ft (393 Nm) at 4300 rpm, about
  // 1450 kg, close-ratio 4-speed Toploader 2.32 / 1.69 / 1.29 / 1.00, 3.50 axle, 0-60 mph 6.9 s
  { name: 'Ford Mustang Boss 302', model: 'boss', price: 24000, color: '#1ea0dc', hp: 420, kg: 1450, vmax: 228, real: 'Boss 302 V8 5.0L · zin 290 mã lực · 0–96 km/h 6,9 giây',
    mass: 1450, a: 1.207, b: 1.536, h: 0.5, torque: 570, pk: 0.66, redline: 6500, idle: 800, gears: [2.32, 1.69, 1.29, 1.0],
    final: 3.5, R: 0.326, drag: 0.36, muF: 1.08, muR: 1.14, pkF: 0.13, pkR: 0.11, slide: 0.84, lock: 0.8, steerIn: 0.6, brake: 1.0,
    maxAng: 1.0, turbo: false, voice: [24, 200, 260, 1600, 0.46, 1.5] },
  { name: 'Toyota Supra A80', model: 'supra', price: 40000, color: '#e8650f', hp: 465, kg: 1500, vmax: 337, real: '2JZ-GTE 3.0L 6 máy twin-turbo · zin 320 mã lực · 250 km/h',
    mass: 1510, a: 1.2, b: 1.35, h: 0.49, torque: 680, pk: 0.55, redline: 7000, idle: 850, gears: [3.83, 2.36, 1.69, 1.31, 1.0, 0.79],
    final: 3.27, R: 0.33, drag: 0.288, muF: 1.1, muR: 1.16, pkF: 0.12, pkR: 0.105, slide: 0.84, lock: 0.82, steerIn: 0.58, brake: 1.1,
    maxAng: 0.98, turbo: true, voice: [33, 270, 340, 2400, 0.1, 1.5] },
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
  // Ford Mustang GT-R: a 2018 Mustang GT fastback (S550) with a race kit. Coyote 5.0 L V8, 460 hp at 7000 rpm,
  // 420 lb-ft (569 Nm) at 4600 rpm, about 1680 kg, 6-speed manual (first 3.66), 250 km/h (limited)
  { name: 'Ford Mustang GT-R', model: 'gtr', price: 55000, color: '#14161a', hp: 650, kg: 1650, vmax: 340, real: 'Coyote 5.0L V8 (Mustang GT 2018) · zin 460 mã lực · 250 km/h',
    mass: 1650, a: 1.278, b: 1.442, h: 0.5, torque: 810, pk: 0.6, redline: 7500, idle: 750, gears: [3.66, 2.43, 1.69, 1.32, 1.0, 0.65],
    final: 3.55, R: 0.317, drag: 0.44, muF: 1.12, muR: 1.18, pkF: 0.12, pkR: 0.105, slide: 0.84, lock: 0.82, steerIn: 0.56, brake: 1.15,
    maxAng: 1.0, turbo: false, voice: [24, 200, 250, 1500, 0.44, 1.5] },
  // S15 pro-am drift build: SR20DET with a big turbo (about 350 hp on the street, +45 % here like the others), stripped
  // with a cage (1190 kg), angle kit, 4.3 final drive on the Spec-R 6-speed
  { name: 'Nissan Silvia S15 Custom', model: 's15c', price: 60000, color: '#f2f2f0', hp: 500, kg: 1190, vmax: 340, real: 'SR20DET độ turbo lớn · ~350 mã lực ngoài đời',
    mass: 1190, a: 1.135, b: 1.39, h: 0.47, torque: 560, pk: 0.62, redline: 8000, idle: 950, gears: [3.32, 1.9, 1.31, 1.0, 0.76, 0.59],
    final: 4.3, R: 0.342, drag: 0.33, muF: 1.12, muR: 1.18, pkF: 0.12, pkR: 0.105, slide: 0.84, lock: 0.9, steerIn: 0.62, brake: 1.12,
    maxAng: 1.08, turbo: true, voice: [31, 250, 330, 2400, 0.3, 2],
    align: { camF: -5.5, camR: -1, toeF: -0.1, toeR: 0.15, cas: 8.5, ack: 30 } },   // (comes with a pro-am drift alignment)
  // Ford Mustang GT (S550, 2018) drift build: Coyote 5.0 L V8, 460 hp at 7000 rpm and 569 Nm stock, about 1700 kg,
  // 6-speed MT-82 3.66 / 2.43 / 1.69 / 1.32 / 1.00 / 0.65, final 3.55. Here supercharged and stripped
  { name: 'Ford Mustang GT Drift Spec', model: 'gtd', price: 62000, color: '#e8650f', hp: 720, kg: 1560, vmax: 360, real: 'Coyote 5.0L V8 (Mustang GT 2018) · zin 460 mã lực · 250 km/h',
    mass: 1560, a: 1.278, b: 1.442, h: 0.49, torque: 900, pk: 0.6, redline: 7500, idle: 800, gears: [3.66, 2.43, 1.69, 1.32, 1.0, 0.65],
    final: 3.55, R: 0.327, drag: 0.4, muF: 1.13, muR: 1.19, pkF: 0.12, pkR: 0.105, slide: 0.85, lock: 0.9, steerIn: 0.6, brake: 1.15,
    maxAng: 1.08, turbo: false, voice: [24, 200, 250, 1500, 0.44, 1.5],
    align: { camF: -5, camR: -1, toeF: -0.1, toeR: 0.15, cas: 8.5, ack: 30 } },   // (a drift alignment)
  // Porsche 911 GT2 (993): 3.6 L twin-turbo flat six, 430 PS at 5750 rpm, 540 Nm, 1295 kg, rear drive, 6-speed
  // (ratios estimated from the 993 Turbo box), 0-100 4.4 s, 295 km/h. Rear engine: 38 % of the weight on the front
  { name: 'Porsche 911 GT2 (993)', model: 'gt2', price: 65000, color: '#f0c419', hp: 615, kg: 1295, vmax: 321, real: '3.6L 6 máy boxer twin-turbo · zin 430 mã lực · 295 km/h',
    mass: 1295, a: 1.409, b: 0.863, h: 0.48, torque: 780, pk: 0.66, redline: 6800, idle: 900, gears: [3.82, 2.15, 1.56, 1.21, 0.97, 0.75],
    final: 3.44, R: 0.323, drag: 0.3, muF: 1.12, muR: 1.2, pkF: 0.12, pkR: 0.105, slide: 0.84, lock: 0.8, steerIn: 0.58, brake: 1.15,
    maxAng: 0.98, turbo: true, voice: [30, 240, 320, 2100, 0.28, 2] },
  // Toyota GT86 (ZN6) "Sugar Skull" drift car: a wide-body GT86 in a full wrap, the model's engine bay holds a twin-turbo
  // V6 swap. Stock GT86: 2.0 L FA20 boxer, 200 PS at 7000 rpm, 205 Nm, about 1240 kg, 6-speed 3.626 / 2.188 / 1.541 /
  // 1.213 / 1.000 / 0.767, final 4.1, 226 km/h. ownLiv: the body wears the model's own livery (the paint shows under it;
  // no stripes to pick)
  { name: 'Toyota GT86 Sugar Skull', model: 'gt86ss', price: 70000, color: '#f2f2f0', hp: 640, kg: 1260, vmax: 313, real: 'GT86 zin: FA20 2.0L boxer · 200 mã lực · 226 km/h', ownLiv: true,
    mass: 1260, a: 1.21, b: 1.36, h: 0.46, torque: 800, pk: 0.6, redline: 7500, idle: 900, gears: [3.626, 2.188, 1.541, 1.213, 1.0, 0.767],
    final: 4.1, R: 0.348, drag: 0.33, muF: 1.14, muR: 1.2, pkF: 0.12, pkR: 0.105, slide: 0.85, lock: 0.92, steerIn: 0.62, brake: 1.15,
    maxAng: 1.1, turbo: true, voice: [30, 250, 320, 2200, 0.24, 2],
    align: { camF: -5, camR: -1, toeF: -0.1, toeR: 0.15, cas: 8.5, ack: 30 } },   // (a drift alignment)
  // Mazda RX-7 FD3S, BN Sports BLS kit: built 13B rotary, about 600 hp on the street (BN Sports BLS build); capped here
  { name: 'Mazda RX-7 BN Sports', model: 'rx7bn', price: 75000, color: '#c0161e', hp: 700, kg: 1250, vmax: 331, real: '13B rotary độ lớn · ~600 mã lực (bản BN Sports BLS)',
    mass: 1250, a: 1.2125, b: 1.2125, h: 0.46, torque: 720, pk: 0.65, redline: 8500, idle: 1100, gears: [3.483, 2.015, 1.391, 1.0, 0.719],
    final: 4.3, R: 0.319, drag: 0.32, muF: 1.14, muR: 1.2, pkF: 0.12, pkR: 0.105, slide: 0.85, lock: 0.9, steerIn: 0.62, brake: 1.15,
    maxAng: 1.08, turbo: true, voice: [42, 330, 440, 3000, 0.16, 3] },
  // Nissan Silvia S15 with the Liberty Walk LB-Super Silhouette kit. Stock Spec-R: SR20DET 2.0 L turbo, 250 PS at
  // 6400 rpm, 275 Nm, about 1240 kg, 6-speed 3.626 / 2.200 / 1.541 / 1.213 / 1.000 / 0.767, final 3.692. Here a big
  // turbo build; it wears its sponsors' decals (ownLiv: no stripes to pick)
  { name: 'Nissan Silvia S15 LB-Super Silhouette', model: 's15lb', price: 80000, color: '#14161a', hp: 620, kg: 1180, vmax: 340, real: 'SR20DET 2.0L turbo · zin 250 mã lực (Spec-R)', ownLiv: true,
    mass: 1180, a: 1.135, b: 1.39, h: 0.45, torque: 700, pk: 0.62, redline: 8000, idle: 950, gears: [3.626, 2.2, 1.541, 1.213, 1.0, 0.767],
    final: 3.692, R: 0.325, drag: 0.34, muF: 1.14, muR: 1.2, pkF: 0.12, pkR: 0.105, slide: 0.85, lock: 0.92, steerIn: 0.62, brake: 1.15,
    maxAng: 1.1, turbo: true, voice: [31, 250, 330, 2400, 0.3, 2],
    align: { camF: -5.5, camR: -1, toeF: -0.1, toeR: 0.15, cas: 8.5, ack: 30 } },   // (a drift alignment)
  // Nissan GT-R R35 with the Liberty Walk LB-Silhouette WORKS GT 35GT-RR kit: VR38DETT 3.8 L twin-turbo V6, 570 PS at
  // 6800 rpm, 633 Nm, about 1750 kg, 6-speed dual clutch, 315 km/h. Four-wheel drive in real life - rear drive here
  { name: 'Nissan GT-R R35 LB-Silhouette', model: 'r35', price: 85000, color: '#f2f2f0', hp: 800, kg: 1700, vmax: 329, real: 'VR38DETT 3.8L V6 twin-turbo · zin 570 mã lực · 315 km/h', ownLiv: true,
    mass: 1700, a: 1.279, b: 1.501, h: 0.47, torque: 900, pk: 0.55, redline: 7100, idle: 900, gears: [4.056, 2.301, 1.595, 1.248, 1.001, 0.796],
    final: 3.7, R: 0.362, drag: 0.31, muF: 1.14, muR: 1.2, pkF: 0.12, pkR: 0.105, slide: 0.84, lock: 0.82, steerIn: 0.58, brake: 1.18,
    maxAng: 1.0, turbo: true, voice: [30, 250, 320, 2200, 0.24, 2] },
  // Ferrari F40, Liberty Walk kit: 2.9 L twin-turbo V8, 478 PS at 7000 rpm, 577 Nm at 4000 rpm, about 1250 kg, 5-speed
  // (ratios estimated to its 324 km/h at the 7750 redline), 0-100 4.1 s. Mid engine: 42 % on the front
  { name: 'Ferrari F40 LB-Works', model: 'f40', price: 90000, color: '#c0161e', hp: 685, kg: 1254, vmax: 313, real: '2.9L V8 twin-turbo · zin 478 mã lực · 324 km/h',
    mass: 1254, a: 1.421, b: 1.029, h: 0.45, torque: 835, pk: 0.52, redline: 7750, idle: 950, gears: [2.077, 1.474, 1.13, 0.917, 0.759],
    final: 3.9, R: 0.317, drag: 0.3, muF: 1.14, muR: 1.2, pkF: 0.12, pkR: 0.105, slide: 0.84, lock: 0.8, steerIn: 0.58, brake: 1.15,
    maxAng: 1.0, turbo: true, voice: [28, 230, 310, 2100, 0.26, 2] },
  // Nissan 180SX of Team Toyo Tires Drift Wisteria, D1 Grand Prix 2018 car #66 (Hideyuki Fujino): a 2JZ swap stroked
  // to 3.4 L, about 850 PS. Capped here like the other pro builds
  { name: 'Nissan 180SX Wisteria D1', model: 'wis', price: 100000, color: '#1f6fd0', hp: 780, kg: 1200, vmax: 315, real: '2JZ 3.4L độ (thay máy) · ~850 mã lực · xe D1GP #66',
    mass: 1200, a: 1.114, b: 1.361, h: 0.46, torque: 900, pk: 0.6, redline: 8000, idle: 1000, gears: [3.827, 2.36, 1.685, 1.312, 1.0, 0.793],
    final: 3.7, R: 0.306, drag: 0.32, muF: 1.16, muR: 1.22, pkF: 0.12, pkR: 0.105, slide: 0.85, lock: 0.95, steerIn: 0.64, brake: 1.15,
    maxAng: 1.12, turbo: true, voice: [33, 270, 340, 2400, 0.1, 1.5],
    align: { camF: -5, camR: -0.75, toeF: -0.05, toeR: 0.2, cas: 9, ack: 15 } },   // (its D1 alignment)
];
// body ends (rear, front) and half width of each model, for the walls
const DRIFT_BODY = { z280: [-2.1, 2.18, 0.88], n180: [-2.4, 2.14, 0.9], m65: [-2.52, 2.04, 0.9], gr86: [-2.22, 2.17, 0.97],
  boss: [-2.52, 2.17, 0.91], supra: [-2.24, 2.28, 0.9], r34: [-2.38, 2.22, 0.95], rx7vs: [-2.2, 2.13, 0.97], gtr: [-2.55, 2.28, 1.02],
  s15c: [-2.4, 2.2, 0.98], gt86ss: [-2.23, 2.3, 1.0], s15lb: [-2.5, 2.3, 0.92], gtd: [-2.5, 2.22, 1.0], gt2: [-1.88, 2.3, 0.93], rx7bn: [-2.25, 2.2, 0.98], r35: [-2.55, 2.35, 1.03], f40: [-1.92, 2.5, 1.0],
  wis: [-2.42, 2.12, 0.96] };
// liveries: stripes drawn over the paint (models.js liveryPaint). A car's livery is a string, the style's number and
// the stripes' colour ('2#f2f2f0'); '' = plain paint
const DRIFT_LIVERIES = ['KHÔNG', 'SỌC ĐÔI', 'SỌC ĐƠN VIỀN', 'SỌC LỆCH', 'SỌC SƯỜN', 'SỌC ĐÔI + SƯỜN'];
const Livery = {
  clean(v) { v = String(v || ''); return /^[1-5]#[0-9a-fA-F]{6}$/.test(v) ? v : ''; },
  style(v) { return +this.clean(v).charAt(0) || 0; },
  color(v) { return this.clean(v).slice(1); },
  // a stripe colour that shows on a paint: dark on light paint, white on the rest
  contrast(paint) { const n = parseInt(String(paint).slice(1), 16), l = ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255; return l > 0.6 ? '#14161a' : '#f2f2f0'; },
};
// engines: the car's own, two stages of tuning on it, and swaps (their own torque, rev range, sound and weight). A car's
// engine is an id ('' = its own); Engine.spec(car, id) is the car as the physics and the garage see it with that engine
const DRIFT_ENGINES = [
  { id: '', name: 'Máy gốc của xe', price: 0, desc: 'Động cơ theo xe.' },
  { id: 'st1', name: 'Độ Stage 1', price: 4000, k: 1.15, desc: 'Trên máy gốc: ECU, cổ hút, ống xả. Thêm 15% mô-men, tính nết xe giữ nguyên.' },
  { id: 'st2', name: 'Độ Stage 2', price: 12000, k: 1.35, pkUp: 0.04, turbo: true, dkg: 15, desc: 'Trên máy gốc: turbo lớn, kim phun, két làm mát khí nạp. Thêm 35% mô-men, lực kéo dồn lên tua cao.' },
  { id: 'sr20', name: 'SR20DET 2.0L turbo', price: 10000, torque: 500, pk: 0.62, redline: 7800, idle: 950, turbo: true, dkg: -20, voice: [31, 250, 330, 2400, 0.3, 2],
    desc: 'Máy 4 xi-lanh turbo của Silvia: nhẹ đầu xe, bốc ở tua cao, dễ giữ bánh quay.' },
  { id: '13b', name: '13B rotary turbo', price: 18000, torque: 480, pk: 0.7, redline: 9000, idle: 1000, turbo: true, dkg: -40, voice: [42, 330, 440, 3000, 0.16, 3],
    desc: 'Máy xoay của RX-7: nhẹ nhất, quay tới 9000 vòng/phút, lực kéo nằm hết ở tua cao.' },
  { id: 'ls3', name: 'LS3 V8 6.2L', price: 22000, torque: 760, pk: 0.5, redline: 6800, idle: 750, turbo: false, dkg: 20, voice: [24, 200, 250, 1500, 0.44, 1.5],
    desc: 'V8 hút khí tự nhiên: mô-men lớn ngay từ tua thấp, ga đều và dễ đoán, tua máy thấp.' },
  { id: 'rb26', name: 'RB26DETT 2.6L twin-turbo', price: 26000, torque: 720, pk: 0.6, redline: 8200, idle: 900, turbo: true, dkg: 40, voice: [33, 260, 330, 2400, 0.22, 2],
    desc: '6 xi-lanh thẳng hàng của Skyline GT-R: khỏe và quay cao, nặng đầu hơn.' },
  { id: '2jz', name: '2JZ-GTE 3.0L turbo', price: 36000, torque: 960, pk: 0.58, redline: 7800, idle: 900, turbo: true, dkg: 50, voice: [33, 270, 340, 2400, 0.1, 1.5],
    desc: '6 xi-lanh thẳng hàng của Supra, turbo đơn lớn: rất nhiều mô-men, bánh sau luôn sẵn sàng quay.' },
  { id: 'vr38', name: 'VR38DETT 3.8L V6 twin-turbo', price: 52000, torque: 1150, pk: 0.56, redline: 7400, idle: 900, turbo: true, dkg: 60, voice: [30, 250, 320, 2200, 0.24, 2],
    desc: 'V6 twin-turbo của GT-R R35: mạnh nhất, nặng nhất. Cần chân ga nhẹ nhàng.' },
];
const Engine = {
  clean(v) { return DRIFT_ENGINES.some(e => e.id === v) ? v : ''; },
  get(id) { return DRIFT_ENGINES.find(e => e.id === id) || DRIFT_ENGINES[0]; },
  // (a plain copy of the car with the engine's figures; hp as the car table counts it. The final drive comes with the
  // engine: regeared so the top gear reaches the same share of the speed the power could pull as the car's own
  // gearing did - more power = more speed in every gear, not only more wheelspin)
  gearV(s, g) { return s.redline / (s.gears[g] * s.final) / 60 * 2 * Math.PI * s.R * 3.6; },   // km/h at the red line in gear g (0 = first)
  dragV(s) { return Math.cbrt(s.hp * 745.7 / s.drag) * 3.6; },
  // seconds from rest to v km/h, about: the lesser of what the rear tyres take (with the weight moving onto them) and
  // what the power gives, against the drag
  time(s, v) {
    const L = s.a + s.b, k = s.muR * TRACTION * 0.86 * (s.tracK || 1), at = k * s.a * 9.81 / (L - k * s.h), P = s.hp * 745.7 * 0.8;
    let t = 0;
    for (let u = 0.5; u < v / 3.6; u += 0.5) t += 0.5 / Math.max(0.2, Math.min(at, P / (s.mass * u)) - s.drag * u * u / s.mass - 0.13);
    return t;
  },
  spec(car, id) {
    const e = this.get(id);
    if (!e.id) return car;
    const s = Object.assign({}, car, { eng: e.id, base: car });
    s.torque = e.torque || Math.round(car.torque * e.k / 5) * 5;
    s.pk = e.pk || Math.min(0.72, car.pk + (e.pkUp || 0));
    s.redline = e.redline || car.redline; s.idle = e.idle || car.idle;
    if (e.turbo !== undefined) s.turbo = e.turbo;
    if (e.voice) s.voice = e.voice;
    s.mass = car.mass + (e.dkg || 0); s.kg = car.kg + (e.dkg || 0);
    s.hp = e.torque ? Math.round(s.torque * s.redline * s.pk / 5600 / 5) * 5 : Math.round(car.hp * e.k / 5) * 5;
    const top = s.gears.length - 1, share = Math.min(1, this.gearV(car, top) / this.dragV(car)), want = share * this.dragV(s);
    s.final = +(car.final * this.gearV(s, top) / want).toFixed(2);
    s.vmax = Math.round(this.gearV(s, top));
    // wider rear tyres come with the power: more of it reaches the road (forward traction only - the sideways grip and
    // the car's balance stay). Without them every engine would pull alike below about 150 km/h: the stock tyres are
    // already at their limit with the stock engine
    s.tracK = U.clamp(Math.pow(s.hp / car.hp, 0.35), 0.9, 1.4);
    return s;
  },
};
// wheels: every car model's own rims and tyres can be fitted to any car (models.js setRim sizes them to the car's
// tyres). A car's wheels are a string: '' its own; '<model>' another car's; either followed by '#rrggbb', the colour of
// the rims' faces ('gr86#f2f2f0', '#c9a227')
const RIM_COLS = ['', '#f2f2f0', '#c8ccd2', '#8e949c', '#3a3d44', '#14161a', '#c9a227', '#b0703a', '#c0161e', '#e8650f', '#f0c419', '#2f8a3a', '#1ea0dc', '#1f6fd0', '#6a2c91', '#e85aa0'];
const Rim = {
  clean(v) { const m = /^([a-z0-9]{0,8})(#[0-9a-fA-F]{6})?$/.exec(String(v || '')); return m ? (DRIFT_CARS.some(c => c.model === m[1]) ? m[1] : '') + (m[2] || '') : ''; },
  model(v) { return this.clean(v).split('#')[0]; },
  color(v) { const c = this.clean(v).split('#')[1]; return c ? '#' + c : ''; },
  make(model, col) { return this.clean((model || '') + (col || '')); },
};
const DRIFT_PAINTS = ['#f2f2f0', '#14161a', '#8e949c', '#c0161e', '#e8650f', '#f0c419', '#2f8a3a', '#1ea0dc', '#1f6fd0', '#16245a', '#6a2c91', '#e85aa0', '#20b8b0'];

// ---------------- wheel alignment: camber, toe, caster ----------------
// Degrees, each wheel. camF / camR: camber (- = the top of the tyre leans in towards the car), toeF / toeR: toe (+ = toe-in,
// the front of the tyre points in; - = toe-out), cas: caster (the steering axis leans back at the top). rng: [lowest,
// highest, step]. stock: a street car's factory alignment - the handling the rest of this file was tuned with, so every
// effect below is 1 (or 0) there. A car may come with its own (spec.align: the pro builds)
const DEG = Math.PI / 180;
const ALIGN = {
  // ack: Ackermann, % (100 = the inner front wheel steers further than the outer one, as on a road car; 0 = both turn
  // alike, as on a drift car). lock: steering lock, degrees (a car comes with its own, spec.lock; an angle kit adds more)
  keys: ['camF', 'camR', 'toeF', 'toeR', 'cas', 'ack', 'lock'],
  rng: { camF: [-8, 2, 0.25], camR: [-4, 2, 0.25], toeF: [-1, 1, 0.05], toeR: [-1, 1, 0.05], cas: [2, 12, 0.25], ack: [0, 100, 5], lock: [30, 85, 1] },
  stock: { camF: -0.75, camR: -1.25, toeF: 0.05, toeR: 0.1, cas: 5.5, ack: 100, lock: 45 },
  // Ackermann: geo x sin²(steer) = how far apart (rad) the two front wheels point at full Ackermann. In a drift, on
  // counter-steer, that split puts one tyre past its best slip: without it the front grips up to `grip` more and the
  // slide sheds up to `drag` m/s² less (x the split); gripping, parallel wheels scrub in tight turns (`turn` less bite).
  // lockAng: drift angle the car holds per radian of steering lock beyond its own
  ack: { geo: 0.58, grip: 0.07, drag: 1.0, turn: 0.04, lockAng: 0.5 },
  // body roll (degrees per m/s² sideways) and the share of it that reaches the tyres' camber (strut front, multi-link
  // rear); ltF: the front's share of the load transfer against an even split (drift cars are stiffer at the front)
  roll: 0.3, rollF: 0.7, rollR: 0.45, ltF: 1.45, track: 1.5,
  // a loaded tyre grips best at opt degrees of camber to the road; it loses kNeg (on its inner shoulder) / kPos (rolled
  // onto the outer one) per degree² away from that, never below floor
  opt: -0.8, kNeg: 0.005, kPos: 0.008, floor: 0.6,
  // the moments the garage judges a setup at: a drift (sideways acceleration m/s² + counter-steer, rad) and a turn-in
  drift: { ay: 7.5, steer: -0.42 }, turn: { ay: 5, steer: 0.08 },
};
const Align = {
  def(spec) { return this.clean(Object.assign({}, ALIGN.stock, { lock: Math.round(spec.lock / DEG) }, spec.align)); },
  // a valid setup (saves, the network): every angle on its step, within its range
  // (spec: the car - an angle the setup lacks (a save from before it existed) is the car's own)
  clean(a, spec) {
    const o = {}, d = spec ? this.def(spec) : ALIGN.stock;
    for (const k of ALIGN.keys) {
      const [lo, hi, st] = ALIGN.rng[k], v = a && a[k] !== undefined && a[k] !== null ? Number(a[k]) : NaN;
      o[k] = Number.isFinite(v) ? U.clamp(Math.round(v / st) * st, lo, hi) : d[k];
      o[k] = +o[k].toFixed(2);
    }
    return o;
  },
  same(a, b) { return ALIGN.keys.every(k => Math.abs(a[k] - b[k]) < 1e-6); },
  // grip of a loaded tyre at camber g (degrees, to the road)
  grip(g) { const d = g - ALIGN.opt; return Math.max(ALIGN.floor, 1 - (d > 0 ? ALIGN.kPos : ALIGN.kNeg) * d * d); },
  // the camber the caster adds to the LEFT front wheel steered by d (rad, + = left): + = its top leans out. Both wheels
  // lean the way they are steered, so the wheel on the outside of the steer gains negative camber, the inside one positive
  casG(cas, d) { return Math.asin(Math.sin(cas * DEG) * Math.sin(d)) / DEG; },
  // camber of the left and right wheel (degrees) of an axle at sideways acceleration ay (m/s², + = turning left: the body
  // rolls right, the left wheel's top leans in, the right one's out) and steer (rad)
  cambers(a, front, ay, steer) {
    const cam = front ? a.camF : a.camR, ph = ay * ALIGN.roll * (front ? ALIGN.rollF : ALIGN.rollR), cg = front ? this.casG(a.cas, steer) : 0;
    return [cam - ph + cg, cam + ph - cg];
  },
  // sideways grip of an axle: its two tyres weighted by their load
  axle(a, front, ay, steer, h) {
    const [gL, gR] = this.cambers(a, front, ay, steer);
    const lt = U.clamp(ay * h / (ALIGN.track * 9.81) * (front ? ALIGN.ltF : 2 - ALIGN.ltF), -0.48, 0.48);
    return (0.5 - lt) * this.grip(gL) + (0.5 + lt) * this.grip(gR);
  },
  // ... against the stock alignment in the same moment (the physics multiplies the tyres' grip by it)
  axleK(a, front, ay, steer, h) { return this.axle(a, front, ay, steer, h) / this.axle(ALIGN.stock, front, ay, steer, h); },
  // the effects that do not change from moment to moment (each 1, or 0, with the stock alignment):
  // brake: front braking grip (camber tilts the tyre onto one shoulder), trac: rear traction (camber; toe-in adds forward
  // bite, too much drags), pkF: the front's peak slip (toe-out = sharper turn-in), steer: how fast the keys turn the
  // wheels (toe-out quicker; lots of caster = heavy), self: how fast the wheel spins back into counter-steer in a drift
  // (caster's self-centring), yawD: yaw damping at speed while gripping, 1/s (toe-in and caster calm the car, toe-out
  // makes it darty), snap: how firmly a tail swinging past the car's angle is caught (rear toe-out: it snaps round),
  // drag: speed a drift sheds from the toed-out outer rear tyre scrubbing sideways (m/s²), gripR: rear grip while
  // gripping (toe-in: steady and slower to break into a drift, toe-out: loose), scrub: rolling resistance from toe.
  // (None of them touches the drift assist's hold on the angle or the line: the assists turn any looseness into a
  // slide - drift points - so an alignment that only made the car twitchier would earn points instead of costing them)
  fx(a) {
    const s = ALIGN.stock, out = t => Math.min(0, t);
    const lonF = g => 1 - 0.0045 * (g + 0.3) ** 2, lonR = g => 1 - 0.006 * (g + 0.3) ** 2;
    // forward bite: best at about 0.2° of rear toe-in, less toed out (the tyres push against each other)
    const bite = t => 1 + 0.06 * t - 0.2 * t * t;
    // front toe-out quickens the steering (no further past about 0.2°: beyond that it only scrubs and wanders)
    const quick = t => 1 + 0.12 * Math.tanh(-t / 0.15);
    const heavy = c => Math.max(0.5, 1 - 0.012 * Math.max(0, c - 6) ** 2), self = c => 0.55 + 0.08 * c;
    const light = heavy(a.cas) / heavy(s.cas);
    // yaw damping: the real figure (yawRaw, the garage shows it) and what the physics uses - capped on the twitchy side
    // (see above). Toe either way scrubs, much more past a few tenths of a degree
    const yawRaw = 1.2 * (a.toeF - s.toeF) - 4 * (out(a.toeF) ** 2 - out(s.toeF) ** 2) + 0.07 * (a.cas - s.cas) + 0.3 * (a.toeR - s.toeR);
    const sc = t => 0.006 * Math.abs(t) + 0.04 * Math.max(0, Math.abs(t) - 0.3) ** 2;
    return {
      brake: lonF(a.camF) / lonF(s.camF),
      trac: Math.max(0.9, lonR(a.camR) * bite(a.toeR) / (lonR(s.camR) * bite(s.toeR))),
      pkF: quick(s.toeF) / quick(a.toeF),
      light, steer: quick(a.toeF) / quick(s.toeF) * light,
      self: self(a.cas) / self(s.cas),
      yawRaw, yawD: U.clamp(yawRaw, -0.3, 0.8),
      snap: U.clamp(1 + 1.2 * a.toeR, 0.4, 1), drag: 1.2 * Math.max(0, -a.toeR),
      gripR: U.clamp(1 + 0.06 * (a.toeR - s.toeR), 0.96, 1.04),
      scrub: sc(a.toeF) + sc(a.toeR) - sc(s.toeF) - sc(s.toeR),
      // (lockK: past about 57 degrees of lock the steering turns heavier - slower on the keys while gripping)
      ack: a.ack / 100, lock: a.lock * DEG, lockK: 1 - 0.6 * Math.max(0, a.lock * DEG - 1.0),
    };
  },
  // the effects for a car: fx plus the drift angle it holds (more steering lock than the car's own = more angle)
  car(a, spec) {
    const f = this.fx(a);
    f.maxAng = U.clamp(spec.maxAng + ALIGN.ack.lockAng * (f.lock - spec.lock), 0.6, 1.4);
    f.angK = f.maxAng / spec.maxAng;   // (the drift angle the keys ask for grows with it: the extra lock gets used)
    return f;
  },
  // how far apart the front wheels point (rad) at full Ackermann, steered by d; the same as a share of a big split
  ackSplit(d) { return ALIGN.ack.geo * Math.sin(d) ** 2; },
  // what the garage shows: each effect as a ratio to the stock alignment (> 1 better), with its weight in the drift rating
  STATS: [['frontD', 'BÁM ĐẦU KHI DRIFT', 0.26], ['turn', 'BÁM ĐẦU VÀO CUA', 0.08], ['rearD', 'BÁM ĐUÔI KHI DRIFT', 0.06],
    ['trac', 'LỰC KÉO (BÁM GA)', 0.12], ['brake', 'PHANH', 0.04], ['resp', 'ĂN LÁI', 0.07], ['self', 'TỰ TRẢ LÁI NGƯỢC', 0.1],
    ['light', 'NHẸ LÁI', 0.08], ['hs', 'ỔN ĐỊNH TỐC ĐỘ CAO', 0.08], ['snap', 'CHỐNG GIẬT XOAY', 0.06], ['init', 'DỄ VÀO DRIFT', 0.04],
    ['roll', 'GIỮ TỐC (MA SÁT LỐP)', 0.05]],
  // (the rating: a weighted sum of the logs; a car with more weight over the rear axle needs its tail steadier)
  stats(a, spec, noScore) {
    const f = this.fx(a), h = spec ? spec.h : 0.48, D = ALIGN.drift, Tn = ALIGN.turn, rearK = spec ? 2 * spec.a / (spec.a + spec.b) : 1;
    // Ackermann and lock: parallel wheels bite better on counter-steer and shed less speed, a little less bite turning
    // in; more lock catches a tail that swings too far (and is heavier to turn)
    const K = ALIGN.ack, par = 1 - f.ack, lk0 = spec ? spec.lock : ALIGN.stock.lock * DEG;
    const st = {
      frontD: this.axleK(a, true, D.ay, D.steer, h) * (1 + K.grip * par * Math.min(1, this.ackSplit(0.75) / 0.25)), rearD: this.axleK(a, false, D.ay, D.steer, h),
      turn: this.axleK(a, true, Tn.ay, Tn.steer, h) * (1 - K.turn * par),
      resp: f.steer / f.pkF, self: f.self, light: f.light * f.lockK, snap: f.snap * (1 + 0.5 * (f.lock - lk0)), init: 1 / f.gripR,
      trac: f.trac, brake: 0.62 * f.brake + 0.38, hs: f.yawRaw < 0 ? Math.max(0.3, 1 + f.yawRaw / 3) : 1 + 0.25 * Math.tanh(f.yawRaw / 0.75), roll: 1 - f.scrub * 6 - f.drag * 0.12 + 0.04 * par,
    };
    let sc = 0;
    for (const [k, , w] of this.STATS) sc += w * (k === 'snap' || k === 'hs' ? rearK : 1) * Math.log(Math.max(0.05, st[k]));
    st.raw = sc;
    // 50 = the stock alignment, 100 = the best this car can get
    if (!noScore) { const best = this.best(spec); st.score = U.clamp(Math.round(50 + 50 * sc / Math.max(1e-6, best.raw)), 0, 100); }
    return st;
  },
  _best: {},
  best(spec) {
    const k = spec ? spec.model : '-';
    if (!this._best[k]) { const a = this.optimize(spec); this._best[k] = { a, raw: this.stats(a, spec, true).raw }; }
    return this._best[k];
  },
  // the best drift setup for a car: coordinate search over the steps from the stock one
  optimize(spec, from) {
    let a = this.clean(from || (spec ? this.def(Object.assign({}, spec, { align: null })) : ALIGN.stock)), best = this.stats(a, spec, true).raw;
    for (let pass = 0; pass < 60; pass++) {
      let moved = false;
      for (const k of ALIGN.keys) for (const dir of [1, -1]) for (const n of [8, 4, 2, 1]) {
        const b = Object.assign({}, a); b[k] += dir * n * ALIGN.rng[k][2];
        if (b[k] < ALIGN.rng[k][0] - 1e-9 || b[k] > ALIGN.rng[k][1] + 1e-9) continue;
        const v = this.stats(this.clean(b), spec, true).raw;
        if (v > best + 1e-9) { best = v; a = this.clean(b); moved = true; }
      }
      if (!moved) break;
    }
    return a;
  },
};

// ---------------- maps ----------------
// Mountain passes are point-to-point: a list of moves ['S', metres] straight, ['L' | 'R', degrees, radius] corners;
// drop = metres the road falls from start to finish, waves = [metres, waves over the run, phase] of rise and fall.
// A pair of 225 degree corners of opposite hand is a figure of eight: two lobes that touch where the road swaps from
// one to the other (a road cannot cross itself, so each lobe is five eighths of a circle; wider angles fold onto the
// road leading in).
// The arena is a closed circuit like the GP tracks (corner points [x, y, radius]). edge = half width of the tarmac and
// wall = the guard rail / barrier (x5 m from the centre line). grades: scores for C, B, A, S, SS. scenery: 'forest'
// lines the road with pines (else rocks and leafy trees); World keys the sky, terrain and far scenery by id
const DRIFT_MAPS = [
  {
    id: 'dMaPiLeng', name: 'Đèo Mã Pí Lèng', desc: 'Hà Giang · 7,4 km vách đá, vực Nho Quế, 8 cua tay áo, 2 khúc số 8, zíc zắc và rắn lượn',
    edge: 1.8, wall: 2.15, drop: 115, waves: [[7, 4, 0.4], [3, 11, 1.3]], centre: 'double',
    grades: [72000, 179000, 361000, 606000, 953000],
    seq: [['S',  150], ['L',  55,  70], ['S',  60], ['R',  85,  38], ['S',  40], ['L',  40,  60], ['R',  45,  50], ['S',  90], ['L',  165,  18],
      ['S',  110], ['R',  150,  21], ['S',  80], ['L',  70,  34], ['R',  80,  30], ['L',  75,  32], ['R',  60,  36], ['S',  70], ['L',  35,  80],
      ['R',  35,  80], ['S',  110], ['R',  170,  17], ['S',  130], ['L',  160,  19], ['S',  90], ['R',  65,  42], ['L',  100,  27], ['S',  60],
      ['R',  120,  24], ['S',  80], ['L',  225,  36], ['R',  225,  36], ['S',  90], ['L',  60,  45], ['S',  120], ['R',  90,  30], ['L',  90,  30],
      ['R',  90,  30], ['L',  90,  30], ['S',  100], ['R',  175,  20], ['S',  120], ['L',  175,  20], ['S',  150], ['R',  50,  40], ['L',  70,  35],
      ['R',  70,  35], ['L',  50,  40], ['S',  80], ['R',  140,  24], ['S',  70], ['L',  130,  26], ['S',  100], ['L',  60,  34], ['R',  75,  30],
      ['L',  75,  30], ['R',  60,  34], ['S',  80], ['L',  170,  19], ['S',  110], ['R',  170,  19], ['S',  140], ['L',  225,  36], ['R',  225,  36],
      ['S',  90], ['L',  85,  28], ['R',  90,  28], ['L',  90,  28], ['R',  85,  28], ['S',  90], ['R',  120,  24], ['S',  60], ['L',  45,  50],
      ['R',  45,  50], ['R',  65,  32], ['L',  86,  32], ['R',  76,  28], ['L',  57,  34], ['S',  74], ['L',  85,  30], ['R',  90,  30], ['L',  90,  30],
      ['R',  90,  30], ['S',  91], ['R',  67,  36], ['L',  85,  31], ['R',  84,  29], ['L',  67,  35], ['S',  61], ['L',  66,  34], ['R',  85,  30],
      ['L',  79,  29], ['R',  60,  34], ['S',  86], ['L',  59,  33], ['R',  84,  28], ['L',  77,  30], ['R',  58,  32], ['S',  82], ['S',  160]],
  },
  {
    id: 'dOQuyHo', name: 'Đèo Ô Quy Hồ', desc: 'Sa Pa · 7,3 km rừng thông hoàng hôn, 10 cua kẹp tóc, 2 khúc số 8, ngoặt liên hoàn',
    edge: 1.8, wall: 2.15, drop: 140, waves: [[6, 5, 1.1], [2.5, 12, 0.2]], centre: 'dash', scenery: 'forest',
    grades: [67000, 164000, 332000, 559000, 878000],
    seq: [['S',  150], ['R',  45,  90], ['S',  50], ['L',  70,  45], ['S',  70], ['R',  175,  17], ['S',  150], ['L',  175,  17], ['S',  150],
      ['R',  175,  18], ['S',  120], ['L',  80,  40], ['R',  60,  45], ['L',  50,  55], ['S',  90], ['R',  110,  26], ['S',  60], ['L',  140,  22],
      ['S',  100], ['R',  40,  70], ['L',  40,  70], ['S',  80], ['L',  225,  36], ['R',  225,  36], ['S',  90], ['L',  170,  18], ['S',  140],
      ['R',  170,  18], ['S',  110], ['L',  90,  32], ['S',  50], ['R',  75,  36], ['S',  120], ['L',  60,  38], ['R',  85,  32], ['L',  85,  32],
      ['R',  85,  32], ['L',  60,  38], ['S',  90], ['R',  160,  20], ['S',  100], ['L',  160,  20], ['S',  80], ['R',  45,  50], ['L',  70,  36],
      ['R',  90,  30], ['L',  70,  36], ['S',  100], ['R',  175,  18], ['S',  130], ['L',  175,  18], ['S',  130], ['R',  175,  18], ['S',  100],
      ['L',  225,  36], ['R',  225,  36], ['S',  90], ['L',  65,  34], ['R',  85,  30], ['L',  85,  30], ['R',  85,  30], ['L',  65,  34], ['S',  90],
      ['R',  110,  26], ['S',  50], ['L',  110,  26], ['L',  65,  36], ['R',  83,  28], ['L',  82,  29], ['R',  57,  33], ['S',  85], ['R',  86,  29],
      ['L',  90,  29], ['R',  90,  29], ['L',  86,  29], ['S',  88], ['R',  56,  33], ['L',  83,  32], ['R',  83,  32], ['L',  68,  34], ['S',  85],
      ['L',  94,  29], ['R',  90,  29], ['L',  90,  29], ['R',  91,  29], ['S',  94], ['R',  70,  35], ['L',  81,  30], ['R',  84,  31], ['L',  57,  32],
      ['S',  69], ['S',  160]],
  },
  {
    id: 'dHaiVan', name: 'Đèo Hải Vân', desc: 'Đà Nẵng – Huế · 8,0 km vách đá trên biển, 6 cua tay áo, 2 khúc số 8, ngoặt dồn dập',
    edge: 1.8, wall: 2.15, drop: 130, waves: [[8, 3, 0.9], [3, 9, 0.2]], centre: 'double',
    grades: [90000, 223000, 450000, 756000, 1186000],
    seq: [['S',  150], ['R',  140,  23], ['S',  77], ['L',  123,  24], ['S',  71], ['R',  69,  34], ['L',  85,  31], ['R',  83,  29], ['L',  64,  34],
      ['S',  89], ['L',  45,  50], ['R',  67,  35], ['L',  89,  30], ['R',  79,  33], ['S',  97], ['R',  88,  29], ['L',  90,  29], ['R',  90,  29],
      ['L',  91,  29], ['S',  97], ['R',  171,  18], ['S',  104], ['R',  59,  34], ['L',  79,  30], ['R',  84,  30], ['L',  69,  35], ['S',  85],
      ['L',  124,  22], ['S',  69], ['R',  110,  24], ['S',  101], ['L',  225,  36], ['R',  225,  36], ['S',  90], ['L',  171,  20], ['S',  105],
      ['R',  63,  35], ['L',  80,  31], ['R',  77,  32], ['L',  65,  34], ['S',  84], ['R',  162,  20], ['S',  113], ['R',  68,  32], ['S',  67],
      ['L',  87,  27], ['R',  90,  27], ['L',  90,  27], ['R',  88,  27], ['S',  81], ['R',  70,  34], ['L',  85,  32], ['R',  79,  28], ['L',  59,  33],
      ['S',  78], ['L',  91,  28], ['R',  90,  28], ['L',  90,  28], ['R',  90,  28], ['S',  95], ['L',  170,  21], ['S',  125], ['L',  64,  36],
      ['R',  78,  30], ['L',  76,  30], ['R',  69,  33], ['S',  79], ['L',  62,  34], ['R',  86,  31], ['L',  87,  29], ['R',  68,  34], ['S',  78],
      ['R',  134,  22], ['S',  61], ['L',  225,  36], ['R',  225,  36], ['S',  90], ['L',  107,  23], ['S',  94], ['L',  48,  54], ['R',  75,  35],
      ['L',  87,  30], ['R',  80,  34], ['S',  96], ['L',  46,  49], ['R',  72,  35], ['L',  92,  31], ['R',  71,  33], ['S',  91], ['R',  71,  37],
      ['S',  65], ['L',  58,  34], ['R',  85,  28], ['L',  80,  31], ['R',  59,  34], ['S',  87], ['R',  165,  20], ['S',  97], ['L',  133,  24],
      ['S',  65], ['R',  135,  23], ['S',  79], ['L',  163,  18], ['S',  121], ['L',  95,  29], ['R',  90,  29], ['L',  90,  29], ['R',  92,  29],
      ['S',  87], ['S',  160]],
  },
  {
    id: 'dKhauPha', name: 'Đèo Khau Phạ', desc: 'Yên Bái · 7,7 km giữa ruộng bậc thang mùa lúa chín, 78 khúc cua gấp, 2 khúc số 8',
    edge: 1.8, wall: 2.15, drop: 120, waves: [[6, 4, 2.0], [3, 10, 0.7]], centre: 'dash',
    grades: [107000, 265000, 534000, 897000, 1409000],
    seq: [['S',  150], ['L',  175,  19], ['S',  115], ['R',  176,  19], ['S',  123], ['L',  128,  26], ['S',  67], ['R',  119,  26], ['S',  93],
      ['R',  42,  51], ['L',  69,  34], ['R',  85,  31], ['L',  73,  37], ['S',  95], ['L',  64,  34], ['R',  78,  28], ['L',  82,  29], ['R',  64,  35],
      ['S',  69], ['R',  90,  29], ['L',  90,  29], ['R',  90,  29], ['L',  94,  29], ['S',  96], ['L',  49,  52], ['R',  73,  34], ['L',  86,  32],
      ['R',  76,  35], ['S',  85], ['R',  79,  31], ['S',  51], ['L',  225,  38], ['R',  225,  38], ['S',  90], ['R',  69,  33], ['L',  81,  28],
      ['R',  81,  28], ['L',  67,  33], ['S',  60], ['L',  46,  55], ['R',  71,  36], ['L',  93,  30], ['R',  71,  36], ['S',  79], ['R',  64,  34],
      ['L',  82,  30], ['R',  86,  30], ['L',  63,  35], ['S',  62], ['R',  93,  27], ['L',  90,  27], ['R',  90,  27], ['L',  87,  27], ['S',  89],
      ['L',  88,  27], ['R',  90,  27], ['L',  90,  27], ['R',  94,  27], ['S',  95], ['R',  46,  54], ['L',  79,  36], ['R',  92,  30], ['L',  72,  33],
      ['S',  95], ['R',  90,  27], ['L',  90,  27], ['R',  90,  27], ['L',  85,  27], ['S',  87], ['L',  67,  32], ['R',  88,  32], ['L',  85,  31],
      ['R',  62,  34], ['S',  72], ['L',  225,  38], ['R',  225,  38], ['S',  90], ['L',  62,  34], ['R',  80,  30], ['L',  87,  29], ['R',  66,  34],
      ['S',  80], ['R',  85,  29], ['L',  90,  29], ['R',  90,  29], ['L',  86,  29], ['S',  88], ['R',  93,  29], ['L',  90,  29], ['R',  90,  29],
      ['L',  92,  29], ['S',  86], ['R',  162,  17], ['S',  128], ['R',  63,  34], ['L',  76,  30], ['R',  87,  29], ['L',  69,  33], ['S',  65],
      ['R',  70,  36], ['L',  86,  30], ['R',  78,  31], ['L',  65,  35], ['S',  68], ['L',  61,  34], ['R',  82,  30], ['L',  83,  31], ['R',  66,  34],
      ['S',  70], ['S',  160]],
  },
  {
    id: 'dPhaDin', name: 'Đèo Pha Đin', desc: 'Điện Biên – Sơn La · 8,2 km sương sớm, cua nối cua không nghỉ, 83 khúc cua gấp, 2 khúc số 8',
    edge: 1.8, wall: 2.15, drop: 150, waves: [[7, 5, 0.3], [2.5, 13, 1.6]], centre: 'double',
    grades: [120000, 297000, 597000, 1003000, 1578000],
    seq: [['S',  150], ['R',  63,  36], ['L',  78,  29], ['R',  75,  32], ['L',  59,  34], ['S',  65], ['R',  92,  29], ['L',  90,  29], ['R',  90,  29],
      ['L',  93,  29], ['S',  91], ['L',  44,  51], ['R',  73,  35], ['L',  89,  31], ['R',  70,  35], ['S',  89], ['R',  59,  36], ['L',  77,  32],
      ['R',  83,  31], ['L',  57,  34], ['S',  66], ['L',  85,  27], ['R',  90,  27], ['L',  90,  27], ['R',  88,  27], ['S',  87], ['R',  59,  33],
      ['L',  81,  29], ['R',  84,  30], ['L',  62,  34], ['S',  83], ['L',  44,  53], ['R',  72,  35], ['L',  93,  31], ['R',  76,  36], ['S',  81],
      ['R',  225,  36], ['L',  225,  36], ['S',  90], ['R',  92,  27], ['L',  90,  27], ['R',  90,  27], ['L',  86,  27], ['S',  94], ['R',  65,  36],
      ['L',  83,  30], ['R',  88,  30], ['L',  69,  34], ['S',  75], ['L',  60,  34], ['R',  80,  28], ['L',  79,  31], ['R',  55,  35], ['S',  76],
      ['R',  47,  49], ['L',  65,  34], ['R',  88,  29], ['L',  79,  36], ['S',  85], ['R',  62,  34], ['L',  86,  30], ['R',  86,  30], ['L',  61,  33],
      ['S',  86], ['L',  61,  34], ['R',  82,  30], ['L',  84,  31], ['R',  60,  34], ['S',  89], ['R',  92,  28], ['L',  90,  28], ['R',  90,  28],
      ['L',  94,  28], ['S',  100], ['R',  93,  28], ['L',  90,  28], ['R',  90,  28], ['L',  94,  28], ['S',  89], ['R',  225,  36], ['L',  225,  36],
      ['S',  90], ['R',  130,  25], ['S',  57], ['L',  109,  24], ['S',  77], ['L',  86,  29], ['R',  90,  29], ['L',  90,  29], ['R',  90,  29],
      ['S',  87], ['R',  94,  27], ['L',  90,  27], ['R',  90,  27], ['L',  89,  27], ['S',  99], ['R',  58,  33], ['L',  84,  31], ['R',  82,  30],
      ['L',  66,  33], ['S',  88], ['L',  82,  39], ['S',  78], ['R',  87,  29], ['L',  90,  29], ['R',  90,  29], ['L',  95,  29], ['S',  100],
      ['L',  48,  48], ['R',  79,  33], ['L',  85,  31], ['R',  79,  37], ['S',  82], ['S',  160]],
  },
  {
    id: 'dKhanhLe', name: 'Đèo Khánh Lê', desc: 'Nha Trang – Đà Lạt · 7,9 km rừng thông lúc chạng vạng, 3 cua tay áo, 2 khúc số 8, zíc zắc liền nhau',
    edge: 1.8, wall: 2.15, drop: 160, waves: [[6, 4, 1.4], [3, 11, 0.5]], centre: 'dash', scenery: 'forest',
    grades: [104000, 258000, 520000, 874000, 1373000],
    seq: [['S',  150], ['L',  64,  35], ['R',  80,  29], ['L',  86,  31], ['R',  66,  33], ['S',  74], ['L',  169,  18], ['S',  107], ['R',  176,  18],
      ['S',  119], ['R',  62,  33], ['L',  78,  32], ['R',  84,  31], ['L',  67,  35], ['S',  76], ['R',  76,  39], ['S',  54], ['R',  47,  51],
      ['L',  75,  35], ['R',  89,  29], ['L',  73,  34], ['S',  95], ['R',  69,  39], ['S',  74], ['L',  65,  32], ['R',  86,  30], ['L',  82,  29],
      ['R',  59,  33], ['S',  84], ['L',  162,  20], ['S',  111], ['R',  225,  36], ['L',  225,  36], ['S',  90], ['L',  90,  29], ['R',  90,  29],
      ['L',  90,  29], ['R',  92,  29], ['S',  96], ['R',  44,  53], ['L',  75,  34], ['R',  84,  32], ['L',  78,  36], ['S',  73], ['L',  44,  52],
      ['R',  76,  34], ['L',  89,  30], ['R',  68,  37], ['S',  85], ['R',  59,  36], ['L',  79,  28], ['R',  88,  30], ['L',  59,  33], ['S',  83],
      ['L',  69,  32], ['S',  67], ['R',  70,  33], ['L',  78,  30], ['R',  78,  31], ['L',  68,  33], ['S',  85], ['R',  61,  33], ['L',  87,  31],
      ['R',  80,  29], ['L',  58,  32], ['S',  82], ['R',  59,  33], ['L',  84,  32], ['R',  78,  30], ['L',  55,  34], ['S',  79], ['L',  42,  50],
      ['R',  73,  35], ['L',  94,  31], ['R',  72,  34], ['S',  79], ['L',  225,  36], ['R',  225,  36], ['S',  90], ['R',  47,  50], ['L',  69,  37],
      ['R',  91,  31], ['L',  66,  36], ['S',  79], ['L',  89,  32], ['S',  73], ['R',  93,  29], ['L',  90,  29], ['R',  90,  29], ['L',  91,  29],
      ['S',  99], ['R',  121,  23], ['S',  74], ['L',  129,  24], ['S',  71], ['R',  69,  36], ['L',  81,  29], ['R',  78,  31], ['L',  67,  33],
      ['S',  80], ['R',  88,  37], ['S',  76], ['R',  69,  33], ['L',  81,  29], ['R',  85,  32], ['L',  64,  34], ['S',  66], ['R',  89,  30],
      ['L',  90,  30], ['R',  90,  30], ['L',  86,  30], ['S',  96], ['S',  160]],
  },
  {
    // big bends only (tools: a random search that keeps the road 42 m clear of itself): long sweepers, 100 to 225 degrees
    id: 'dBaoLoc', name: 'Đèo Bảo Lộc', desc: 'Lâm Đồng · 8,7 km rừng xanh, 36 cua lớn ôm dài 100–225°, bán kính 46–85 m, gần như không có đoạn thẳng',
    edge: 1.8, wall: 2.15, drop: 125, waves: [[6, 4, 0.8], [3, 10, 1.9]], centre: 'double', scenery: 'forest',
    grades: [125000, 310000, 625000, 1050000, 1650000],
    seq: [['S',  150], ['R',  135,  75], ['L',  150,  73], ['S',  45], ['R',  135,  71], ['L',  130,  81], ['S',  55], ['R',  215,  47],
      ['L',  195,  48], ['S',  70], ['R',  135,  63], ['L',  135,  74], ['S',  55], ['R',  165,  70], ['S',  45], ['L',  200,  46], ['R',  215,  54],
      ['S',  70], ['L',  205,  51], ['S',  70], ['R',  150,  64], ['L',  150,  81], ['S',  55], ['R',  155,  58], ['S',  65], ['L',  115,  73],
      ['R',  145,  62], ['S',  65], ['L',  185,  55], ['S',  90], ['R',  130,  69], ['L',  105,  78], ['S',  55], ['R',  200,  50], ['L',  200,  53],
      ['S',  65], ['R',  195,  55], ['S',  45], ['L',  125,  83], ['R',  150,  76], ['S',  55], ['L',  150,  64], ['S',  45], ['R',  100,  82],
      ['L',  120,  70], ['S',  45], ['R',  205,  54], ['S',  65], ['L',  190,  55], ['S',  85], ['R',  150,  67], ['S',  50], ['L',  105,  76],
      ['R',  140,  85], ['S',  70], ['L',  160,  55], ['S',  90], ['R',  155,  69], ['L',  145,  76], ['S',  45], ['S',  160]],
  },
  {
    // carousels: bends of 120 to 225 degrees on a 34 to 48 m radius, one straight into the next
    id: 'dThungKhe', name: 'Đèo Thung Khe', desc: 'Hòa Bình · 8,4 km núi đá trắng, 46 cua tròn 120–225° nối nhau liên tục, bán kính 34–48 m',
    edge: 1.8, wall: 2.15, drop: 110, waves: [[5, 5, 0.2], [2.5, 12, 1.1]], centre: 'dash',
    grades: [130000, 320000, 650000, 1090000, 1710000],
    seq: [['S',  150], ['L',  205,  36], ['R',  190,  36], ['S',  60], ['L',  155,  40], ['R',  150,  42], ['S',  35], ['L',  155,  44],
      ['R',  150,  40], ['S',  45], ['L',  185,  41], ['S',  65], ['R',  180,  41], ['S',  55], ['L',  195,  38], ['S',  35], ['R',  180,  39],
      ['L',  175,  39], ['S',  75], ['R',  190,  37], ['S',  60], ['L',  170,  34], ['R',  195,  38], ['L',  195,  38], ['S',  50], ['R',  205,  39],
      ['L',  180,  37], ['S',  50], ['R',  200,  42], ['L',  170,  40], ['S',  60], ['R',  175,  40], ['L',  205,  39], ['S',  70], ['R',  205,  41],
      ['S',  45], ['L',  190,  44], ['S',  60], ['R',  180,  41], ['L',  180,  38], ['S',  45], ['R',  170,  41], ['L',  200,  36], ['S',  65],
      ['R',  125,  42], ['L',  140,  41], ['S',  45], ['R',  185,  37], ['L',  160,  35], ['R',  185,  36], ['S',  65], ['L',  165,  39],
      ['R',  195,  35], ['L',  190,  37], ['S',  60], ['R',  195,  38], ['L',  200,  35], ['S',  45], ['R',  215,  36], ['L',  210,  40], ['S',  70],
      ['R',  205,  41], ['L',  205,  42], ['S',  45], ['R',  185,  42], ['S',  65], ['L',  200,  39], ['R',  205,  41], ['S',  50], ['L',  175,  41],
      ['R',  210,  42], ['S',  50], ['S',  160]],
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
    const forest = map.scenery === 'forest';
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
// multiplier grows every multD m of drifting (by distance, not time: a slower drift must not build it faster) and with
// every change of direction; `wall` m from the rail = close bonus
// crash: speed (m/s) into the rail (or another car) that loses the whole chain (a softer brush only costs 30% of it)
// tandem: drifting within this many metres of another drifting car scores x1.5
const DSCORE = { minKmh: 22, minAng: 12, rate: 6, gap: 1.6, multD: 60, maxMult: 5, wall: 1.0, spin: 112, crash: 3.5, tandem: 7 };
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
// engine braking (off the throttle, in gear): above `from` of the redline it grows by up to hi g at the redline (a low
// gear at speed holds the car back hard). A downshift that makes the engine jump more than `slack` of the redline also
// jolts the car as the clutch bites: jolt m/s² per unit of redline jumped (at most max), fading at fade 1/s - the rear
// tyres take it, the nose dips
const EBRAKE = { hi: 0.2, from: 0.55, jolt: 11, slack: 0.1, max: 0.4, fade: 4 };
// the hard setting: the road and its rails this many times as wide (half, plus a quarter of that)
const DRIFT_HARD = 0.625;
// ... where the computer drivers take more care: fast = x their speed into the bends, chase = x the extra speed and
// push of one catching the player up, lane = x how far off the centre line their own line runs, follow = how far back (m)
// they take the player's line and drift where the player did (further back that ran them into the rails)
const HARD_AI = { fast: 0.9, chase: 0.4, lane: 0.5, follow: 12 };
const DRIFT_RANKS = ['C', 'B', 'A', 'S', 'SS'];

// computer drivers: names, the most of them, metres between grid rows. Each gets a skill 0..1 (how fast it dares into
// the bends, how tight a bend gets a handbrake flick and how long the flick is) and a line of its own across the road
const DRIFT_AI = {
  names: ['Tùng Khói', 'Khoa Lốp Mòn', 'Bảo Tay Lái', 'Hùng Phanh Tay', 'Minh Đuôi Cá', 'Long Đèo'],
  max: 5, grid: 7.5,
};

class DriftRace {
  // o: { mapIdx, carIdx, paint, al (wheel alignment, see ALIGN), eng (engine id), ais (computer drivers), seed?, aiSeed?, net?, demo? }.
  // demo: the race behind the title screen and the menus - a computer driver in the camera's car too, no countdown, no
  // sounds or messages (the car is not 'the player' to the code that makes them). net = { me,
  // cars: [{ id, name, car, paint, al, liv, rim }] } for an online race: the cars of the other players (remote: no physics here, Net
  // moves them; their alignment only shows on their wheels) in the server's grid order
  constructor(o) {
    this.drift = true; this.local = true;
    this.mapIdx = o.mapIdx; this.def = DRIFT_MAPS[o.mapIdx]; this.hard = !!o.hard;
    // (hard: the same stage with the tarmac and the rails DRIFT_HARD x as far from the centre line)
    const d = this.hard ? Object.assign({}, this.def, { edge: this.def.edge * DRIFT_HARD, wall: this.def.wall * DRIFT_HARD }) : this.def;
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
    const c = this.car = this.mkCar(o.carIdx, this.paint, 'BẠN', o.al, o.liv, o.rim, o.eng);
    c.isPlayer = true;
    this.racers = [c];
    if (o.net) {   // online: the others as remote cars, everyone on the grid in the server's order
      this.online = true; this.hold = true;   // (the countdown waits for the server's go)
      const grid = [];
      for (const n of o.net.cars) {
        if (n.id === o.net.me) { c.netId = n.id; grid.push(c); continue; }
        const r = this.mkCar(U.clamp(n.car | 0, 0, DRIFT_CARS.length - 1), n.paint, n.name, n.al, n.liv, n.rim);
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
    // (the player's place in that order: the car nearest to its own power to weight - with a bigger engine, faster rivals)
    const pr = c.spec.hp / c.spec.mass; let pi = 0, pd = 1e9;
    rankd.forEach((q, k) => { const d = Math.abs(DRIFT_CARS[q].hp / DRIFT_CARS[q].mass - pr); if (d < pd) { pd = d; pi = k; } });
    for (let k = 0; k < nAi; k++) {
      const ci = rankd[U.clamp(pi + Math.floor(rnd() * 3) - 1, 0, DRIFT_CARS.length - 1)];
      const pk = paints[k % paints.length];
      const a = this.mkCar(ci, pk, names[k], null, k % 2 ? (1 + k * 2 % 5) + Livery.contrast(pk) : '');   // (every other one wears stripes)
      const skill = U.clamp((nAi > 1 ? 0.2 + 0.75 * k / (nAi - 1) : 0.6) + (rnd() - 0.5) * 0.15, 0, 1);
      const hk = this.hard ? HARD_AI : { fast: 1, lane: 1 };
      a.ai = { skill, fast: (0.98 + 0.27 * skill) * hk.fast, hbR: 40 + 22 * skill, hb: 0.28 + 0.22 * skill, lane: (rnd() - 0.5) * 3 * hk.lane, hbT: 0, hbCool: 0, stuckT: 0,
        react: 0.1 + rnd() * 0.6 };   // reaction to the green light (s): the field strings out before the first bend
      this.racers.push(a);
    }
    if (o.demo) {
      this.demo = true; this.state = 'racing'; this.count = 0; this.camMode = 1;
      c.isPlayer = false; c.name = 'DEMO';
      c.ai = { skill: 0.8, fast: 1.18, hbR: 56, hb: 0.44, lane: 0, hbT: 0, hbCool: 0, stuckT: 0, react: 0 };
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
  // align: the car's wheel alignment (al; default: what the car comes with); fx: its effects that do not change (Align.fx)
  mkCar(ci, paint, name, al, liv, rim, eng) {
    const spec = Engine.spec(DRIFT_CARS[ci], Engine.clean(eng));
    al = Align.clean(al || Align.def(spec), spec);
    return { spec, carIdx: ci, paint, liv: Livery.clean(liv), rim: Rim.clean(rim), name, isPlayer: false, ai: null, body: DRIFT_BODY[spec.model], I: spec.mass * spec.a * spec.b * 1.05,
      align: al, fx: Align.car(al, spec), gF: 1, gR: 1, gFs: 1, ayA: 0, ackS: 0,
      pq: {}, wq: {}, placed: false, auto: true,
      px: 0, pz: 0, psi: 0, vx: 0, vz: 0, w: 0, steer: 0, sIn: 0, ax: 0, ay: 0,
      u: 0, v: 0, beta: 0, gear: 1, nextGear: 1, shiftT: 0, shock: 0, revT: 0, rpm: spec.idle, spin: 0, kick: 0, clutch: false, limiter: false,
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
    c.gear = 1; c.shiftT = 0; c.shock = 0; c.rpm = c.spec.idle;
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
      const ck = this.hard ? HARD_AI.chase : 1;   // (less of it on the narrow road)
      if (gap > 9) { fast *= 1 + Math.min(CHASE.fast, (gap - 9) / 100) * ck; c.boost = 1 + Math.min(CHASE.boost, (gap - 9) / 60); c.push = U.clamp((gap - 25) / 6, 0, CHASE.push) * ck; }
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
    if (chase && gap > 1.5 && gap < (this.hard ? HARD_AI.follow : TANDEM.follow) && Math.hypot(P.vx, P.vz) > 8) {   // (the player crawling: go past instead)
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
    // gearbox: automatic by default; B / V (or E / Q) shift (and switch to manual), T toggles automatic
    if (inp.mode) { c.auto = !c.auto; if (c.isPlayer) this.msg(c.auto ? 'SỐ TỰ ĐỘNG' : 'SỐ TAY (B lên số, V xuống số)', '#9fe0ff', 1.6, 24); }
    if ((inp.up || inp.dn) && c.auto) { c.auto = false; if (c.isPlayer) this.msg('SỐ TAY (T: về số tự động)', '#9fe0ff', 1.4, 24); }
    const ratio = g => g > 0 ? S.gears[g - 1] : g < 0 ? -3.4 : 0;
    const kRpm = g => Math.abs(ratio(g)) * S.final / S.R * 60 / (2 * Math.PI);   // engine rpm per m/s at the rear tyres
    const shift = g => {
      if (g === c.gear || c.shiftT > 0 || g > S.gears.length || g < 1) return;
      c.nextGear = g; c.shiftT = 0.09; if (c.isPlayer && Sound.shift) Sound.shift();
    };
    if (c.shiftT > 0) {
      c.shiftT -= dt;
      if (c.shiftT <= 0) {
        const from = c.gear;
        c.gear = c.nextGear; c.shiftT = 0;
        // down a gear at speed: the wheels spin the engine up to the lower gear's revs - the car is held back with a jolt
        if (from >= 1 && c.gear < from && u > 2) {
          const jump = (u * kRpm(c.gear) - c.rpm) / S.redline - EBRAKE.slack;
          if (jump > 0) {
            c.shock = Math.max(c.shock, Math.min(EBRAKE.max, jump));
            if (c.shock > 0.2) { c.backfire = 0.22; if (c.isPlayer && Sound.pop) Sound.pop(); }
          }
        }
      }
    }
    c.shock = Math.max(0, c.shock - c.shock * Math.min(1, dt * EBRAKE.fade) - dt * 0.05);
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
    } else if (!free && c.gear >= 1 && (!gas || rpmRoad > S.redline * 1.03)) {
      // engine braking: gentle at low revs, hard near the redline (and past it, after a downshift too far, throttle or
      // not); less of it through a drift, where the rear tyres are already sliding
      const x = Math.min(1.15, Math.max(c.rpm, rpmRoad) / S.redline);
      drive = -Math.sign(u) * S.mass * 9.81 * (0.05 * Math.min(1, c.rpm / S.redline) + EBRAKE.hi * smoothK(EBRAKE.from, 1, x) * x * (1 - 0.6 * c.dk));
    }
    if (!free && c.shock > 0 && c.gear >= 1) drive -= Math.sign(u) * S.mass * c.shock * EBRAKE.jolt;   // the jolt of a downshift
    c.drive = drive; c.gas = gas; c.brk = brk; c.hand = !!inp.hand;
    // steering: gripping, the keys turn the wheels (less lock at speed). Drifting, they steer relative to where the
    // front wheels are rolling, so letting go counter-steers by itself (like a real wheel spinning back through the
    // driver's hands), and the keys trim the angle: towards the bend = more angle, away = less (a flick the other way
    // swings the car into the next bend)
    const want = -(inp.steer || 0);
    c.sIn += (want - c.sIn) * Math.min(1, dt * STEER.keys);
    const d0 = u > 1 ? Math.atan2(v + c.w * S.a, Math.max(u, 2)) : 0;
    // (lock beyond the car's own: the keys reach it at low speed - it fades out quickly, the steering at speed stays as it was)
    const din = (S.steerIn + Math.max(0, c.fx.lock - S.lock) / (1 + spd / 6)) / (1 + spd / STEER.fade);
    const target = U.clamp(d0 * c.dk * 0.95 + c.sIn * (din * (1 - c.dk) + STEER.drift * c.dk), -c.fx.lock, c.fx.lock);
    // (the alignment: gripping, toe and the caster's weight set how fast the keys turn the wheels; drifting, the caster's
    // self-centring sets how fast the wheel spins back into counter-steer)
    const rate = STEER.rate * (c.fx.steer * c.fx.lockK * (1 - c.dk) + c.fx.self * c.dk);
    c.steer += U.clamp(target - c.steer, -dt * rate, dt * rate);
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
    // (the angle a drift can be held at grows with the front tyres' grip at full counter-steer - the wheel alignment's
    // camber and caster: fronts that wash out at lock let the car straighten, fronts that bite carry more angle)
    const hold = (c.holdT > 0 ? (gas ? 0.42 + (c.nitroOn ? 0.1 : 0) : 0.22) + 0.34 * toward : gas ? 0.12 : 0.05) * U.clamp(c.gFs ** 2, 0.7, 1.3) * c.fx.angK;
    // holding the other way hard on the throttle (not a quick dab to straighten) swings the car across into a drift
    // the other way - linking an S-bend. A short counter-steer just straightens it
    c.awayT = away > 0.8 ? c.awayT + dt : 0;
    c.swing = !!gas && c.awayT > SWING_T;
    const aim = c.swing ? -0.35 : U.clamp(hold - 0.4 * away - (brk ? 0.12 : 0), 0, c.fx.maxAng);
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
    // wheel alignment: each axle's sideways grip from the camber its loaded tyre has right now (static camber + body
    // roll + what the caster adds as the wheels steer), against the stock alignment in the same moment; rear toe-in
    // steadies (toe-out loosens) the rear while gripping
    const fx = c.fx;
    c.gF = Align.axleK(c.align, true, c.ayA, c.steer, S.h); c.gR = Align.axleK(c.align, false, c.ayA, c.steer, S.h);
    // Ackermann (against the full Ackermann of a road car): the wheels closer to parallel bite better on the counter-
    // steer of a drift, a little worse in a tight turn while gripping
    c.ackS = Align.ackSplit(c.steer);
    c.gF *= 1 + (1 - fx.ack) * (ALIGN.ack.grip * Math.min(1, c.ackS / 0.25) * c.dk - ALIGN.ack.turn * Math.min(1, c.ackS / 0.08) * (1 - c.dk));
    if (c.dk > 0.3) c.gFs += (c.gF - c.gFs) * Math.min(1, dt * 3);   // (the front's grip through the drift, smoothed)
    const GF = S.muF * c.surf * Fzf * c.gF, GR = S.muR * c.surf * Fzr * (c.looseT > 0 ? 0.45 : 1) * c.gR * (1 + (fx.gripR - 1) * (1 - c.dk));
    // front tyres (front toe: toe-out answers the wheel sooner - a smaller peak slip)
    const d = c.steer, cd = Math.cos(d), sd = Math.sin(d), pkF = S.pkF * fx.pkF;
    const vf = v + w * a, lw = u * cd + vf * sd, tw = -u * sd + vf * cd;
    const af = Math.atan2(tw, Math.max(Math.abs(lw), 1.5));
    let Fyf = -GF * tyreCurve(af / pkF), Fxf = 0;
    if (c.brk > 0) Fxf = -Math.sign(lw) * Math.min(c.brk * S.brake * BRAKE_K * m * g * 0.62 * fx.brake, m * Math.abs(lw) / dt * 0.3);
    const rf = Math.hypot(Fxf / (GF * (c.drifting ? 1 : TRACTION) * fx.brake), Fyf / GF);
    if (rf > 1) { Fxf /= rf; Fyf /= rf; }
    c.frontSlide = smoothK(1.4, 3, Math.abs(af) / pkF); c.fRatio = Math.abs(af) / pkF;
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
      // friction ellipse: straight ahead the tyres take TRACTION x more than sideways (not while drifting); the rear
      // camber and toe set how much of it the throttle can use (forward bite)
      const GRx = GR * (c.drifting ? 1 : TRACTION) * fx.trac * (S.tracK || 1), r = Math.hypot(Fxr / GRx, Fyr / GR);
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
      // (past the car's angle the body is pulled straighter - later and more weakly with the tail toed out: it snaps round)
      const snap = fx.snap, ex = Math.abs(beta) - fx.maxAng - 0.3 * snap;
      if (ex > 0) Mz += Math.sign(beta) * I * (ex * 14 + Math.max(0, -Math.sign(beta) * w) * 1.6) * snap;
    }
    const spd = Math.hypot(c.vx, c.vz);
    // gripping at speed: toe-in and caster calm the car's yaw (it runs straight), toe-out makes it darty
    if (c.dk < 0.98 && fx.yawD) Mz -= I * fx.yawD * w * (1 - c.dk) * smoothK(12, 30, spd);
    // world-space forces: tyres, drag, rolling resistance (much more off the tarmac; toe scrubs a little), gravity along the slope
    let FX = Fx * sn + Fy * cs, FZ = Fx * cs - Fy * sn;
    if (spd > 0.01) {
      const k = S.drag * spd + m * g * (0.013 + fx.scrub + (c.surf < 1 ? 0.1 : 0)) / Math.max(spd, 0.5);
      FX -= c.vx * k; FZ -= c.vz * k;
    }
    const q = c.pq;
    FX -= m * g * q.slope * Math.sin(q.h); FZ -= m * g * q.slope * Math.cos(q.h);
    // path assist (arcade): while drifting the keys steer where the car GOES, not only where its nose points. The
    // sideways pull on the path is steered towards pathK x PATH.acc (more than the tyres alone could give)
    if (c.dk > 0.02 && spd > 3) {
      const lx = c.vz / spd, lz = -c.vx / spd, aNow = (FX * lx + FZ * lz) / m;   // left of the direction of travel
      // (more for a computer car catching up: it carries more speed round without running wide; and as much more or
      // less as the front tyres grip with the car's alignment - the front pulls a drift round the bend)
      const acc = PATH.acc * c.boost * c.gF;
      const add = U.clamp(c.pathK * acc - aNow, -acc, acc) * c.dk * PATH.k;
      FX += lx * add * m; FZ += lz * add * m;
      // a car hung out sideways sheds speed, more so when it is held tight into the bend: a bend taken too fast
      // tightens up instead of running into the rail (less with front tyres that bite)
      // (less for a computer car catching up; more with the rear wheels toed out: the outer one scrubs sideways)
      const scrub = c.dk * Math.max(0, (PATH.scrubAng * Math.abs(Math.sin(c.beta)) + PATH.scrubTow * c.toward) * Math.min(1.6, (spd / 20) * (spd / 20)) / (c.boost * c.boost) + fx.drag
        - ALIGN.ack.drag * (1 - fx.ack) * Math.min(0.5, c.ackS));   // (parallel front wheels: no tyre dragged across the slide)
      FX -= c.vx / spd * scrub * m; FZ -= c.vz / spd * scrub * m;
    }
    if (c.dk < 0.98 && spd > GRIP.v0 && Math.abs(c.sIn) > 0.05 && c.u > 0) {
      const lx = c.vz / spd, lz = -c.vx / spd, aNow = (FX * lx + FZ * lz) / m, want = c.sIn * GRIP.acc * c.boost * c.gF;
      const add = (want - aNow) * Math.abs(c.sIn) * GRIP.k * (1 - c.dk) * smoothK(GRIP.v0, GRIP.v1, spd) * smoothK(0.8, 1.5, c.fRatio);
      if (add * c.sIn > 0) { FX += lx * add * m; FZ += lz * add * m; }   // only ever helps the turn the keys ask for
    }
    if (c.push && c.gas && spd > 3) { FX += c.vx / spd * c.push * m; FZ += c.vz / spd * c.push * m; }   // (the rubber band)
    // the body's whole sideways acceleration (the assists' pull included, as the body feels it), for the roll and load
    // transfer of the wheel alignment
    c.ayA += (U.clamp((FX * cs - FZ * sn) / m, -10, 10) - c.ayA) * Math.min(1, dt * 8);
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
      if (!c.chain) c.chain = { pts: 0, mult: 1, t: 0, d: 0, gap: 0, dir: Math.sign(c.beta), side: 0, trans: 0, near: 0, ang: 0, tan: 0 };
      const C = c.chain;
      C.gap = 0; C.t += dt; C.d += kmh / 3.6 * dt; C.ang = ang; C.side += dt;
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
      C.mult = Math.min(DSCORE.maxMult, 1 + Math.floor(C.d / DSCORE.multD) + C.trans);
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
      // (louder on the throttle - and for a moment as a downshift drags the revs up)
      Sound.engine(U.clamp((c.rpm - S.idle * 0.6) / S.redline, 0, 1.05), 0.09 + 0.08 * Math.max(c.gas, Math.min(1, c.shock * 4)));
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
