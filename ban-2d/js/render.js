'use strict';
// ============ Renderer: pseudo-3D road, sprites, dashboard HUD ============
const Render = {
  g: null, _dash: null,
  init(canvas) { this.g = canvas.getContext('2d'); this.g.imageSmoothingEnabled = false; },

  // one road segment, drawn scanline by scanline (crisp edges like 16-bit hardware)
  segment(seg, x1, y1, w1, x2, y2, w2, maxy, theme) {
    const g = this.g, col = seg.color, lanes = CFG.lanes;
    const top = Math.max(0, Math.ceil(y2)), bot = Math.min(maxy, Math.ceil(y1), CFG.viewH);
    if (bot <= top) return;
    for (let y = top; y < bot; y++) {
      const p = y1 === y2 ? 1 : (y - y2) / (y1 - y2);
      const x = x2 + (x1 - x2) * p, w = w2 + (w1 - w2) * p, sw = w / 9;
      g.fillStyle = col.grass; g.fillRect(0, y, W, 1);
      g.fillStyle = col.shoulder; g.fillRect(Math.round(x - w - sw), y, Math.round(2 * (w + sw)), 1);
      if (seg.checker) {
        const n = 14, cw = 2 * w / n, row = (seg.index * 2 + (p > 0.5 ? 1 : 0)) % 2;
        for (let i = 0; i < n; i++) {
          g.fillStyle = (i + row) % 2 ? '#141414' : '#f2f2f2';
          g.fillRect(Math.round(x - w + i * cw), y, Math.ceil(cw), 1);
        }
        continue;
      }
      g.fillStyle = col.road; g.fillRect(Math.round(x - w), y, Math.round(2 * w), 1);
      const ew = Math.max(1, Math.round(w / 40)), ei = Math.round(w * 0.035);
      g.fillStyle = '#e4e4e4';
      g.fillRect(Math.round(x - w) + ei, y, ew, 1);
      g.fillRect(Math.round(x + w) - ei - ew, y, ew, 1);
      if (col.lane) {
        const lw = Math.max(1, Math.round(w / 34)); g.fillStyle = col.lane;
        for (let l = 1; l < lanes; l++) g.fillRect(Math.round(x - w + 2 * w * l / lanes - lw / 2), y, lw, 1);
      }
    }
    if (seg.fog < 1) {
      g.globalAlpha = 1 - seg.fog; g.fillStyle = theme.fog;
      g.fillRect(0, top, W, bot - top); g.globalAlpha = 1;
    }
  },

  bg(img, off, oy) {
    const x = -Math.floor((((off % 1) + 1) % 1) * img.width), y = Math.round(oy - (200 - CFG.horizon));
    this.g.drawImage(img, x, y); this.g.drawImage(img, x + img.width, y);
  },

  sprite(img, px, scale, sx, sy, ox, oy, clipY) {
    const dw = img.width * px * scale * W / 2, dh = img.height * px * scale * W / 2;
    if (!(dw >= 1) || dw > W * 6) return;
    const dx = sx + dw * ox, dy = sy + dh * oy;
    const clipH = clipY ? Math.max(0, dy + dh - clipY) : 0;
    if (clipH >= dh) return;
    const srcH = Math.max(1, img.height - img.height * clipH / dh);
    this.g.drawImage(img, 0, 0, img.width, srcH, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh - clipH));
  },

  shadow(sx, sy, w, clipY) {
    if (clipY && sy > clipY) return;
    const g = this.g; g.fillStyle = 'rgba(0,0,20,0.33)';
    g.beginPath(); g.ellipse(sx, sy, Math.max(2, w), Math.max(1, w * 0.16), 0, 0, Math.PI * 2); g.fill();
  },

  frame(race) {
    const g = this.g, segs = race.segs, theme = race.theme, cam = race.cam;
    g.save();
    g.beginPath(); g.rect(0, 0, W, CFG.viewH); g.clip();
    if (race.shake > 0) g.translate(Math.round(U.rand(-3, 3) * race.shake * 3), Math.round(U.rand(-2, 2) * race.shake * 3));
    const pos = cam.z, base = race.findSeg(pos), basePct = U.pctRemain(pos, CFG.segL);
    const pSeg = race.findSeg(cam.focusZ), pPct = U.pctRemain(cam.focusZ, CFG.segL);
    const playerY = U.lerp(pSeg.p1.world.y, pSeg.p2.world.y, pPct);

    g.fillStyle = theme.sky[0]; g.fillRect(-10, -10, W + 20, CFG.viewH + 20);
    const oy = U.clamp(playerY * 0.0012, -35, 35);
    this.bg(race.bgs.sky, race.bgOff.sky, oy * 0.5);
    this.bg(race.bgs.far, race.bgOff.far, oy);
    this.bg(race.bgs.near, race.bgOff.near, oy * 1.5);

    let maxy = CFG.viewH, x = 0, dx = -(base.curve * basePct);
    const camX = cam.x * CFG.roadW, camY = playerY + CFG.camH, n0 = base.index;
    for (let n = 0; n < CFG.draw; n++) {
      const seg = segs[n0 + n]; if (!seg) break;
      seg.fog = U.fog(n / CFG.draw, CFG.fog); seg.clip = maxy;
      U.project(seg.p1, camX - x, camY, pos);
      U.project(seg.p2, camX - x - dx, camY, pos);
      x += dx; dx += seg.curve;
      if (seg.p1.camera.z <= CFG.camDepth || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
      this.segment(seg, seg.p1.screen.x, seg.p1.screen.y, seg.p1.screen.w,
        seg.p2.screen.x, seg.p2.screen.y, seg.p2.screen.w, maxy, theme);
      maxy = seg.p2.screen.y;
    }
    for (let n = CFG.draw - 1; n >= 0; n--) {
      const seg = segs[n0 + n]; if (!seg) continue;
      if (n > 0) {
        const sc = seg.p1.screen.scale;
        for (const s of seg.sprites) {
          const sx = seg.p1.screen.x + sc * s.offset * CFG.roadW * W / 2;
          this.sprite(s.img, s.img.px, sc, sx, seg.p1.screen.y, s.anchor === 'c' ? -0.5 : (s.offset < 0 ? -1 : 0), -1, seg.clip);
        }
      }
      const list = race.ents.get(seg.index);
      if (list) for (const e of list) this.entity(race, e, seg);
    }
    g.restore();
    g.drawImage(this.dashImg(), 0, CFG.viewH);
  },

  riderImg(race, r) {
    if (r.crash) return Spr.bikeDown(r.pal);
    let act = 0;
    if (r.atk) act = r.atk.t < 0.14 ? (r.atk.side < 0 ? 1 : 3) : (r.atk.side < 0 ? 2 : 4);
    const lean = Math.round(U.clamp(r.lean, -2, 2));
    return Spr.rider(r.pal, act, r.weapon, lean, r.isPolice ? Math.floor(race.time * 8) % 2 : 0);
  },

  entity(race, e, seg) {
    if (e === race.player) return this.drawPlayer(race, seg);
    if (e.z - race.cam.z < 120) return;
    if (e.inv > 0 && Math.floor(e.inv * 10) % 2) return;
    const pct = U.pctRemain(e.z, CFG.segL);
    const sc = U.lerp(seg.p1.screen.scale, seg.p2.screen.scale, pct);
    const sx = U.lerp(seg.p1.screen.x, seg.p2.screen.x, pct) + sc * e.x * CFG.roadW * W / 2;
    const sy = U.lerp(seg.p1.screen.y, seg.p2.screen.y, pct);
    const unit = sc * W / 2;
    let img;
    if (e.kind === 'rider') {
      img = this.riderImg(race, e);
      if (!e.crash) this.shadow(sx, sy, 140 * unit, seg.clip);
      this.sprite(img, img.px, sc, sx, sy, -0.5, -1, seg.clip);
    } else if (e.kind === 'car') {
      img = Spr.car(e.type, e.col, e.dir < 0);
      this.shadow(sx, sy, img.width * img.px * 0.52 * unit, seg.clip);
      this.sprite(img, img.px, sc, sx, sy, -0.5, -1, seg.clip);
    } else if (e.kind === 'body') {
      img = Spr.tumble(e.pal, e.frame);
      this.shadow(sx, sy, 110 * unit, seg.clip);
      this.sprite(img, img.px, sc, sx, sy - sc * e.h * H / 2, -0.5, -0.85, seg.clip);
    }
  },

  drawPlayer(race, pSeg) {
    const P = race.player;
    const pct = U.pctRemain(P.z, CFG.segL), sc = CFG.camDepth / CFG.playerZ;
    const camY = U.lerp(pSeg.p1.camera.y, pSeg.p2.camera.y, pct);
    const sy = CFG.horizon - sc * camY * H / 2, sx = W / 2;
    if (P.crash) { const b = Spr.bikeDown(P.pal); this.sprite(b, b.px, sc, sx, sy, -0.5, -1); return; }
    if (P.inv > 0 && Math.floor(P.inv * 10) % 2) return;
    const sp = P.speed / P.top;
    const bounce = Math.round((Math.random() * 2 - 1) * sp * (Math.abs(P.x) > 1 ? 2.5 : 0.7));
    const img = this.riderImg(race, P);
    this.shadow(sx, sy, 140 * sc * W / 2);
    this.sprite(img, img.px, sc, sx, sy + bounce, -0.5, -1);
  },

  // ---------------- HUD ----------------
  text(s, x, y, size, col, align, maxW) {
    const g = this.g;
    g.font = size + 'px ' + FONT; g.textAlign = align || 'left'; g.textBaseline = 'top';
    const draw = (dx, dy) => maxW ? g.fillText(s, x + dx, y + dy, maxW) : g.fillText(s, x + dx, y + dy);
    g.fillStyle = '#000'; draw(1, 1); draw(2, 2);
    g.fillStyle = col; draw(0, 0);
  },
  box(x, y, w, h, a) {
    const g = this.g;
    g.fillStyle = 'rgba(0,0,0,' + (a === undefined ? 0.55 : a) + ')'; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y, w, 1);
  },
  bar(x, y, w, h, f, col) {
    const g = this.g; f = U.clamp(f, 0, 1);
    g.fillStyle = '#000'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = '#3a1010'; g.fillRect(x, y, w, h);
    g.fillStyle = f < 0.3 ? '#e83030' : col; g.fillRect(x, y, Math.round(w * f), h);
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x, y, Math.round(w * f), 1);
    g.fillStyle = 'rgba(0,0,0,0.4)'; for (let i = x + 4; i < x + w; i += 4) g.fillRect(i, y, 1, h);
  },
  pline(x0, y0, x1, y1, col) {
    const g = this.g, n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) || 1;
    g.fillStyle = col;
    for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1);
  },
  needle(cx, cy, f) {
    const a = Math.PI * 0.75 + U.clamp(f, 0, 1) * Math.PI * 1.5, ex = cx + Math.cos(a) * 15, ey = cy + Math.sin(a) * 15;
    this.pline(cx + 1, cy + 1, ex + 1, ey + 1, '#000');
    this.pline(cx, cy, ex, ey, '#ff3a2a'); this.pline(cx + (Math.abs(Math.sin(a)) > 0.7 ? 1 : 0), cy + (Math.abs(Math.sin(a)) > 0.7 ? 0 : 1), ex, ey, '#c01a10');
    this.g.fillStyle = '#c8c8d0'; this.g.fillRect(cx - 2, cy - 2, 4, 4);
  },
  dashImg() {
    if (this._dash) return this._dash;
    const { Buf, ramp } = Art, b = new Buf(W, H - CFG.viewH), hh = H - CFG.viewH;
    const steel = ramp('#5a5e6a', { sh: 0.8, hl: 0.5 }), face = ramp('#18181e', { sh: 0.5, hl: 0.35 });
    const chrome = ramp('#a8b2c0', { hl: 0.9 }), lcd = ramp('#10181c', { sh: 0.4, hl: 0.25 });
    b.rect(0, 0, W, hh, steel, [0.6, 0.28], { tex: 0.06 });
    b.rect(0, 0, W, 2, steel, 0.95); b.rect(0, hh - 2, W, 2, steel, 0.05);
    for (const cx of [30, 78]) { b.blob(cx, 24, 21, 21, chrome, { gloss: 0.6 }); b.blob(cx, 24, 18, 18, face, { amb: 0.55 }); }
    for (const [x, w] of [[104, 196], [306, 202]]) { b.rect(x - 1, 3, w + 2, 42, steel, 0.1); b.rect(x, 4, w, 40, lcd, [0.4, 0.2]); }
    const c = b.canvas(), g = c.getContext('2d');
    for (const [cx, red] of [[30, 11], [78, 11]]) for (let i = 0; i <= 14; i++) {
      const a = Math.PI * 0.75 + i / 14 * Math.PI * 1.5;
      g.fillStyle = i >= red ? '#ff4a3a' : '#e8e8e8';
      for (let r = i % 2 ? 15 : 13; r <= 17; r++) g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(24 + Math.sin(a) * r), 1, 1);
    }
    return this._dash = c;
  },
  hud(race) {
    const g = this.g, P = race.player, Y = CFG.viewH;
    const kmh = Math.round(P.speed / 60), sp = P.speed / P.top;
    const gear = Math.min(4, Math.floor(sp * 5)), rpm = P.speed < 30 ? 0.12 : 0.3 + (sp * 5 - gear) * 0.62;
    this.needle(30, Y + 24, kmh / 280); this.needle(78, Y + 24, rpm);
    this.text(String(kmh), 30, Y + 27, 13, '#ffd23a', 'center');
    this.text(String(gear + 1), 78, Y + 27, 13, '#ffd23a', 'center');
    this.text('BẠN', 108, Y + 4, 13, '#ffd23a'); this.bar(138, Y + 9, 156, 5, P.hp / P.maxHp, '#3ad84a');
    this.text('XE', 108, Y + 16, 13, '#ffd23a'); this.bar(138, Y + 21, 156, 5, P.bikeHp / P.bikeMax, '#f0b020');
    const T = race.target;
    if (T) {
      this.text(T.name, 108, Y + 28, 13, T.isPolice ? '#7ab0ff' : '#ff9a9a', 'left', 76);
      this.bar(188, Y + 33, 106, 5, T.hp / T.maxHp, T.isPolice ? '#4a8cff' : '#e05050');
    } else this.text('KHÔNG CÓ ĐỐI THỦ GẦN', 108, Y + 28, 13, '#6a7078', 'left', 186);
    this.text('HẠNG ' + P.rank + '/' + race.racers.length, 310, Y + 3, 17, '#ffffff', 'left', 100);
    this.text(U.fmtTime(race.time), 504, Y + 3, 17, '#ffffff', 'right', 84);
    const km = Math.max(0, (race.finishZ - P.z) / 216000);
    this.text('CÒN ' + km.toFixed(1) + ' KM', 310, Y + 19, 13, '#9fe0ff', 'left', 100);
    if (P.weapon) this.text('VŨ KHÍ: ' + (P.weapon === 'chain' ? 'XÍCH' : 'GẬY'), 504, Y + 19, 13, '#7fff7f', 'right', 90);
    const bx = 312, bw = 184, by = Y + 36;
    g.fillStyle = '#4a5058'; g.fillRect(bx, by + 2, bw, 1);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(bx + bw + 1 + i * 2, by - 1 + j * 2, 2, 2); }
    const prog = r => U.clamp((r.z - race.startZ) / (race.finishZ - race.startZ), 0, 1);
    for (const r of race.riders()) {
      if (r === P) continue;
      g.fillStyle = r.isPolice ? '#4a8cff' : r.crash ? '#666' : '#e04848';
      g.fillRect(Math.round(bx + prog(r) * bw) - 1, by, 2, 5);
    }
    g.fillStyle = '#ffd23a'; g.fillRect(Math.round(bx + prog(P) * bw) - 2, by - 1, 4, 7);

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
