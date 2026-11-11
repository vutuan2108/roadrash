'use strict';
// ============ Online play, client side ============
// - the lobby / waiting-room overlay (HTML in index.html) and the WebSocket link to server/server.js
// - the mirror of a networked race: riders, traffic and police are shown ~100 ms behind the server's snapshots
//   (interpolated), while our own bike is predicted at once with Race.motion() and re-based on every snapshot,
//   so steering never waits for the network
// - online drift (room mode 'drift'): our car runs its own physics in a DriftRace (o.net) and we send its state 20
//   times a second; the other players' cars are remote cars placed from the server's relayed states, ~100 ms behind
const Net = {
  ws: null, id: null, themes: null, room: null, list: [], autoJoin: null, uiReady: false,
  view: null, seq: 0, pending: [], snaps: [], offset: null, err: { z: 0, x: 0 }, predicting: false,
  loaded: false, menu: false, police: null,
  INTERP: 0.1, TICK: 1 / 60,
  WEAPONS: [null, 'club', 'chain'],

  // how many players are on line (the server counts the pages that ask): asked every 20 s while the page is in view
  online: null, onlineId: Math.random().toString(36).slice(2, 12).padEnd(8, '0'),
  pollOnline() {
    if (!this.available() || typeof fetch !== 'function' || document.hidden) return;
    fetch((this.server() || location.origin) + '/online?id=' + this.onlineId, { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
      .then(m => { this.online = m && typeof m.n === 'number' ? m : null; this.showOnline(); }).catch(() => { this.online = null; this.showOnline(); });
  },
  onlineText() { const o = this.online; return o ? o.n + ' người đang online' + (o.inRoom ? ' · ' + o.inRoom + ' trong phòng' : '') : ''; },
  showOnline() { const e = document.getElementById('ol-count'); if (e) e.textContent = this.onlineText(); },
  // the game server: HB_SERVER (js/config.js) when the page is hosted elsewhere (e.g. Vercel), else this very site
  server() { return typeof HB_SERVER === 'string' ? HB_SERVER.trim().replace(/\/+$/, '') : ''; },
  wsUrl() {
    const s = this.server();
    return s ? s.replace(/^http/i, 'ws') : (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  },
  available() { return !!this.server() || location.protocol === 'http:' || location.protocol === 'https:'; },
  // ---------------- overlay ----------------
  $(id) { return document.getElementById(id); },
  // mode: 'drift' when opened from the drift menu (a new room starts as a drift room)
  open(code, mode) {
    if (mode) this.wantMode = mode;
    this.initUI();
    this.$('online').hidden = false;
    Game.state = 'online';
    if (!this.available()) {
      this.status('Chơi online cần chạy máy chủ: mở thư mục game trong terminal, gõ "npm install" rồi "npm start", sau đó vào http://localhost:3000', true);
      this.render(); return;
    }
    if (code) this.autoJoin = code;
    if (this.ws && this.ws.readyState === 1) { if (this.autoJoin) { this.join(this.autoJoin); this.autoJoin = null; } else this.send({ t: 'list' }); }
    else if (!this.ws) this.connect();   // (a connection already being opened just carries on)
    this.render();
  },
  close() {
    clearTimeout(this.retryT);
    if (this.room) this.send({ t: 'leave' });
    this.room = null;
    this.$('online').hidden = true;
    Game.state = 'menu';
  },
  hideOverlay() { this.$('online').hidden = true; },
  status(text, bad) { const s = this.$('ol-status'); s.textContent = text || ''; s.className = bad ? 'bad' : ''; },
  profile() {
    const s = Game.save;
    let name = this.$('ol-name').value.trim();
    if (!name) { name = 'Tay đua ' + (10 + Math.floor(Math.random() * 90)); this.$('ol-name').value = name; }
    try { localStorage.setItem('hb_name', name); } catch (e) { /* ignore */ }
    return { name, bike: s.bike, bikeHp: Math.max(1, Math.round(Game.bikeHp())), level: s.level, dcar: Game.dIdx(), dpaint: Game.carPaint(Game.dIdx()), dliv: Game.carLiv(Game.dIdx()),
      dal: Game.carAlign(Game.dIdx()) };   // (the drift car's wheel alignment: the others see its wheels set the same)
  },
  join(code) {
    code = String(code || '').trim().toUpperCase();
    if (code.length !== 4) { this.status('Mã phòng gồm 4 chữ cái.', true); return; }
    this.send(Object.assign({ t: 'join', code }, this.profile()));
  },
  initUI() {
    if (this.uiReady) return;
    this.uiReady = true;
    const $ = id => this.$(id);
    let saved = ''; try { saved = localStorage.getItem('hb_name') || ''; } catch (e) { /* ignore */ }
    $('ol-name').value = saved;
    $('ol-create').onclick = () => this.send(Object.assign({ t: 'create', mode: this.wantMode || 'bike' }, this.profile()));
    $('ol-join').onclick = () => this.join($('ol-code').value);
    $('ol-code').onkeydown = e => { if (e.key === 'Enter') this.join($('ol-code').value); };
    $('ol-back').onclick = () => { if (this.room) { this.send({ t: 'leave' }); this.room = null; this.render(); } else this.close(); };
    $('ol-ready').onclick = () => { const me = this.meInRoom(); if (me) this.send({ t: 'ready', v: !me.ready }); };
    $('ol-start').onclick = () => this.send({ t: 'start' });
    const stage = d => {   // the stage list of the room's mode
      const R = this.room; if (!R) return;
      if (R.mode === 'drift') this.send({ t: 'dmap', v: (R.dmap + d + DRIFT_MAPS.length) % DRIFT_MAPS.length });
      else this.send({ t: 'theme', v: (R.theme + d + this.themeCount()) % this.themeCount() });
    };
    $('ol-prev').onclick = () => stage(-1);
    $('ol-next').onclick = () => stage(1);
    $('ol-easy').onclick = () => this.send({ t: 'dhard', v: false });
    $('ol-hard').onclick = () => this.send({ t: 'dhard', v: true });
    $('ol-mbike').onclick = () => this.send({ t: 'mode', v: 'bike' });
    $('ol-mdrift').onclick = () => this.send({ t: 'mode', v: 'drift' });
    $('ol-copy').onclick = () => {
      const link = location.origin + location.pathname + '?room=' + this.room.code;
      const ok = () => this.status('Đã sao chép link mời - gửi cho bạn bè nhé!');
      if (navigator.clipboard) navigator.clipboard.writeText(link).then(ok, () => window.prompt('Link mời:', link));
      else window.prompt('Link mời:', link);
    };
  },
  themeCount() { return THEMES.length; },
  meInRoom() { return this.room && this.room.players.find(p => p.id === this.id); },
  render() {
    if (!this.uiReady) return;
    const $ = id => this.$(id), R = this.room, online = this.ws && this.ws.readyState === 1;
    $('ol-lobby').hidden = !!R; $('ol-room').hidden = !R;
    $('ol-back').textContent = R ? 'RỜI PHÒNG' : 'QUAY LẠI';
    for (const id of ['ol-create', 'ol-join']) $(id).disabled = !online;
    if (!R) {
      const L = $('ol-list'); L.innerHTML = '';
      if (!this.list.length) { L.innerHTML = '<div class="ol-empty">' + (online ? 'Chưa có phòng nào - hãy tạo phòng và mời bạn bè!' : '...') + '</div>'; return; }
      for (const r of this.list) {
        const row = document.createElement('div'); row.className = 'ol-item';
        const info = document.createElement('span');
        const stage = r.mode === 'drift' ? 'Drift · ' + (DRIFT_MAPS[r.dmap] || DRIFT_MAPS[0]).name + (r.dhard ? ' (khó)' : '') : THEMES[r.theme].name;
        info.textContent = r.code + ' · ' + r.host + ' · ' + r.n + '/' + r.max + ' người · ' + stage + (r.state === 'race' ? ' · đang đua' : '');
        const b = document.createElement('button'); b.textContent = 'VÀO'; b.disabled = r.state !== 'wait' || r.n >= r.max;
        b.onclick = () => this.join(r.code);
        row.append(info, b); L.append(row);
      }
      return;
    }
    const host = R.host === this.id, me = this.meInRoom();
    const drift = R.mode === 'drift';
    $('ol-rcode').textContent = R.code;
    $('ol-theme').textContent = drift ? (DRIFT_MAPS[R.dmap] || DRIFT_MAPS[0]).name : THEMES[R.theme].name;
    $('ol-prev').disabled = $('ol-next').disabled = !host;
    $('ol-mbike').disabled = $('ol-mdrift').disabled = !host;
    // drift difficulty (the host picks): easy = the road as it is, hard = half as wide
    $('ol-diff').hidden = !drift;
    $('ol-easy').disabled = $('ol-hard').disabled = !host;
    $('ol-easy').className = R.dhard ? '' : 'on'; $('ol-hard').className = R.dhard ? 'on' : '';
    $('ol-mbike').className = drift ? '' : 'on'; $('ol-mdrift').className = drift ? 'on' : '';
    $('ol-note').textContent = drift
      ? 'Tối đa 8 người, mỗi người một chiếc ô tô drift đang chọn trong gara. Xếp hạng theo điểm drift; drift sát xe người khác được điểm x1,5.'
      : 'Tối đa 8 người, tay đua máy lấp chỗ trống cho đủ 12 xe. Bạn đua bằng chiếc xe đang chọn trong cửa hàng.';
    const P = $('ol-players'); P.innerHTML = '';
    R.players.forEach((p, i) => {
      const row = document.createElement('div'); row.className = 'ol-item' + (p.id === this.id ? ' me' : '');
      const n = document.createElement('span'); n.textContent = (i + 1) + '. ' + p.name + (p.id === this.id ? ' (bạn)' : '');
      const bk = document.createElement('span'); bk.className = 'ol-bike';
      bk.textContent = drift ? (DRIFT_CARS[p.dcar] || DRIFT_CARS[0]).name : BIKES[p.bike].name;
      if (drift && p.dpaint) bk.style.borderLeft = '0.5em solid ' + p.dpaint, bk.style.paddingLeft = '0.3em';
      const st = document.createElement('span');
      st.className = 'ol-chip ' + (p.id === R.host ? 'host' : p.ready ? 'ok' : 'wait');
      st.textContent = p.id === R.host ? 'CHỦ PHÒNG' : p.ready ? 'SẴN SÀNG' : 'CHƯA SẴN SÀNG';
      row.append(n, bk, st); P.append(row);
    });
    const others = R.players.filter(p => p.id !== R.host), allReady = others.every(p => p.ready);
    $('ol-ready').hidden = host; $('ol-start').hidden = !host;
    $('ol-ready').textContent = me && me.ready ? 'HỦY SẴN SÀNG' : 'SẴN SÀNG';
    $('ol-start').disabled = !allReady;
    $('ol-wait').textContent = host ? (allReady ? (others.length ? 'Mọi người đã sẵn sàng!' : drift ? 'Bạn có thể chạy thử một mình, hoặc đợi bạn bè vào.' : 'Bạn có thể đua một mình với tay đua máy, hoặc đợi bạn bè vào.')
      : 'Đợi mọi người bấm SẴN SÀNG...') : 'Đợi chủ phòng bắt đầu...';
  },

  // ---------------- connection ----------------
  connect(retry) {
    clearTimeout(this.retryT);
    if (!retry) this.tries = 0;
    this.status(this.tries ? 'Đang đánh thức máy chủ online (lần đầu có thể mất khoảng 1 phút)...' : 'Đang kết nối máy chủ...');
    let ws;
    try { ws = this.ws = new WebSocket(this.wsUrl()); } catch (e) { this.status('Địa chỉ máy chủ online không hợp lệ: ' + this.server(), true); return; }
    let opened = false;
    ws.onopen = () => {
      opened = true; this.tries = 0;
      clearInterval(this.pinger);   // keep idle connections alive through hosting proxies
      this.pinger = setInterval(() => this.send({ t: 'ping', c: Date.now() }), 20000);
      this.status('');
      if (this.autoJoin) { this.join(this.autoJoin); this.autoJoin = null; } else this.send({ t: 'list' });
      this.render();
    };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (err) { return; } this.onMsg(m); };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null; this.room = null; this.list = [];
      // never got through: a free-tier host may still be waking up - keep trying for a couple of minutes
      if (!opened && Game.state === 'online' && ++this.tries < 40) { this.retryT = setTimeout(() => this.connect(true), 3000); this.render(); return; }
      if (['netrace', 'netres', 'netdrift', 'netdres'].includes(Game.state)) { this.view = null; this.dview = null; this.$('online').hidden = false; Game.state = 'online'; }
      if (Game.state === 'online') this.status('Mất kết nối với máy chủ. Bấm QUAY LẠI rồi vào lại CHƠI ONLINE.', true);
      this.render();
    };
  },
  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); },
  onMsg(m) {
    switch (m.t) {
      case 'hi': this.id = m.id; break;
      case 'list': this.list = m.rooms; this.render(); break;
      case 'room':
        if (!this.room) this.status('');
        this.room = m; this.render(); break;
      case 'err': this.status(m.msg, true); break;
      case 'start': this.onStart(m); break;
      case 's': this.onSnap(m); break;
      case 'end': this.onEnd(m); break;
      case 'dstart': this.onDriftStart(m); break;
      case 'dgo': if (this.dview) this.dview.hold = false; break;
      case 'dsn': this.onDriftSnap(m); break;
      case 'dend': this.onDriftEnd(m); break;
    }
  },

  // ---------------- the race ----------------
  onStart(m) {
    const v = new Race({ themeIdx: m.theme, level: m.level, seed: m.seed, humans: m.humans, roster: m.roster, view: true });
    v.player = v.humans.find(h => h.id === this.id) || v.humans[0];
    v.bikeIdx = v.player.style; v.bike = v.player.bike; v.shown = false;
    this.view = v; this.myIdx = v.racers.indexOf(v.player);
    this.pending = []; this.snaps = []; this.offset = null; this.err = { z: 0, x: 0 };
    this.predicting = false; this.loaded = false; this.menu = false; this.police = null;
    this.hideOverlay();
    Game.state = 'netrace';
    Sound.music.start();
  },
  // keys -> bits (see IN in race.js)
  readBits() {
    let k = 0;
    if (Input.is('left')) k |= IN.L;
    if (Input.is('right')) k |= IN.R;
    if (Input.is('up')) k |= IN.GAS;
    if (Input.is('down')) k |= IN.BRAKE;
    if (Input.is('wheelie')) k |= IN.WHEEL;
    if (Input.pressed('atkL')) k |= IN.ATKL;
    if (Input.pressed('atkR')) k |= IN.ATKR;
    return k;
  },
  latest() { return this.snaps[this.snaps.length - 1]; },
  // our bike is predicted while we race; while crashed / finished / during the countdown it just follows the server
  canPredict() {
    const L = this.latest(), P = this.view.player;
    return !!L && L.cd < 0 && !(L.R[this.myIdx][6] & 1) && !P.done;
  },
  update(dt) {
    const v = this.view; if (!v) return;
    const P = v.player;
    if (Input.pressed('pause')) this.menu = !this.menu;
    if (this.menu && Input.pressed('quit')) { this.quitRace(); return; }
    if (!this.loaded) return;
    const k = this.menu ? 0 : this.readBits(), inp = decodeInput(k);
    this.seq++;
    this.send({ t: 'in', s: this.seq, k });
    const pred = this.canPredict();
    if (pred !== this.predicting) { this.predicting = pred; this.rebase(); }
    this.pending.push({ s: this.seq, inp: v.state === 'racing' && !P.done ? inp : NO_INPUT });
    if (this.pending.length > 240) this.pending.shift();
    if (pred) {
      if (inp.atkL) v.startAttack(P, -1);
      if (inp.atkR) v.startAttack(P, 1);
      v.motion(P, inp, dt);
    }
    v.updateAttack(P, dt);   // our own swing animates at once (hits are decided by the server)
    this.interpolate();
    const decay = Math.exp(-dt * 10);
    this.err.z *= decay; this.err.x *= decay;
    v.shake = Math.max(0, v.shake - dt * 2);
    if (v.msgs.length) { v.msgs[0].t -= dt; if (v.msgs[0].t <= 0) v.msgs.shift(); }
    v.findTarget();
    Sound.voice(P.style);
    if (v.state === 'countdown') Sound.engine(Input.is('up') ? 0.75 : 0.12, 0.1);
    else Sound.engine(P.speed / P.top, P.crash ? 0.02 : 0.08 + 0.06 * P.speed / P.top);
  },
  // move our predicted bike onto the server's latest state, then replay the inputs it has not processed yet;
  // the jump is hidden by an offset that fades out over a few frames
  rebase() {
    const L = this.latest(), v = this.view, P = v.player; if (!L) return;
    const z0 = P.z, x0 = P.x;
    if (this.predicting) {
      const R = L.R[this.myIdx], me = L.me;
      Object.assign(P, { z: R[0], x: R[1], speed: R[2], pitch: R[4], leanF: me[0], lean: me[0], pitchV: me[1], wheelT: me[2], launch: me[8] || 0, vx: me[9] || 0, brakeT: me[10] || 0 });
      v.replaying = true;
      for (const p of this.pending) v.motion(P, p.inp, this.TICK);
      v.replaying = false;
    } else this.interpolate();
    this.err.z += z0 - P.z; this.err.x += x0 - P.x;
    if (Math.abs(this.err.z) > 3000 || Math.abs(this.err.x) > 1) this.err = { z: 0, x: 0 };
  },
  onSnap(m) {
    const v = this.view; if (!v) return;
    this.snaps.push(m);
    if (this.snaps.length > 40) this.snaps.shift();
    // clock: track the quickest arrival (least delayed snapshot), drift back slowly if the delay grows
    const off = m.n / 60 - performance.now() / 1000;
    if (this.offset === null || off > this.offset) this.offset = off; else this.offset += (off - this.offset) * 0.05;
    const P = v.player, R = m.R[this.myIdx], me = m.me;
    P.hp = R[5]; P.weapon = this.WEAPONS[R[9]]; P.inv = R[10]; P.rank = R[11]; P.finished = !!(R[6] & 2);
    this.crashState(P, R, R[13]);
    P.bikeHp = me[3]; P.kos = me[4]; P.place = me[5] || undefined; P.done = me[6] || null;
    this.pending = this.pending.filter(p => p.s > m.ack);
    if (this.predicting && this.canPredict()) this.rebase();
    for (const e of m.ev) {
      if (e.k === 'msg') { v.msg(e.text, e.col, e.dur, e.size); continue; }
      if (!e.to && Math.abs(e.z - P.z) > (FX_RANGE[e.k] || Infinity)) continue;
      Race.playFx(v, e.k);
    }
  },
  // put a rider between two snapshot rows (a, b) at fraction f
  applyRider(r, A, B, f) {
    const jump = Math.abs(B[0] - A[0]) > 4000, L = i => jump ? B[i] : A[i] + (B[i] - A[i]) * f, D = f < 0.5 ? A : B;
    r.z = L(0); r.x = L(1); r.speed = L(2); r.lean = r.leanF = L(3); r.pitch = L(4);
    r.hp = D[5]; this.crashState(r, D, A[12] === B[12] ? L(13) : D[13]); r.finished = !!(D[6] & 2); r.gone = !!(D[6] & 4);
    r.weapon = this.WEAPONS[D[9]]; r.inv = D[10]; r.rank = D[11];
    if (B[7] && A[7] === B[7] && B[8] >= A[8]) r.atk = { side: B[7], t: A[8] + (B[8] - A[8]) * f };
    else r.atk = D[7] ? { side: D[7], t: D[8] } : null;
  },
  // crash phase (0 thrown, 1 getting up, 2 running back, 3 lifting the bike), the side he stands on, lift progress
  crashState(r, row, lift) {
    if (!(row[6] & 1)) { r.crash = null; return; }
    const c = r.crash || (r.crash = { t: 0 }), code = row[12] || 1;
    c.ph = Math.abs(code) - 1; c.side = Math.sign(code); c.lift = lift || 0;
  },
  interpolate() {
    const v = this.view, sn = this.snaps; if (!sn.length) return;
    const t = performance.now() / 1000 + this.offset - this.INTERP;
    let i = sn.length - 1;
    while (i > 0 && sn[i].n / 60 > t) i--;
    if (i === sn.length - 1 && i > 0) i--;   // past the newest snapshot: extrapolate a little from the last pair
    const a = sn[i], b = sn[Math.min(i + 1, sn.length - 1)], ta = a.n / 60, tb = b.n / 60;
    const f = tb > ta ? U.clamp((t - ta) / (tb - ta), 0, 1.25) : 0, L = this.latest();
    v.time = a.time + (b.time - a.time) * Math.min(1, f);
    v.state = L.cd >= 0 ? 'countdown' : 'racing'; v.count = Math.max(0.001, L.cd);
    v.racers.forEach((r, k) => { if (!(r === v.player && this.predicting)) this.applyRider(r, a.R[k], b.R[k], f); });
    // police: a new generation number means a fresh police bike (no blending with the old one)
    if (!b.P) v.police = null;
    else {
      const C = this.police || (this.police = v.mkRider({ isPolice: true, name: 'CẢNH SÁT', pal: POLICE_PAL, hp: 70 + v.level * 15, style: 2 }));
      const pb = b.P.slice(1), pa = a.P && a.P[0] === b.P[0] ? a.P.slice(1) : pb;
      this.applyRider(C, pa, pb, f);
      v.police = C;
    }
    // traffic
    const ca = a.C, cb = b.C;
    v.cars.length = cb.length;
    for (let k = 0; k < cb.length; k++) {
      const B = cb[k], A = ca[k] && ca[k][0] === B[0] && ca[k][1] === B[1] && Math.abs(ca[k][2] - B[2]) < 6000 ? ca[k] : B;
      const c = v.cars[k] || (v.cars[k] = { kind: 'car' }), type = CAR_TYPES[B[0]];
      c.type = type; c.col = CAR_COLS[B[1]]; c.w = CAR_DIM[type].w; c.len = CAR_DIM[type].len;
      c.z = A[2] + (B[2] - A[2]) * f; c.x = A[3] + (B[3] - A[3]) * f;
    }
    // thrown riders
    v.bodies = b.B.map(B => {
      const A = a.B.find(x => x[0] === B[0]) || B, owner = B[0] < 0 ? this.police : v.racers[B[0]];
      const same = A[6] === B[6];   // the same phase: blend its clock and facing too
      return { owner, z: A[1] + (B[1] - A[1]) * f, x: A[2] + (B[2] - A[2]) * f, h: A[3] + (B[3] - A[3]) * f, rot: A[4] + (B[4] - A[4]) * f, vz: B[5] ? 100 : 0,
        mode: B[6] || 0, mt: same ? A[7] + (B[7] - A[7]) * f : B[7] || 0, face: same && Math.abs(B[8] - A[8]) < 1 ? A[8] + (B[8] - A[8]) * f : B[8] || 0 };
    }).filter(o => o.owner);
  },
  draw() {
    const v = this.view; if (!v) return;
    if (!v.shown) {   // one frame of "loading" while the 3D world for this track is built
      v.shown = true; Render.begin(); Game.dim(0.6);
      Render.text('ĐANG TẢI CHẶNG ĐUA...', W / 2, 140, 32, '#ffd23a', 'center');
      return;
    }
    const P = v.player;
    P.z += this.err.z; P.x += this.err.x;
    Render.frame(v, true);
    P.z -= this.err.z; P.x -= this.err.x;
    if (!this.loaded) { this.loaded = true; this.send({ t: 'loaded' }); }
    if (!this.snaps.length) {
      Game.dim(0.45); Render.text('ĐỢI NGƯỜI CHƠI KHÁC TẢI XONG...', W / 2, 120, 26, '#ffd23a', 'center');
      return;
    }
    Render.hud(v);
    if (P.done && P.done !== 'finished') Render.text('Bạn đã dừng cuộc đua - đợi mọi người về đích', W / 2, 110, 18, '#ffffff', 'center');
    if (this.menu) {
      Game.dim(0.5); Game.panel(116, 96, 280, 110);
      Render.text('ĐANG ĐUA ONLINE', W / 2, 102, 30, '#ffd23a', 'center');
      Render.text('ESC: tiếp tục đua', W / 2, 140, 20, '#ffffff', 'center');
      Render.text('Q: rời cuộc đua', W / 2, 166, 20, '#ff8a8a', 'center');
    }
  },
  quitRace() {
    this.send({ t: 'leave' });
    this.view = null; this.dview = null; this.room = null; this.menu = false;
    Sound.engine(0, 0); Sound.quiet();
    this.$('online').hidden = false; Game.state = 'online';
    this.send({ t: 'list' }); this.render();
  },
  // results: money, kills and bike damage go to the local save (online races do not count towards the level)
  onEnd(m) {
    const v = this.view; if (!v) return;
    const s = Game.save, me = m.me, mult = 1 + 0.5 * (me.level - 1);
    const reason = ['finished', 'busted', 'wrecked', 'timeout'].includes(me.done) ? me.done : 'quit';
    const res = { reason, online: true, place: me.place, prize: 0, bonus: 0, fine: 0, kos: me.kos, theme: v.theme.name,
      levelUp: false, qualified: false,
      rows: m.rows.map(r => ({ name: r.name, isPlayer: r.id === this.id, human: !!r.id, time: r.time === null ? Infinity : r.time })) };
    if (reason === 'finished') res.prize = Math.round(Game.PRIZES[me.place - 1] * mult);
    else if (reason === 'busted') res.fine = 600 * me.level;
    else if (reason === 'wrecked') res.fine = 900 * me.level;
    res.bonus = reason === 'quit' ? 0 : me.kos * 60 * me.level;
    s.money = Math.max(0, s.money + res.prize + res.bonus - res.fine);
    s.hp[s.bike] = me.bikeHp <= 0 || reason === 'wrecked' ? Math.round(BIKES[s.bike].dur * 0.4) : me.bikeHp;
    res.money = s.money;
    Game.store(); Game.res = res; Game.state = 'netres';
    this.view = null;
    Sound.engine(0, 0);
  },
  // ================= online drift =================
  onDriftStart(m) {
    const me = m.cars.find(c => c.id === this.id) || m.cars[0];
    const ci = U.clamp(me.car | 0, 0, DRIFT_CARS.length - 1);
    const r = new DriftRace({ mapIdx: U.clamp(m.map | 0, 0, DRIFT_MAPS.length - 1), carIdx: ci, paint: me.paint, liv: me.liv, al: me.al || Game.carAlign(ci), hard: !!m.hard,
      net: { me: this.id, cars: m.cars } });
    r.ready = false;   // the 3D models of all the cars first
    Promise.all(r.racers.map(c => Models.loadCar(c.spec.model))).then(() => { r.ready = true; }, () => { r.ready = true; });
    this.dview = r; this.dsnaps = []; this.offset = null; this.loaded = false; this.menu = false; this.finSent = false; this.sendT = 0;
    this.hideOverlay();
    Game.state = 'netdrift';
    Sound.music.stop();
  },
  // our car's state for the others: [x, z, heading, vx, vz, steer, flags, smoke, rear slide, front slide, progress
  // (segments), score, yaw rate, drift angle]; flags: 1 drifting, 2 handbrake, 4 braking, 8 nitro, 16 throttle,
  // 32 exhaust pop, 64 finished
  driftState() {
    const r = this.dview, c = r.car;
    const flags = (c.drifting ? 1 : 0) | (c.hand ? 2 : 0) | (c.brk > 0 ? 4 : 0) | (c.nitroOn ? 8 : 0) | (c.gas ? 16 : 0) | (c.backfire > 0 ? 32 : 0) | (c.fin ? 64 : 0);
    return [c.px, c.pz, c.psi, c.vx, c.vz, c.steer, flags, c.smoke, c.rearSlide, c.frontSlide, c.sAbs + c.al, r.score, c.w, c.beta];
  },
  onDriftSnap(m) {
    if (!this.dview) return;
    this.dsnaps.push(m);
    if (this.dsnaps.length > 40) this.dsnaps.shift();
    const off = m.n / 60 - performance.now() / 1000;
    if (this.offset === null || off > this.offset) this.offset = off; else this.offset += (off - this.offset) * 0.05;
  },
  // the other players' cars, ~INTERP s behind the newest relayed state
  interpDrift() {
    const r = this.dview, sn = this.dsnaps; if (!sn.length) return;
    const t = performance.now() / 1000 + this.offset - this.INTERP;
    let i = sn.length - 1;
    while (i > 0 && sn[i].n / 60 > t) i--;
    if (i === sn.length - 1 && i > 0) i--;
    const a = sn[i], b = sn[Math.min(i + 1, sn.length - 1)], ta = a.n / 60, tb = b.n / 60, L = sn[sn.length - 1];
    const f = tb > ta ? U.clamp((t - ta) / (tb - ta), 0, 1.25) : 0;
    const row = (s, id) => s.P.find(x => x[0] === id);
    const wrap = d => { while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
    for (const c of r.racers) {
      if (!c.remote) continue;
      const B = row(b, c.netId), A = row(a, c.netId) || B;
      if (!B) { if (c.seen && !row(L, c.netId)) c.gone = true; continue; }   // (left the race)
      c.seen = true; c.gone = false;
      const jump = Math.hypot(B[1] - A[1], B[2] - A[2]) > 30, l = k => jump ? B[k] : A[k] + (B[k] - A[k]) * f;
      c.px = l(1); c.pz = l(2); c.psi = jump ? B[3] : A[3] + wrap(B[3] - A[3]) * f;
      c.vx = l(4); c.vz = l(5); c.steer = l(6); c.w = l(13); c.beta = l(14);
      const F = B[7] | 0, sn2 = Math.sin(c.psi), cs2 = Math.cos(c.psi);
      c.u = c.vx * sn2 + c.vz * cs2; c.v = c.vx * cs2 - c.vz * sn2;
      c.drifting = !!(F & 1); c.hand = !!(F & 2); c.brk = F & 4 ? 1 : 0; c.nitroOn = !!(F & 8); c.gas = F & 16 ? 1 : 0;
      c.backfire = F & 32 ? 0.1 : 0; c.fin = F & 64 ? 1 : 0;
      c.smoke = l(8); c.rearSlide = l(9); c.frontSlide = l(10); c.wheelSpin = 0; c.sHint = l(11); c.score = Math.round(B[12]);
    }
  },
  updateDrift(dt) {
    const r = this.dview; if (!r) return;
    if (Input.pressed('pause')) this.menu = !this.menu;
    if (this.menu && Input.pressed('quit')) { this.quitRace(); return; }
    if (r.ready === false || !this.loaded) return;
    this.interpDrift();
    r.update(dt, this.menu ? { steer: 0, gas: false, brake: false } : DriftRace.readKeys());
    this.sendT -= dt;
    if (this.sendT <= 0) { this.sendT = 0.05; this.send({ t: 'dst', d: this.driftState() }); }
    if (r.over && !this.finSent) { this.finSent = true; this.send({ t: 'dfin', score: r.score, time: r.time }); }
  },
  drawDrift() {
    const r = this.dview; if (!r) return;
    if (r.ready === false || !r.shown) {   // the car models loading, then one frame while the stage is built
      if (r.ready !== false) r.shown = true;
      Render.begin(); Game.dim(0.6);
      Render.text(r.ready === false ? 'ĐANG TẢI XE...' : 'ĐANG TẢI CUNG ĐƯỜNG...', W / 2, 140, 32, '#ffd23a', 'center');
      return;
    }
    Render.frame(r, false); Render.driftHud(r);
    if (!this.loaded) { this.loaded = true; this.send({ t: 'loaded' }); }
    if (r.hold) { Game.dim(0.35); Render.text('ĐỢI NGƯỜI CHƠI KHÁC TẢI XONG...', W / 2, 120, 26, '#ffd23a', 'center'); }
    else if (r.over && r.over.t > 2) {
      const left = r.racers.filter(c => c.remote && !c.gone && !c.fin).length;
      Render.text(left ? 'Đợi ' + left + ' người nữa về đích (tối đa 75 giây)...' : 'Đang chốt bảng điểm...', W / 2, 150, 18, '#ffffff', 'center', W - 40);
    }
    if (this.menu) {
      Game.dim(0.5); Game.panel(116, 96, 280, 110);
      Render.text('ĐANG ĐUA ONLINE', W / 2, 102, 30, '#ffd23a', 'center');
      Render.text('ESC: tiếp tục đua', W / 2, 140, 20, '#ffffff', 'center');
      Render.text('Q: rời cuộc đua', W / 2, 166, 20, '#ff8a8a', 'center');
    }
  },
  // the final table from the server: money as offline (score, grade, a prize for the top three); online scores do not
  // touch the stage records
  onDriftEnd(m) {
    const r = this.dview; if (!r) return;
    const s = Game.save, rows = m.rows || [], place = Math.max(1, rows.findIndex(x => x.id === this.id) + 1), score = r.score;
    const grade = r.rank(score), prize = rows.length > 1 ? [3000, 1500, 600][place - 1] || 0 : 0;
    const money = Math.round(score / 10) + [0, 300, 800, 1500, 3000, 6000][grade + 1] + prize;
    s.money += money; Game.store();
    Game.dres = { map: r.def.name, car: DRIFT_CARS[r.carIdx].name, score, grade, money, rec: false, prev: Game.driftBest(r.mapIdx), best: r.best,
      hits: r.hits, bumps: r.car.bumps, time: r.time, quit: false, place, prize, online: true,
      table: rows.map(x => ({ name: x.id === this.id ? 'BẠN' : x.name + (x.left ? ' (đã rời)' : ''), score: x.score, paint: x.paint, me: x.id === this.id })) };
    Game.state = 'netdres';
    this.dview = null;
    Sound.quiet(); Sound.engine(0, 0);
  },
  // back from the results screen to the waiting room (with our repaired / damaged bike)
  backToRoom() {
    this.$('online').hidden = false; Game.state = 'online';
    if (this.room) this.send(Object.assign({ t: 'profile' }, this.profile()));
    else this.send({ t: 'list' });
    this.render();
  },
};

if (typeof document !== 'undefined') { Net.pollOnline(); setInterval(() => Net.pollOnline(), 20000); document.addEventListener('visibilitychange', () => Net.pollOnline()); }
