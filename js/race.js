'use strict';
// ============ Race simulation: physics, AI, combat, police, traffic ============
// One Race object runs a whole event for one or more human riders.
//  - single player: one local human whose keys are read here; sounds / messages play at once
//  - online server (o.server): several humans fed by network input; feedback is queued in `events` for the clients
//  - online client mirror (o.view): no simulation at all, Net fills it from snapshots and only predicts its own
//    bike with motion()
// real bikes; the order is fixed (saved garages store these numbers). color = the factory main colour, which also
// switches on that bike's stock livery in the 3D model. Ranked roughly like the real things (power, weight, handling)
const BIKES = [
  { name: 'Kawasaki Z900', price: 0, speed: 12000, accel: 1.05, handling: 1.04, dur: 110, color: '#5fb52a' },
  { name: 'Yamaha YZF-R1', price: 30000, speed: 15300, accel: 1.45, handling: 1.16, dur: 140, color: '#1d3ea8' },
  { name: 'Kawasaki Ninja 1000SX', price: 16000, speed: 14000, accel: 1.3, handling: 1.08, dur: 165, color: '#2a8a35' },
  { name: 'BMW S 1000 RR', price: 34000, speed: 15600, accel: 1.48, handling: 1.18, dur: 150, color: '#eef0f2' },
  { name: 'Kawasaki W800', price: 8000, speed: 11000, accel: 0.98, handling: 1.1, dur: 130, color: '#141519' },
  { name: 'Honda Africa Twin', price: 22000, speed: 13000, accel: 1.2, handling: 1.1, dur: 200, color: '#f0f1ee' },
  { name: 'Honda Rebel 1100', price: 14000, speed: 12400, accel: 1.22, handling: 0.98, dur: 185, color: '#17181c' },
  // the 150 cc street favourites: slower, but light and quick to turn
  { name: 'Honda Winner X', price: 2500, speed: 10000, accel: 1.05, handling: 1.2, dur: 95, color: '#cc1f26' },
  { name: 'Yamaha Exciter 155', price: 2800, speed: 10200, accel: 1.08, handling: 1.22, dur: 95, color: '#1d4bb8' },
  { name: 'Suzuki Raider R150', price: 3000, speed: 10500, accel: 1.1, handling: 1.18, dur: 90, color: '#1c1d21' },
  { name: 'Yamaha YZF-R15 V4', price: 5500, speed: 11000, accel: 1.08, handling: 1.26, dur: 105, color: '#1f47bd' },
  { name: 'Honda SH 160i', price: 4500, speed: 9300, accel: 0.95, handling: 1.05, dur: 120, color: '#f3f3f1' },
  // 250 cc twin sport bike: quicker than the 150s, still light and sharp
  { name: 'Honda CBR250RR', price: 7500, speed: 11800, accel: 1.14, handling: 1.26, dur: 110, color: '#c8121f' },
  // the Fireblade: a 1000 cc superbike, as fast as the R1
  { name: 'Honda CBR1000RR Fireblade', price: 32000, speed: 15400, accel: 1.46, handling: 1.17, dur: 145, color: '#c8121f' },
];
const BIKE_STYLES = BIKES.length;   // one look per bike; rivals and the police ride these too
const PANTS = ['#2b3a6b', '#1a1a1a', '#3a2a1a', '#4a4a5a', '#2f4a8a'];
const RIVALS = [
  ['Tèo Bão', '#b5262c', '#f2f2f2', '#1a1a1a', null, 'chain'],
  ['Hùng Xăng', '#1f6f3a', '#f5c400', '#e0a000', null, 'club'],
  ['Lan Gió', '#c43b8a', '#ffffff', '#ff6a00', '#2a1a10', 'chain'],
  ['Tuấn Sẹo', '#2a2a2a', '#202020', '#c01818', null, 'club'],
  ['Bảo Lửa', '#d97a1a', '#e02020', '#d01c1c', null, 'chain'],
  ['Mai Tốc', '#6a2c91', '#8a2be2', '#d8d8d8', '#c8a040', 'club'],
  ['Long Đinh', '#1d4f9a', '#2050d0', '#1f5fd0', null, 'club'],
  ['Khoa Xích', '#7a5230', '#30a040', '#2f9a3a', null, 'chain'],
  ['Vy Sấm', '#3a8f8f', '#ff7a00', '#00a0a0', '#8a2a10', 'club'],
  ['Dũng Gậy', '#8a1f1f', '#202020', '#e0a000', null, 'club'],
  ['Phong Nhớt', '#a8a8a8', '#2050d0', '#8a2be2', null, 'chain'],
  ['Hải Cò', '#e0c020', '#202020', '#1a1a1a', null, 'club'],
  ['Nam Bụi', '#4a5a2a', '#f2f2f2', '#2f9a3a', null, 'chain'],
  ['Thu Lốc', '#20206a', '#e02020', '#c01818', '#2a1a10', 'club'],
].map(([name, jacket, helmet, bike, hair, weapon], i) => ({
  name, weapon,
  pal: { id: 'rv' + i, jacket, helmet, bike, hair, pants: PANTS[i % 5],
    stripe: i % 3 ? null : '#ffd23a', emblem: i % 4 === 1 ? '#ffffff' : null },
}));
const POLICE_PAL = { id: 'police', jacket: '#1d2c55', pants: '#1d2c55', helmet: '#f0f0f0', stripe: '#1d2c55',
  bike: '#f0f0f0', police: true, emblem: '#ffd23a' };
const playerPal = i => ({ id: 'pl' + i, jacket: '#2a2a32', pants: '#2f4a8a', helmet: '#f5c400', stripe: '#1a1a1a',
  bike: BIKES[i].color, emblem: '#ffd23a', glove: '#5a2a10' });
// online: every seat gets its own jacket / helmet so two humans on the same bike model can be told apart
const SEAT_COLS = [['#2a2a32', '#f5c400'], ['#b01818', '#f2f2f2'], ['#1f4fb0', '#ffffff'], ['#1f7a3a', '#f0c020'],
  ['#6a2c91', '#e8e8e8'], ['#d97a1a', '#202020'], ['#138c8c', '#f2f2f2'], ['#e8e8e8', '#d01c1c']];
const humanPal = (bikeIdx, seat) => seat < 0 ? playerPal(bikeIdx) : { id: 'hu' + seat + '_' + bikeIdx, jacket: SEAT_COLS[seat][0],
  pants: '#2b3a6b', helmet: SEAT_COLS[seat][1], stripe: '#1a1a1a', bike: BIKES[bikeIdx].color, emblem: '#ffd23a', glove: '#5a2a10' };
