'use strict';
// ============ Roadside props (man-made): houses, poles, fences, signs, lamps, buildings, gate ============
(() => {
  const { Buf, ramp } = Art;
  const M = Spr.makers;
  const RQ = {
    wood: ramp('#7a5434', { hl: 0.4 }), roof: ramp('#b8442c', { hl: 0.45 }), glass: ramp('#4a6a8c', { hl: 0.85 }),
    green: ramp('#3a7a4a'), white: ramp('#eeeeea', { sh: 0.6, hl: 0.3 }), red: ramp('#d02020', { hl: 0.5 }),
    metal: ramp('#6a6e78', { hl: 0.6 }), dark: ramp('#2a2a32', { hl: 0.3 }), yellow: ramp('#f5c400', { sh: 0.6, hl: 0.4 }),
    ceramic: ramp('#e8e8f0', { hl: 0.8 }), lamp: ramp('#fff2b0', { sh: 0.3, hl: 1 }), black: ramp('#141418', { hl: 0.2 }),
    win: ramp('#ffd870', { sh: 0.5, hl: 0.8 }), winB: ramp('#7ae0ff', { sh: 0.5, hl: 0.8 }),
  };
  const WALLS = ['#f2d36b', '#e9a3a3', '#9fd0e8', '#f0ece0', '#b9e0a5'];

  M.house = v => {
    const b = new Buf(160, 130), wall = ramp(WALLS[v % WALLS.length], { sh: 0.6, hl: 0.3 });
    b.rect(14, 56, 132, 74, wall, [0.72, 0.58], { tex: 0.08 });
    b.rect(118, 56, 28, 74, wall, [0.45, 0.35]);
    b.poly([[4, 60], [156, 60], [136, 16], [24, 16]], RQ.roof, { I: (x, y) => 0.42 + ((y % 6) < 2 ? -0.22 : 0.12) + (60 - y) / 220 });
    b.rect(4, 58, 152, 3, RQ.roof, 0.15);
    b.rect(14, 61, 132, 5, wall, 0.25);
    for (const x of [26, 100]) {
      b.rect(x - 2, 72, 30, 28, RQ.wood, 0.45);
      b.rect(x, 74, 26, 24, RQ.glass, [0.85, 0.3]);
      b.rect(x + 12, 74, 2, 24, RQ.wood, 0.4);
      b.rect(x - 9, 72, 6, 28, RQ.green, 0.5); b.rect(x + 29, 72, 6, 28, RQ.green, 0.5);
    }
    b.rect(66, 84, 28, 46, RQ.wood, [0.55, 0.35]); b.rect(68, 86, 11, 42, RQ.wood, 0.42); b.rect(81, 86, 11, 42, RQ.wood, 0.42);
    b.blob(78, 108, 1.5, 1.5, RQ.yellow, { gloss: 1 });
    return b.outline(0.3).canvas(17.6);
  };
  M.pole = () => {
    const b = new Buf(48, 220);
    b.cap(24, 219, 24, 10, 3.8, 2.8, RQ.wood, { tex: 0.3 });
    b.box(3, 22, 42, 5, RQ.wood, { r: 2, tex: 0.2 });
    for (const x of [7, 17, 31, 41]) b.blob(x, 19, 2, 3, RQ.ceramic, { gloss: 0.8 });
    b.box(16, 30, 16, 14, RQ.metal, { r: 4, gloss: 0.4 });
    return b.outline(0.35).canvas(15.6);
  };
  M.fence = () => {
    const b = new Buf(90, 40);
    for (const x of [6, 46, 84]) b.box(x - 3, 2, 7, 38, RQ.wood, { r: 2, tex: 0.25 });
    for (const y of [10, 24]) b.box(0, y, 90, 5, RQ.wood, { r: 2, tex: 0.25, bias: 0.05 });
    return b.outline(0.35).canvas(11.4);
  };
  const BOARDS = [
    ['CÀ PHÊ SỮA ĐÁ', 'NGON - RẺ', '#1a3a8a', '#ffd23a'], ['NƯỚC MÍA', 'SIÊU MÁT', '#1f7a2a', '#ffffff'],
    ['SỬA XE MÁY', 'MỞ 24/7', '#c01818', '#ffffff'], ['BÁNH MÌ', 'THƠM GIÒN', '#f0c020', '#8a1a1a'],
    ['NHÀ NGHỈ', 'MÁY LẠNH', '#6a2a8a', '#ffe0ff'], ['PHỞ BÒ', 'GIA TRUYỀN', '#f4f1e6', '#c01818'],
  ];
  M.billboard = v => {
    const bd = BOARDS[v % BOARDS.length], b = new Buf(160, 120);
    for (const x of [34, 126]) b.cap(x, 119, x, 60, 4, 4, RQ.metal, { gloss: 0.4 });
    b.box(2, 4, 156, 66, RQ.metal, { r: 4, gloss: 0.3 });
    b.rect(7, 9, 146, 56, ramp(bd[2], { sh: 0.6, hl: 0.4 }), [0.7, 0.45]);
    b.text(bd[0], 80, 16, 20, ramp(bd[3], { sh: 0.5, hl: 0.5 }), 0.7, 'center');
    b.text(bd[1], 80, 42, 15, ramp(bd[3], { sh: 0.5, hl: 0.5 }), 0.6, 'center');
    return b.outline(0.3).canvas(19);
  };
  M.sign = d => {
    const b = new Buf(40, 64);
    b.cap(20, 63, 20, 28, 1.8, 1.8, RQ.metal, { gloss: 0.5 });
    b.poly([[20, 1], [39, 20], [20, 39], [1, 20]], RQ.black, { I: 0.3 });
    b.poly([[20, 4], [36, 20], [20, 36], [4, 20]], RQ.yellow, { I: (x, y) => 0.75 - (x + y) / 160 });
    const s = d < 0 ? -1 : 1;
    for (const o of [-6, 5]) b.poly([[20 + (o - 4) * s, 12], [20 + (o + 3) * s, 20], [20 + (o - 4) * s, 28], [20 + (o - 1) * s, 20]], RQ.black, { I: 0.2 });
    return b.outline(0.35).canvas(13);
  };
  M.kmpost = () => {
    const b = new Buf(22, 34);
    b.box(2, 8, 18, 26, RQ.white, { r: 3 }); b.blob(11, 9, 9, 8, RQ.red, { gloss: 0.4 });
    b.rect(2, 9, 18, 6, RQ.red, 0.55); b.rect(6, 20, 10, 2, RQ.dark, 0.2); b.rect(6, 25, 10, 2, RQ.dark, 0.2);
    return b.outline(0.35).canvas(9);
  };
  M.post = () => {
    const b = new Buf(14, 34);
    b.box(2, 2, 10, 32, RQ.white, { r: 3 }); b.rect(2, 6, 10, 6, RQ.red, 0.6);
    return b.outline(0.35).canvas(10);
  };
  M.lamp = side => {
    const b = new Buf(64, 200), px = side < 0 ? 10 : 54, hx = side < 0 ? 56 : 8;
    b.cap(px, 199, px, 14, 3.4, 2.4, RQ.metal, { gloss: 0.4 });
    b.cap(px, 16, hx, 10, 1.8, 1.6, RQ.metal);
    b.box(hx - 8, 6, 16, 6, RQ.dark, { r: 2 }); b.box(hx - 6, 11, 12, 3, RQ.lamp, { r: 1, amb: 0.9 });
    const c = b.outline(0.35).canvas(17), g = c.getContext('2d');
    const gr = g.createRadialGradient(hx, 16, 1, hx, 16, 18);
    gr.addColorStop(0, 'rgba(255,240,170,0.5)'); gr.addColorStop(1, 'rgba(255,240,170,0)');
    g.fillStyle = gr; g.fillRect(hx - 18, 0, 36, 36);
    return c;
  };
  const BLD = ['#3a3860', '#4a3456', '#2c4256', '#50404a', '#344050'];
  const NEON = [['KARAOKE', '#ff3ab0'], ['KHÁCH SẠN', '#3af0ff'], ['BIA HƠI', '#ffd23a'], ['PHỞ 24H', '#7aff5a']];
  M.building = v => {
    const rnd = U.rng(v * 97 + 13), h = 250 + Math.floor(rnd() * 110), b = new Buf(180, h);
    const wall = ramp(BLD[v % BLD.length], { sh: 0.7, hl: 0.35 });
    b.rect(4, 12, 172, h - 12, wall, [0.6, 0.4], { tex: 0.06 });
    b.rect(140, 12, 36, h - 12, wall, 0.25);
    b.rect(2, 8, 176, 6, wall, 0.8); b.rect(30, 0, 30, 9, wall, 0.4);
    for (let y = 24; y < h - 44; y += 18) for (let x = 12; x < 168; x += 15) {
      const lit = rnd() < 0.42;
      b.rect(x - 1, y - 1, 11, 14, wall, 0.12);
      b.rect(x, y, 9, 12, lit ? (rnd() < 0.8 ? RQ.win : RQ.winB) : RQ.glass, lit ? [0.85, 0.6] : [0.3, 0.12]);
    }
    b.rect(60, h - 36, 60, 36, RQ.dark, 0.2); b.rect(64, h - 32, 52, 32, RQ.win, [0.9, 0.6]);
    const c = b.outline(0.3).canvas(30);
    if (v % 2 === 0) {
      const g = c.getContext('2d'), n = NEON[v % NEON.length];
      g.fillStyle = '#100818'; g.fillRect(20, h - 68, 140, 24);
      g.font = 'bold 17px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = n[1]; g.shadowBlur = 8; g.fillStyle = n[1]; g.fillText(n[0], 90, h - 56, 132);
    }
    return c;
  };
  Spr.gate = text => Spr.cached('g|' + text, () => {
    const b = new Buf(300, 130);
    for (const x of [8, 292]) b.cap(x, 129, x, 14, 5, 5, RQ.metal, { gloss: 0.7 });
    b.box(4, 8, 292, 40, RQ.red, { r: 6, gloss: 0.3 });
    for (let x = 6; x < 294; x += 6) { b.rect(x, 10, 6, 6, x % 12 ? RQ.black : RQ.white, 0.6); b.rect(x, 40, 6, 6, x % 12 ? RQ.white : RQ.black, 0.6); }
    b.text(text, 150, 17, 22, RQ.white, 0.85, 'center');
    return b.outline(0.3).canvas(16);
  });
})();
