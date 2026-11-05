'use strict';
// ============ Race simulation: physics, AI, combat, police, traffic ============
// One Race object runs a whole event for one or more human riders.
//  - single player: one local human whose keys are read here; sounds / messages play at once
//  - online server (o.server): several humans fed by network input; feedback is queued in `events` for the clients
//  - online client mirror (o.view): no simulation at all, Net fills it from snapshots and only predicts its own
//    bike with motion()
const BIKES = [
  { name: 'Sói Xám 250', price: 0, speed: 11500, accel: 1.0, handling: 1.0, dur: 100, color: '#8a8f99' },
  { name: 'Hổ Mang 600', price: 6000, speed: 12800, accel: 1.15, handling: 1.06, dur: 120, color: '#2f9a3a' },
  { name: 'Đại Bàng 750', price: 15000, speed: 14000, accel: 1.3, handling: 1.12, dur: 140, color: '#1f5fd0' },
  { name: 'Rồng Lửa 1000', price: 32000, speed: 15500, accel: 1.45, handling: 1.18, dur: 170, color: '#d01c1c' },
];
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
    const online = !!o.humans, hs = o.humans || [{ id: 'me', name: 'BẠN', bikeIdx: o.bikeIdx, bikeHp: o.bikeHp }];
    this.humans = hs.map((h, i) => {
      const bike = BIKES[h.bikeIdx], [row, col] = GRID[i];
      const r = this.mkRider({ isPlayer: true, id: h.id, name: h.name, pal: humanPal(h.bikeIdx, online ? i : -1), style: h.bikeIdx,
        top: bike.speed, hp: 100, x: [-0.5, 0, 0.5][col], z: this.startZ + (3 - row) * 650 });
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
        name: rv.name, pal: rv.pal, rv: RIVALS.indexOf(rv), x: [-0.5, 0, 0.5][col], z: this.startZ + (3 - row) * 650,
        top: (10600 + this.level * 650) * (0.84 + skill * 0.16), skill,
        hp: roster ? roster[i].hp : 55 + this.level * 12 + skill * 20, aggr: U.rand(0.3, 0.9),
        weapon: Math.random() < 0.3 + this.level * 0.06 ? rv.weapon : null,
      });
      this.racers.push(r);
    });
    this.police = null; this.policeTimer = U.rand(35, 60) / (0.7 + this.level * 0.15); this.policeGen = 0;
    this.cars = []; this.carTurn = 0;
    if (!this.view) {
      const nCars = 10 + this.level * 2;
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
      pitch: 0, pitchV: 0, wheelT: 0, wheelie: 0 }, o);
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
        for (const r of this.racers) if (!r.isPlayer && Math.random() < 0.4) r.wheelie = U.rand(0.6, 1.4);   // launch wheelies
      }
      if (this.local && !this.demo) Sound.engine(Input.is('up') ? 0.75 : 0.12, 0.1);
    } else {
      this.time += dt;
      const P = this.player;
      if (this.local && !this.demo) Sound.engine(P.speed / P.top, P.crash ? 0.02 : 0.08 + 0.06 * P.speed / P.top);
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
    if (this.state === 'racing') inp = !h.done && !this.demo ? h.input : { steer: this.autoSteer(h, dt), gas: this.demo, brake: false, wheel: false };
    if (inp.atkL) this.startAttack(h, -1);
    if (inp.atkR) this.startAttack(h, 1);
    const zPrev = h.z;
    this.motion(h, inp, dt);
    if (Math.abs(h.x) > 0.95) this.propCollide(h, zPrev);
    this.carCollide(h, dt);
    this.updateAttack(h, dt);
  }
  // throttle, brake, steering and wheelie of a human-ridden bike (the online client predicts its own bike with this)
  motion(r, inp, dt) {
    const B = r.bike, seg = this.findSeg(r.z), sp = r.speed / r.top;
    // wheelie: needs the throttle open; the brake slams the front down
    this.updatePitch(r, dt, inp.wheel && inp.gas && !inp.brake, inp.brake);
    const wk = U.clamp(r.pitch / 0.4, 0, 1), topE = r.top * (1 + WHEELIE.boost * wk);
    if (r.speed > 30 || inp.gas) {
      // front wheel in the air: much less steering
      const dx = dt * 2.2 * Math.max(0.3, Math.min(1, sp * 1.3)) * B.handling * (1 - 0.55 * wk);
      r.x += inp.steer * dx;
      r.x -= dx * sp * seg.curve * 0.2;
    }
    r.leanF += (U.clamp(inp.steer * 2 * (1 - 0.5 * wk) + seg.curve * 0.12 * sp, -2, 2) - r.leanF) * Math.min(1, dt * 10);
    r.lean = r.leanF;
    if (inp.gas) r.speed += r.top / 5 * B.accel * (1.25 - r.speed / topE) * dt;
    else if (inp.brake) r.speed -= r.top * 1.1 * dt;
    else r.speed -= r.top / 5 * (r.finished ? 1.2 : 0.7) * dt;
    if (Math.abs(r.x) > 1.05 && r.speed > r.top * 0.3) { r.speed -= r.top * 0.8 * dt; this.fx('rumble', r); }
    // a wheelie is worth a little extra top speed; it bleeds off gently once the front is down
    if (r.speed > topE) r.speed = Math.max(topE, r.speed - r.top * 0.2 * dt);
    r.speed = Math.max(0, r.speed);
    r.x = U.clamp(r.x, -3.2, 3.2);
    r.z += r.speed * dt;
  }
  autoSteer(r, dt) {
    r.laneT -= dt;
    if (r.laneT <= 0) { r.laneT = U.rand(3, 6); r.targetX = U.pick([-0.3, 0, 0.3, 0.5]); }
    this.avoidCars(r);
    const seg = this.findSeg(r.z), sp = r.speed / r.top;
    return U.clamp((r.targetX - r.x) * 4 + seg.curve * 0.2 * sp, -1, 1);
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
  crash(r, cause) {
    if (r.crash) return;
    r.crash = { t: 0, dur: r.isPlayer ? 3.0 : 2.6 };
    r.atk = null; r.engaged = false; r.pitch = 0; r.pitchV = 0; r.wheelT = 0; r.wheelie = 0;
    this.bodies.push({ kind: 'body', owner: r, pal: r.pal, z: r.z + 60, x: r.x, h: 120,
      vz: r.speed * 0.6 + 900, vh: 1500, vx: U.rand(-0.5, 0.5), rot: 0, frame: 0 });
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
    const c = r.crash; c.t += dt;
    r.speed = Math.max(0, r.speed - (r.speed * 2.2 + 1500) * dt);
    r.z += r.speed * dt;
    if (c.t < c.dur) return;
    this.bodies = this.bodies.filter(b => b.owner !== r);
    r.crash = null; r.speed = 0; r.inv = 1.6; r.x = U.clamp(r.x, -0.8, 0.8);
    r.hp = r.isPlayer ? r.maxHp : r.maxHp * 0.7;
    if (r.isPolice) { this.police = null; this.policeTimer = U.rand(25, 45); return; }
    if (r.isPlayer && r.bikeHp <= 0) { r.bikeHp = 0; this.retire(r, 'wrecked'); }
  }
  updateBodies(dt) {
    for (const b of this.bodies) {
      if (b.h > 0 || b.vh > 0) {
        b.vh -= 4200 * dt; b.h += b.vh * dt;
        if (b.h <= 0) { b.h = 0; b.vh = b.vh < -700 ? -b.vh * 0.35 : 0; b.vz *= 0.55; }
      }
      b.vz = Math.max(0, b.vz - 2200 * dt); b.z += b.vz * dt;
      b.x += b.vx * dt; b.vx *= 1 - dt * 2;
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
    const d = r.targetX - r.x, step = 1.3 * dt;
    r.x += U.clamp(d, -step, step);
    r.lean = U.clamp(d * 10, -2, 2);
    r.x = U.clamp(r.x, -1, 1);
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
    want *= 1 - Math.min(0.12, Math.abs(seg.curve) * 0.015);
    r.laneT -= dt;
    if (r.laneT <= 0) { r.laneT = U.rand(2, 5); r.targetX = U.pick([-0.6, -0.25, 0.1, 0.45, 0.7]); }
    const canFight = T && !this.demo && !T.crash && !r.finished && this.state === 'racing';
    const near = canFight && Math.abs(dzT) < 900;
    if (near) { if (!r.engaged && Math.random() < r.aggr * dt * 2) r.engaged = true; } else r.engaged = false;
    if (r.engaged) {
      r.targetX = T.x + (r.x < T.x ? -0.28 : 0.28);
      if (dzT > 150) want = Math.min(want, T.speed * 0.97);
      else if (dzT < -150) want = Math.max(want, Math.min(r.top * 1.05, T.speed * 1.05));
    }
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
    if (this.demo || this.state !== 'racing') return;
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
