'use strict';
// ============ Game shell: title, menus, shop, results, save, loop ============
const Game = {
  state: 'title', t: 0, sel: 0, shopSel: 0, shopMsg: '', race: null, demo: null, res: null,
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
    // invite link (?room=ABCD): straight into that room's waiting list
    const code = new URLSearchParams(location.search).get('room');
    if (code) Net.open(code);
    requestAnimationFrame(t => { this.last = t; this.loop(t); });
  },
  load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem('hb_save') || 'null'); } catch (e) { s = null; }
    this.save = Object.assign({ money: 2500000, level: 1, owned: [0], bike: 0, hp: { 0: BIKES[0].dur }, passed: [] }, s || {});
    // one-time gift so existing saves also get the 2.5M starting money
    if (!this.save.gift) { this.save.money = Math.max(this.save.money, 2500000); this.save.gift = 1; this.store(); }
  },
  store() { try { localStorage.setItem('hb_save', JSON.stringify(this.save)); } catch (e) { /* ignore */ } },
  bikeHp() { const s = this.save; return s.hp[s.bike] !== undefined ? s.hp[s.bike] : BIKES[s.bike].dur; },

  newDemo() {
    this.demo = new Race({ themeIdx: U.randInt(0, THEMES.length - 1), level: 1, bikeIdx: U.randInt(0, 3), demo: true, seed: U.randInt(1, 99999) });
  },
  updDemo(dt) {
    if (!this.demo || this.demo.player.z > this.demo.finishZ - 4000) this.newDemo();
    this.demo.update(dt);
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
    if (s.passed.length >= THEMES.length && s.level < 5) { s.level++; s.passed = []; res.levelUp = true; }
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
        if (Input.pressed('ok')) { this.state = 'menu'; this.sel = 0; Sound.beep(660, 0.08); Sound.music.start(); }
        break;
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
      case 'netres':
        this.updDemo(dt);
        if (Input.pressed('ok')) { Sound.beep(660, 0.08); Net.backToRoom(); }
        break;
    }
  },
  updMenu() {
    const n = THEMES.length + 2;
    if (Input.pressed('up')) { this.sel = (this.sel + n - 1) % n; Sound.beep(520, 0.05); }
    if (Input.pressed('down')) { this.sel = (this.sel + 1) % n; Sound.beep(520, 0.05); }
    if (Input.pressed('back')) { this.state = 'title'; return; }
    if (Input.pressed('ok')) {
      Sound.beep(880, 0.1);
      if (this.sel < THEMES.length) this.startRace(this.sel);
      else if (this.sel === THEMES.length) Net.open();
      else { this.state = 'shop'; this.shopSel = this.save.bike; this.shopMsg = ''; }
    }
  },
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
      case 'title': Render.frame(this.demo); this.drawTitle(); break;
      case 'menu': Render.frame(this.demo); this.drawMenu(); break;
      case 'shop': Render.frame(this.demo); this.drawShop(); break;
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
      case 'results': case 'netres': Render.frame(this.demo); this.drawResults(); break;
      case 'online': Render.frame(this.demo); this.dim(0.35); break;
      case 'netrace': Net.draw(); break;
    }
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
    this.bigText('HIGHWAY BRAWL', 18, 72);
    Render.text('ĐUA XE  ·  ĐẤM NHAU  ·  VỀ NHẤT', W / 2, 84, 20, '#ffffff', 'center');
    if (Math.floor(this.t * 2) % 2 === 0) Render.text('NHẤN ENTER ĐỂ BẮT ĐẦU', W / 2, 192, 26, '#ffd23a', 'center');
    Render.box(60, 228, 392, 88, 0.7);
    Render.text('↑ / W: tăng ga    ↓ / S: phanh    ← → / A D: lái', W / 2, 232, 16, '#e8e8e8', 'center', 380);
    Render.text('Z / J: đạp/đánh bên trái    X / K: đạp/đánh bên phải', W / 2, 249, 16, '#e8e8e8', 'center', 380);
    Render.text('SPACE / SHIFT + tăng ga: bốc đầu xe', W / 2, 266, 16, '#ffd23a', 'center', 380);
    Render.text('ESC / P: tạm dừng    M: bật/tắt âm thanh', W / 2, 283, 16, '#e8e8e8', 'center', 380);
    Render.text('Tay không thì đạp - đang bốc đầu mà trúng đòn là té!', W / 2, 299, 14, '#7fff7f', 'center', 380);
  },
  drawMenu() {
    const s = this.save, b = BIKES[s.bike];
    this.dim(0.35); this.panel(56, 14, 400, 292);
    Render.text('CHỌN CHẶNG ĐUA', W / 2, 18, 30, '#ffd23a', 'center');
    Render.text('CẤP ' + s.level + '/5      TIỀN: ' + U.money(s.money), W / 2, 46, 18, '#ffffff', 'center');
    Render.text('XE: ' + b.name, 76, 68, 16, '#9fe0ff', 'left', 180);
    Render.text('ĐỘ BỀN', 262, 68, 16, '#9fe0ff', 'left', 52);
    Render.bar(320, 73, 116, 7, this.bikeHp() / b.dur, '#f0b020');
    const items = THEMES.map((t, i) => ({ a: t.name, b: t.desc, ok: s.passed.includes(i) }));
    items.push({ a: 'CHƠI ONLINE', b: 'Phòng chờ - đua cùng bạn bè qua mạng', ok: false, col: '#7fff7f' });
    items.push({ a: 'CỬA HÀNG XE', b: 'Mua xe mới, sửa xe', ok: false });
    items.forEach((it, i) => {
      const y = 88 + i * 29, on = i === this.sel;
      if (on) { const g = Render.g; g.fillStyle = 'rgba(255,210,58,0.18)'; g.fillRect(64, y - 2, 384, 28); g.fillStyle = '#ffd23a'; g.fillRect(64, y - 2, 3, 28); }
      Render.text((on ? '> ' : '  ') + it.a, 76, y - 3, 20, on ? '#ffd23a' : it.col || '#ffffff');
      Render.text(it.b, 96, y + 12, 13, '#a8b8d0');
      if (it.ok) Render.text('[ĐẠT]', 440, y, 18, '#7fff7f', 'right');
    });
    Render.text('Về TOP 3 ở cả ' + THEMES.length + ' chặng để lên cấp ' + Math.min(5, s.level + 1), W / 2, 266, 16, '#ffb000', 'center');
    Render.text('↑↓ chọn   ENTER xác nhận   ESC quay lại', W / 2, 284, 15, '#a8b8d0', 'center');
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
    rows.forEach(([a, b], i) => {
      const y = 56 + i * 30, on = i === this.shopSel;
      if (on) { g.fillStyle = 'rgba(255,210,58,0.18)'; g.fillRect(24, y - 2, 236, 26); g.fillStyle = '#ffd23a'; g.fillRect(24, y - 2, 3, 26); }
      Render.text((on ? '> ' : '  ') + a, 32, y, 20, on ? '#ffd23a' : '#ffffff', 'left', 140);
      Render.text(b, 254, y + 3, 15, '#9fe0ff', 'right', 76);
    });
    const bi = this.shopSel < BIKES.length ? this.shopSel : s.bike, b = BIKES[bi];
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(272, 50, 214, 250);
    Render.preview(bi, 274, 52, 210, 134, this.t);
    Render.text(b.name, 379, 190, 20, '#ffd23a', 'center');
    const stats = [['TỐC ĐỘ', b.speed / 15500, Math.round(b.speed / 60) + ' km/h'], ['TĂNG TỐC', b.accel / 1.45, ''],
      ['BÁM ĐƯỜNG', b.handling / 1.18, ''], ['ĐỘ BỀN', b.dur / 170, String(b.dur)]];
    stats.forEach(([n, f, v], i) => {
      const y = 214 + i * 18;
      Render.text(n, 282, y - 3, 15, '#ffffff', 'left', 70);
      Render.bar(358, y + 2, 70, 7, f, '#3ad84a');
      Render.text(v, 482, y - 3, 13, '#9fe0ff', 'right', 50);
    });
    if (this.shopMsg) Render.text(this.shopMsg, 140, 248, 16, '#7fff7f', 'center');
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