// real-world paint mix: mostly white / silver / grey / black, some red, blue and bronze
const CAR_COLS = ['#eef0f2', '#e9e7e1', '#eef0f2', '#b8bcc3', '#b8bcc3', '#6a6f77', '#17181b', '#17181b', '#8c0f17', '#1d3b80', '#7d6650'];
const CAR_TYPES = ['sedan', 'suv', 'van', 'truck'];
const RIDER_W = 0.14;   // bike width in half road-widths (0.7 m)
const RIDER_L = 210;    // half bike length in road units (~1 m)
// full width (half road-widths, x5 m) and length (road units, /216 m): sedan 4.5 m, SUV 4.72 m, 16-seat van 5.8 m, lorry 8.7 m
const CAR_DIM = { sedan: { w: 0.35, len: 972 }, suv: { w: 0.372, len: 1020 }, van: { w: 0.40, len: 1253 }, truck: { w: 0.49, len: 1880 } };
// wheelie: pitch in radians (front wheel up) about the rear axle
const WHEELIE = { hold: 0.5, max: 0.9, fall: 0.3, boost: 0.06 };
// holding the wheelie button as the lights go green: a wheelie launch with extra pull while the front stays up
const LAUNCH = { time: 2.4, boost: 0.45, fade: 0.8 };
// after a crash the rider gets up, runs to the bike, stands it up and rides on (seconds; run speed in m/s;
// stand = how far beside the bike the rider stands, in half road-widths)
const CRASH = { minTumble: 1.0, maxTumble: 4.5, up: 0.5, run: 8, lift: 0.8, stand: 0.11 };
// the brake bites progressively (speed lost per second, x top speed): a tap only takes a little off, holding it squeezes
// harder until full braking after `full` seconds
const BRAKE = { min: 0.25, max: 1.1, full: 1.2 };
// starting grid [row, column], back row first: humans take the back slots, AI riders fill the rest (12 bikes)
const GRID = [[3, 1], [3, 0], [3, 2], [2, 1], [2, 0], [2, 2], [1, 1], [1, 0], [1, 2], [0, 1], [0, 0], [0, 2]];
const FIELD = GRID.length;
// controls of a human rider; packed into bits for the network
const IN = { L: 1, R: 2, GAS: 4, BRAKE: 8, WHEEL: 16, ATKL: 32, ATKR: 64 };
const decodeInput = k => ({ steer: (k & IN.R ? 1 : 0) - (k & IN.L ? 1 : 0), gas: !!(k & IN.GAS), brake: !!(k & IN.BRAKE),
  wheel: !!(k & IN.WHEEL), atkL: !!(k & IN.ATKL), atkR: !!(k & IN.ATKR) });
const NO_INPUT = decodeInput(0);
// how far (road units) a sound carries to a listener; feedback the online client predicts for its own bike
const FX_RANGE = { hit: 3000, thud: 4000, siren: 5000 };
const LOCAL_FX = new Set(['land', 'rumble']);

class Race {
  // o: { themeIdx, level, seed?, demo?, bikeIdx, bikeHp }               single player
  //    { themeIdx, level, seed, humans: [{ id, name, bikeIdx, bikeHp }], server: true }   online server
  //    { ...same, view: true, roster }                                   online client mirror
  constructor(o) {
    this.theme = THEMES[o.themeIdx]; this.themeIdx = o.themeIdx; this.level = o.level; this.demo = !!o.demo;
    this.server = !!o.server; this.view = !!o.view; this.local = !this.server && !this.view;
    this.seed = o.seed !== undefined ? o.seed : o.themeIdx * 977 + o.level * 131 + 7;
    const tr = Track.build(this.theme, o.level, this.seed);
    this.segs = tr.segs; this.startZ = tr.startZ; this.finishZ = tr.finishZ;
    // circuits: laps of lapN segments from the line at lineZ; the tarmac is edge half road-widths wide, the barrier at wall
    this.circuit = !!this.theme.circuit; this.E = this.theme.edge || 1; this.wall = this.theme.wall || 3.2;
    this.lapN = tr.lapN || 0; this.laps = tr.laps || 0; this.lineZ = tr.lineZ || 0; this.map = tr.map || null; this.pit = tr.pit || null;
    const online = !!o.humans, hs = o.humans || [{ id: 'me', name: 'BẠN', bikeIdx: o.bikeIdx, bikeHp: o.bikeHp }];
    this.humans = hs.map((h, i) => {
      const bike = BIKES[h.bikeIdx], [row, col] = GRID[i];
      const r = this.mkRider({ isPlayer: true, id: h.id, name: h.name, pal: humanPal(h.bikeIdx, online ? i : -1), style: h.bikeIdx,
        top: bike.speed, hp: 100, x: [-0.5, 0, 0.5][col] * this.E, z: this.startZ + (3 - row) * 650 });
      return Object.assign(r, { bike, bikeMax: bike.dur, bikeHp: h.bikeHp !== undefined ? h.bikeHp : bike.dur, kos: 0, input: NO_INPUT, done: null });
    });
    this.player = this.humans[0];   // the local human (single player; the client mirror re-points it at its own bike)
    this.bikeIdx = this.player.style; this.bike = this.player.bike;
    this.racers = this.humans.slice();
    const pool = RIVALS.slice().sort(() => Math.random() - 0.5), roster = o.roster ? o.roster.filter(e => e.id === undefined) : null;
    const slots = GRID.slice(this.humans.length).reverse();   // AI slots, front row first (best rider at the front)
    slots.forEach(([row, col], i) => {
      const rv = roster ? RIVALS[roster[i].rv] : pool[i];
      const skill = U.clamp(1 - i / 11 * 0.7 + U.rand(-0.1, 0.1), 0, 1);
      const r = this.mkRider({
        name: rv.name, pal: rv.pal, rv: RIVALS.indexOf(rv), x: [-0.5, 0, 0.5][col] * this.E, z: this.startZ + (3 - row) * 650,
        lineOff: U.rand(-0.22, 0.22),   // where this rider likes to sit relative to the racing line (circuits)
        top: (10600 + this.level * 650) * (0.84 + skill * 0.16), skill,
        hp: roster ? roster[i].hp : 55 + this.level * 12 + skill * 20, aggr: U.rand(0.3, 0.9),
        weapon: Math.random() < 0.3 + this.level * 0.06 ? rv.weapon : null,
      });
      this.racers.push(r);
    });
    this.police = null; this.policeTimer = U.rand(35, 60) / (0.7 + this.level * 0.15); this.policeGen = 0;
    this.cars = []; this.carTurn = 0;
    if (!this.view) {
      const nCars = this.circuit ? 0 : 10 + this.level * 2;   // circuits are closed: no traffic, no police
      for (let i = 0; i < nCars; i++) this.cars.push(this.placeCar(this.newCar(this.startZ + 40000 + i * 66000 / nCars)));
    }
    this.bodies = []; this.msgs = []; this.events = [];
    this.time = 0; this.count = 3.999; this.lastBeep = 4; this.lastCall = null;
    this.state = this.demo ? 'racing' : 'countdown';
    this.over = null; this.shake = 0; this.target = null; this.replaying = false;
    this.rank();
  }

