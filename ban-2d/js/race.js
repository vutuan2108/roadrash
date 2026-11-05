'use strict';
// ============ Race simulation: physics, AI, combat, police, traffic ============
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
const CAR_COLS = ['#c8102e', '#f0f0f0', '#1f5fd0', '#e0b020', '#2a2a2a', '#2f8a4a', '#a0a0a8', '#7a2a8a'];
const RIDER_W = 0.14;

class Race {
  constructor(o) {
    this.theme = THEMES[o.themeIdx]; this.level = o.level; this.demo = !!o.demo;
    const tr = Track.build(this.theme, o.level, o.seed !== undefined ? o.seed : o.themeIdx * 977 + o.level * 131 + 7);
    this.segs = tr.segs; this.startZ = tr.startZ; this.finishZ = tr.finishZ;
    this.bgs = Spr.backgrounds(this.theme); this.bgOff = { sky: 0, far: 0, near: 0 };
    this.bike = BIKES[o.bikeIdx];
    const P = this.player = this.mkRider({ isPlayer: true, name: 'BẠN', pal: playerPal(o.bikeIdx), top: this.bike.speed, hp: 100, x: 0, z: this.startZ });
    P.bikeMax = this.bike.dur; P.bikeHp = o.bikeHp !== undefined ? o.bikeHp : this.bike.dur; P.kos = 0;
    this.racers = [P];
    const pool = RIVALS.slice().sort(() => Math.random() - 0.5);
    let slot = 0;
    for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
      if (row === 3 && col === 1) continue;
      const i = slot++, rv = pool[i];
      const skill = U.clamp(1 - i / 11 * 0.7 + U.rand(-0.1, 0.1), 0, 1);
      this.racers.push(this.mkRider({
        name: rv.name, pal: rv.pal, x: [-0.5, 0, 0.5][col], z: this.startZ + (3 - row) * 450,
        top: (10600 + this.level * 650) * (0.84 + skill * 0.16), skill,
        hp: 55 + this.level * 12 + skill * 20, aggr: U.rand(0.3, 0.9),
        weapon: Math.random() < 0.3 + this.level * 0.06 ? rv.weapon : null,
      }));
    }
    this.police = null; this.policeTimer = U.rand(35, 60) / (0.7 + this.level * 0.15);
    const nCars = 10 + this.level * 2;
    this.cars = [];
    for (let i = 0; i < nCars; i++) this.cars.push(this.newCar(this.startZ + 18000 + i * 66000 / nCars));
    this.bodies = []; this.msgs = []; this.ents = new Map();
    this.time = 0; this.count = 3.999; this.lastBeep = 4;
    this.state = this.demo ? 'racing' : 'countdown';
    this.over = null; this.shake = 0; this.target = null;
    this.cam = { z: 0, x: 0, focusZ: 0 };
    this.updateCam(); this.rank(); this.buildEnts();
  }

  mkRider(o) {
    const r = Object.assign({ kind: 'rider', speed: 0, lean: 0, leanF: 0, atk: null, cool: U.rand(1, 3), crash: null,
      inv: 0, laneT: U.rand(1, 4), finished: false, time: 0, rank: 0, weapon: null, skill: 0.5, aggr: 0.5, hp: 100 }, o);
    r.maxHp = r.hp; r.targetX = r.x;
    return r;
  }
  newCar(z) {
    const dir = Math.random() < 0.35 ? -1 : 1, q = Math.random();
    const type = q < 0.6 ? 'sedan' : q < 0.82 ? 'van' : 'truck';
    return { kind: 'car', z, dir, type, col: U.pick(CAR_COLS), x: (dir < 0 ? -0.5 : 0.5) + U.rand(-0.06, 0.06),
      speed: dir > 0 ? U.rand(3500, 6500) : U.rand(4000, 7000), w: type === 'truck' ? 0.44 : 0.34 };
  }
  findSeg(z) { return this.segs[U.clamp(Math.floor(z / CFG.segL), 0, this.segs.length - 1)]; }
  riders() { return this.police ? this.racers.concat([this.police]) : this.racers; }
  msg(text, col, dur, size) {
    this.msgs.push({ text, col: col || '#fff', t: dur || 1.6, size });
    if (this.msgs.length > 3) this.msgs.shift();
  }
  end(reason) {
    if (this.over) return;
    this.over = { reason, t: 0 };
    if (reason === 'busted') this.msg('BỊ CẢNH SÁT BẮT!', '#5aa0ff', 4, 36);
    if (reason === 'wrecked') this.msg('XE HỎNG NẶNG!', '#ff5040', 4, 36);
  }
  updateCam() { const P = this.player; this.cam.focusZ = P.z; this.cam.z = P.z - CFG.playerZ; this.cam.x = P.x; }

  update(dt) {
    const P = this.player, z0 = P.z;
    this.shake = Math.max(0, this.shake - dt * 2);
    if (this.state === 'countdown') {
      this.count -= dt;
      const c = Math.ceil(this.count);
      if (c !== this.lastBeep) { this.lastBeep = c; if (c > 0) Sound.beep(440, 0.15); }
      if (this.count <= 0) { this.state = 'racing'; Sound.beep(880, 0.4); this.msg('ĐI!', '#7fff7f', 1, 56); }
      Sound.engine(Input.is('up') ? 0.75 : 0.12, 0.1);
    } else {
      this.time += dt;
      if (!this.demo) Sound.engine(P.speed / P.top, P.crash ? 0.02 : 0.08 + 0.06 * P.speed / P.top);
    }
    this.updatePlayer(dt);
    for (const r of this.racers) if (r !== P) this.updateAI(r, dt);
    this.updatePolice(dt);
    this.updateCars(dt);
    this.updateBodies(dt);
    this.separate();
    this.checkFinish();
    this.rank();
    this.findTarget();
    const seg = this.findSeg(P.z), d = (P.z - z0) / CFG.segL;
    this.bgOff.sky += 0.001 * seg.curve * d; this.bgOff.far += 0.002 * seg.curve * d; this.bgOff.near += 0.003 * seg.curve * d;
    this.updateCam();
    if (this.msgs.length) { this.msgs[0].t -= dt; if (this.msgs[0].t <= 0) this.msgs.shift(); }
    if (this.over) this.over.t += dt;
    this.buildEnts();
  }

  // ---------------- player ----------------
  updatePlayer(dt) {
    const P = this.player, B = this.bike;
    P.inv = Math.max(0, P.inv - dt);
    if (P.crash) { this.updateCrash(P, dt); return; }
    const seg = this.findSeg(P.z), sp = P.speed / P.top;
    let steer = 0, gas = false, brake = false;
    if (this.state === 'racing' && !this.demo && !P.finished && !this.over) {
      steer = (Input.is('right') ? 1 : 0) - (Input.is('left') ? 1 : 0);
      gas = Input.is('up'); brake = Input.is('down');
      if (Input.pressed('atkL')) this.startAttack(P, -1);
      if (Input.pressed('atkR')) this.startAttack(P, 1);
    } else if (this.state === 'racing') {
      steer = this.autoSteer(P, dt); gas = this.demo;
    }
    if (P.speed > 30 || gas) {
      const dx = dt * 2.2 * Math.max(0.3, Math.min(1, sp * 1.3)) * B.handling;
      P.x += steer * dx;
      P.x -= dx * sp * seg.curve * 0.2;
    }
    P.leanF += (U.clamp(steer * 2 + seg.curve * 0.12 * sp, -2, 2) - P.leanF) * Math.min(1, dt * 10);
    P.lean = P.leanF;
    if (gas) P.speed += P.top / 5 * B.accel * (1.25 - sp) * dt;
    else if (brake) P.speed -= P.top * 1.1 * dt;
    else P.speed -= P.top / 5 * (P.finished ? 1.2 : 0.7) * dt;
    if (Math.abs(P.x) > 1.05 && P.speed > P.top * 0.3) {
      P.speed -= P.top * 0.8 * dt;
      if (Math.random() < 0.3) this.shake = Math.max(this.shake, 0.08);
    }
    P.speed = U.clamp(P.speed, 0, P.top);
    P.x = U.clamp(P.x, -3.2, 3.2);
    const zPrev = P.z;
    P.z += P.speed * dt;
    if (Math.abs(P.x) > 0.95) this.propCollide(P, zPrev);
    this.carCollide(P, dt);
    this.updateAttack(P, dt);
  }
  autoSteer(r, dt) {
    r.laneT -= dt;
    if (r.laneT <= 0) { r.laneT = U.rand(3, 6); r.targetX = U.pick([-0.3, 0, 0.3, 0.5]); }
    this.avoidCars(r);
    const seg = this.findSeg(r.z), sp = r.speed / r.top;
    return U.clamp((r.targetX - r.x) * 4 + seg.curve * 0.2 * sp, -1, 1);
  }

  propCollide(r, zPrev) {
    const i0 = Math.floor(zPrev / CFG.segL), i1 = Math.floor(r.z / CFG.segL);
    for (let i = i0; i <= i1; i++) {
      const seg = this.segs[i]; if (!seg) continue;
      for (const s of seg.sprites) {
        if (!s.col) continue;
        const fullW = s.img.width * s.img.px / CFG.roadW;
        const cx = s.anchor === 'c' ? s.offset : s.offset + Math.sign(s.offset) * fullW / 2;
        if (!U.overlap(r.x, RIDER_W, cx, fullW * s.col)) continue;
        const sg = Math.sign(s.offset);
        if (s.soft) {
          r.speed *= 0.6; r.x -= sg * 0.12;
          if (r.isPlayer) { Sound.thud(); this.shake = 0.3; r.bikeHp -= 2; }
        } else if (r.speed > r.top * 0.22) this.crash(r, 'prop');
        else { r.speed = Math.min(r.speed, r.top * 0.1); r.z = zPrev; r.x -= sg * 0.06; }
        return;
      }
    }
  }
  carCollide(r, dt) {
    if (r.crash) return;
    for (const c of this.cars) {
      const rel1 = c.z - r.z, rel0 = rel1 - (c.speed * c.dir - r.speed) * dt;
      if (Math.max(rel0, rel1) < -60 || Math.min(rel0, rel1) > 160) continue;
      if (!U.overlap(r.x, RIDER_W, c.x, c.w)) continue;
      const relSpeed = r.speed - c.speed * c.dir;
      if (relSpeed > 3500 || c.dir < 0) { this.crash(r, 'car'); return; }
      r.speed = Math.max(0, c.speed * 0.85); r.z = c.z - 170;
      if (r.isPlayer) { Sound.thud(); this.shake = 0.25; r.bikeHp -= 3; }
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
    const reach = a.weapon ? 0.62 : 0.48;
    let best = null, bd = 1e9;
    for (const t of this.riders()) {
      if (t === a || t.crash || t.inv > 0) continue;
      const dz = t.z - a.z; if (Math.abs(dz) > 340) continue;
      const dx = (t.x - a.x) * side; if (dx < 0.05 || dx > reach) continue;
      const d = Math.abs(dz) / 340 + dx;
      if (d < bd) { bd = d; best = t; }
    }
    if (!best) { if (a.isPlayer) Sound.whiff(); return; }
    const base = a.weapon === 'chain' ? 17 : a.weapon === 'club' ? 14 : 8;
    const mult = a.isPlayer ? 1 : best.isPlayer ? 0.65 + this.level * 0.08 : 0.8;
    best.hp -= base * U.rand(0.8, 1.25) * mult;
    best.x += side * 0.07; best.speed *= 0.985;
    if (Math.abs(a.z - this.player.z) < 3000) Sound.hit();
    if (best.isPlayer) this.shake = Math.max(this.shake, 0.3);
    if (best.hp <= 0) {
      this.crash(best, 'ko');
      if (a.isPlayer) {
        a.kos++;
        this.msg(best.isPolice ? 'HẠ GỤC CẢNH SÁT!' : 'HẠ GỤC ' + best.name.toUpperCase() + '!', '#ffd23a', 1.6, 28);
        if (best.weapon && !a.weapon) this.steal(a, best);
      }
    } else if (a.isPlayer && best.weapon && !a.weapon && best.atk && Math.random() < 0.5) {
      best.atk = null; this.steal(a, best);
    }
  }
  steal(a, from) {
    a.weapon = from.weapon; from.weapon = null;
    this.msg('CƯỚP ĐƯỢC ' + (a.weapon === 'chain' ? 'XÍCH' : 'GẬY') + '!', '#7fff7f', 1.6, 28);
  }
  crash(r, cause) {
    if (r.crash) return;
    r.crash = { t: 0, dur: r.isPlayer ? 3.0 : 2.6 };
    r.atk = null; r.engaged = false;
    this.bodies.push({ kind: 'body', owner: r, pal: r.pal, z: r.z + 60, x: r.x, h: 120,
      vz: r.speed * 0.6 + 900, vh: 1500, vx: U.rand(-0.5, 0.5), rot: 0, frame: 0 });
    if (r.isPlayer) {
      Sound.crash(); this.shake = 0.7; r.weapon = null;
      r.bikeHp -= cause === 'ko' ? 6 : cause === 'car' ? U.rand(25, 38) : U.rand(15, 26);
      r.crash.copNear = !!(this.police && !this.police.crash && Math.abs(this.police.z - r.z) < 4500);
      this.msg(cause === 'ko' ? 'BỊ HẠ GỤC!' : 'TÉ XE!', '#ff5040', 1.6, 36);
    } else if (Math.abs(r.z - this.player.z) < 4000) Sound.thud();
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
    if (r.isPlayer && r.bikeHp <= 0) { r.bikeHp = 0; this.end('wrecked'); }
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
  avoidCars(r) {
    for (const c of this.cars) {
      const dz = c.z - r.z;
      if (dz > 0 && dz < 3000 && Math.abs(c.x - r.x) < c.w) {
        let tx = c.x + (r.x <= c.x ? -1 : 1) * (c.w + 0.12);
        if (Math.abs(tx) > 0.95) tx = c.x - Math.sign(tx) * (c.w + 0.12);
        r.targetX = tx; return;
      }
    }
  }
  steerTo(r, dt) {
    const d = r.targetX - r.x, step = 1.3 * dt;
    r.x += U.clamp(d, -step, step);
    r.lean = U.clamp(d * 10, -2, 2);
    r.x = U.clamp(r.x, -1, 1);
  }
  aiAttack(r) {
    const P = this.player, dzP = r.z - P.z, ddx = P.x - r.x, reach = r.weapon ? 0.6 : 0.46;
    if (r.cool > 0 || r.atk || Math.abs(dzP) > 300) return;
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
    const P = this.player, dzP = r.z - P.z, seg = this.findSeg(r.z);
    let want = r.top;
    if (!this.demo && !r.finished) { if (dzP > 6000) want *= 0.9; else if (dzP < -5000) want *= 1.08; }
    if (r.finished) want = r.top * 0.4;
    want *= 1 - Math.min(0.12, Math.abs(seg.curve) * 0.015);
    r.laneT -= dt;
    if (r.laneT <= 0) { r.laneT = U.rand(2, 5); r.targetX = U.pick([-0.6, -0.25, 0.1, 0.45, 0.7]); }
    const canFight = !this.demo && !P.crash && !P.finished && !r.finished && !this.over && this.state === 'racing';
    const near = canFight && Math.abs(dzP) < 900;
    if (near) { if (!r.engaged && Math.random() < r.aggr * dt * 2) r.engaged = true; } else r.engaged = false;
    if (r.engaged) {
      r.targetX = P.x + (r.x < P.x ? -0.28 : 0.28);
      if (dzP > 150) want = Math.min(want, P.speed * 0.97);
      else if (dzP < -150) want = Math.max(want, Math.min(r.top * 1.05, P.speed * 1.05));
    }
    if (r.speed < want) r.speed = Math.min(want, r.speed + r.top / 4.5 * dt);
    else r.speed = Math.max(want, r.speed - r.top / 2.5 * dt);
    this.avoidCars(r);
    this.steerTo(r, dt);
    r.z += r.speed * dt;
    this.carCollide(r, dt);
    if (r.engaged) this.aiAttack(r);
    this.updateAttack(r, dt);
  }

  updatePolice(dt) {
    const P = this.player;
    if (this.demo || this.state !== 'racing') return;
    if (!this.police) {
      if (P.finished || this.over) return;
      this.policeTimer -= dt;
      if (this.policeTimer <= 0 && P.z < this.finishZ - 30000) {
        const C = this.police = this.mkRider({ isPolice: true, name: 'CẢNH SÁT', pal: POLICE_PAL, z: P.z - 2600,
          x: U.rand(-0.6, 0.6), top: Math.max(P.top * 1.1, 12500), hp: 70 + this.level * 15, weapon: 'club', aggr: 1 });
        C.speed = P.speed; C.sirenT = 0;
        this.msg('CẢNH SÁT ĐUỔI THEO!', '#5aa0ff', 2, 30);
      }
      return;
    }
    const C = this.police;
    C.inv = Math.max(0, C.inv - dt); C.cool -= dt;
    if (C.crash) { this.updateCrash(C, dt); return; }
    const dz = C.z - P.z;
    C.sirenT -= dt;
    if (C.sirenT <= 0 && Math.abs(dz) < 5000) { Sound.siren(); C.sirenT = 0.7; }
    if (P.crash && P.crash.copNear) {
      const want = dz < -400 ? C.top : 0;
      C.speed += U.clamp(want - C.speed, -C.top * 1.5 * dt, C.top / 3 * dt);
      C.targetX = P.x + 0.3;
      if (Math.abs(dz) < 800 && P.crash.t > 1) this.end('busted');
    } else {
      if (dz < -15000 || P.finished) {
        this.police = null; this.policeTimer = U.rand(20, 35);
        if (!P.finished) this.msg('ĐÃ CẮT ĐUÔI CẢNH SÁT!', '#9fe0ff');
        return;
      }
      const want = dz < -200 ? C.top : dz > 400 ? P.speed * 0.85 : P.speed;
      C.speed += U.clamp(want - C.speed, -C.top * dt, C.top / 3.5 * dt);
      C.targetX = P.x + (C.x < P.x ? -0.3 : 0.3);
      if (!P.crash && !this.over) this.aiAttack(C);
    }
    C.speed = Math.max(0, C.speed);
    this.avoidCars(C);
    this.steerTo(C, dt);
    C.z += C.speed * dt;
    this.carCollide(C, dt);
    this.updateAttack(C, dt);
  }

  updateCars(dt) {
    const P = this.player;
    for (const c of this.cars) {
      if (c.dir > 0) for (const o of this.cars) {
        if (o === c || o.dir < 0 || Math.abs(o.x - c.x) > 0.2) continue;
        const dz = o.z - c.z;
        if (dz > 0 && dz < 900 && o.speed < c.speed) c.speed = o.speed;
      }
      c.z += c.speed * c.dir * dt;
      if (c.z < P.z - 5000 || c.z > P.z + 90000) Object.assign(c, this.newCar(P.z + U.rand(62000, 85000)));
    }
  }

  separate() {
    const rs = this.riders();
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j];
      if (a.crash || b.crash || Math.abs(a.z - b.z) > 140) continue;
      const d = b.x - a.x, ad = Math.abs(d);
      if (ad < RIDER_W) {
        const push = (RIDER_W - ad) / 2 + 0.002, s = d >= 0 ? 1 : -1;
        a.x -= s * push; b.x += s * push;
      }
    }
  }
  checkFinish() {
    for (const r of this.racers) {
      if (r.finished || r.z < this.finishZ) continue;
      r.finished = true; r.time = this.time;
      if (r.isPlayer && !this.demo) {
        r.place = this.racers.filter(o => o.finished).length;
        this.msg(r.place === 1 ? 'VỀ NHẤT!' : 'VỀ ĐÍCH - HẠNG ' + r.place, r.place <= 3 ? '#ffd23a' : '#ffffff', 5, 40);
        this.end('finished');
      }
    }
  }
  rank() {
    const arr = this.racers.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.time - b.time;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.z - a.z;
    });
    arr.forEach((r, i) => { r.rank = i + 1; });
    if (this.player.place) this.player.rank = this.player.place;
  }
  findTarget() {
    const P = this.player; let best = null, bd = 1e9;
    for (const r of this.riders()) {
      if (r === P || r.crash) continue;
      const dz = Math.abs(r.z - P.z); if (dz > 1500) continue;
      const d = dz + Math.abs(r.x - P.x) * 1000;
      if (d < bd) { bd = d; best = r; }
    }
    this.target = best;
  }
  buildEnts() {
    const m = this.ents; m.clear();
    const add = e => {
      const i = Math.floor(e.z / CFG.segL); let a = m.get(i);
      if (!a) m.set(i, a = []);
      a.push(e);
    };
    for (const r of this.riders()) if (r.isPlayer || !(r.finished && r.z > this.finishZ + 8000)) add(r);
    for (const c of this.cars) add(c);
    for (const b of this.bodies) add(b);
    for (const a of m.values()) if (a.length > 1) a.sort((p, q) => q.z - p.z);
  }
  results() {
    const rows = this.racers.map(r => ({
      name: r.name, isPlayer: !!r.isPlayer, finished: r.finished,
      time: r.finished ? r.time : r.isPlayer ? Infinity : this.time + (this.finishZ - r.z) / Math.max(4000, r.top * 0.9),
    }));
    rows.sort((a, b) => a.time - b.time);
    return rows;
  }
}
