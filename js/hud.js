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
    this.text('CÒN ' + km.toFixed(1) + ' KM', 312, Y + 20, 13, '#9fe0ff', 'left', 100);
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
    }
    const m = race.msgs[0];
    if (m) {
      g.globalAlpha = Math.min(1, m.t * 3);
      this.text(m.text, W / 2, 70, m.size || 30, m.col, 'center', W - 40);
      g.globalAlpha = 1;
    }
  },
};