  mkRider(o) {
    const r = Object.assign({ kind: 'rider', speed: 0, lean: 0, leanF: 0, atk: null, cool: U.rand(1, 3), crash: null,
      inv: 0, laneT: U.rand(1, 4), finished: false, time: 0, rank: 0, weapon: null, skill: 0.5, aggr: 0.5, hp: 100,
      pitch: 0, pitchV: 0, wheelT: 0, wheelie: 0, launch: 0, vx: 0, lap: 1, brakeT: 0 }, o);
    r.maxHp = r.hp; r.targetX = r.x;
    return r;
  }
  // all traffic drives our way (no oncoming vehicles); the left lane is the faster one. 60 units/s = 1 km/h
  newCar(z) {
    const q = Math.random(), type = q < 0.42 ? 'sedan' : q < 0.67 ? 'suv' : q < 0.84 ? 'van' : 'truck';
    const lane = Math.random() < 0.5 ? -1 : 1, vmax = (lane < 0 ? U.rand(5200, 7400) : U.rand(3600, 5800)) * (type === 'truck' ? 0.85 : 1);
    return { kind: 'car', z, type, col: U.pick(CAR_COLS), x: lane * 0.5 + U.rand(-0.05, 0.05), vmax, speed: vmax,
      w: CAR_DIM[type].w, len: CAR_DIM[type].len };
  }
  // keep a new vehicle clear of the others in its lane (switch lane, else move it further ahead)
  placeCar(c) {
    const clash = () => this.cars.some(o => o !== c && Math.abs(o.x - c.x) < 0.3 && Math.abs(o.z - c.z) < (o.len + c.len) / 2 + 2500);
    for (let k = 0; k < 6 && clash(); k++) { if (k === 0) c.x = -c.x; else c.z += 3500; }
    return c;
  }
  findSeg(z) { return this.segs[U.clamp(Math.floor(z / CFG.segL), 0, this.segs.length - 1)]; }
  riders() { return this.police ? this.racers.concat([this.police]) : this.racers; }
  msg(text, col, dur, size) {
    this.msgs.push({ text, col: col || '#fff', t: dur || 1.6, size });
    if (this.msgs.length > 3) this.msgs.shift();
  }

