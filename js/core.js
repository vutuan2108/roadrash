'use strict';
// ============ Core: constants, math utils, input, sound ============
const W = 512, H = 320;
const FONT = 'VT323, "Courier New", monospace';

const CFG = {
  segL: 200,        // segment length (world units)
  rumble: 3,        // segments per rumble strip
  roadW: 2000,      // half road width
  lanes: 2,
  fov: 100,
  camH: 1000,
  draw: 300,        // draw distance (segments)
  fog: 5,
  viewH: 272,       // road view height (dashboard below)
  horizon: 136,     // screen y of the flat-road horizon
};
CFG.camDepth = 1 / Math.tan((CFG.fov / 2) * Math.PI / 180);
CFG.playerZ = CFG.camH * CFG.camDepth * (H / 2) / (CFG.viewH - 4 - CFG.horizon);
// ---- 3D world scale (three.js uses metres) ----
CFG.KZ = 1 / 216;   // metres per unit along the road (216000 units = 1 km, so speed/60 = km/h)
CFG.KX = 5;         // metres per half road-width (x = ±1 is the road edge, road is 10 m wide)
CFG.KY = 1 / 1500;  // metres per unit of road elevation
CFG.KH = 1 / 320;   // metres per unit of crash-body height
CFG.KC = 0.0022;    // heading change (radians) per unit of curve per segment
CFG.headMax = 1.2;  // the road never turns more than this from its start direction (no self-crossing)

const U = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, p) => a + (b - a) * p,
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: a => a[Math.floor(Math.random() * a.length)],
  easeIn: (a, b, p) => a + (b - a) * p * p,
  easeInOut: (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5),
  pctRemain: (n, t) => (n % t) / t,
  fog: (d, dens) => 1 / Math.pow(Math.E, d * d * dens),
  overlap(x1, w1, x2, w2) {
    return !(x1 + w1 / 2 < x2 - w2 / 2 || x1 - w1 / 2 > x2 + w2 / 2);
  },
  project(p, cx, cy, cz) {
    p.camera.x = (p.world.x || 0) - cx;
    p.camera.y = (p.world.y || 0) - cy;
    p.camera.z = (p.world.z || 0) - cz;
    p.screen.scale = CFG.camDepth / p.camera.z;
    p.screen.x = Math.round(W / 2 + p.screen.scale * p.camera.x * W / 2);
    p.screen.y = Math.round(CFG.horizon - p.screen.scale * p.camera.y * H / 2);
    p.screen.w = Math.round(p.screen.scale * CFG.roadW * W / 2);
  },
  rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },
  rgb2hex(r, g, b) {
    return '#' + [r, g, b].map(v => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  },
  shade(h, amt) {
    const [r, g, b] = U.hex2rgb(h);
    return amt >= 0
      ? U.rgb2hex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt)
      : U.rgb2hex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
  },
  mix(h1, h2, p) {
    const a = U.hex2rgb(h1), b = U.hex2rgb(h2);
    return U.rgb2hex(a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p, a[2] + (b[2] - a[2]) * p);
  },
  fmtTime(t) {
    const m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  },
  money: n => '$' + Math.round(n).toLocaleString('en-US'),
};

