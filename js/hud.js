'use strict';
// ============ Overlay canvas (HUD, dashboard, menus) on top of the three.js canvas ============
// All drawing uses a 512x320 logical space; the canvas itself is sized to the screen for crisp text.
const Render = {
  g: null, ov: null, wrap: null, k: 1, cssW: W, cssH: H, dpr: 1, q: 1, ema: 1 / 60, slowT: 0, fastT: 0, lastT: 0,

  init(overlay, gl) {
    this.ov = overlay; this.g = overlay.getContext('2d'); this.wrap = overlay.parentElement;
    World.init(gl);
    this.resize();
    addEventListener('resize', () => this.resize());
  },
  resize() {
    const r = this.wrap.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    this.cssW = Math.max(64, Math.round(r.width)); this.cssH = Math.max(40, Math.round(r.height));
    this.ov.width = Math.round(this.cssW * dpr); this.ov.height = Math.round(this.cssH * dpr);
    this.k = this.ov.width / W; this.dpr = Math.min(dpr, 1.5);
    World.resize(this.cssW, this.cssH, this.dpr * this.q);
  },
  // lower the 3D resolution when frames are slow, raise it again when there is headroom
  adapt(dt) {
    this.ema += (dt - this.ema) * 0.05;
    this.capT = (this.capT || 0) + dt;
    if (this.capT > 60) { this.qCap = 1; this.capT = 0; }   // now and then allow trying a higher resolution again
    if (this.ema > 1 / 42) { this.slowT += dt; this.fastT = 0; } else if (this.ema < 1 / 57) { this.fastT += dt; this.slowT = 0; } else { this.slowT = 0; this.fastT = 0; }
    if (this.slowT > 1.5 && this.q > 0.55) {   // too slow: drop resolution and remember that this level was too much
      this.qCap = this.q * 0.97; this.capT = 0; this.q = Math.max(0.55, this.q * 0.85); this.slowT = 0; this.resize();
    }
    const cap = Math.min(1, this.qCap || 1);
    if (this.fastT > 6 && this.q < cap) { this.q = Math.min(cap, this.q * 1.1); this.fastT = 0; this.resize(); }
  },
  begin() {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.ov.width, this.ov.height);
    g.setTransform(this.k, 0, 0, this.k, 0, 0); g.imageSmoothingEnabled = true;
  },
  // draw the 3D view of a race; dash = leave room for (and draw) the dashboard
  frame(race, dash) {
    const now = performance.now(), dt = this.lastT ? Math.min(0.1, (now - this.lastT) / 1000) : 1 / 60;
    this.lastT = now; this.adapt(dt);
    this.begin();
    World.render(race, dash ? 'race' : 'full', dt);
    if (dash) this.dash();
  },
  // rotating 3D bike inside a window of the overlay (shop)
  preview(bikeIdx, x, y, w, h, t) { this.g.clearRect(x, y, w, h); World.preview(bikeIdx, x, y, w, h, t); },
  carPreview(model, paint, x, y, w, h, t, al) { this.g.clearRect(x, y, w, h); World.carPreview(model, paint, x, y, w, h, t, al); },
  // the wheel alignment screen's 3D view (see World.alignPreview)
  alignPreview(model, paint, al, view, steer, x, y, w, h, t) { this.g.clearRect(x, y, w, h); return World.alignPreview(model, paint, al, view, steer, x, y, w, h, t); },

  // ================= drift mode HUD (full-screen 3D, no dashboard strip) =================
  driftHud(race) {
    const g = this.g, c = race.car, S = c.spec, kmh = Math.round(Math.hypot(c.vx, c.vz) * 3.6);
    // total score, record, time (top left)
    this.box(6, 6, 132, 50, 0.5);
    this.text('ĐIỂM', 12, 7, 12, '#9fe0ff');
    this.text(race.score.toLocaleString('en-US'), 12, 16, 24, '#ffffff', 'left', 122);
    const rec = Game.driftBest ? Game.driftBest(race.mapIdx) : 0;
    this.text('KỶ LỤC ' + rec.toLocaleString('en-US'), 12, 40, 12, '#ffd23a', 'left', 70);
    this.text(U.fmtTime(race.time), 132, 40, 12, '#e8e8e8', 'right', 50);
    // the field by score (computer drivers on the stage): rank, name, score; the player's row lit
    if (race.racers.length > 1) {
      const ord = race.order(), rh = 11, y0 = 60;
      this.box(6, y0, 132, 14 + ord.length * rh, 0.45);
      this.text('BẢNG ĐIỂM', 12, y0 + 1, 11, '#9fe0ff');
      ord.forEach((c, i) => {
        const y = y0 + 13 + i * rh, col = c.isPlayer ? '#ffd23a' : c.fin ? '#8a96a8' : '#e8e8e8';
        g.fillStyle = c.paint; g.fillRect(12, y + 3, 4, 6);
        this.text((i + 1) + '. ' + c.name + (c.fin && !c.isPlayer ? ' ✓' : ''), 19, y, 11, col, 'left', 70);
        this.text(c.score.toLocaleString('en-US'), 132, y, 11, col, 'right', 44);
      });
    }
    // the drift chain (top centre): points x multiplier, angle, and how long before it banks
    const C = race.chain;
    if (C) {
      const pts = Math.round(C.pts), col = C.near > 0 ? '#ffd23a' : '#ffffff';
      this.text(pts.toLocaleString('en-US'), W / 2 - 4, 8, 30, col, 'right', 150);
      this.rr(W / 2 + 2, 13, 34, 20, 4, ['#3a8a4a', '#2f7fbf', '#8a4ad0', '#d07a1a', '#d03030'][C.mult - 1] || '#d03030');
      this.text('x' + C.mult, W / 2 + 19, 12, 20, '#ffffff', 'center');
      if (C.ang > 0) this.text(Math.round(C.ang) + '°', W / 2 + 44, 14, 16, C.ang > 45 ? '#ff9a5a' : '#9fe0ff', 'left');
      const f = U.clamp(C.gap / DSCORE.gap, 0, 1);
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(W / 2 - 60, 40, 120, 3);
      g.fillStyle = f > 0 ? '#ff8a5a' : '#7fff7f'; g.fillRect(W / 2 - 60, 40, 120 * (f > 0 ? 1 - f : Math.min(1, (C.d % DSCORE.multD) / DSCORE.multD)), 3);
    }
    // little pop-up messages under it (+points, close to the rail, transitions, lost chains)
    race.pops.forEach((p, i) => {
      g.globalAlpha = Math.min(1, p.t * 2.5);
      this.text(p.text, W / 2, 48 + i * 15 - (1.4 - p.t) * 6, 15, p.col, 'center', 300);
      g.globalAlpha = 1;
    });
    // map (top right)
    this.driftMap(race);
    // progress: laps of the arena or what is left of the pass (bottom centre)
    const pr = race.progress(), bx = 150, bw = 212, by = H - 14;
    this.text(race.circuit ? 'VÒNG ' + race.lapOf() + '/' + race.laps : 'CÒN ' + Math.max(0, (race.finishZ - race.player.z) / 216000).toFixed(2) + ' KM',
      W / 2, by - 15, 13, '#9fe0ff', 'center');
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(bx - 1, by - 1, bw + 2, 6);
    g.fillStyle = '#ffd23a'; g.fillRect(bx, by, bw * pr, 4);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(bx + bw + 2 + i * 2, by - 1 + j * 2.5, 2, 2.5); }
    // nitro, gearbox, handbrake / clutch lamps (bottom left)
    this.box(6, H - 46, 128, 40, 0.45);
    this.text('NITRO', 12, H - 45, 12, c.nitroOn ? '#7ac8ff' : '#9fe0ff');
    this.bar(52, H - 40, 76, 5, c.nitro, '#3a9aff');
    const chip = (x, on, label, col) => {
      this.rr(x, H - 28, 38, 11, 2, on ? col : 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.25)');
      this.text(label, x + 19, H - 28, 10, on ? '#000' : '#7a828e', 'center', 36);
    };
    chip(12, c.hand, 'PHANH TAY', '#ff5a4a'); chip(53, c.clutch && race.state === 'racing', 'CÔN', '#ffd23a'); chip(94, c.nitroOn, 'N2O', '#5ab0ff');
    this.text((race.auto ? 'SỐ TỰ ĐỘNG' : 'SỐ TAY') + ' · CAM ' + (race.camMode + 1), 12, H - 15, 11, '#a8b8d0', 'left', 120);
    // tachometer with the gear in the middle and the speed under it (bottom right)
    const cx = W - 50, cy = H - 48, r = 38, red = S.redline, maxR = Math.ceil(red / 1000) + 1, ang = v => Math.PI * 0.75 + v / (maxR * 1000) * Math.PI * 1.5;
    const face = g.createRadialGradient(cx, cy - 10, 2, cx, cy, r);
    face.addColorStop(0, 'rgba(30,34,44,0.85)'); face.addColorStop(1, 'rgba(6,7,10,0.85)');
    g.fillStyle = face; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(255,50,40,0.8)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r - 4, ang(red * 0.9), ang(maxR * 1000)); g.stroke();
    g.lineCap = 'round';
    for (let k = 0; k <= maxR; k++) {
      const a = ang(k * 1000), hot = k * 1000 >= red * 0.9;
      g.strokeStyle = hot ? '#ff5a4a' : '#e8ecf2'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8)); g.lineTo(cx + Math.cos(a) * (r - 2.5), cy + Math.sin(a) * (r - 2.5)); g.stroke();
      this.text(String(k), cx + Math.cos(a) * (r - 14), cy + Math.sin(a) * (r - 14) - 5, 9, hot ? '#ff8a7a' : '#c8d0da', 'center');
    }
    const na = ang(Math.min(c.rpm, maxR * 1000));
    g.strokeStyle = '#ff3a22'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx - Math.cos(na) * 5, cy - Math.sin(na) * 5); g.lineTo(cx + Math.cos(na) * (r - 6), cy + Math.sin(na) * (r - 6)); g.stroke();
    g.fillStyle = '#2a2e36'; g.beginPath(); g.arc(cx, cy, 3, 0, 7); g.fill();
    const gear = c.shiftT > 0 ? 'N' : c.gear < 0 ? 'R' : String(c.gear);
    this.text(gear, cx, cy + 4, 24, c.rpm > red * 0.93 ? '#ff5a4a' : '#ffd23a', 'center');
    this.text(kmh + ' km/h', cx, cy + 27, 13, '#ffffff', 'center');
    if (c.rpm > red * 0.93 && Math.floor(performance.now() / 90) % 2) { g.fillStyle = '#ff3020'; g.beginPath(); g.arc(cx, cy - 18, 3, 0, 7); g.fill(); }
    // countdown and messages
    if (race.state === 'countdown' && !race.hold) {   // (online: no count until the server's go)
      const k = Math.ceil(race.count);
      this.text(String(k), W / 2, 90, 72, k === 1 ? '#ffd23a' : '#ff4040', 'center');
      this.text('Giữ ↑ để vê ga - đèn xanh là xe tự nhả côn bốc đi', W / 2, 166, 15, '#e8e8e8', 'center', W - 60);
    }
    const m = race.msgs[0];
    if (m) { g.globalAlpha = Math.min(1, m.t * 3); this.text(m.text, W / 2, 112, m.size || 30, m.col, 'center', W - 40); g.globalAlpha = 1; }
  },
  // the stage seen from above: the road, start / finish and the car (an arrow)
  driftMap(race) {
    const g = this.g, M = race.map;
    if (!race._mm) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const [x, z] of M) { x0 = Math.min(x0, -x); x1 = Math.max(x1, -x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      const s = Math.min(82 / (x1 - x0), 62 / (z1 - z0));
      race._mm = { s, ox: W - 52 - (x0 + x1) / 2 * s, oy: 43 + (z0 + z1) / 2 * s };
    }
    const { s, ox, oy } = race._mm, px = x => ox - x * s, py = z => oy - z * s;
    this.box(W - 98, 6, 92, 74, 0.45);
    g.lineJoin = 'round';
    for (const [col, lw] of [['rgba(0,0,0,0.75)', 3.4], ['#e8ecf2', 1.5]]) {
      g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
      M.forEach((p, i) => i ? g.lineTo(px(p[0]), py(p[1])) : g.moveTo(px(p[0]), py(p[1])));
      if (race.circuit) g.closePath();
      g.stroke();
    }
    const C = race.ctr, mark = (i, col) => { g.fillStyle = col; g.fillRect(px(C.X[i]) - 2, py(C.Z[i]) - 2, 4, 4); };
    mark(Math.round(race.lineZ / CFG.segL) % C.N, '#7fff7f');
    if (!race.circuit) mark(Math.min(C.N, Math.round(race.finishZ / CFG.segL)), '#ff5a4a');
    for (const o of race.racers) {
      if (o.isPlayer || o.gone) continue;
      g.fillStyle = '#000'; g.fillRect(px(o.px) - 2.2, py(o.pz) - 2.2, 4.4, 4.4);
      g.fillStyle = o.paint; g.fillRect(px(o.px) - 1.4, py(o.pz) - 1.4, 2.8, 2.8);
    }
    const c = race.car, x = px(c.px), y = py(c.pz);
    g.save(); g.translate(x, y); g.rotate(-c.psi);   // heading (sin psi, cos psi) shows as (-sin psi, -cos psi) on the map
    g.fillStyle = '#000'; g.beginPath(); g.moveTo(0, -5); g.lineTo(3.6, 3.4); g.lineTo(-3.6, 3.4); g.closePath(); g.fill();
    g.fillStyle = '#ffd23a'; g.beginPath(); g.moveTo(0, -3.8); g.lineTo(2.5, 2.4); g.lineTo(-2.5, 2.4); g.closePath(); g.fill();
    g.restore();
  },

  // ---------------- drawing helpers (logical coordinates) ----------------
  text(s, x, y, size, col, align, maxW) {
    const g = this.g;
    g.font = size + 'px ' + FONT; g.textAlign = align || 'left'; g.textBaseline = 'top';
    const draw = (dx, dy) => maxW ? g.fillText(s, x + dx, y + dy, maxW) : g.fillText(s, x + dx, y + dy);
    g.fillStyle = 'rgba(0,0,0,0.85)'; draw(1, 1); draw(1.6, 1.6);
    g.fillStyle = col; draw(0, 0);
  },
  box(x, y, w, h, a) {
    const g = this.g;
    g.fillStyle = 'rgba(0,0,0,' + (a === undefined ? 0.55 : a) + ')'; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y, w, 0.75);
  },
  rr(x, y, w, h, r, fill, stroke) {
    const g = this.g;
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = 0.75; g.stroke(); }
  },
  bar(x, y, w, h, f, col) {
    const g = this.g; f = U.clamp(f, 0, 1);
    this.rr(x - 1, y - 1, w + 2, h + 2, 2, '#050608', 'rgba(255,255,255,0.15)');
    g.fillStyle = '#2a0e10'; g.fillRect(x, y, w, h);
    const c = f < 0.3 ? '#e83030' : col, gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, U.shade(c, 0.45)); gr.addColorStop(0.5, c); gr.addColorStop(1, U.shade(c, -0.35));
    g.fillStyle = gr; g.fillRect(x, y, w * f, h);
    g.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = x + 6; i < x + w; i += 6) g.fillRect(i, y, 0.6, h);
  },
  gauge(cx, cy, r, red) {
    const g = this.g;
    const ring = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    ring.addColorStop(0, '#f0f4fa'); ring.addColorStop(0.45, '#7a828e'); ring.addColorStop(1, '#2a2e36');
    g.fillStyle = ring; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    const face = g.createRadialGradient(cx, cy - r * 0.4, 1, cx, cy, r);
    face.addColorStop(0, '#2a2e38'); face.addColorStop(1, '#07080a');
    g.fillStyle = face; g.beginPath(); g.arc(cx, cy, r - 2.2, 0, 7); g.fill();
    g.lineCap = 'round';
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * 0.75 + i / 14 * Math.PI * 1.5, r0 = i % 2 ? r - 6 : r - 7.5;
      g.strokeStyle = i >= red ? '#ff4a3a' : '#e8ecf2'; g.lineWidth = i % 2 ? 0.6 : 1.1;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * (r - 3.5), cy + Math.sin(a) * (r - 3.5)); g.stroke();
    }
    g.strokeStyle = 'rgba(255,60,40,0.55)'; g.lineWidth = 1.6;
    g.beginPath(); g.arc(cx, cy, r - 4.2, Math.PI * 0.75 + red / 14 * Math.PI * 1.5, Math.PI * 2.25); g.stroke();
  },
  needle(cx, cy, f, len) {
    const g = this.g, a = Math.PI * 0.75 + U.clamp(f, 0, 1) * Math.PI * 1.5;
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(cx + 0.8, cy + 0.8); g.lineTo(cx + Math.cos(a) * len + 0.8, cy + Math.sin(a) * len + 0.8); g.stroke();
    g.strokeStyle = '#ff3a22'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(cx - Math.cos(a) * 3, cy - Math.sin(a) * 3); g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); g.stroke();
    const cap = g.createRadialGradient(cx - 0.8, cy - 0.8, 0.2, cx, cy, 3);
    cap.addColorStop(0, '#f4f6fa'); cap.addColorStop(1, '#4a505a');
    g.fillStyle = cap; g.beginPath(); g.arc(cx, cy, 2.6, 0, 7); g.fill();
  },
  dash() {
    const g = this.g, Y = CFG.viewH, h = H - Y;
    const gr = g.createLinearGradient(0, Y, 0, H);
    gr.addColorStop(0, '#4a4f5a'); gr.addColorStop(0.06, '#2c3038'); gr.addColorStop(0.5, '#1c1f25'); gr.addColorStop(1, '#0c0d10');
    g.fillStyle = gr; g.fillRect(0, Y, W, h);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, Y, W, 0.6);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, Y + 0.6, W, 0.8);
    for (const [x, w] of [[104, 196], [306, 202]]) {
      const lg = g.createLinearGradient(0, Y + 4, 0, Y + 44);
      lg.addColorStop(0, '#0e161c'); lg.addColorStop(1, '#05080a');
      this.rr(x, Y + 3.5, w, 41, 3.5, lg, 'rgba(160,180,200,0.35)');
    }
    this.gauge(30, Y + 24, 21, 11); this.gauge(78, Y + 24, 21, 11);
  },

  // circuit map, top right: the lap outline, the start line and everybody's position
  miniMap(race) {
    const g = this.g, M = race.map, N = race.lapN;
    if (!race._mm) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const [x, z] of M) { x0 = Math.min(x0, -x); x1 = Math.max(x1, -x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      const s = Math.min(80 / (x1 - x0), 60 / (z1 - z0));
      race._mm = { s, ox: W - 52 - (x0 + x1) / 2 * s, oy: 43 + (z0 + z1) / 2 * s };   // map x = -world x: right turns go right
    }
    const { s, ox, oy } = race._mm, px = p => ox - p[0] * s, py = p => oy - p[1] * s;
    const at = z => M[Math.min(M.length - 1, Math.floor((((Math.floor(z / CFG.segL)) % N) + N) % N / 12))];
    this.box(W - 98, 6, 92, 74, 0.45);
    g.lineJoin = 'round';
    for (const [col, lw] of [['rgba(0,0,0,0.75)', 3.4], ['#e8ecf2', 1.5]]) {
      g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
      M.forEach((p, i) => i ? g.lineTo(px(p), py(p)) : g.moveTo(px(p), py(p)));
      g.closePath(); g.stroke();
    }
    const L = at(race.lineZ);
    g.fillStyle = '#111'; g.fillRect(px(L) - 3, py(L) - 3, 6, 6); g.fillStyle = '#fff'; g.fillRect(px(L) - 3, py(L) - 3, 3, 3); g.fillRect(px(L), py(L), 3, 3);
    const P = race.player;
    for (const r of race.riders()) {
      if (r === P || r.gone) continue;
      const p = at(r.z);
      g.fillStyle = r.crash ? '#777' : r.isPlayer ? '#7fff7f' : '#ff4a4a';
      g.beginPath(); g.arc(px(p), py(p), 1.7, 0, 7); g.fill();
    }
    const p = at(P.z);
    g.fillStyle = '#000'; g.beginPath(); g.arc(px(p), py(p), 3.3, 0, 7); g.fill();
    g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(px(p), py(p), 2.5, 0, 7); g.fill();
  },

  hud(race) {
    const g = this.g, P = race.player, Y = CFG.viewH;
    const kmh = Math.round(P.speed / 60), sp = Math.min(1, P.speed / P.top);
    const gear = Math.min(4, Math.floor(sp * 5)), rpm = P.speed < 30 ? 0.12 : 0.3 + (sp * 5 - gear) * 0.62;
    this.text(String(kmh), 30, Y + 28, 12, '#ffd23a', 'center');
    this.text(String(gear + 1), 78, Y + 28, 12, '#ffd23a', 'center');
    this.text('km/h', 30, Y + 9, 8, '#9aa4b0', 'center'); this.text('x1000', 78, Y + 9, 8, '#9aa4b0', 'center');
    this.needle(30, Y + 24, kmh / 280, 16); this.needle(78, Y + 24, rpm, 16);
    this.text('BẠN', 110, Y + 5, 13, '#ffd23a'); this.bar(140, Y + 9, 154, 5, P.hp / P.maxHp, '#3ad84a');
    this.text('XE', 110, Y + 17, 13, '#ffd23a'); this.bar(140, Y + 21, 154, 5, P.bikeHp / P.bikeMax, '#f0b020');
    const Tg = race.target;
    if (Tg) {
      this.text(Tg.name, 110, Y + 29, 13, Tg.isPolice ? '#7ab0ff' : '#ff9a9a', 'left', 74);
      this.bar(188, Y + 33, 106, 5, Tg.hp / Tg.maxHp, Tg.isPolice ? '#4a8cff' : '#e05050');
    } else this.text('KHÔNG CÓ ĐỐI THỦ GẦN', 110, Y + 29, 13, '#6a7078', 'left', 184);
    this.text('HẠNG ' + P.rank + '/' + race.racers.length, 312, Y + 4, 17, '#ffffff', 'left', 100);
    this.text(U.fmtTime(race.time), 502, Y + 4, 17, '#ffffff', 'right', 84);
    const km = Math.max(0, (race.finishZ - P.z) / 216000);
    if (race.circuit) this.text('VÒNG ' + race.lapOf(P) + '/' + race.laps + '  ·  ' + km.toFixed(1) + ' KM', 312, Y + 20, 13, '#9fe0ff', 'left', 100);
    else this.text('CÒN ' + km.toFixed(1) + ' KM', 312, Y + 20, 13, '#9fe0ff', 'left', 100);
    if (race.map) this.miniMap(race);
    if (P.weapon) this.text('VŨ KHÍ: ' + (P.weapon === 'chain' ? 'XÍCH' : 'GẬY'), 502, Y + 20, 13, '#7fff7f', 'right', 90);
    const bx = 314, bw = 180, by = Y + 37;
    g.fillStyle = '#4a5058'; g.fillRect(bx, by + 2, bw, 1);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(bx + bw + 1 + i * 2, by - 1 + j * 2, 2, 2); }
    const prog = r => U.clamp((r.z - race.startZ) / (race.finishZ - race.startZ), 0, 1);
    for (const r of race.riders()) {
      if (r === P || r.gone) continue;
      g.fillStyle = r.isPolice ? '#4a8cff' : r.crash ? '#666' : r.isPlayer ? '#7fff7f' : '#e04848';   // green = other online players
      g.fillRect(bx + prog(r) * bw - 1, by, 2, 5);
    }
    g.fillStyle = '#ffd23a'; g.fillRect(bx + prog(P) * bw - 2, by - 1, 4, 7);

    if (P.wheelT > 0.3 && !P.crash) {   // wheelie timer, top-left
      this.text('BỐC ĐẦU ' + P.wheelT.toFixed(1) + 's', 12, 8, 20, '#ffd23a', 'left');
      this.bar(14, 32, 96, 4, P.pitch / WHEELIE.max, P.pitch > 0.7 ? '#ff6040' : '#ffd23a');
    }
    if (race.state === 'countdown') {
      const c = Math.ceil(race.count);
      this.text(String(c), W / 2, 40, 72, c === 1 ? '#ffd23a' : '#ff4040', 'center');
      const held = Input.is('wheelie');   // wheelie launch: hold the button as the lights go green
      this.text(held ? 'SẴN SÀNG BỐC ĐẦU XUẤT PHÁT!' : 'Giữ SPACE / SHIFT để xuất phát bốc đầu', W / 2, 118, 17, held ? '#7fff7f' : '#e8e8e8', 'center', W - 60);
    }
    const m = race.msgs[0];
    if (m) {
      g.globalAlpha = Math.min(1, m.t * 3);
      this.text(m.text, W / 2, 70, m.size || 30, m.col, 'center', W - 40);
      g.globalAlpha = 1;
    }
  },
};
