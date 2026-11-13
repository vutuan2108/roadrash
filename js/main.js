'use strict';
// ============ Game shell: title, menus, shop, results, save, loop ============
const Game = {
  state: 'title', t: 0, sel: 0, shopSel: 0, shopMsg: '', race: null, demo: null, res: null,
  dsel: 0, gsel: 0, gmsg: '', drace: null, dres: null,
  msel: 0, mode: 'bike',   // the first screen's choice: 'bike' (motorbike racing) or 'drift' (drift cars) - each has its own menu
  last: 0, acc: 0, save: null, raceTheme: 0,
  PRIZES: [1500, 1000, 750, 500, 400, 300, 200, 150, 100, 50, 0, 0],

  init() {
    try { Render.init(document.getElementById('game'), document.getElementById('gl')); }
    catch (e) {
      document.body.innerHTML = '<div style="color:#ffd23a;font:20px sans-serif;padding:40px;text-align:center">' +
        'Không khởi tạo được đồ họa 3D (WebGL).<br>Hãy mở game bằng Chrome, Edge hoặc Firefox bản mới và bật tăng tốc phần cứng.</div>';
      return;
    }
    this.load();
    this.newDemo();
    setTimeout(() => { Models.loadCar(DRIFT_CARS[this.dIdx()].model).then(() => Models.preloadCars()); }, 1200);
    // invite link (?room=ABCD): straight into that room's waiting list
    const code = new URLSearchParams(location.search).get('room');
    if (code) Net.open(code);
    requestAnimationFrame(t => { this.last = t; this.loop(t); });
  },
  load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem('hb_save') || 'null'); } catch (e) { s = null; }
    this.save = Object.assign({ money: 2500000, level: 1, owned: [0], bike: 0, hp: { 0: BIKES[0].dur }, passed: [],
      dcars: [], dcar: '', dpaint: {}, dliv: {}, drim: {}, deng: {}, dengs: {}, dalign: {}, dbest: {}, dai: 3, dhard: false }, s || {});
    // one-time gift so existing saves also get the 2.5M starting money
    if (!this.save.gift) { this.save.money = Math.max(this.save.money, 2500000); this.save.gift = 1; this.store(); }
    this.fixCars();
  },
  // drift cars are kept by model name (dcars, dcar, dpaint). Saves from before the car list became the authored models
  // only kept list positions: those are read with the old list, and the cars no longer sold are refunded
  fixCars() {
    const s = this.save, has = m => DRIFT_CARS.some(c => c.model === m);
    const OLD = [['ae86', 0], ['s15', 18000], ['fd', 26000], ['supra', 40000], ['mustang', 55000], ['gr86', 14000], ['s15c', 60000],
      ['z280', 9000], ['r34', 45000], ['rx7vs', 52000], ['rx7bn', 75000], ['gt2', 65000], ['f40', 90000]];
    let changed = false;
    if (typeof s.dcar === 'number' || s.dcars.some(x => typeof x === 'number')) {
      const cars = [], paint = {};
      for (const x of s.dcars) {
        const o = OLD[x]; if (!o) continue;
        const c = DRIFT_CARS.find(d => d.model === o[0]);
        if (c && c.price > 0) cars.push(o[0]); else s.money += o[1];   // (gone, or free now: the money back)
      }
      for (const k in s.dpaint) { const o = OLD[k]; if (o && has(o[0])) paint[o[0]] = s.dpaint[k]; }
      const cur = OLD[s.dcar] && OLD[s.dcar][0];
      s.dcars = cars; s.dpaint = paint; s.dcar = has(cur) ? cur : '';
      changed = true;
    }
    // the free cars are always in the garage; a car no longer in the list falls back to the first one
    for (const c of DRIFT_CARS) if (!c.price && !s.dcars.includes(c.model)) { s.dcars.push(c.model); changed = true; }
    const n = s.dcars.length; s.dcars = s.dcars.filter(has); changed = changed || s.dcars.length !== n;
    if (!s.dcars.includes(s.dcar)) { s.dcar = DRIFT_CARS[0].model; changed = true; }
    if (changed) this.store();
  },
  dIdx() { return Math.max(0, DRIFT_CARS.findIndex(c => c.model === this.save.dcar)); },   // the chosen car's place in the list
  ownsCar(i) { return this.save.dcars.includes(DRIFT_CARS[i].model); },
  store() { try { localStorage.setItem('hb_save', JSON.stringify(this.save)); } catch (e) { /* ignore */ } },
  bikeHp() { const s = this.save; return s.hp[s.bike] !== undefined ? s.hp[s.bike] : BIKES[s.bike].dur; },

  // the race behind the title screen and the menus: drift cars with computer drivers on one of the mountain passes
  // (the camera rides behind one of them). It starts once the models of its cars are in
  newDemo() {
    const maps = DRIFT_MAPS.map((m, i) => i).filter(i => !DRIFT_MAPS[i].circuit);
    const ci = U.randInt(0, DRIFT_CARS.length - 1), car = DRIFT_CARS[ci];
    const r = this.demo = new DriftRace({ mapIdx: maps[U.randInt(0, maps.length - 1)], carIdx: ci, paint: car.ownLiv ? car.color : DRIFT_PAINTS[U.randInt(0, DRIFT_PAINTS.length - 1)],
      ais: 3, demo: true });
    r.ready = false;
    Promise.all(r.racers.map(c => Models.loadCar(c.spec.model))).then(() => { r.ready = true; }, () => { r.ready = true; });
  },
  updDemo(dt) {
    const r = this.demo;
    if (!r || r.over || r.car.fin || r.progress() > 0.92) { this.newDemo(); return; }
    if (r.ready !== false) r.update(dt, {});
  },
  // the demo as the backdrop of a screen (a dark sky while its cars are still loading)
  drawDemo() {
    if (this.demo && this.demo.ready !== false) { Render.frame(this.demo); return; }
    Render.begin();
    const g = Render.g, gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#060814'); gr.addColorStop(1, '#1a2040');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  },
  startRace(ti) {
    const s = this.save;
    this.raceTheme = ti;
    this.race = new Race({ themeIdx: ti, level: s.level, bikeIdx: s.bike, bikeHp: this.bikeHp() });
    this.state = 'race';
    Sound.music.start();
  },
  finishRace() {
    const r = this.race, s = this.save, P = r.player, reason = r.over.reason, mult = 1 + 0.5 * (s.level - 1);
    const res = { reason, rows: r.results(), place: P.place || 0, prize: 0, bonus: 0, fine: 0, kos: P.kos,
      theme: r.theme.name, levelUp: false, qualified: false, time: P.time };
    if (reason === 'finished') {
      res.prize = Math.round(this.PRIZES[P.place - 1] * mult);
      res.qualified = P.place <= 3;
      if (res.qualified && !s.passed.includes(this.raceTheme)) s.passed.push(this.raceTheme);
    } else if (reason === 'busted') res.fine = 600 * s.level;
    else if (reason === 'wrecked') res.fine = 900 * s.level;
    res.bonus = reason === 'quit' ? 0 : P.kos * 60 * s.level;
    s.money = Math.max(0, s.money + res.prize + res.bonus - res.fine);
    s.hp[s.bike] = P.bikeHp <= 0 || reason === 'wrecked' ? Math.round(BIKES[s.bike].dur * 0.4) : Math.round(P.bikeHp);
    if (s.passed.length >= this.levelNeed() && s.level < 5) { s.level++; s.passed = []; res.levelUp = true; }
    res.money = s.money;
    this.store(); this.res = res; this.state = 'results';
    Sound.engine(0, 0);
  },

  loop(ts) {
    const dt = Math.min(0.1, Math.max(0, (ts - this.last) / 1000));
    this.last = ts; this.acc += dt;
    const STEP = 1 / 60; let n = 0;
    while (this.acc >= STEP && n < 6) { this.update(STEP); Input.endFrame(); this.acc -= STEP; n++; }
    if (n === 6) this.acc = 0;
    this.draw();
    requestAnimationFrame(t => this.loop(t));
  },

  update(dt) {
    this.t += dt;
    if (Input.pressed('mute')) Sound.toggleMute();
    switch (this.state) {
      case 'title':
        this.updDemo(dt);
        if (Input.pressed('ok')) { this.state = 'mode'; Sound.beep(660, 0.08); Sound.music.start(); }
        break;
      case 'mode': this.updDemo(dt); this.updMode(); break;
      case 'help': this.updDemo(dt); this.updHelp(); break;
      case 'menu': this.updDemo(dt); this.updMenu(); break;
      case 'shop': this.updDemo(dt); this.updShop(); break;
      case 'race':
        if (Input.pressed('pause') && !this.race.over) { this.state = 'pause'; Sound.engine(0, 0); break; }
        this.race.update(dt);
        if (this.race.over && this.race.over.t > 4) this.finishRace();
        break;
      case 'pause':
        if (Input.pressed('quit')) { this.race.end('quit'); this.finishRace(); }
        else if (Input.pressed('ok') || Input.pressed('pause')) this.state = 'race';
        break;
      case 'results':
        this.updDemo(dt);
        if (Input.pressed('ok')) { this.state = 'menu'; Sound.beep(660, 0.08); }
        break;
      case 'online':   // lobby / waiting room (HTML overlay over the demo race)
        this.updDemo(dt);
        if (Input.pressed('back')) Net.close();
        break;
      case 'netrace': Net.update(dt); break;
      case 'netdrift': Net.updateDrift(dt); break;
      case 'netdres':
        this.updDemo(dt);
        if (Input.pressed('ok')) { Sound.beep(660, 0.08); Net.backToRoom(); }
        break;
      case 'netres':
        this.updDemo(dt);
        if (Input.pressed('ok')) { Sound.beep(660, 0.08); Net.backToRoom(); }
        break;
      // ---- drift cars
      case 'dmenu': this.updDemo(dt); this.updDriftMenu(); break;
      case 'garage': this.updDemo(dt); this.updGarage(); break;
      case 'dalign': this.updDemo(dt); this.updAlign(dt); break;
      case 'drift':
        if (this.drace.ready === false) break;
        if (Input.pressed('pause') && !this.drace.over) { this.state = 'dpause'; Sound.quiet(); break; }
        this.drace.update(dt);
        if (this.drace.over && this.drace.over.t > 4) this.finishDrift('finished');
        break;
      case 'dpause':
        if (Input.pressed('quit')) this.finishDrift('quit');
        else if (Input.pressed('ok') || Input.pressed('pause')) this.state = 'drift';
        break;
      case 'dres':
        this.updDemo(dt);
        if (Input.pressed('ok')) { this.state = 'dmenu'; Sound.beep(660, 0.08); }
        break;
    }
  },
  // ---------------- drift mode: stage list, garage, a run, results ----------------
  // (records are kept apart for the easy and the hard - half-width road - setting)
  driftKey(id, hard) { return id + (hard ? ':h' : ''); },
  driftBest(i) { return this.save.dbest[this.driftKey(DRIFT_MAPS[i].id, this.save.dhard)] || 0; },
  carPaint(i) { return this.save.dpaint[DRIFT_CARS[i].model] || DRIFT_CARS[i].color; },
  // the car's engine (id, '' = its own), the car as it runs with it, and the engines bought for it
  carEng(i) { return Engine.clean(this.save.deng[DRIFT_CARS[i].model]); },
  carSpec(i) { return Engine.spec(DRIFT_CARS[i], this.carEng(i)); },
  ownsEng(i, id) { return !id || (this.save.dengs[DRIFT_CARS[i].model] || []).includes(id); },
  carRim(i) { return Rim.clean(this.save.drim[DRIFT_CARS[i].model]); },       // (the car's wheels: model + colour, '' = its own)
  carLiv(i) { return Livery.clean(this.save.dliv[DRIFT_CARS[i].model]); },   // (the car's stripes: style + colour, '' = none)
  // the car's wheel alignment (camber, toe, caster): the player's own, else what the car comes with
  carAlign(i) { const c = DRIFT_CARS[i]; return Align.clean(this.save.dalign[c.model], c); },   // (angles a save lacks: the car's own)
  updDriftMenu() {
    const n = DRIFT_MAPS.length + 5, HARD = DRIFT_MAPS.length, AI = HARD + 1, s = this.save;
    if (Input.pressed('up')) { this.dsel = (this.dsel + n - 1) % n; Sound.beep(520, 0.05); }
    if (Input.pressed('down')) { this.dsel = (this.dsel + 1) % n; Sound.beep(520, 0.05); }
    if (Input.pressed('back')) { this.state = 'mode'; return; }
    if (Input.pressed('horn')) { this.state = 'help'; this.helpBack = true; return; }   // (H: how to play)
    // the number of computer drivers: left / right (or ENTER to step through)
    const dir = (Input.pressed('right') ? 1 : 0) - (Input.pressed('left') ? 1 : 0) || ((this.dsel === AI || this.dsel === HARD) && Input.pressed('ok') ? 1 : 0);
    if (this.dsel === HARD) {   // easy (the road as it is) / hard (half as wide)
      if (dir) { s.dhard = !s.dhard; this.store(); Sound.beep(700, 0.05); }
      return;
    }
    if (this.dsel === AI) {
      if (dir) { s.dai = ((s.dai | 0) + dir + DRIFT_AI.max + 1) % (DRIFT_AI.max + 1); this.store(); Sound.beep(700, 0.05); }
      return;
    }
    if (!Input.pressed('ok')) return;
    Sound.beep(880, 0.1);
    if (this.dsel < DRIFT_MAPS.length) this.startDrift(this.dsel);
    else if (this.dsel === AI + 1) Net.open(null, 'drift');   // online: rooms created from here race drift
    else if (this.dsel === AI + 2) { this.state = 'garage'; this.gsel = this.dIdx(); this.gmsg = ''; }
    else this.state = 'mode';
  },
  startDrift(i) {
    const s = this.save, ci = this.dIdx();
    const r = this.drace = new DriftRace({ mapIdx: i, carIdx: ci, paint: this.carPaint(ci), liv: this.carLiv(ci), rim: this.carRim(ci), eng: this.carEng(ci), al: this.carAlign(ci), ais: s.dai | 0, hard: !!s.dhard });
    this.state = 'drift';
    Sound.music.stop();
    r.ready = false;   // until the 3D models of all its cars are in
    Promise.all(r.racers.flatMap(c => [c.spec.model, Rim.model(c.rim)]).filter(Boolean).map(m => Models.loadCar(m))).then(() => { r.ready = true; }, () => { r.ready = true; });
  },
  finishDrift(reason) {
    const r = this.drace, s = this.save, id = this.driftKey(r.def.id, r.hard), quit = reason === 'quit', score = r.score;
    const grade = quit ? -1 : r.rank(score), prev = s.dbest[id] || 0, rec = !quit && score > prev;
    // with computer drivers: the final order by score, and a prize for the top three
    const table = !quit && r.racers.length > 1 ? r.standings() : null, place = table ? table.findIndex(t => t.me) + 1 : 0;
    const prize = table ? [3000, 1500, 600][place - 1] || 0 : 0;
    const money = quit ? 0 : Math.round(score / 10) + [0, 300, 800, 1500, 3000, 6000][grade + 1] + prize;
    if (rec) s.dbest[id] = score;
    s.money += money;
    this.store();
    this.dres = { map: r.def.name + (r.hard ? ' (KHÓ)' : ''), car: DRIFT_CARS[r.carIdx].name, score, grade, money, rec, prev, best: r.best, hits: r.hits, bumps: r.car.bumps, time: r.time, quit, table, place, prize };
    this.state = 'dres';
    Sound.quiet(); Sound.music.start();
  },
  updGarage() {
    const s = this.save, n = DRIFT_CARS.length + 1, i = this.gsel;
    if (Input.pressed('up')) { this.gsel = (i + n - 1) % n; this.gmsg = ''; Sound.beep(520, 0.05); }
    if (Input.pressed('down')) { this.gsel = (i + 1) % n; this.gmsg = ''; Sound.beep(520, 0.05); }
    if (Input.pressed('back')) { this.state = 'dmenu'; return; }
    // left / right: paint colour of an owned car
    const dir = (Input.pressed('right') ? 1 : 0) - (Input.pressed('left') ? 1 : 0);
    if (dir && i < DRIFT_CARS.length) {
      if (!this.ownsCar(i)) { this.gmsg = 'Mua xe trước rồi mới sơn được'; Sound.beep(200, 0.1); }
      else {
        const k = DRIFT_PAINTS.indexOf(this.carPaint(i)), nk = ((k < 0 ? 0 : k) + dir + DRIFT_PAINTS.length) % DRIFT_PAINTS.length;
        s.dpaint[DRIFT_CARS[i].model] = DRIFT_PAINTS[nk]; this.store(); Sound.beep(700, 0.04);
      }
    }
    // T: the next style of stripes, Y: their next colour (an owned car)
    const tS = Input.pressed('livery'), tC = Input.pressed('liveryCol');
    if ((tS || tC) && i < DRIFT_CARS.length) {
      if (DRIFT_CARS[i].ownLiv) { this.gmsg = 'Xe này đã có tem riêng (vẫn đổi được màu sơn)'; Sound.beep(200, 0.1); }
      else if (!this.ownsCar(i)) { this.gmsg = 'Mua xe trước rồi mới dán tem được'; Sound.beep(200, 0.1); }
      else {
        const cur = this.carLiv(i), st = Livery.style(cur), col = Livery.color(cur) || Livery.contrast(this.carPaint(i));
        let v;
        if (tS) { const ns = (st + 1) % DRIFT_LIVERIES.length; v = ns ? ns + col : ''; }
        else if (!st) { this.gmsg = 'Bấm T chọn kiểu tem trước'; v = ''; }
        else v = st + DRIFT_PAINTS[(DRIFT_PAINTS.indexOf(col) + 1) % DRIFT_PAINTS.length];
        s.dliv[DRIFT_CARS[i].model] = v; this.store(); Sound.beep(700, 0.04);
      }
    }
    // C: the wheel alignment of an owned car
    if (Input.pressed('cam') && i < DRIFT_CARS.length) {
      if (!this.ownsCar(i)) { this.gmsg = 'Mua xe trước rồi mới căn chỉnh được'; Sound.beep(200, 0.1); }
      else { this.state = 'dalign'; this.acar = i; this.asel = 0; this.aedit = this.carAlign(i); this.arim = this.carRim(i); this.aeng = this.carEng(i); this.aengSel = DRIFT_ENGINES.findIndex(e => e.id === this.aeng); this.amsg = ''; this.arep = 0; this.arepAcc = 0; Sound.beep(880, 0.08); return; }
    }
    if (!Input.pressed('ok')) return;
    if (i === DRIFT_CARS.length) { this.state = 'dmenu'; return; }
    const c = DRIFT_CARS[i];
    if (this.ownsCar(i)) { s.dcar = c.model; this.gmsg = 'Đã chọn ' + c.name; Sound.beep(880, 0.08); }
    else if (s.money >= c.price) { s.money -= c.price; s.dcars.push(c.model); s.dcar = c.model; this.gmsg = 'Đã mua ' + c.name + '!'; Sound.beep(1200, 0.2); }
    else { this.gmsg = 'Không đủ tiền!'; Sound.beep(200, 0.2); }
    this.store();
  },
  // the first screen after the title: motorbike racing or drift cars (left / right or up / down, ENTER)
  updMode() {
    if (Input.pressed('left') || Input.pressed('right') || Input.pressed('up') || Input.pressed('down')) { this.msel = 1 - this.msel; Sound.beep(520, 0.05); }
    if (Input.pressed('back')) { this.state = 'title'; return; }
    if (!Input.pressed('ok')) return;
    Sound.beep(880, 0.1);
    if (this.msel === 0) { this.mode = 'bike'; this.sel = 0; }
    else { this.mode = 'drift'; this.dsel = 0; }
    this.state = 'help';
  },
  // how to play the chosen mode: shown on the way into its menu (ENTER: on to the menu), and again from the menu with H
  HELP: {
    bike: { title: 'ĐUA XE MÁY · CÁCH CHƠI', col: '#ffd23a', keys: [
      ['↑ / W', 'Tăng ga'], ['↓ / S', 'Phanh (giữ càng lâu phanh càng gấp)'], ['← → / A D', 'Lái'],
      ['Z / J', 'Đánh / đạp đối thủ bên trái'], ['X / K', 'Đánh / đạp đối thủ bên phải'],
      ['SPACE / SHIFT', 'Giữ cùng tăng ga: bốc đầu'], ['ESC / P', 'Tạm dừng'], ['M', 'Bật / tắt âm thanh']],
      tips: ['Về TOP 3 ở các chặng để lên cấp, kiếm tiền mua xe mới ở cửa hàng.', 'Giữ SPACE lúc đếm ngược để xuất phát bốc đầu, tăng tốc nhanh hơn.',
        'Tay không thì đạp - đang bốc đầu mà trúng đòn là té!'] },
    drift: { title: 'ĐUA Ô TÔ DRIFT · CÁCH CHƠI', col: '#ff9a5a', keys: [
      ['↑ / W', 'Ga'], ['↓ / S', 'Phanh (xe đứng yên: lùi)'], ['← → / A D', 'Lái'], ['SPACE', 'Phanh tay: khóa bánh sau để vào drift'],
      ['SHIFT', 'Côn: giữ rồi vê ga, thả ra để "đá côn"'], ['B / V (E / Q)', 'Lên / xuống số'], ['T', 'Số tự động / số tay'],
      ['N', 'Nitro (tự nạp lại khi drift)'], ['C', 'Đổi camera'], ['R', 'Đặt lại xe lên đường'], ['ESC / P', 'Tạm dừng']],
      tips: ['Vào cua: kéo phanh tay hoặc đá côn, rồi giữ ga để xe trượt ngang.', 'Điểm tính theo góc trượt, tốc độ và độ sát rào. Chạm rào là mất chuỗi điểm.',
        'Gara: mua xe, đổi màu sơn, tem. Phím C trong gara: căn góc bánh, đổi động cơ, mâm.'] },
  },
  updHelp() {
    const menu = this.mode === 'drift' ? 'dmenu' : 'menu';
    if (Input.pressed('back')) { this.state = this.helpBack ? menu : 'mode'; this.helpBack = false; return; }
    if (Input.pressed('ok')) { this.state = menu; this.helpBack = false; Sound.beep(880, 0.1); }
  },
  drawHelp() {
    const h = this.HELP[this.mode], g = Render.g, n = h.keys.length, rh = Math.min(17, 176 / n);
    this.dim(0.45); this.panel(40, 14, 432, 292);
    Render.text(h.title, W / 2, 20, 24, h.col, 'center', 410);
    h.keys.forEach(([k, d], i) => {
      const y = 54 + i * rh;
      g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(62, y, 116, rh - 3);
      Render.text(k, 120, y, Math.min(14, rh - 3), '#ffd23a', 'center', 110);
      Render.text(d, 188, y, Math.min(14, rh - 3), '#ffffff', 'left', 268);
    });
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(56, 236, 400, 1);
    h.tips.forEach((t, i) => Render.text('• ' + t, 62, 241 + i * 13, 11, '#9fe0ff', 'left', 392));
    if (Math.floor(this.t * 2) % 2 === 0) Render.text(this.helpBack ? 'ENTER / ESC: quay lại menu' : 'ENTER: tiếp tục      ESC: quay lại', W / 2, 284, 15, '#ffd23a', 'center');
  },
  updMenu() {
    const n = THEMES.length + 2;
    if (Input.pressed('up')) { this.sel = (this.sel + n - 1) % n; Sound.beep(520, 0.05); }
    if (Input.pressed('down')) { this.sel = (this.sel + 1) % n; Sound.beep(520, 0.05); }
    if (Input.pressed('back')) { this.state = 'mode'; return; }
    if (Input.pressed('horn')) { this.state = 'help'; this.helpBack = true; return; }   // (H: how to play)
    if (Input.pressed('ok')) {
      Sound.beep(880, 0.1);
      if (this.sel < THEMES.length) this.startRace(this.sel);
      else if (this.sel === THEMES.length) Net.open(null, 'bike');   // online: rooms created from here race motorbikes
      else { this.state = 'shop'; this.shopSel = this.save.bike; this.shopMsg = ''; }
    }
  },
  levelNeed() { return Math.min(4, THEMES.length); },   // top 3 on this many different tracks to go up a level
  repairCost() { const b = BIKES[this.save.bike]; return Math.ceil((b.dur - this.bikeHp()) * 8); },
  updShop() {
    const s = this.save, n = BIKES.length + 2;
    if (Input.pressed('up')) { this.shopSel = (this.shopSel + n - 1) % n; this.shopMsg = ''; Sound.beep(520, 0.05); }
    if (Input.pressed('down')) { this.shopSel = (this.shopSel + 1) % n; this.shopMsg = ''; Sound.beep(520, 0.05); }
    if (Input.pressed('back')) { this.state = 'menu'; return; }
    if (!Input.pressed('ok')) return;
    const i = this.shopSel;
    if (i < BIKES.length) {
      const b = BIKES[i];
      if (s.owned.includes(i)) { s.bike = i; this.shopMsg = 'Đã chọn ' + b.name; }
      else if (s.money >= b.price) {
        s.money -= b.price; s.owned.push(i); s.bike = i; s.hp[i] = b.dur;
        this.shopMsg = 'Đã mua ' + b.name + '!'; Sound.beep(1200, 0.2);
      } else { this.shopMsg = 'Không đủ tiền!'; Sound.beep(200, 0.2); }
    } else if (i === BIKES.length) {
      const b = BIKES[s.bike], cost = this.repairCost();
      if (cost <= 0) this.shopMsg = 'Xe đang nguyên vẹn.';
      else if (s.money >= cost) { s.money -= cost; s.hp[s.bike] = b.dur; this.shopMsg = 'Đã sửa xong!'; Sound.beep(1000, 0.15); }
      else if (s.money > 0) {
        s.hp[s.bike] = Math.min(b.dur, this.bikeHp() + Math.floor(s.money / 8));
        s.money = 0; this.shopMsg = 'Sửa được một phần (hết tiền).';
      } else this.shopMsg = 'Không đủ tiền!';
    } else { this.state = 'menu'; }
    this.store();
  },

  // ---------------- drawing ----------------
  draw() {
    switch (this.state) {
      case 'title': this.drawDemo(); this.drawTitle(); break;
      case 'mode': this.drawDemo(); this.drawMode(); break;
      case 'help': this.drawDemo(); this.drawHelp(); break;
      case 'menu': this.drawDemo(); this.drawMenu(); break;
      case 'shop': this.drawDemo(); this.drawShop(); break;
      case 'race':
        if (!this.race.shown) {   // one frame of "loading" while the 3D world for this track is built
          this.race.shown = true; Render.begin(); this.dim(0.6);
          Render.text('ĐANG TẢI CHẶNG ĐUA...', W / 2, 140, 32, '#ffd23a', 'center');
          break;
        }
        Render.frame(this.race, true); Render.hud(this.race);
        if (this.race.over && this.race.over.t > 3) this.dim(Math.min(1, (this.race.over.t - 3)));
        break;
      case 'pause': Render.frame(this.race, true); Render.hud(this.race); this.drawPause(); break;
      case 'results': case 'netres': this.drawDemo(); this.drawResults(); break;
      case 'online': this.drawDemo(); this.dim(0.35); break;
      case 'netrace': Net.draw(); break;
      case 'netdrift': Net.drawDrift(); break;
      case 'netdres': this.drawDemo(); this.drawDriftResults(); break;
      case 'dmenu': this.drawDemo(); this.drawDriftMenu(); break;
      case 'garage': this.drawDemo(); this.drawGarage(); break;
      case 'dalign': this.drawDemo(); this.drawAlign(); break;
      case 'drift':
        if (this.drace.ready === false || !this.drace.shown) {   // the car models loading, then one frame while the stage is built
          if (this.drace.ready !== false) this.drace.shown = true;
          Render.begin(); this.dim(0.6);
          Render.text(this.drace.ready === false ? 'ĐANG TẢI XE...' : 'ĐANG TẢI CUNG ĐƯỜNG...', W / 2, 140, 32, '#ffd23a', 'center');
          break;
        }
        Render.frame(this.drace, false); Render.driftHud(this.drace);
        if (this.drace.over && this.drace.over.t > 3) this.dim(Math.min(1, this.drace.over.t - 3));
        break;
      case 'dpause': Render.frame(this.drace, false); Render.driftHud(this.drace); this.drawDriftPause(); break;
      case 'dres': this.drawDemo(); this.drawDriftResults(); break;
    }
  },
  // the keys of the drift mode (like most PC drift games: CarX, Forza, Assetto Corsa)
  DKEYS: [['↑ / W', 'ga'], ['↓ / S', 'phanh (giữ khi đứng yên = lùi)'], ['← → / A D', 'lái'], ['SPACE', 'phanh tay (vào drift)'],
    ['SHIFT', 'côn (giữ rồi thả = đá côn)'], ['B / V', 'lên / xuống số (số tay)'], ['T', 'số tự động / số tay'], ['N', 'nitro'],
    ['C', 'đổi góc camera'], ['R', 'đặt lại xe lên đường'], ['H', 'còi'], ['ESC / P', 'tạm dừng']],
  // the same keys, short, for the drift menu (three columns under the stage list)
  DKEYS_S: [['↑ / W', 'ga'], ['↓ / S', 'phanh / lùi'], ['← → A D', 'lái'], ['SPACE', 'phanh tay'], ['SHIFT', 'côn / đá côn'],
    ['B / V', 'lên / xuống số'], ['T', 'số tự động / tay'], ['N', 'nitro'], ['C', 'góc camera'], ['R', 'đặt lại xe'], ['H', 'còi'], ['ESC / P', 'tạm dừng']],
  drawKeysS(x, y, size) {
    this.DKEYS_S.forEach(([k, d], i) => {
      const xx = x + (i % 3) * 140, yy = y + Math.floor(i / 3) * (size + 2);
      Render.text(k, xx, yy, size, '#ffd23a', 'left', 52); Render.text(d, xx + 54, yy, size, '#e8e8e8', 'left', 84);
    });
  },
  drawKeys(x, y, cols, size) {
    this.DKEYS.forEach(([k, d], i) => {
      const col = i % cols, row = Math.floor(i / cols), xx = x + col * 206, yy = y + row * (size + 2);
      Render.text(k, xx, yy, size, '#ffd23a', 'left', 62); Render.text(d, xx + 64, yy, size, '#e8e8e8', 'left', 134);
    });
  },
  drawDriftMenu() {
    const s = this.save, g = Render.g, car = DRIFT_CARS[this.dIdx()];
    this.dim(0.4); this.panel(36, 8, 440, 304);
    Render.text('ĐUA Ô TÔ DRIFT', W / 2, 10, 28, '#ff9a5a', 'center');
    Render.text('XE: ' + car.name + '   ·   TIỀN: ' + U.money(s.money), W / 2, 37, 15, '#9fe0ff', 'center', 420);
    const items = DRIFT_MAPS.map((m, i) => {
      const b = this.driftBest(i), r = DriftRace.prototype.rank.call({ def: m }, b);
      return { a: m.name, b: m.desc + (m.circuit ? ' · ' + m.laps + ' vòng' : ''), rec: b ? b.toLocaleString('en-US') : '--', grade: b ? DRIFT_RANKS[r] || '-' : '' };
    });
    const nai = s.dai | 0, iH = DRIFT_MAPS.length, iA = iH + 1;
    items.push({ a: 'ĐỘ KHÓ', b: s.dhard ? 'KHÓ: mặt đường hẹp lại còn khoảng 60%, rào sát hơn (← → để đổi). Kỷ lục tính riêng.'
      : 'DỄ: mặt đường rộng như bình thường (← → để đổi sang KHÓ: đường hẹp còn khoảng 60%).',
      opt: (this.dsel === iH ? '◄ ' : '') + (s.dhard ? 'KHÓ' : 'DỄ') + (this.dsel === iH ? ' ►' : '') });
    items.push({ a: 'ĐỐI THỦ MÁY', b: 'Số xe máy drift cùng đường (← → để đổi). Xếp hạng theo điểm drift, top 3 có thưởng.',
      opt: (this.dsel === iA ? '◄ ' : '') + (nai ? nai + ' XE' : 'TẮT') + (this.dsel === iA ? ' ►' : '') });
    items.push({ a: 'CHƠI ONLINE', b: (Net.onlineText() ? Net.onlineText().toUpperCase() + ' · ' : '') + 'Đua drift với bạn bè qua mạng: tạo phòng, gửi link mời, xếp hạng theo điểm drift' });
    items.push({ a: 'GARA Ô TÔ', b: 'Mua xe, đổi màu sơn, tem · phím C: căn góc bánh, Ackermann, đổi động cơ, mâm' }, { a: 'QUAY LẠI', b: '' });
    // (nine stages and five more rows; the keys are on the how-to-play screen, H)
    const rh = 14, y0 = 61;
    Render.text('KỶ LỤC', 400, 49, 12, '#a8b8d0', 'right'); Render.text('HẠNG', 448, 49, 12, '#a8b8d0', 'right');
    items.forEach((it, i) => {
      const y = y0 + i * rh, on = i === this.dsel;
      if (on) { g.fillStyle = 'rgba(255,154,90,0.2)'; g.fillRect(44, y - 1, 424, rh - 1); g.fillStyle = '#ff9a5a'; g.fillRect(44, y - 1, 3, rh - 1); }
      Render.text((on ? '> ' : '  ') + it.a, 54, y - 2, 15, on ? '#ffd23a' : '#ffffff', 'left', 250);
      if (it.rec) Render.text(it.rec, 400, y, 13, '#e8e8e8', 'right', 90);
      if (it.opt) Render.text(it.opt, 448, y - 1, 14, on ? '#ffd23a' : '#9fe0ff', 'right', 150);
      if (it.grade) Render.text(it.grade, 448, y - 1, 15, it.grade[0] === 'S' ? '#ffd23a' : '#7fff7f', 'right');
    });
    const yd = y0 + items.length * rh + 1;
    Render.text(items[this.dsel].b, W / 2, yd, 13, '#a8b8d0', 'center', 420);
    Render.text('↑↓ chọn   ENTER bắt đầu   H hướng dẫn   ESC quay lại', W / 2, 299, 12, '#a8b8d0', 'center');
  },
  drawGarage() {
    const s = this.save, g = Render.g;
    this.dim(0.45); this.panel(16, 12, 480, 296);
    Render.text('GARA Ô TÔ DRIFT', 30, 16, 28, '#ff9a5a');
    Render.text('TIỀN: ' + U.money(s.money), 482, 22, 18, '#ffffff', 'right');
    const rows = DRIFT_CARS.map((c, i) => [c.name, this.ownsCar(i) ? (s.dcar === c.model ? '[ĐANG DÙNG]' : '[ĐÃ CÓ]') : U.money(c.price)]);
    rows.push(['QUAY LẠI', '']);
    // the list scrolls: VIS rows in view, kept round the selection
    const rh = 20, VIS = 10;
    this.gscroll = U.clamp(this.gscroll || 0, Math.max(0, this.gsel - VIS + 1), Math.min(this.gsel, rows.length - VIS));
    if (rows.length <= VIS) this.gscroll = 0;
    rows.slice(this.gscroll, this.gscroll + VIS).forEach(([a, b], k) => {
      const i = this.gscroll + k, y = 56 + k * rh, on = i === this.gsel;
      if (on) { g.fillStyle = 'rgba(255,154,90,0.2)'; g.fillRect(24, y - 2, 236, rh - 3); g.fillStyle = '#ff9a5a'; g.fillRect(24, y - 2, 3, rh - 3); }
      Render.text((on ? '> ' : '  ') + a, 32, y - 1, 15, on ? '#ffd23a' : '#ffffff', 'left', 158);
      Render.text(b, 254, y + 1, 12, '#9fe0ff', 'right', 64);
    });
    if (this.gscroll > 0) Render.text('▲', 142, 45, 11, '#ff9a5a', 'center');
    if (this.gscroll + VIS < rows.length) Render.text('▼', 142, 56 + VIS * rh - 3, 11, '#ff9a5a', 'center');
    const ci = this.gsel < DRIFT_CARS.length ? this.gsel : this.dIdx(), c = DRIFT_CARS[ci], paint = this.carPaint(ci);
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(272, 50, 214, 250);
    const al = this.carAlign(ci);
    const liv = this.carLiv(ci);
    Render.carPreview(c.model, paint, 274, 52, 210, 110, this.t, al, liv, this.carRim(ci));
    Render.text(c.name, 379, 163, 17, '#ffd23a', 'center', 206);
    // (the figures with the engine fitted to it)
    const e = this.carSpec(ci);
    if (e.eng) Render.text('Động cơ: ' + Engine.get(e.eng).name, 379, 181, 11, '#ffb04a', 'center', 208);
    else if (c.real) Render.text('Ngoài đời: ' + c.real, 379, 181, 11, '#a8b8d0', 'center', 208);
    const top = k => Math.max(...DRIFT_CARS.map(x => x[k])), sc = Align.stats(al, c).score, fr = k => Math.min(1, e[k] / top(k));
    const stats = [['CÔNG SUẤT', fr('hp'), e.hp + ' mã lực'], ['MÔ-MEN', fr('torque'), e.torque + ' Nm'],
      ['TRỌNG LƯỢNG', fr('kg'), e.kg + ' kg'], ['VÒNG TUA', fr('redline'), e.redline + ' v/p'],
      ['TỐC ĐỘ', fr('vmax'), e.vmax + ' km/h'], ['CĂN CHỈNH', sc / 100, 'điểm ' + sc + '/100']];
    stats.forEach(([n, f, v], i) => {
      const y = 196 + i * 12;
      Render.text(n, 280, y - 3, 12, '#ffffff', 'left', 76);
      Render.bar(358, y + 1, 64, 5, f, '#ff9a5a');
      Render.text(v, 482, y - 3, 12, '#9fe0ff', 'right', 58);
    });
    // paint swatches (owned cars: left / right to change)
    DRIFT_PAINTS.forEach((p, k) => {
      const x = 281 + k * 15.4, on = p === paint;
      Render.rr(x, 269, 12, 10, 2, p, on ? '#ffd23a' : 'rgba(255,255,255,0.3)');
      if (on) { g.strokeStyle = '#ffd23a'; g.lineWidth = 1.2; g.strokeRect(x - 1.5, 267.5, 15, 13); }
    });
    Render.text(this.ownsCar(ci) ? '← → đổi màu sơn' : 'Mua xe để đổi màu sơn', 379, 280, 11, '#a8b8d0', 'center', 200);
    // the stripes: style and colour (a car with its own livery keeps that)
    Render.text(c.ownLiv ? 'TEM: NGUYÊN BẢN CỦA XE' : 'TEM (T): ' + DRIFT_LIVERIES[Livery.style(liv)], 280, 290, 11, c.ownLiv ? '#9fe0ff' : '#ffffff', 'left', 190);
    if (liv && !c.ownLiv) { Render.text('MÀU (Y)', 452, 290, 11, '#ffffff', 'right', 46); Render.rr(457, 291, 22, 7, 2, Livery.color(liv), 'rgba(255,255,255,0.5)'); }
    if (this.gmsg) Render.text(this.gmsg, 140, 258, 15, '#7fff7f', 'center', 230);
    Render.text('ENTER mua/chọn  C căn bánh & mâm  T/Y tem xe  ESC quay lại', 140, 282, 12, '#a8b8d0', 'center', 236);
  },
  // ---------------- wheel alignment (garage, C): camber, toe, caster of an owned car ----------------
  // per angle: its name, the 3D view that shows it, and what it does (the garage's explanation)
  ALIGN_INFO: {
    camF: { name: 'CAMBER TRƯỚC', view: 'front', text: 'Độ nghiêng bánh nhìn từ trước (âm = đỉnh bánh ngả vào trong). Khi drift, thân xe nghiêng và caster làm bánh chịu tải ngả dương lúc lái ngược; camber âm bù lại để mặt lốp phẳng: đầu xe bám, giữ góc drift sâu hơn. Quá âm: phanh và vào cua kém, bánh trong mất bám. Dương: lốp lăn trên vai ngoài. Xe drift: -3,5° đến -5°.' },
    camR: { name: 'CAMBER SAU', view: 'rear', text: 'Bánh sau truyền lực. Gần 0° thì mặt lốp tiếp đất trọn khi đạp ga: lực kéo tốt nhất. Âm một chút giúp bánh sau chịu tải bám ngang khi thân xe nghiêng lúc drift. Quá âm: mất lực kéo, bánh quay trơn. Dương: mất cả bám ngang lẫn lực kéo. Xe drift: -0,5° đến -1°.' },
    toeF: { name: 'TOE TRƯỚC', view: 'top', text: 'Nhìn từ trên: mũi hai bánh chụm vào (toe-in) hay choãi ra (toe-out). Toe-out: bánh trong cua hướng sẵn vào cua nên đánh lái là ăn ngay, vào drift sắc. Quá 0,2°: xe "bơi" ở tốc độ cao, lốp bị cà mất tốc. Toe-in: đầm, chạy thẳng tốt nhưng lái lì. Xe drift: 0° đến 0,15° ra mỗi bánh.' },
    toeR: { name: 'TOE SAU', view: 'top', text: 'Toe-in sau: bánh sau chịu tải (phía ngoài cua) hướng vào cua nên đuôi không văng quá, xe ổn định, đạp ga có lực đẩy (forward bite). Quá nhiều: xe lì, khó bẻ đuôi, cà lốp mất tốc. Toe-out: bẻ đuôi dễ nhưng đuôi "giật", dễ xoay vòng, bánh cà ngang làm mất tốc khi drift. Xe drift: 0,1° đến 0,25° vào.' },
    ack: { name: 'ACKERMANN', view: 'top', text: 'Chênh lệch góc lái giữa hai bánh trước. 100%: bánh trong cua bẻ gắt hơn bánh ngoài như xe đường phố. Khi drift xe trượt ngang chứ không lăn theo bánh trước, nên bánh bẻ gắt hơn bị kéo lê như phanh: ghì đầu xe, mất tốc độ trượt. Gần 0% (hai bánh song song): đầu xe bám hơn khi lái ngược, giữ tốc drift tốt hơn, đổi lại hơi kém bám khi vào cua gắt lúc chưa trượt. Xe drift thường để 0-30%.' },
    lock: { name: 'GÓC LÁI TỐI ĐA', view: 'top', text: 'Góc bẻ lái lớn nhất của bánh trước (bộ kit mở góc lái). Xe đường phố khoảng 35-40°, xe drift 55-70° (ở đây chỉnh được tới 85°). Góc lái lớn cho phép lái ngược sâu hơn nên giữ được góc drift lớn hơn và cứu xe khi đuôi văng quá đà. Trên 57° vô-lăng nặng dần. Góc lái lớn mà Ackermann còn cao thì bánh trong bị kéo lê nhiều: nên giảm Ackermann khi tăng góc lái.' },
    cas: { name: 'CASTER', view: 'side', text: 'Độ ngả về sau của trục lái (đường vàng). Caster lớn: vô-lăng tự trả nhanh nên bắt lái ngược kịp khi đuôi văng, xe đầm ở tốc độ cao, bánh ngả theo hướng lái (bánh ngoài thêm camber âm). Nhược: lái nặng; lúc lái ngược khi drift, bánh chịu tải ngả dương nên cần camber âm bù. Xe drift: 7° đến 9°.' },
  },
  ALIGN_ACTS: [['TỐI ƯU CHO DRIFT', 'Tự tính bộ góc cho điểm drift cao nhất với chính chiếc xe này (chiều cao trọng tâm, phân bổ trọng lượng): camber trước âm vừa đủ bù nghiêng thân và caster, camber sau gần 0, toe trước hơi choãi, toe sau hơi chụm, caster cao.'],
    ['VỀ THÔNG SỐ GỐC', 'Bộ góc có sẵn khi mua xe. Xe đường phố: camber nhỏ, caster khoảng 5,5°, toe chụm nhẹ - đầm, dễ lái, nhưng đầu xe kém bám khi lái ngược lúc drift.'],
    ['LƯU & QUAY LẠI', 'Lưu bộ góc cho xe này (dùng cả khi chơi online) và quay về gara.']],
  updAlign(dt) {
    const K = ALIGN.keys, NR = 3, n = K.length + NR + this.ALIGN_ACTS.length, i = this.asel, c = DRIFT_CARS[this.acar];
    if (Input.pressed('up')) { this.asel = (i + n - 1) % n; Sound.beep(520, 0.05); }
    if (Input.pressed('down')) { this.asel = (i + 1) % n; Sound.beep(520, 0.05); }
    if (Input.pressed('back')) { this.saveAlign(); this.state = 'garage'; return; }
    if (i < K.length) {
      // left / right: one step; held, it repeats, faster after a while
      const dir = (Input.is('right') ? 1 : 0) - (Input.is('left') ? 1 : 0);
      let steps = 0;
      if (Input.pressed('right') || Input.pressed('left')) { steps = 1; this.arep = 0; this.arepAcc = 0; }
      else if (dir) {
        this.arep += dt;
        if (this.arep > 0.35) { this.arepAcc += dt * (this.arep > 1.6 ? 32 : 12); steps = Math.floor(this.arepAcc); this.arepAcc -= steps; }
      } else this.arep = 0;
      if (steps && dir) {
        const k = K[i], [lo, hi, st] = ALIGN.rng[k], v = U.clamp(this.aedit[k] + dir * steps * st, lo, hi);
        if (Math.abs(v - this.aedit[k]) > 1e-9) { this.aedit = Align.clean(Object.assign({}, this.aedit, { [k]: v })); this.amsg = ''; Sound.beep(640 + 200 * (v - lo) / (hi - lo), 0.025); }
      }
      return;
    }
    // the wheels: left / right through every car's rims (the car's own first), and through their colours
    if (i < K.length + NR) {
      const dir = (Input.pressed('right') ? 1 : 0) - (Input.pressed('left') ? 1 : 0);
      // the engine: left / right to look through them, ENTER fits the one shown (buying it first if need be)
      if (i === K.length) {
        const NE = DRIFT_ENGINES.length;
        if (dir) { this.aengSel = (this.aengSel + dir + NE) % NE; this.amsg = ''; Sound.beep(700, 0.04); }
        if (Input.pressed('ok')) {
          const e = DRIFT_ENGINES[this.aengSel], s = this.save;
          if (e.id === this.aeng) this.amsg = 'Xe đang lắp động cơ này';
          else if (this.ownsEng(this.acar, e.id)) { this.aeng = e.id; this.amsg = 'Đã lắp ' + e.name; Sound.beep(1100, 0.15); }
          else if (s.money >= e.price) {
            s.money -= e.price; (s.dengs[c.model] || (s.dengs[c.model] = [])).push(e.id);
            this.aeng = e.id; s.deng[c.model] = e.id; this.store();
            this.amsg = 'Đã mua và lắp ' + e.name; Sound.beep(1200, 0.2);
          } else { this.amsg = 'Không đủ tiền (cần ' + U.money(e.price) + ')'; Sound.beep(200, 0.1); }
        }
        return;
      }
      if (!dir) return;
      const own = c.model, cur = Rim.model(this.arim) || own, col = Rim.color(this.arim);
      if (i === K.length + 1) {
        const L = [own].concat(DRIFT_CARS.map(q => q.model).filter(m => m !== own)), m = L[(L.indexOf(cur) + dir + L.length) % L.length];
        this.arim = Rim.make(m === own ? '' : m, col);
        Models.loadCar(m);
      } else this.arim = Rim.make(cur === own ? '' : cur, RIM_COLS[(Math.max(0, RIM_COLS.indexOf(col)) + dir + RIM_COLS.length) % RIM_COLS.length]);
      this.amsg = ''; Sound.beep(700, 0.04);
      return;
    }
    if (!Input.pressed('ok')) return;
    const j = i - K.length - NR;
    if (j === 0) { this.aedit = Align.clean(Align.best(c).a); this.amsg = 'Đã áp dụng bộ góc drift tối ưu cho xe này'; Sound.beep(1100, 0.15); }
    else if (j === 1) { this.aedit = Align.def(c); this.amsg = 'Đã trả về bộ góc gốc của xe'; Sound.beep(700, 0.1); }
    else { this.saveAlign(); this.state = 'garage'; this.gmsg = 'Đã lưu căn chỉnh ' + c.name; Sound.beep(880, 0.08); }
  },
  saveAlign() { const m = DRIFT_CARS[this.acar].model; this.save.dalign[m] = Align.clean(this.aedit); this.save.drim[m] = Rim.clean(this.arim); this.save.deng[m] = Engine.clean(this.aeng); this.store(); },
  // an angle as the garage writes it: camber / caster with their sign, toe as in (vào) / out (ra) per wheel
  fmtAlign(k, v) {
    const f = x => Math.abs(x).toFixed(2).replace('.', ',');
    if (k === 'ack') return v + '%';
    if (k === 'lock') return v + '°';
    if (k === 'toeF' || k === 'toeR') return v === 0 ? '0,00°' : f(v) + '° ' + (v > 0 ? 'vào' : 'ra');
    return (v < 0 ? '-' : v > 0 && k !== 'cas' ? '+' : '') + f(v) + '°';
  },
  // text wrapped into lines w wide (overlay units); returns the y under the last line
  wrapText(str, x, y, w, size, col, lh) {
    const g = Render.g; g.font = size + 'px ' + FONT;
    let line = '';
    for (const word of str.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (g.measureText(t).width > w && line) { Render.text(line, x, y, size, col, 'left'); y += lh; line = word; } else line = t;
    }
    if (line) { Render.text(line, x, y, size, col, 'left'); y += lh; }
    return y;
  },
  drawAlign() {
    const g = Render.g, c = DRIFT_CARS[this.acar], a = this.aedit, K = ALIGN.keys, sel = this.asel, D = Math.PI / 180;
    const best = Align.best(c).a, st = Align.stats(a, c), info = sel < K.length ? this.ALIGN_INFO[K[sel]] : null, NR = 3;
    this.dim(0.5); this.panel(8, 6, 496, 308);
    Render.text('SETUP XE: BÁNH · ĐỘNG CƠ · MÂM', 18, 10, 18, '#ff9a5a', 'left', 260);
    Render.text(c.name, 494, 14, 13, '#9fe0ff', 'right', 220);
    // ---- left: the five angles (a slider each: grey tick = the car's own setup, green = the best for drift), the actions
    K.forEach((k, r) => {
      const y = 33 + r * 16, on = sel === r,   // (rows 16 apart: the two wheel rows fit under them)
        [lo, hi] = ALIGN.rng[k], X = v => 24 + 206 * (v - lo) / (hi - lo);
      if (on) { g.fillStyle = 'rgba(255,154,90,0.2)'; g.fillRect(16, y - 2, 222, 16); g.fillStyle = '#ff9a5a'; g.fillRect(16, y - 2, 3, 16); }
      Render.text((on ? '> ' : '  ') + this.ALIGN_INFO[k].name, 22, y - 2, 11, on ? '#ffd23a' : '#ffffff', 'left', 120);
      Render.text(this.fmtAlign(k, a[k]), 232, y - 2, 11, on ? '#ffd23a' : '#9fe0ff', 'right', 90);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(24, y + 10.5, 206, 1.5);
      if (lo < 0 && hi > 0) { g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(X(0) - 0.4, y + 8.5, 0.8, 5); }   // zero
      const def = Align.def(c);
      g.fillStyle = '#8e949c'; g.fillRect(X(def[k]) - 1, y + 8, 2, 6);
      g.fillStyle = '#4ad86a'; g.fillRect(X(best[k]) - 1, y + 8, 2, 6);
      g.beginPath(); g.arc(X(a[k]), y + 11.2, on ? 2.9 : 2.3, 0, Math.PI * 2); g.fillStyle = on ? '#ffd23a' : '#e8e8e8'; g.fill();
    });
    // the wheels: whose rims, and their colour
    const rm = Rim.model(this.arim), rc = Rim.color(this.arim), rcar = rm && DRIFT_CARS.find(q => q.model === rm);
    // (the engine row shows the one being looked at: fitted, owned, or its price)
    const eb = DRIFT_ENGINES[this.aengSel], es = Engine.spec(c, eb.id);
    const etag = eb.id === this.aeng ? ' [ĐANG LẮP]' : this.ownsEng(this.acar, eb.id) ? ' [ĐÃ CÓ]' : ' ' + U.money(eb.price);
    [['ĐỘNG CƠ', eb.name + etag], ['MÂM XE', rcar ? rcar.name : 'Mâm gốc của xe'], ['MÀU MÂM', rc ? '' : 'Màu gốc']].forEach(([name, val], j) => {
      const y = 146 + j * 13, on = sel === K.length + j;
      if (on) { g.fillStyle = 'rgba(255,154,90,0.2)'; g.fillRect(16, y - 1, 222, 13); g.fillStyle = '#ff9a5a'; g.fillRect(16, y - 1, 3, 13); }
      Render.text((on ? '> ' : '  ') + name, 22, y - 1, 11, on ? '#ffd23a' : '#ffffff', 'left', 70);
      if (j === 2 && rc) {   // a swatch of the colour between the arrows
        Render.rr(198, y + 2, 24, 8, 2, rc, 'rgba(255,255,255,0.5)');
        if (on) { Render.text('◀', 195, y - 1, 11, '#ffd23a', 'right'); Render.text('▶', 233, y - 1, 11, '#ffd23a', 'right'); }
      } else Render.text((on ? '◀ ' : '') + val + (on ? ' ▶' : ''), 232, y - 1, j ? 11 : 10, on ? '#ffd23a' : j === 0 && eb.id !== this.aeng ? '#ffb04a' : '#9fe0ff', 'right', 156);
    });
    this.ALIGN_ACTS.forEach(([name], j) => {
      const y = 187 + j * 11, on = sel === K.length + NR + j;
      if (on) { g.fillStyle = 'rgba(255,154,90,0.2)'; g.fillRect(16, y - 1, 222, 11); g.fillStyle = '#ff9a5a'; g.fillRect(16, y - 1, 3, 11); }
      Render.text((on ? '> ' : '  ') + name, 22, y - 2, 12, on ? '#ffd23a' : j === 0 ? '#7fff7f' : '#ffffff', 'left', 210);
    });
    Render.text('▮ gốc', 150, 211, 8, '#8e949c', 'left'); Render.text('▮ tối ưu drift', 182, 211, 8, '#4ad86a', 'left');
    // the selected row's explanation
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(16, 221, 222, 1);
    const RIM_TEXT = ['Chọn bộ mâm và lốp của bất kỳ mẫu xe nào trong game (← →). Mâm được chỉnh cỡ cho vừa bánh của xe này nên không ảnh hưởng tới cách xe chạy. Dùng cả khi chơi online.',
      'Màu mặt mâm (← →). "Màu gốc" là màu có sẵn của bộ mâm đang chọn. Viền mâm, ốc và heo phanh giữ nguyên màu.'];
    const ENG_TEXT = eb.desc + ' Thay máy đi kèm cầu sau có tỉ số hợp với máy và lốp sau rộng hơn: máy mạnh hơn thì mỗi số chạy nhanh hơn và xe bốc hơn. ' +
      (eb.id === this.aeng ? '' : this.ownsEng(this.acar, eb.id) ? 'ENTER để lắp. ' : 'ENTER để mua và lắp (' + U.money(eb.price) + '). ') + 'Tiền: ' + U.money(this.save.money) + '.';
    const yEnd = this.wrapText(info ? info.text : sel === K.length ? ENG_TEXT : sel < K.length + NR ? RIM_TEXT[sel - K.length - 1] : this.ALIGN_ACTS[sel - K.length - NR][1], 18, 224, 218, 9, '#c8d4e4', 9.8);
    if (this.amsg && yEnd < 287) Render.text(this.amsg, 127, 288, 10, '#7fff7f', 'center', 220);
    // ---- right: the 3D view (the angle as set, on the car) with a true-scale diagram of it
    const vx = 244, vy = 32, vw = 252, vh = 122, view = info ? info.view : '3q';
    // steering: still for camber and toe (the angle reads as set); swinging for caster and the whole car
    // (Ackermann and lock: the wheels swing from lock to lock, seen from above)
    const lockRow = info && (K[sel] === 'ack' || K[sel] === 'lock');
    const steer = lockRow ? Math.sin(this.t * 0.9) * a.lock * D : view === 'side' || view === '3q' ? Math.sin(this.t * 0.9) * 0.5 : 0;
    const P = Render.alignPreview(c.model, this.carPaint(this.acar), a, view, steer, vx, vy, vw, vh, this.t, this.arim);
    g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 0.75; g.strokeRect(vx, vy, vw, vh);
    const VIEW = { front: 'NHÌN TỪ PHÍA TRƯỚC', rear: 'NHÌN TỪ PHÍA SAU', top: 'NHÌN TỪ TRÊN XUỐNG (ĐẦU XE HƯỚNG LÊN)', side: 'NHÌN TỪ BÊN HÔNG (ĐẦU XE BÊN TRÁI)', '3q': 'TOÀN XE' };
    Render.text(VIEW[view], vx + 4, vy + 2, 9, '#a8b8d0', 'left', 170);
    if (info) this.drawAlignDiagram(K[sel], a, c, vx + vw - 78, vy + 3, 75, 64);
    // angle labels at the wheels in the front / rear views (scale of that camera: fov 15° at 9 m)
    if (view === 'front' || view === 'rear') {
      const kpx = (vh / 2) / (9 * Math.tan(7.5 * D)), cx = vx + vw / 2, cy = vy + vh / 2, txt = this.fmtAlign(view === 'front' ? 'camF' : 'camR', view === 'front' ? a.camF : a.camR);
      for (const s of [-1, 1]) Render.text(txt, cx + s * P.track * kpx, cy - 0.62 * kpx, 10, '#ffd23a', 'center');
      Render.text(view === 'front' ? 'PHẢI' : 'TRÁI', cx - P.track * kpx, cy + 0.42 * kpx, 8, '#a8b8d0', 'center');
      Render.text(view === 'front' ? 'TRÁI' : 'PHẢI', cx + P.track * kpx, cy + 0.42 * kpx, 8, '#a8b8d0', 'center');
    }
    if (view === 'side') {   // the camber each front wheel has right now, steered about the caster axis
      const cg = Align.casG(a.cas, steer);
      Render.text('Đánh lái ' + Math.round(Math.abs(steer) / D) + '° ' + (steer > 0 ? 'trái' : 'phải') + ' → camber bánh trái ' + this.fmtAlign('camF', +(a.camF + cg).toFixed(2)) + ' · bánh phải ' + this.fmtAlign('camF', +(a.camF - cg).toFixed(2)),
        vx + 4, vy + vh - 12, 9, '#ffd23a', 'left', vw - 8);
    }
    // ---- right, below: the drift rating and each effect against the car's stock street alignment
    const ry = 158;
    if (sel === K.length) this.drawEngPanel(c, eb, vx, ry, vw);
    else {
    Render.text('ĐIỂM SETUP DRIFT', vx, ry, 11, '#ffffff', 'left');
    Render.bar(vx + 98, ry + 3, 110, 6, st.score / 100, st.score >= 90 ? '#4ad86a' : st.score >= 60 ? '#f0b020' : '#e86a3a');
    Render.text(st.score + '/100', vx + vw, ry, 12, st.score >= 90 ? '#7fff7f' : '#ffd23a', 'right');
    Render.text('so với thông số zin đường phố:', vx, ry + 13, 8.5, '#a8b8d0', 'left');
    Align.STATS.forEach(([k, name], i) => {
      const col = i % 2, row = Math.floor(i / 2), x = vx + col * 128, y = ry + 24 + row * 13, d = st[k] - 1, pc = Math.round(d * 100);
      Render.text(name, x, y, 8.5, '#e8e8e8', 'left', 72);
      const bx = x + 90, half = 14, f = U.clamp(Math.abs(d) / 0.25, 0, 1) * half;
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(bx - half, y + 4, half * 2, 3);
      g.fillStyle = d >= 0 ? '#4ad86a' : '#e8503a'; g.fillRect(d >= 0 ? bx : bx - f, y + 4, f, 3);
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(bx - 0.3, y + 2, 0.6, 7);
      Render.text((pc > 0 ? '+' : '') + pc + '%', x + 124, y, 8.5, pc > 0 ? '#7fff7f' : pc < 0 ? '#ff8a7a' : '#a8b8d0', 'right');
    });
    // the camber the loaded / light front tyre really has in a drift and at turn-in (static + body roll + caster)
    const [dl, dr] = Align.cambers(a, true, ALIGN.drift.ay, ALIGN.drift.steer), [tl, tr] = Align.cambers(a, true, ALIGN.turn.ay, ALIGN.turn.steer);
    const yc = ry + 24 + Math.ceil(Align.STATS.length / 2) * 13 + 2;
    Render.text('Camber thật bánh trước khi drift (lái ngược ' + Math.round(-ALIGN.drift.steer / D) + '°): bánh chịu tải ' + this.fmtAlign('camF', +dr.toFixed(1)) + ' · bánh nhẹ ' + this.fmtAlign('camF', +dl.toFixed(1)), vx, yc, 8.5, '#9fe0ff', 'left', vw);
    Render.text('Khi vào cua (chưa trượt): bánh chịu tải ' + this.fmtAlign('camF', +tr.toFixed(1)) + ' · bánh nhẹ ' + this.fmtAlign('camF', +tl.toFixed(1)) + '  (lốp bám nhất ≈ ' + this.fmtAlign('camF', ALIGN.opt) + ')', vx, yc + 11, 8.5, '#9fe0ff', 'left', vw);
    }
    Render.text('↑↓ chọn   ← → chỉnh (giữ để chỉnh nhanh)   ENTER áp dụng   ESC lưu & quay lại', W / 2, 300, 10, '#a8b8d0', 'center', 480);
  },
  // the setup screen's right-hand panel on the engine row: the car's figures with the engine being looked at (bars as
  // in the garage), each against the engine fitted now, and the speed every gear reaches at the red line
  drawEngPanel(c, eb, x, y, w) {
    const g = Render.g, e = Engine.spec(c, eb.id), cur = Engine.spec(c, this.aeng), same = eb.id === this.aeng;
    Render.text('ĐỘNG CƠ: ' + eb.name, x, y, 11, '#ffb04a', 'left', w - 70);
    Render.text(same ? 'ĐANG LẮP' : this.ownsEng(this.acar, eb.id) ? 'ĐÃ CÓ' : U.money(eb.price), x + w, y, 11, same ? '#7fff7f' : '#ffd23a', 'right');
    Render.text(same ? 'thông số xe với động cơ này:' : 'thông số xe với động cơ này (so với máy đang lắp):', x, y + 13, 8.5, '#a8b8d0', 'left');
    const rows = [['CÔNG SUẤT', 'hp', 900, ' mã lực', 1], ['MÔ-MEN', 'torque', 1200, ' Nm', 1], ['TRỌNG LƯỢNG', 'kg', 1800, ' kg', -1],
      ['VÒNG TUA', 'redline', 9000, ' v/p', 1], ['TỐC ĐỘ TỐI ĐA', 'vmax', 420, ' km/h', 1]];
    // (how hard it pulls: seconds to 100 and to 200 km/h, about)
    const acc = s => Engine.time(s, 100).toFixed(1).replace('.', ',') + ' s · ' + Engine.time(s, 200).toFixed(1).replace('.', ',') + ' s';
    rows.forEach(([name, k, top, unit, good], i) => {
      const yy = y + 26 + i * 13, d = e[k] - cur[k];
      Render.text(name, x, yy, 9.5, '#e8e8e8', 'left', 74);
      Render.bar(x + 80, yy + 2, 78, 5, Math.min(1, e[k] / top), '#ff9a5a');
      if (!same) { g.fillStyle = '#ffffff'; g.fillRect(x + 80 + 78 * Math.min(1, cur[k] / top) - 0.5, yy, 1, 9); }   // (the engine fitted now)
      Render.text(e[k] + unit, x + 212, yy, 9.5, '#9fe0ff', 'right', 52);
      if (d) Render.text((d > 0 ? '+' : '') + d, x + w, yy, 9, d * good > 0 ? '#7fff7f' : '#ff8a7a', 'right', 36);
    });
    // the gears: the same gearbox, a final drive to suit the engine
    Render.text('0–100 · 0–200 km/h', x, y + 26 + rows.length * 13, 9.5, '#e8e8e8', 'left', 90);
    Render.text('≈ ' + acc(e), x + 212, y + 26 + rows.length * 13, 9.5, '#7fff7f', 'right', 110);
    const yy = y + 26 + (rows.length + 1) * 13 + 2, sp = s => s.gears.map((_, k) => Math.round(Engine.gearV(s, k))).join(' · ');
    Render.text('Tốc độ tối đa từng số (km/h) · tỉ số cầu ' + String(e.final).replace('.', ',') + ':', x, yy, 8.5, '#a8b8d0', 'left', w);
    Render.text(sp(e), x, yy + 11, 10, '#ffd23a', 'left', w);
    if (!same) Render.text('máy đang lắp: ' + sp(cur) + '  (0–100 ≈ ' + Engine.time(cur, 100).toFixed(1).replace('.', ',') + ' s)', x, yy + 23, 8.5, '#a8b8d0', 'left', w);
  },
  // the angle k drawn to scale (toe magnified, it says so), in a box at x, y (w x h)
  drawAlignDiagram(k, a, c, x, y, w, h) {
    const g = Render.g, D = Math.PI / 180, cx = x + w / 2, v = a[k];
    g.fillStyle = 'rgba(8,12,30,0.78)'; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 0.6; g.strokeRect(x, y, w, h);
    const dash = (x0, y0, x1, y1) => { g.save(); g.setLineDash([2, 2]); g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore(); };
    const arc = (px, py, r, a0, a1) => { g.strokeStyle = '#ffd23a'; g.lineWidth = 0.9; g.beginPath(); g.arc(px, py, r, Math.min(a0, a1), Math.max(a0, a1)); g.stroke(); };
    const tyre = (px, py, ang, tw, th) => { g.save(); g.translate(px, py); g.rotate(ang); Render.rr(-tw / 2, -th / 2, tw, th, 2, '#2a2c33', '#c8ccd4'); g.fillStyle = '#8e949c'; g.fillRect(-tw / 2 + 1.5, -1, tw - 3, 2); g.restore(); };
    if (k === 'camF' || k === 'camR') {
      // one wheel seen from in front (the car's left wheel, the car's centre to its left), at the true angle
      const gy = y + h - 12, th = 34, tw = 11, py = gy - th / 2 - 0.5;
      g.fillStyle = '#5a5e68'; g.fillRect(x + 4, gy, w - 8, 1.2);
      dash(cx, gy - th - 4, cx, gy + 2);
      tyre(cx, py, v * D, tw, th);
      arc(cx, py, th / 2 + 2, -Math.PI / 2, -Math.PI / 2 + v * D);
      Render.text('◄ tâm xe', x + 4, y + 3, 8, '#a8b8d0', 'left');
      Render.text(this.fmtAlign(k, v), x + w - 3, y + 3, 9, '#ffd23a', 'right');
      Render.text(v < 0 ? 'âm' : v > 0 ? 'dương' : '0', x + w - 3, y + h - 10, 8, '#a8b8d0', 'right');
    } else if (k === 'toeF' || k === 'toeR') {
      // the axle from above, front up: both wheels, the toe magnified x5 (one degree would not show at this size)
      const M = 5, py = y + h / 2 + 2, off = 20, th = 26, tw = 8;
      for (const s of [-1, 1]) {   // s -1 = left wheel (screen left)
        const px = cx + s * off;
        dash(px, py - th / 2 - 4, px, py + th / 2 + 4);
        tyre(px, py, -s * v * D * M, tw, th);
      }
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(cx - off + 5, py - 0.3, off * 2 - 10, 0.6);
      Render.text('▲ đầu xe', cx, y + 2, 8, '#a8b8d0', 'center');
      const mm = 2 * 2 * c.R * 1000 * Math.tan(Math.abs(v) * D);   // total (both wheels), across the tyre's diameter
      Render.text(this.fmtAlign(k, v), cx, y + h - 19, 9, '#ffd23a', 'center');
      Render.text('tổng ' + mm.toFixed(1).replace('.', ',') + ' mm · vẽ x' + M, cx, y + h - 9, 7.5, '#a8b8d0', 'center', w - 4);
    } else if (k === 'ack' || k === 'lock') {
      // the front axle from above, front up, at full lock to the left: the inner (left) and the outer wheel
      const d = a.lock * D, sp = a.ack / 100 * 0.29 * Math.sin(d) ** 2, py = y + h / 2 - 1, off = 20, th = 24, tw = 8;
      for (const s of [-1, 1]) {   // s -1 = left wheel (screen left), the inner one
        const px = cx + s * off, ang = d - s * sp;
        dash(px, py - th / 2 - 4, px, py + th / 2 + 4);
        tyre(px, py, -ang, tw, th);
        Render.text(Math.round(ang / D) + '°', px, y + h - 19, 9, '#ffd23a', 'center');
      }
      Render.text('▲ đầu xe · hết lái trái', cx, y + 2, 7.5, '#a8b8d0', 'center', w - 4);
      Render.text('trong            ngoài', cx, y + h - 9, 7.5, '#a8b8d0', 'center', w - 4);
    } else if (k === 'cas') {
      // the front wheel from the left side (front to the left), the steering axis leaning back at the top
      const gy = y + h - 9, r = 17, py = gy - r;
      g.fillStyle = '#5a5e68'; g.fillRect(x + 4, gy, w - 8, 1.2);
      g.beginPath(); g.arc(cx, py, r, 0, Math.PI * 2); g.fillStyle = '#2a2c33'; g.fill(); g.strokeStyle = '#c8ccd4'; g.lineWidth = 0.8; g.stroke();
      g.beginPath(); g.arc(cx, py, r * 0.55, 0, Math.PI * 2); g.strokeStyle = '#8e949c'; g.stroke();
      dash(cx, py - r - 8, cx, gy);
      const L = r + 10, sx = Math.sin(v * D) * L, sy = Math.cos(v * D) * L;
      g.strokeStyle = '#ffd23a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx - sx, py + sy); g.lineTo(cx + sx, py - sy); g.stroke();
      arc(cx, py, r + 6, -Math.PI / 2, -Math.PI / 2 + v * D);
      Render.text('◄ đầu xe', x + 3, y + 3, 8, '#a8b8d0', 'left');
      Render.text(this.fmtAlign(k, v), x + w - 3, y + 3, 9, '#ffd23a', 'right');
    }
  },
  drawDriftPause() {
    this.dim(0.55); this.panel(30, 40, 452, 242);
    Render.text('TẠM DỪNG', W / 2, 44, 32, '#ffd23a', 'center');
    this.drawKeys(44, 84, 2, 14);
    Render.text('ENTER / ESC: tiếp tục      Q: bỏ cuộc      M: bật/tắt âm thanh', W / 2, 186, 15, '#ffffff', 'center', 400);
    Render.text('Vào cua: kéo phanh tay (SPACE) hoặc đánh lái gắt, giữ ga - đuôi xe văng ra là đang drift.', W / 2, 206, 14, '#7fff7f', 'center', 420);
    Render.text('Đang trượt: giữ lái VỀ PHÍA CUA để ôm cua · nhấp lái ngược để thẳng xe · giữ lái ngược + ga để đảo sang cua kế.', W / 2, 223, 14, '#7fff7f', 'center', 420);
    Render.text('Chạm rào / húc xe phía trước: -30% điểm chuỗi · đâm mạnh hoặc xoay xe: mất cả chuỗi.', W / 2, 240, 14, '#ff9a8a', 'center', 420);
    Render.text('Đối thủ máy: xếp hạng theo điểm drift · drift sát một xe đang drift (SONG HÀNH): điểm x1.5.', W / 2, 257, 14, '#ff9aff', 'center', 420);
  },
  drawDriftResults() {
    const r = this.dres, g = Render.g;
    if (r.table) { this.drawDriftTable(); return; }
    this.dim(0.5); this.panel(40, 14, 432, 292);
    Render.text(r.quit ? 'BỎ CUỘC' : 'HOÀN THÀNH!', W / 2, 16, 30, r.quit ? '#ff8a8a' : '#ffd23a', 'center');
    Render.text(r.map + '  ·  ' + r.car, W / 2, 46, 15, '#9fe0ff', 'center', 400);
    Render.text('ĐIỂM DRIFT', 140, 72, 15, '#a8b8d0', 'center');
    Render.text(r.score.toLocaleString('en-US'), 140, 88, 34, '#ffffff', 'center', 190);
    if (r.rec) { if (Math.floor(this.t * 3) % 2 === 0) Render.text('KỶ LỤC MỚI!', 140, 126, 20, '#ffd23a', 'center'); }
    else Render.text('Kỷ lục: ' + r.prev.toLocaleString('en-US'), 140, 128, 14, '#a8b8d0', 'center');
    if (!r.quit) {
      Render.text('XẾP HẠNG', 372, 72, 15, '#a8b8d0', 'center');
      Render.text(r.grade >= 0 ? DRIFT_RANKS[r.grade] : '-', 372, 84, 64, r.grade >= 3 ? '#ffd23a' : r.grade >= 0 ? '#7fff7f' : '#ff8a8a', 'center');
    }
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(56, 156, 400, 1);
    const rows = [['Chuỗi drift dài nhất', r.best.chain.toLocaleString('en-US') + ' điểm'], ['Góc trượt lớn nhất', Math.round(r.best.angle) + '°'],
      ['Tốc độ cao nhất', Math.round(r.best.kmh) + ' km/h'], ['Va chạm rào', String(r.hits)], ['Thời gian', U.fmtTime(r.time)]];
    rows.forEach(([a, b], i) => { Render.text(a, 70, 162 + i * 17, 15, '#ffffff', 'left', 200); Render.text(b, 442, 162 + i * 17, 15, '#9fe0ff', 'right', 160); });
    Render.text('Tiền thưởng: +' + U.money(r.money), W / 2, 252, 20, '#7fff7f', 'center');
    if (Math.floor(this.t * 2) % 2 === 0) Render.text('ENTER để tiếp tục', W / 2, 282, 17, '#ffffff', 'center');
  },
  // results with computer drivers: score and grade on the left, the final order by score on the right
  drawDriftTable() {
    const r = this.dres, g = Render.g;
    this.dim(0.5); this.panel(30, 10, 452, 300);
    Render.text(r.place === 1 ? 'VÔ ĐỊCH!' : 'HẠNG ' + r.place + '/' + r.table.length, W / 2, 12, 30, r.place === 1 ? '#ffd23a' : r.place <= 3 ? '#7fff7f' : '#ffffff', 'center');
    Render.text(r.map + '  ·  ' + r.car, W / 2, 42, 14, '#9fe0ff', 'center', 420);
    Render.text('ĐIỂM DRIFT', 128, 62, 14, '#a8b8d0', 'center');
    Render.text(r.score.toLocaleString('en-US'), 128, 76, 30, '#ffffff', 'center', 180);
    if (r.rec) { if (Math.floor(this.t * 3) % 2 === 0) Render.text('KỶ LỤC MỚI!', 128, 108, 17, '#ffd23a', 'center'); }
    else Render.text('Kỷ lục: ' + r.prev.toLocaleString('en-US'), 128, 110, 13, '#a8b8d0', 'center');
    Render.text('XẾP HẠNG', 100, 132, 14, '#a8b8d0', 'center');
    Render.text(r.grade >= 0 ? DRIFT_RANKS[r.grade] : '-', 160, 124, 32, r.grade >= 3 ? '#ffd23a' : r.grade >= 0 ? '#7fff7f' : '#ff8a8a', 'center');
    // the table
    const x0 = 238, x1 = 470;
    Render.text('BẢNG ĐIỂM CHUNG CUỘC', (x0 + x1) / 2, 60, 14, '#ff9a5a', 'center');
    r.table.forEach((t, i) => {
      const y = 78 + i * 16;
      if (t.me) { g.fillStyle = 'rgba(255,210,58,0.16)'; g.fillRect(x0 - 4, y - 1, x1 - x0 + 6, 15); }
      g.fillStyle = t.paint; g.fillRect(x0 + 14, y + 3, 5, 8);
      const col = t.me ? '#ffd23a' : '#e8e8e8';
      Render.text((i + 1) + '.', x0, y, 14, col, 'left');
      Render.text(t.name, x0 + 24, y, 14, col, 'left', 112);
      Render.text(t.score.toLocaleString('en-US'), x1, y, 14, col, 'right', 70);
    });
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(46, 178, 420, 1);
    const rows = [['Chuỗi drift dài nhất', r.best.chain.toLocaleString('en-US')], ['Góc trượt lớn nhất', Math.round(r.best.angle) + '°'],
      ['Tốc độ cao nhất', Math.round(r.best.kmh) + ' km/h'], ['Chạm rào / chạm xe', r.hits + ' / ' + r.bumps], ['Thời gian', U.fmtTime(r.time)],
      ['Thưởng hạng ' + r.place, r.prize ? '+' + U.money(r.prize) : '-']];
    rows.forEach(([a, b], i) => {
      const x = i % 2 ? 262 : 50, y = 184 + Math.floor(i / 2) * 17;
      Render.text(a, x, y, 14, '#ffffff', 'left', 130); Render.text(b, x + 200, y, 14, '#9fe0ff', 'right', 80);
    });
    Render.text('Tiền thưởng: +' + U.money(r.money), W / 2, 244, 20, '#7fff7f', 'center');
    if (Math.floor(this.t * 2) % 2 === 0) Render.text(r.online ? 'ENTER: về phòng chờ' : 'ENTER để tiếp tục', W / 2, 280, 17, '#ffffff', 'center');
  },
  dim(a) { const g = Render.g; g.fillStyle = 'rgba(0,0,0,' + a + ')'; g.fillRect(0, 0, W, H); },
  panel(x, y, w, h) {
    const g = Render.g;
    g.fillStyle = 'rgba(8,12,40,0.88)'; g.fillRect(x, y, w, h);
    g.fillStyle = '#ffd23a'; g.fillRect(x, y, w, 2); g.fillRect(x, y + h - 2, w, 2); g.fillRect(x, y, 2, h); g.fillRect(x + w - 2, y, 2, h);
    g.fillStyle = '#8a5a00'; g.fillRect(x + 3, y + 3, w - 6, 1); g.fillRect(x + 3, y + h - 4, w - 6, 1);
  },
  bigText(str, y, size) {
    const g = Render.g;
    g.font = size + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillStyle = '#000';
    const mw = W - 24;
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [3, 3], [2, 3], [3, 2]]) g.fillText(str, W / 2 + dx, y + dy, mw);
    const gr = g.createLinearGradient(0, y + size * 0.15, 0, y + size * 0.85);
    gr.addColorStop(0, '#fff6a0'); gr.addColorStop(0.5, '#ffb000'); gr.addColorStop(1, '#d02000');
    g.fillStyle = gr; g.fillText(str, W / 2, y, mw);
  },
  drawTitle() {
    const g = Render.g;
    const gr = g.createLinearGradient(0, 0, 0, 140);
    gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, 140);
    this.bigText('RC Drift', 18, 72);
    Render.text('ĐUA XE MÁY ĐẤM NHAU  ·  Ô TÔ DRIFT TRÊN ĐÈO', W / 2, 84, 20, '#ffffff', 'center', 440);
    Render.text(BIKES.length + ' MẪU XE MÁY  ·  ' + DRIFT_CARS.length + ' Ô TÔ DRIFT  ·  CHƠI ONLINE', W / 2, 106, 16, '#ff9a5a', 'center', 440);
    if (Math.floor(this.t * 2) % 2 === 0) Render.text('NHẤN ENTER ĐỂ BẮT ĐẦU', W / 2, 262, 26, '#ffd23a', 'center');
  },
  // the two game modes side by side, each with its vehicle turning in a window
  drawMode() {
    const g = Render.g, s = this.save, ci = this.dIdx(), car = DRIFT_CARS[ci];
    this.dim(0.45); this.panel(24, 20, 464, 280);
    Render.text('CHỌN CHẾ ĐỘ CHƠI', W / 2, 26, 28, '#ffd23a', 'center');
    const cards = [
      { name: 'ĐUA XE MÁY', col: '#ffd23a', lines: ['Đua trên xa lộ, đấm đá đối thủ', THEMES.length + ' chặng · chơi online · cửa hàng xe'], sub: BIKES[s.bike].name + ' · cấp ' + s.level + '/5' },
      { name: 'ĐUA Ô TÔ DRIFT', col: '#ff9a5a', lines: ['Drift trên đèo, ghi điểm bằng góc trượt', DRIFT_MAPS.length + ' bản đồ · chơi online · gara, mâm, tem'], sub: car.name },
    ];
    cards.forEach((c, i) => {
      const x = 40 + i * 222, y = 62, w = 210, h = 204, on = i === this.msel;
      g.fillStyle = on ? 'rgba(255,210,58,0.16)' : 'rgba(255,255,255,0.05)'; g.fillRect(x, y, w, h);
      g.strokeStyle = on ? c.col : 'rgba(255,255,255,0.25)'; g.lineWidth = on ? 2 : 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      if (i === 0) Render.preview(s.bike, x + 6, y + 6, w - 12, 112, this.t);
      else Render.carPreview(car.model, this.carPaint(ci), x + 6, y + 6, w - 12, 112, this.t, this.carAlign(ci), this.carLiv(ci), this.carRim(ci));
      Render.text((on ? '> ' : '') + c.name, x + w / 2, y + 124, 21, on ? c.col : '#ffffff', 'center', w - 12);
      Render.text(c.sub, x + w / 2, y + 148, 12, '#9fe0ff', 'center', w - 12);
      c.lines.forEach((l, k) => Render.text(l, x + w / 2, y + 166 + k * 14, 11, '#c8d4e4', 'center', w - 10));
    });
    Render.text('TIỀN: ' + U.money(s.money), W / 2, 270, 14, '#ffffff', 'center');
    Render.text('← → chọn   ENTER vào   ESC quay lại', W / 2, 284, 14, '#a8b8d0', 'center');
  },
  drawMenu() {
    const s = this.save, b = BIKES[s.bike];
    this.dim(0.35); this.panel(56, 8, 400, 304);
    Render.text('ĐUA XE MÁY · CHỌN CHẶNG', W / 2, 10, 26, '#ffd23a', 'center', 380);
    Render.text('CẤP ' + s.level + '/5      TIỀN: ' + U.money(s.money), W / 2, 37, 17, '#ffffff', 'center');
    Render.text('XE: ' + b.name, 76, 56, 15, '#9fe0ff', 'left', 180);
    Render.text('ĐỘ BỀN', 262, 56, 15, '#9fe0ff', 'left', 52);
    Render.bar(320, 61, 116, 7, this.bikeHp() / b.dur, '#f0b020');
    const laps = Track.laps(s.level);
    const items = THEMES.map((t, i) => ({ a: t.name, b: t.desc + (t.circuit ? ' · ' + laps + ' vòng' : ''), ok: s.passed.includes(i), gp: t.circuit }));
    items.push({ a: 'CHƠI ONLINE', b: 'Phòng chờ - đua cùng bạn bè qua mạng' + (Net.onlineText() ? ' · ' + Net.onlineText() : ''), ok: false, col: '#7fff7f' });
    items.push({ a: 'CỬA HÀNG XE', b: 'Mua xe mới, sửa xe', ok: false });
    const g = Render.g, rh = 17;
    items.forEach((it, i) => {
      const y = 77 + i * rh, on = i === this.sel;
      if (on) { g.fillStyle = 'rgba(255,210,58,0.18)'; g.fillRect(64, y - 1, 384, rh - 1); g.fillStyle = '#ffd23a'; g.fillRect(64, y - 1, 3, rh - 1); }
      Render.text((on ? '> ' : '  ') + it.a, 76, y - 2, 17, on ? '#ffd23a' : it.col || '#ffffff', 'left', 270);
      if (it.tag && Math.floor(this.t * 3) % 2 === 0) Render.text(it.tag, 392, y - 1, 14, '#ff9a5a', 'right');
      if (it.gp) Render.text('GP', 392, y, 14, '#5ad0ff', 'right');
      if (it.ok) Render.text('[ĐẠT]', 440, y - 1, 16, '#7fff7f', 'right');
    });
    Render.text(items[this.sel].b, W / 2, 249, 14, '#a8b8d0', 'center', 380);
    const need = this.levelNeed(), got = Math.min(need, s.passed.length);
    Render.text(s.level < 5 ? 'Về TOP 3 ở ' + need + ' chặng khác nhau để lên cấp ' + (s.level + 1) + ' (' + got + '/' + need + ')' : 'Đã đạt cấp cao nhất!',
      W / 2, 268, 15, '#ffb000', 'center', 380);
    Render.text('↑↓ chọn   ENTER xác nhận   H hướng dẫn   ESC quay lại', W / 2, 287, 14, '#a8b8d0', 'center');
  },
  drawShop() {
    const s = this.save, g = Render.g;
    this.dim(0.45); this.panel(16, 12, 480, 296);
    Render.text('CỬA HÀNG XE', 30, 16, 30, '#ffd23a');
    Render.text('TIỀN: ' + U.money(s.money), 482, 22, 20, '#ffffff', 'right');
    const cost = this.repairCost();
    const rows = BIKES.map((b, i) => [b.name, s.owned.includes(i) ? (s.bike === i ? '[ĐANG DÙNG]' : '[ĐÃ CÓ]') : U.money(b.price)]);
    rows.push(['SỬA XE', cost > 0 ? U.money(cost) : '--']);
    rows.push(['QUAY LẠI', '']);
    // a scrolling window of rows that follows the selection
    const VIS = Math.min(9, rows.length), rh = 21, fs = 17, first = U.clamp(this.shopSel - 4, 0, rows.length - VIS);
    for (let k = 0; k < VIS; k++) {
      const i = first + k, [a, b] = rows[i], y = 56 + k * rh, on = i === this.shopSel;
      if (on) { g.fillStyle = 'rgba(255,210,58,0.18)'; g.fillRect(24, y - 2, 236, rh - 3); g.fillStyle = '#ffd23a'; g.fillRect(24, y - 2, 3, rh - 3); }
      Render.text((on ? '> ' : '  ') + a, 32, y, fs, on ? '#ffd23a' : '#ffffff', 'left', 150);
      Render.text(b, 254, y + 2, 14, '#9fe0ff', 'right', 70);
    }
    if (first > 0) Render.text('▲', 142, 45, 11, '#ffd23a', 'center');
    if (first + VIS < rows.length) Render.text('▼', 142, 56 + VIS * rh - 3, 11, '#ffd23a', 'center');
    const bi = this.shopSel < BIKES.length ? this.shopSel : s.bike, b = BIKES[bi];
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(272, 50, 214, 250);
    Render.preview(bi, 274, 52, 210, 134, this.t);
    Render.text(b.name, 379, 190, 20, '#ffd23a', 'center', 206);
    const top = k => Math.max(...BIKES.map(x => x[k]));
    const stats = [['TỐC ĐỘ', b.speed / top('speed'), Math.round(b.speed / 60) + ' km/h'], ['TĂNG TỐC', b.accel / top('accel'), ''],
      ['BÁM ĐƯỜNG', b.handling / top('handling'), ''], ['ĐỘ BỀN', b.dur / top('dur'), String(b.dur)]];
    stats.forEach(([n, f, v], i) => {
      const y = 214 + i * 18;
      Render.text(n, 282, y - 3, 15, '#ffffff', 'left', 70);
      Render.bar(358, y + 2, 70, 7, f, '#3ad84a');
      Render.text(v, 482, y - 3, 13, '#9fe0ff', 'right', 50);
    });
    if (this.shopMsg) Render.text(this.shopMsg, 140, 258, 16, '#7fff7f', 'center');
    Render.text('ENTER mua/chọn   ESC quay lại', 140, 282, 14, '#a8b8d0', 'center');
  },
  drawPause() {
    this.dim(0.5); this.panel(126, 90, 260, 130);
    Render.text('TẠM DỪNG', W / 2, 96, 36, '#ffd23a', 'center');
    Render.text('ENTER / ESC: tiếp tục', W / 2, 140, 20, '#ffffff', 'center');
    Render.text('Q: bỏ cuộc', W / 2, 164, 20, '#ff8a8a', 'center');
    Render.text('M: bật/tắt âm thanh', W / 2, 188, 16, '#a8b8d0', 'center');
  },
  drawResults() {
    const r = this.res, g = Render.g;
    this.dim(0.5); this.panel(24, 10, 464, 300);
    const title = r.reason === 'finished' ? (r.place === 1 ? 'CHIẾN THẮNG!' : 'VỀ ĐÍCH - HẠNG ' + r.place)
      : r.reason === 'busted' ? 'BỊ CẢNH SÁT BẮT!' : r.reason === 'wrecked' ? 'XE HỎNG - BỎ CUỘC' : r.reason === 'timeout' ? 'HẾT GIỜ - CHƯA VỀ ĐÍCH' : 'BỎ CUỘC';
    Render.text(title, W / 2, 12, 32, r.reason === 'finished' && r.place <= 3 ? '#ffd23a' : '#ff8a8a', 'center');
    Render.text(r.theme, W / 2, 40, 16, '#9fe0ff', 'center');
    r.rows.forEach((row, i) => {
      const y = 60 + i * 15;
      if (row.isPlayer) { g.fillStyle = 'rgba(255,210,58,0.25)'; g.fillRect(36, y, 240, 15); }
      const col = row.isPlayer ? '#ffd23a' : row.human ? '#7fff7f' : '#ffffff';
      Render.text(String(i + 1).padStart(2, ' ') + '.', 40, y - 1, 16, col);
      Render.text(row.name, 66, y - 1, 16, col);
      Render.text(row.time === Infinity ? '--:--' : U.fmtTime(row.time), 270, y - 1, 16, col, 'right');
    });
    const x = 296;
    Render.text('Giải thưởng', x, 66, 17, '#ffffff', 'left', 100); Render.text('+' + U.money(r.prize), 478, 66, 17, '#7fff7f', 'right', 76);
    Render.text('Hạ gục x' + r.kos, x, 86, 17, '#ffffff', 'left', 100); Render.text('+' + U.money(r.bonus), 478, 86, 17, '#7fff7f', 'right', 76);
    Render.text('Tiền phạt', x, 106, 17, '#ffffff', 'left', 100); Render.text('-' + U.money(r.fine), 478, 106, 17, '#ff8a8a', 'right', 76);
    g.fillStyle = '#ffd23a'; g.fillRect(x, 128, 182, 1);
    Render.text('Tổng', x, 134, 19, '#ffd23a', 'left', 60); Render.text(U.money(r.money), 478, 134, 19, '#ffd23a', 'right', 120);
    if (r.online) Render.text('ĐUA ONLINE', 387, 166, 18, '#7fff7f', 'center');
    else if (r.reason === 'finished') Render.text(r.qualified ? 'ĐẠT CHUẨN CHẶNG NÀY!' : 'CHƯA ĐẠT (cần TOP 3)', 387, 166, 18, r.qualified ? '#7fff7f' : '#ffb000', 'center');
    if (r.levelUp && Math.floor(this.t * 3) % 2 === 0) Render.text('LÊN CẤP ' + this.save.level + '!', 387, 190, 30, '#ffd23a', 'center');
    if (Math.floor(this.t * 2) % 2 === 0) Render.text(r.online ? 'ENTER: về phòng chờ' : 'ENTER để tiếp tục', 387, 282, 18, '#ffffff', 'center');
  },
};

window.addEventListener('load', () => Game.init());