// ---------------- Input ----------------
const Input = {
  down: {}, hit: {},
  map: {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
    atkL: ['KeyZ', 'KeyJ'], atkR: ['KeyX', 'KeyK'], wheelie: ['ShiftLeft', 'ShiftRight', 'Space'],
    ok: ['Enter', 'Space'], back: ['Escape', 'Backspace'],
    pause: ['Escape', 'KeyP'], mute: ['KeyM'], quit: ['KeyQ'], repair: ['KeyR'],
  },
  is(a) { return this.map[a].some(k => this.down[k]); },
  pressed(a) { return this.map[a].some(k => this.hit[k]); },
  endFrame() { this.hit = {}; },
};
addEventListener('keydown', e => {
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;   // typing in the online lobby
  if (!e.repeat) Input.hit[e.code] = true;
  Input.down[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  Sound.init();
});
addEventListener('keyup', e => { Input.down[e.code] = false; });
addEventListener('blur', () => { Input.down = {}; });
addEventListener('pointerdown', () => Sound.init());

// ---------------- Sound (WebAudio, procedural) ----------------
const Sound = {
  ac: null, master: null, eng: null, muted: false,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      const ac = this.ac = new (window.AudioContext || window.webkitAudioContext)();
      this.master = ac.createGain(); this.master.gain.value = 0.5; this.master.connect(ac.destination);
      const o1 = ac.createOscillator(), o2 = ac.createOscillator();
      const f = ac.createBiquadFilter(), g = ac.createGain();
      o1.type = 'sawtooth'; o2.type = 'square';
      o1.frequency.value = 50; o2.frequency.value = 25;
      f.type = 'lowpass'; f.frequency.value = 600; g.gain.value = 0;
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
      o1.start(); o2.start();
      this.eng = { o1, o2, f, g };
      const len = ac.sampleRate;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      this.music.init(this);
    } catch (e) { this.ac = null; }
  },
  engine(rpm, vol) {
    if (!this.eng) return;
    const t = this.ac.currentTime, f = 38 + rpm * 150;
    this.eng.o1.frequency.setTargetAtTime(f, t, 0.05);
    this.eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.eng.f.frequency.setTargetAtTime(300 + rpm * 1500, t, 0.05);
    this.eng.g.gain.setTargetAtTime(vol, t, 0.08);
  },
  noise(dur, vol, freq, q, dest) {
    if (!this.ac) return;
    const ac = this.ac, t = ac.currentTime;
    const s = ac.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.master);
    s.start(t); s.stop(t + dur);
  },
  tone(f0, f1, dur, vol, type, when, dest) {
    if (!this.ac) return;
    const ac = this.ac, t = when || ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },
  hit() { this.noise(0.15, 0.7, 900, 0.8); this.tone(170, 45, 0.16, 0.6, 'sine'); },
  whiff() { this.noise(0.12, 0.25, 2500, 2); },
  crash() { this.noise(0.9, 0.9, 500, 0.5); this.tone(120, 30, 0.6, 0.6, 'square'); },
  thud() { this.noise(0.25, 0.4, 300, 0.7); },
  beep(f, dur) { this.tone(f, f, dur || 0.15, 0.25, 'square'); },
  siren() { this.tone(700, 1100, 0.35, 0.12, 'triangle'); },
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
  },
};

// Simple procedural rock loop (E minor)
Sound.music = {
  on: false, step: 0, next: 0, timer: null, bpm: 140,
  init(S) {
    this.S = S;
    this.out = S.ac.createGain(); this.out.gain.value = 0.55; this.out.connect(S.master);
  },
  start() {
    const S = this.S;
    if (!S || !S.ac || this.on) return;
    this.on = true; this.step = 0; this.next = S.ac.currentTime + 0.1;
    this.timer = setInterval(() => this.tick(), 30);
  },
  stop() { this.on = false; clearInterval(this.timer); },
  tick() {
    const ac = this.S.ac, spb = 60 / this.bpm / 4;
    while (this.next < ac.currentTime + 0.12) {
      this.play(this.step, this.next);
      this.next += spb; this.step = (this.step + 1) % 64;
    }
  },
  LEAD: [
    64, -1, 67, -1, 69, -1, 67, 64, -1, -1, 71, -1, 69, 67, 64, -1,
    64, -1, 67, -1, 69, -1, 71, 74, -1, -1, 71, -1, 69, -1, -1, -1,
    67, -1, 71, -1, 74, -1, 71, 67, -1, -1, 74, -1, 76, 74, 71, -1,
    69, -1, 72, -1, 76, -1, 74, 72, 71, -1, 69, -1, 67, -1, 66, -1,
  ],
  ROOTS: [40, 40, 43, 45],
  play(s, t) {
    const S = this.S, o = this.out, hz = m => 440 * Math.pow(2, (m - 69) / 12);
    const bar = Math.floor(s / 16), st = s % 16;
    if (st % 2 === 0) {
      const n = this.ROOTS[bar] + ((st % 8 === 6) ? 12 : 0);
      S.tone(hz(n), hz(n), 0.16, 0.16, 'sawtooth', t, o);
    }
    const l = this.LEAD[s];
    if (l > 0) S.tone(hz(l), hz(l), 0.14, 0.06, 'square', t, o);
    if (st === 0 || st === 8 || st === 10) S.tone(150, 40, 0.12, 0.5, 'sine', t, o);
    if (st === 4 || st === 12) this.snare(t);
    if (st % 2 === 0) this.hat(t);
  },
  snare(t) {
    const ac = this.S.ac, s = ac.createBufferSource(); s.buffer = this.S.noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200;
    const g = ac.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t); s.stop(t + 0.13);
  },
  hat(t) {
    const ac = this.S.ac, s = ac.createBufferSource(); s.buffer = this.S.noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ac.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t + 0.001); s.stop(t + 0.05);
  },
};