  // ---------------- feedback: sounds, screen shake, messages ----------------
  // who = the human it concerns, or null for everyone within earshot of z
  fx(kind, who, z) {
    if (this.view) { if (who === this.player && !this.replaying && LOCAL_FX.has(kind)) Race.playFx(this, kind); return; }
    if (this.server) {
      if (who && LOCAL_FX.has(kind)) return;   // the client predicts these for its own bike
      this.events.push({ k: kind, to: who ? who.id : null, z: Math.round(z !== undefined ? z : who ? who.z : 0) });
      return;
    }
    if (who ? who !== this.player : Math.abs(z - this.player.z) > (FX_RANGE[kind] || Infinity)) return;
    Race.playFx(this, kind);
  }
  static playFx(race, kind) {
    switch (kind) {
      case 'bump': Sound.thud(); race.shake = Math.max(race.shake, 0.28); break;
      case 'hurt': race.shake = Math.max(race.shake, 0.3); break;
      case 'whiff': Sound.whiff(); break;
      case 'hit': Sound.hit(); break;
      case 'crash': Sound.crash(); race.shake = 0.7; break;
      case 'thud': Sound.thud(); break;
      case 'land': Sound.thud(); race.shake = Math.max(race.shake, 0.12); break;
      case 'rumble': race.shake = Math.max(race.shake, 0.08); break;
      case 'siren': Sound.siren(); break;
      case 'beep': Sound.beep(440, 0.15); break;
      case 'go': Sound.beep(880, 0.4); break;
    }
  }
  say(who, text, col, dur, size) {
    if (this.server) { this.events.push({ k: 'msg', to: who ? who.id : null, text, col, dur, size }); return; }
    if (this.local && (!who || who === this.player)) this.msg(text, col, dur, size);
  }
  // a human leaves the running (finished / busted / wrecked / timeout / quit); the event is over once nobody races
  retire(h, reason) {
    if (h.done) return;
    h.done = reason;
    if (reason === 'busted') this.say(h, 'BỊ CẢNH SÁT BẮT!', '#5aa0ff', 4, 36);
    if (reason === 'wrecked') this.say(h, 'XE HỎNG NẶNG!', '#ff5040', 4, 36);
    if (reason === 'timeout') this.say(h, 'HẾT GIỜ!', '#ff8a8a', 4, 36);
    if (!this.over && this.humans.every(o => o.done)) this.over = { reason: this.local ? reason : 'all', t: 0 };
  }
  end(reason) { this.retire(this.player, reason); }   // single player (quit from the pause menu)

  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 2);
    if (this.state === 'countdown') {
      this.count -= dt;
      const c = Math.ceil(this.count);
      if (c !== this.lastBeep) { this.lastBeep = c; if (c > 0) this.fx('beep', null, 0); }
      if (this.count <= 0) {
        this.state = 'racing'; this.fx('go', null, 0); this.say(null, 'ĐI!', '#7fff7f', 1, 56);
        for (const r of this.racers) if (!r.isPlayer) {   // everybody gets going before the first punches; some pull launch wheelies
          r.cool = Math.max(r.cool, U.rand(1.2, 2.4));
          if (Math.random() < 0.4) r.wheelie = U.rand(0.6, 1.4);
        }
        // humans holding the wheelie button at the green light get a wheelie launch
        if (!this.demo) for (const h of this.humans) if (h.input.wheel && !h.done) {
          h.launch = LAUNCH.time;
          this.say(h, 'XUẤT PHÁT BỐC ĐẦU!', '#ffd23a', 1.4, 30);
        }
      }
      if (this.local && !this.demo) { Sound.voice(this.player.style); Sound.engine(Input.is('up') ? 0.75 : 0.12, 0.1); }
    } else {
      this.time += dt;
      const P = this.player;
      if (this.local && !this.demo) { Sound.voice(P.style); Sound.engine(P.speed / P.top, P.crash ? 0.02 : 0.08 + 0.06 * P.speed / P.top); }
    }
    if (this.local) this.player.input = this.demo ? NO_INPUT : Race.readKeys();
    for (const h of this.humans) this.updateHuman(h, dt);
    for (const r of this.racers) if (!r.isPlayer) this.updateAI(r, dt);
    this.updatePolice(dt);
    this.updateCars(dt);
    this.updateBodies(dt);
    this.separate();
    this.checkFinish();
    this.rank();
    if (this.server) this.lastCallClock(dt);
    if (this.local) this.findTarget();
    if (this.msgs.length) { this.msgs[0].t -= dt; if (this.msgs[0].t <= 0) this.msgs.shift(); }
    if (this.over) this.over.t += dt;
  }

  // ---------------- humans ----------------
  static readKeys() {
    return { steer: (Input.is('right') ? 1 : 0) - (Input.is('left') ? 1 : 0), gas: Input.is('up'), brake: Input.is('down'),
      wheel: Input.is('wheelie'), atkL: Input.pressed('atkL'), atkR: Input.pressed('atkR') };
  }
  updateHuman(h, dt) {
    h.inv = Math.max(0, h.inv - dt); h.scrape = Math.max(0, (h.scrape || 0) - dt);
    if (h.gone) return;
    if (h.crash) { this.updateCrash(h, dt); return; }
    let inp = NO_INPUT;
    if (this.state === 'racing') inp = !h.done && !this.demo ? h.input : this.autoInput(h, dt);
    if (inp.atkL) this.startAttack(h, -1);
    if (inp.atkR) this.startAttack(h, 1);
    const zPrev = h.z;
    this.motion(h, inp, dt);
    if (Math.abs(h.x) > this.E - 0.05) this.propCollide(h, zPrev);
    if (this.circuit && Math.abs(h.x) >= this.wall - 0.01) {   // into the barrier at the edge of the run-off
      if (h.speed > h.top * 0.25) { this.crash(h, 'prop'); return; }
      h.speed = Math.min(h.speed, h.top * 0.1); h.vx = 0;
    }
    if (this.circuit && !h.done && this.state === 'racing') {
      const lap = this.lapOf(h);
      if (lap > h.lap) { h.lap = lap; this.say(h, lap === this.laps ? 'VÒNG CUỐI!' : 'VÒNG ' + lap + '/' + this.laps, '#ffd23a', 1.8, 36); }
    }
    this.carCollide(h, dt);
    this.updateAttack(h, dt);
  }
  lapOf(r) { return U.clamp(Math.floor((r.z - this.lineZ) / (this.lapN * CFG.segL)) + 1, 1, this.laps); }
  // the bend under a rider: the lateral acceleration it asks for (m/s², + = right-hand bend) and how much of the grip that is
  bend(r, seg, gripK) {
    const v = r.speed * CFG.KZ, need = v * v * seg.curve * CURV_M;
    return { need, ratio: Math.abs(need) / (CORNER.grip * gripK) };
  }
  // how far the bike leans over (1 = full lean, knee on the tarmac, at the grip limit; + = right): the bend, plus a little
  // for changing line (lat = sideways speed -1..1)
  static leanFor(need, ratio, lat, sp) {
    return U.clamp(Math.sign(need) * Math.min(1.05, Math.pow(ratio, 0.75)) + 0.32 * lat * Math.min(1, sp * 1.5), -1.1, 1.1);
  }
  // how fast (half road-widths/s, + = to the left) a bend pushes the bike wide
  static drift(need, ratio) {
    return Math.sign(need) * (Math.min(1, ratio) * CORNER.drift + Math.min(CORNER.slideMax, Math.max(0, ratio - 1) * CORNER.slide));
  }
  // throttle, brake, steering and wheelie of a human-ridden bike (the online client predicts its own bike with this)
  motion(r, inp, dt) {
    const B = r.bike, seg = this.findSeg(r.z), sp = r.speed / r.top, E = this.E;
    // wheelie: needs the throttle open; the brake slams the front down
    this.updatePitch(r, dt, inp.wheel && inp.gas && !inp.brake, inp.brake);
    const wk = U.clamp(r.pitch / 0.4, 0, 1), topE = r.top * (1 + WHEELIE.boost * wk);
    // steering builds up over a moment; a bend pushes the bike wide, gently while the tyres grip and harder once it is
    // taken too fast (so slow corners want the brakes). Front wheel in the air: much less steering and grip
    const { need, ratio } = this.bend(r, seg, B.handling * (1 - 0.5 * wk)), drift = Race.drift(need, ratio);
    const auth = r.speed > 30 || inp.gas ? Math.max(0.3, Math.min(1, sp * 1.3)) * B.handling * (1 - 0.55 * wk) : 0;
    r.vx += (inp.steer * CORNER.steer * auth - r.vx) * Math.min(1, dt * CORNER.resp);
    r.x += (r.vx - drift) * dt;
    r.leanF += (Race.leanFor(need, ratio, r.vx / CORNER.steer, sp) - r.leanF) * Math.min(1, dt * 6);
    r.lean = r.leanF;
    // wheelie launch: extra pull for a couple of seconds, as long as the throttle and the wheelie button stay held
    let pull = 1;
    if (r.launch > 0) {
      if (inp.gas && inp.wheel && !inp.brake) { pull = 1 + LAUNCH.boost * Math.min(1, r.launch / LAUNCH.fade); r.launch = Math.max(0, r.launch - dt); }
      else r.launch = 0;
    }
    if (!inp.brake) r.brakeT = 0;
    if (inp.gas) r.speed += r.top / 5 * B.accel * pull * (1.25 - r.speed / topE) * dt;
    else if (inp.brake) {
      r.brakeT = Math.min(BRAKE.full, r.brakeT + dt);
      const k = r.brakeT / BRAKE.full;
      r.speed -= r.top * (BRAKE.min + (BRAKE.max - BRAKE.min) * k * k) * dt;
    }
    else r.speed -= r.top / 5 * (r.finished ? 1.2 : 0.7) * dt;
    if (ratio > 1) r.speed -= r.top * CORNER.scrub * Math.min(2, ratio - 1) * dt;   // too fast for the bend: the tyres scrub it off
    const off = Math.abs(r.x) - E;
    if (off > 0.05 && !this.circuit) { if (r.speed > r.top * 0.3) { r.speed -= r.top * 0.8 * dt; this.fx('rumble', r); } }
    else if (off > 0.05) {   // circuit: the kerb, then the painted run-off, then grass - or the gravel trap outside a bend
      if (off > 0.24) {   // [braking, speed (of top) it brakes down to]: you can always ride back out at a crawl
        const [k, low] = off < 0.5 ? [0.25, 0.55] : seg.gravel === Math.sign(r.x) ? [1.5, 0.18] : [0.7, 0.3];
        if (r.speed > r.top * low) r.speed -= r.top * k * dt;
      }
      if (r.speed > r.top * 0.3) this.fx('rumble', r);
    }
    // a wheelie is worth a little extra top speed; it bleeds off gently once the front is down
    if (r.speed > topE) r.speed = Math.max(topE, r.speed - r.top * 0.2 * dt);
    r.speed = Math.max(0, r.speed);
    r.x = U.clamp(r.x, -this.wall, this.wall);
    r.z += r.speed * dt;
  }
  // the title-screen demo and humans who are done ride themselves: follow a lane (or the racing line), brake for bends
  // (keep = steer for the targetX already set)
  autoInput(r, dt, keep) {
    const seg = this.findSeg(r.z), B = r.bike;
    r.laneT -= dt;
    if (keep) { /* target chosen by the caller */ }
    else if (this.circuit) r.targetX = this.findSeg(r.z + 25 * CFG.segL).line * this.E;
    else {
      if (r.laneT <= 0) { r.laneT = U.rand(3, 6); r.targetX = U.pick([-0.3, 0, 0.3, 0.5]); }
      this.avoidCars(r);
    }
    const { need, ratio } = this.bend(r, seg, B.handling);
    const drift = Race.drift(need, ratio);
    const auth = Math.max(0.3, Math.min(1, r.speed / r.top * 1.3)) * B.handling * CORNER.steer;
    const vmax = seg.vlim * Math.sqrt(B.handling) / CFG.KZ;
    return { steer: U.clamp(((r.targetX - r.x) * 2.5 + drift) / auth, -1, 1), gas: this.demo && r.speed < vmax * 0.97,
      brake: r.speed > vmax * 1.04, wheel: false };
  }
  // wheelie pitch: the throttle lifts the front towards a balance angle (with a little wobble), gravity drops it
  updatePitch(r, dt, lift, brake) {
    if (lift) {
      const tgt = WHEELIE.hold + Math.sin(r.wheelT * 2.3 + r.maxHp) * 0.05;
      r.pitchV += ((tgt - r.pitch) * 30 - r.pitchV * 7) * dt;
    } else if (r.pitch > 0 || r.pitchV > 0) r.pitchV -= (5 + (brake ? 9 : 0)) * dt;
    r.pitch += r.pitchV * dt;
    if (r.pitch > WHEELIE.max) { r.pitch = WHEELIE.max; r.pitchV = Math.min(0, r.pitchV); }
    if (r.pitch <= 0) {
      if (r.pitchV < -1.6 && r.isPlayer) this.fx('land', r);   // front wheel lands
      r.pitch = 0; r.pitchV = 0;
    }
    if (r.pitch > 0.25) r.wheelT += dt;
    else if (r.wheelT > 0) {
      if (r === this.player && r.wheelT >= 3 && !this.server && !this.replaying) this.msg('BỐC ĐẦU ' + r.wheelT.toFixed(1) + ' GIÂY!', '#ffd23a', 1.6, 28);
      r.wheelT = 0;
    }
  }

  propCollide(r, zPrev) {
    const i0 = Math.floor(zPrev / CFG.segL), i1 = Math.floor(r.z / CFG.segL);
    for (let i = i0; i <= i1; i++) {
      const seg = this.segs[i]; if (!seg) continue;
      for (const s of seg.sprites) {
        if (!s.col) continue;
        const fullW = s.w;
        const cx = s.anchor === 'c' ? s.offset : s.offset + Math.sign(s.offset) * fullW / 2;
        if (!U.overlap(r.x, RIDER_W, cx, fullW * s.col)) continue;
        const sg = Math.sign(s.offset);
        if (s.soft) {
          r.speed *= 0.6; r.x -= sg * 0.12;
          if (r.isPlayer) { this.fx('bump', r); r.bikeHp -= 2; }
        } else if (r.speed > r.top * 0.22) this.crash(r, 'prop');
        else { r.speed = Math.min(r.speed, r.top * 0.1); r.z = zPrev; r.x -= sg * 0.06; }
        return;
      }
    }
  }
  carCollide(r, dt) {
    if (r.crash) return;
    for (const c of this.cars) {
      const reach = c.len / 2 + RIDER_L;
      const rel1 = c.z - r.z, rel0 = rel1 - (c.speed - r.speed) * dt;
      if (Math.max(rel0, rel1) < -reach || Math.min(rel0, rel1) > reach) continue;
      if (!U.overlap(r.x, RIDER_W, c.x, c.w)) continue;
      const relSpeed = r.speed - c.speed, fromBehind = rel0 >= reach - 60;
      if (fromBehind && relSpeed > 3500) { this.crash(r, 'car'); return; }
      if (fromBehind) { r.speed = Math.max(0, c.speed * 0.85); r.z = c.z - reach; }
      else {   // scraping along the side of the car: pushed away (knocked off if on one wheel)
        if (r.pitch > WHEELIE.fall) { this.crash(r, 'fall'); return; }
        const s = r.x >= c.x ? 1 : -1;
        r.x = c.x + s * ((c.w + RIDER_W) / 2 + 0.01); r.speed *= 0.97;
        if (r.scrape > 0) return;
        r.scrape = 0.5;
      }
      if (r.isPlayer) { this.fx('bump', r); r.bikeHp -= 3; }
      return;
    }
  }

  // ---------------- combat ----------------
  startAttack(r, side) { if (!r.atk && !r.crash) r.atk = { t: 0, side, done: false }; }
  updateAttack(r, dt) {
    if (!r.atk) return;
    r.atk.t += dt;
    if (!r.atk.done && r.atk.t >= 0.14) { r.atk.done = true; this.resolveHit(r, r.atk.side); }
    if (r.atk && r.atk.t >= 0.36) r.atk = null;
  }
  resolveHit(a, side) {
    if (this.view) return;   // hits are decided by the server
    const reach = a.weapon ? 0.62 : 0.48;
    let best = null, bd = 1e9;
    for (const t of this.riders()) {
      if (t === a || t.crash || t.inv > 0 || t.gone) continue;
      const dz = t.z - a.z; if (Math.abs(dz) > 340) continue;
      const dx = (t.x - a.x) * side; if (dx < 0.05 || dx > reach) continue;
      const d = Math.abs(dz) / 340 + dx;
      if (d < bd) { bd = d; best = t; }
    }
    if (!best) { if (a.isPlayer) this.fx('whiff', a); return; }
    const base = a.weapon === 'chain' ? 17 : a.weapon === 'club' ? 14 : 8;
    const mult = a.isPlayer ? 1 : best.isPlayer ? 0.65 + this.level * 0.08 : 0.8;
    best.hp -= base * U.rand(0.8, 1.25) * mult;
    best.x += side * 0.07; best.speed *= 0.985;
    this.fx('hit', null, a.z);
    if (best.isPlayer) this.fx('hurt', best);
    if (best.launch > 0 && best.hp > 0) { best.launch = 0; best.pitch = Math.min(best.pitch, 0.12); best.pitchV = 0; }   // a hit just slams a launch wheelie down
    if (best.hp <= 0 || best.pitch > WHEELIE.fall) {   // a hit during a wheelie knocks the rider off
      this.crash(best, best.hp <= 0 ? 'ko' : 'fall');
      if (a.isPlayer) {
        a.kos++;
        this.say(a, best.isPolice ? 'HẠ GỤC CẢNH SÁT!' : 'HẠ GỤC ' + best.name.toUpperCase() + '!', '#ffd23a', 1.6, 28);
        if (best.weapon && !a.weapon) this.steal(a, best);
      }
    } else if (a.isPlayer && best.weapon && !a.weapon && best.atk && Math.random() < 0.5) {
      best.atk = null; this.steal(a, best);
    }
  }
  steal(a, from) {
    a.weapon = from.weapon; from.weapon = null;
    this.say(a, 'CƯỚP ĐƯỢC ' + (a.weapon === 'chain' ? 'XÍCH' : 'GẬY') + '!', '#7fff7f', 1.6, 28);
  }
  // a crash: the rider is thrown (tumble), gets up, runs back to the bike, stands it up and rides on.
  // crash.ph: 0 tumble, 1 getting up, 2 running to the bike, 3 lifting it; crash.side: which side of the bike he stands
  crash(r, cause) {
    if (r.crash) return;
    r.crash = { t: 0, ph: 0, pt: 0, lift: 0, side: Math.random() < 0.5 ? -1 : 1 };
    r.atk = null; r.engaged = false; r.pitch = 0; r.pitchV = 0; r.wheelT = 0; r.wheelie = 0; r.launch = 0;
    // the rider is thrown over the bars and lands some 5-16 m ahead of where the bike stops, then runs back to it
    this.bodies.push({ kind: 'body', owner: r, pal: r.pal, z: r.z + 60, x: r.x, h: 120,
      vz: r.speed * 0.6 + 1200, vh: 1500, vx: U.rand(-0.4, 0.4), rot: 0, frame: 0, mode: 0, mt: 0, face: 0 });
    if (r.isPlayer) {
      this.fx('crash', r); r.weapon = null;
      r.bikeHp -= cause === 'ko' ? 6 : cause === 'car' ? U.rand(25, 38) : cause === 'fall' ? U.rand(8, 14) : U.rand(15, 26);
      const C = this.police;
      r.crash.copNear = !!(C && C.target === r && !C.crash && Math.abs(C.z - r.z) < 4500);
      this.say(r, cause === 'ko' ? 'BỊ HẠ GỤC!' : 'TÉ XE!', '#ff5040', 1.6, 36);
    }
    if (!r.isPlayer || this.server) this.fx('thud', null, r.z);
  }
  updateCrash(r, dt) {
    const c = r.crash; c.t += dt; c.pt += dt;
    // the bike slides to a stop
    r.speed = Math.max(0, r.speed - (r.speed * 2.2 + 1500) * dt);
    r.z += r.speed * dt;
    const b = this.bodies.find(o => o.owner === r);
    if (!b) { this.remount(r); return; }
    const next = ph => { c.ph = ph; c.pt = 0; b.mode = ph; b.mt = 0; };
    if (c.ph === 0) {   // tumbling: wait until both the rider and the bike lie still
      const still = b.h <= 0 && b.vh <= 0 && b.vz < 60 && r.speed < 150;
      if (c.t >= CRASH.minTumble && still || c.t >= CRASH.maxTumble) {
        b.vz = 0; b.vh = 0; b.h = 0; b.vx = 0;
        if (r.isPlayer && r.bikeHp <= 0) { r.bikeHp = 0; this.retire(r, 'wrecked'); }
        next(1);
      }
      return;
    }
    b.mt += dt;
    // where he stands to pick the bike up: beside it, on the side its seat faces
    const tx = U.clamp(r.x + c.side * CRASH.stand, -this.wall, this.wall), tz = r.z - 20;
    if (c.ph === 1) { if (c.pt >= CRASH.up) next(2); return; }
    if (c.ph === 2) {   // run to the bike (distances in metres: z is 216 units/m, x is 5 m per unit)
      const dxm = (tx - b.x) * 5, dzm = (tz - b.z) / 216, d = Math.hypot(dxm, dzm), step = CRASH.run * dt;
      if (d <= step || c.pt > 8) { b.x = tx; b.z = tz; next(3); b.face = -c.side * Math.PI / 2; return; }
      b.x += dxm / d * step / 5; b.z += dzm / d * step * 216;
      b.face = Math.atan2(dxm, dzm);
      return;
    }
    // lifting: stand the bike up and wheel it back onto the road
    c.lift = Math.min(1, c.pt / CRASH.lift);
    r.x += (U.clamp(r.x, 0.1 - this.E, this.E - 0.1) - r.x) * Math.min(1, dt * 3);
    b.x = U.clamp(r.x + c.side * CRASH.stand, -this.wall, this.wall); b.z = tz;
    if (c.pt >= CRASH.lift) this.remount(r);
  }
  // back on the bike: a moment of grace (no flashing) so nobody is knocked straight off again
  remount(r) {
    this.bodies = this.bodies.filter(b => b.owner !== r);
    r.crash = null; r.speed = 0; r.inv = 0.8; r.vx = 0; r.x = U.clamp(r.x, 0.1 - this.E, this.E - 0.1);
    r.hp = r.isPlayer ? r.maxHp : r.maxHp * 0.7;
  }
  updateBodies(dt) {
    for (const b of this.bodies) {
      if (b.mode) continue;   // on his feet: moved by updateCrash
      if (b.h > 0 || b.vh > 0) {
        b.vh -= 4200 * dt; b.h += b.vh * dt;
        if (b.h <= 0) { b.h = 0; b.vh = b.vh < -700 ? -b.vh * 0.35 : 0; b.vz *= 0.55; }
      }
      b.vz = Math.max(0, b.vz - (b.h > 0 ? 2200 : 2200 + b.vz) * dt); b.z += b.vz * dt;   // sliding on the tarmac brakes harder
      b.x = U.clamp(b.x + b.vx * dt, -this.wall, this.wall); b.vx *= 1 - dt * 2;
      const moving = b.vz > 50 || b.h > 0;
      if (moving) b.rot += dt * (8 + b.vz / 450);
      b.frame = moving ? Math.floor(b.rot) % 8 : 2;
    }
  }

  // ---------------- AI ----------------
  // the human an AI rider measures itself against: the nearest one still racing
  nearHuman(z) {
    let best = null, bd = Infinity;
    for (const h of this.humans) {
      if (h.done || h.gone) continue;
      const d = Math.abs(h.z - z); if (d < bd) { bd = d; best = h; }
    }
    return best;
  }
  avoidCars(r) {
    for (const c of this.cars) {
      // look ~0.7 s ahead (closing speed) so there is time to change lane before reaching the car's tail
      const dz = c.z - r.z, reach = c.len / 2 + RIDER_L, gap = (c.w + RIDER_W) / 2;
      const look = reach + 1500 + Math.max(0, r.speed - c.speed) * 0.7;
      if (dz > -reach && dz < look && Math.abs(c.x - r.x) < gap + 0.1) {
        let tx = c.x + (r.x <= c.x ? -1 : 1) * (gap + 0.15);
        if (Math.abs(tx) > 0.95) tx = c.x - Math.sign(tx) * (gap + 0.15);
        r.targetX = tx; return true;
      }
    }
    return false;
  }
  steerTo(r, dt) {
    const step = (this.circuit ? 1.6 : 1.3) * dt, mv = U.clamp(r.targetX - r.x, -step, step);
    r.x = U.clamp(r.x + mv, -this.E, this.E);
    const { need, ratio } = this.bend(r, this.findSeg(r.z), 1.08);
    r.leanF += (Race.leanFor(need, ratio, step > 0 ? mv / step : 0, r.speed / r.top) - r.leanF) * Math.min(1, dt * 6);
    r.lean = r.leanF;
  }
  aiAttack(r, T) {
    const dz = r.z - T.z, ddx = T.x - r.x, reach = r.weapon ? 0.6 : 0.46;
    if (r.cool > 0 || r.atk || Math.abs(dz) > 300) return;
    if (Math.abs(ddx) > 0.06 && Math.abs(ddx) < reach) {
      this.startAttack(r, ddx < 0 ? -1 : 1);
      r.cool = U.rand(0.8, 2.0) / (0.4 + r.aggr) * Math.max(0.6, 1.3 - this.level * 0.08);
    }
  }
  updateAI(r, dt) {
    r.inv = Math.max(0, r.inv - dt); r.cool -= dt;
    if (r.crash) { this.updateCrash(r, dt); return; }
    if (this.state === 'countdown') return;
    if (r.finished && r.z > this.finishZ + 8000) { r.speed = 0; return; }
    const T = this.nearHuman(r.z), dzT = T ? r.z - T.z : 0, seg = this.findSeg(r.z);
    let want = r.top;
    if (T && !this.demo && !r.finished) { if (dzT > 6000) want *= 0.9; else if (dzT < -5000) want *= 1.08; }
    if (r.finished) want = r.top * 0.4;
    if (!this.circuit) want *= 1 - Math.min(0.12, Math.abs(seg.curve) * 0.015);
    r.laneT -= dt;
    if (this.circuit) r.targetX = (this.findSeg(r.z + 25 * CFG.segL).line + r.lineOff) * this.E;   // racing line
    else if (r.laneT <= 0) { r.laneT = U.rand(2, 5); r.targetX = U.pick([-0.6, -0.25, 0.1, 0.45, 0.7]); }
    const canFight = T && !this.demo && !T.crash && !r.finished && this.state === 'racing';
    const near = canFight && Math.abs(dzT) < 900;
    if (near) { if (!r.engaged && Math.random() < r.aggr * dt * 2) r.engaged = true; } else r.engaged = false;
    if (r.engaged) {
      r.targetX = T.x + (r.x < T.x ? -0.28 : 0.28);
      if (dzT > 150) want = Math.min(want, T.speed * 0.97);
      else if (dzT < -150) want = Math.max(want, Math.min(r.top * 1.05, T.speed * 1.05));
    }
    // no faster than the bends ahead allow (a better rider dares a little more)
    want = Math.min(want, seg.vlim * Math.sqrt(0.92 + 0.16 * r.skill) / CFG.KZ);
    r.targetX = U.clamp(r.targetX, 0.12 - this.E, this.E - 0.12);
    if (r.speed < want) r.speed = Math.min(want, r.speed + r.top / 4.5 * dt);
    else r.speed = Math.max(want, r.speed - r.top / 2.5 * dt);
    const avoiding = this.avoidCars(r);
    // show-off wheelies on a clear road (never while fighting or dodging traffic)
    if (r.wheelie > 0) r.wheelie -= dt;
    else if (!r.engaged && !r.finished && r.speed > r.top * 0.4 && Math.random() < dt * 0.05) r.wheelie = U.rand(0.8, 2.4);
    this.updatePitch(r, dt, r.wheelie > 0 && !r.engaged && !avoiding, false);
    this.steerTo(r, dt);
    r.z += r.speed * dt;
    this.carCollide(r, dt);
    if (r.engaged) this.aiAttack(r, T);
    this.updateAttack(r, dt);
  }

  // one police bike at a time, chasing one human (its target)
  updatePolice(dt) {
    if (this.demo || this.circuit || this.state !== 'racing') return;
    if (!this.police) {
      const pool = this.humans.filter(h => !h.done && !h.gone && h.z < this.finishZ - 30000);
      if (!pool.length) return;
      this.policeTimer -= dt;
      if (this.policeTimer > 0) return;
      const T = U.pick(pool);
      const C = this.police = this.mkRider({ isPolice: true, name: 'CẢNH SÁT', pal: POLICE_PAL, z: T.z - 2600,
        x: U.rand(-0.6, 0.6), top: Math.max(T.top * 1.1, 12500), hp: 70 + this.level * 15, weapon: 'club', aggr: 1 });
      C.speed = T.speed; C.sirenT = 0; C.target = T; this.policeGen++;
      this.say(T, 'CẢNH SÁT ĐUỔI THEO!', '#5aa0ff', 2, 30);
      return;
    }
    const C = this.police, T = C.target;
    C.inv = Math.max(0, C.inv - dt); C.cool -= dt;
    if (C.crash) { this.updateCrash(C, dt); return; }
    const dz = C.z - T.z;
    C.sirenT -= dt;
    if (C.sirenT <= 0) { this.fx('siren', null, C.z); C.sirenT = 0.7; }
    if (T.crash && T.crash.copNear) {
      const want = dz < -400 ? C.top : 0;
      C.speed += U.clamp(want - C.speed, -C.top * 1.5 * dt, C.top / 3 * dt);
      C.targetX = T.x + 0.3;
      if (Math.abs(dz) < 800 && T.crash.t > 1) this.retire(T, 'busted');
    } else {
      if (dz < -15000 || T.done || T.gone) {
        this.police = null; this.policeTimer = U.rand(20, 35);
        if (!T.done && !T.gone) this.say(T, 'ĐÃ CẮT ĐUÔI CẢNH SÁT!', '#9fe0ff');
        return;
      }
      const want = dz < -200 ? C.top : dz > 400 ? T.speed * 0.85 : T.speed;
      C.speed += U.clamp(want - C.speed, -C.top * dt, C.top / 3.5 * dt);
      C.targetX = T.x + (C.x < T.x ? -0.3 : 0.3);
      if (!T.crash) this.aiAttack(C, T);
    }
    C.speed = Math.max(0, C.speed);
    this.avoidCars(C);
    this.steerTo(C, dt);
    C.z += C.speed * dt;
    this.carCollide(C, dt);
    this.updateAttack(C, dt);
  }

  // traffic lives around the humans: a vehicle nobody is near any more reappears ahead of the next human in turn
  updateCars(dt) {
    if (this.state === 'countdown') return;   // traffic waits for the start
    const hs = this.humans.filter(h => !h.gone), live = hs.filter(h => !h.done), around = live.length ? live : hs;
    for (const c of this.cars) {
      let want = c.vmax;
      for (const o of this.cars) {   // keep a gap to the vehicle ahead in the same lane
        if (o === c || Math.abs(o.x - c.x) > 0.25) continue;
        const dz = o.z - c.z, gap = (o.len + c.len) / 2 + 700;
        if (dz > 0 && dz < gap + 2500) want = Math.min(want, dz < gap ? o.speed * 0.9 : o.speed);
      }
      c.speed += U.clamp(want - c.speed, -2500 * dt, 900 * dt);
      c.z += c.speed * dt;
      if (around.length && !around.some(h => c.z > h.z - 5000 && c.z < h.z + 90000)) {
        const h = around[this.carTurn++ % around.length];
        this.placeCar(Object.assign(c, this.newCar(h.z + U.rand(62000, 85000))));
      }
    }
  }

  separate() {
    const rs = this.riders();
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j];
      if (a.crash || b.crash || a.gone || b.gone || Math.abs(a.z - b.z) > RIDER_L * 2) continue;
      const d = b.x - a.x, ad = Math.abs(d);
      if (ad < RIDER_W) {
        const push = (RIDER_W - ad) / 2 + 0.002, s = d >= 0 ? 1 : -1;
        a.x -= s * push; b.x += s * push;
      }
    }
  }
  checkFinish() {
    for (const r of this.racers) {
      if (r.finished || r.gone || r.z < this.finishZ) continue;
      r.finished = true; r.time = this.time;
      if (r.isPlayer && !this.demo) {
        r.place = this.racers.filter(o => o.finished).length;
        this.say(r, r.place === 1 ? 'VỀ NHẤT!' : 'VỀ ĐÍCH - HẠNG ' + r.place, r.place <= 3 ? '#ffd23a' : '#ffffff', 5, 40);
        this.retire(r, 'finished');
      }
    }
  }
  // online: once the first human is home the others get 60 s to finish
  lastCallClock(dt) {
    if (this.over) return;
    if (this.lastCall === null) {
      if (!this.humans.some(h => h.done === 'finished')) return;
      this.lastCall = 60;
      for (const h of this.humans) if (!h.done) this.say(h, 'CÒN 60 GIÂY ĐỂ VỀ ĐÍCH!', '#ffb000', 3, 30);
    }
    this.lastCall -= dt;
    if (this.lastCall <= 0) for (const h of this.humans) if (!h.done) this.retire(h, 'timeout');
  }
  rank() {
    const arr = this.racers.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.time - b.time;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.z - a.z;
    });
    arr.forEach((r, i) => { r.rank = i + 1; });
    for (const h of this.humans) if (h.place) h.rank = h.place;
  }
  findTarget() {
    const P = this.player; let best = null, bd = 1e9;
    for (const r of this.riders()) {
      if (r === P || r.crash || r.gone) continue;
      const dz = Math.abs(r.z - P.z); if (dz > 1500) continue;
      const d = dz + Math.abs(r.x - P.x) * 1000;
      if (d < bd) { bd = d; best = r; }
    }
    this.target = best;
  }
  results() {
    const rows = this.racers.map(r => ({
      name: r.name, id: r.id, human: !!r.isPlayer, isPlayer: r === this.player && this.local, finished: r.finished,
      time: r.finished ? r.time : r.isPlayer ? Infinity : this.time + (this.finishZ - r.z) / Math.max(4000, r.top * 0.9),
    }));
    rows.sort((a, b) => a.time - b.time);
    return rows;
  }
}
