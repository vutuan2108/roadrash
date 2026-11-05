'use strict';
// ============ Traffic: sedans, vans, trucks, police car (rear + front views) ============
(() => {
  const { Buf, ramp } = Art;
  const CPX = 4.0;
  const RC = {
    tire: ramp('#34343a', { sh: 0.9, hl: 0.2 }), chrome: ramp('#b0b8c4', { hl: 0.95 }),
    glass: ramp('#3a5a84', { sh: 0.85, hl: 0.8 }), black: ramp('#2a2a30', { hl: 0.35 }),
    red: ramp('#d01818', { hl: 0.75 }), light: ramp('#fff2c0', { sh: 0.4, hl: 1 }), amber: ramp('#ff9a1a', { hl: 0.7 }),
    plate: ramp('#e8e2c0', { sh: 0.5 }), grill: ramp('#3a3a42', { hl: 0.4 }), blue: ramp('#2a5aff', { hl: 0.9 }),
    box: ramp('#c8c8c0', { sh: 0.7, hl: 0.4 }),
  };
  const glassI = (top, bot) => (x, y) => 0.25 + (bot - y) / (bot - top) * 0.6;

  function sedan(b, P, front, police) {
    for (const x of [12, 136]) b.box(x, 108, 28, 30, RC.tire, { r: 6, tex: 0.12 });
    b.box(4, 58, 168, 48, P, { r: 16, gloss: 0.7, shin: 14 });
    b.poly([[24, 64], [152, 64], [138, 22], [38, 22]], P, { I: (x, y) => 0.5 + (64 - y) / 110 });
    b.box(38, 14, 100, 12, P, { r: 5, gloss: 0.8 });
    b.poly([[33, 60], [143, 60], [132, 27], [44, 27]], RC.glass, { I: glassI(27, 60) });
    b.poly([[64, 60], [78, 60], [94, 27], [82, 27]], RC.glass, { I: 0.92 });
    if (police) {
      b.rect(4, 82, 168, 24, RC.black, [0.3, 0.15], { only: true });
      b.box(54, 6, 34, 10, RC.red, { r: 3, gloss: 1, amb: 0.6 }); b.box(88, 6, 34, 10, RC.blue, { r: 3, gloss: 1, amb: 0.6 });
    }
    b.box(6, 98, 164, 18, front ? RC.chrome : RC.black, { r: 7, gloss: 0.6 });
    if (front) {
      for (const x of [10, 132]) b.box(x, 70, 34, 14, RC.light, { r: 4, gloss: 1, amb: 0.75 });
      b.box(52, 72, 72, 18, RC.grill, { r: 3 });
      for (let x = 56; x < 122; x += 5) b.rect(x, 74, 2, 14, RC.chrome, 0.8);
      b.blob(88, 81, 5, 4, RC.chrome, { gloss: 1 });
    } else {
      for (const x of [10, 130]) b.box(x, 68, 36, 13, RC.red, { r: 3, gloss: 1, amb: 0.45 });
      b.box(16, 71, 10, 7, RC.amber, { r: 2, gloss: 1 }); b.box(150, 71, 10, 7, RC.amber, { r: 2, gloss: 1 });
      b.rect(70, 86, 36, 12, RC.plate, 0.75); b.rect(74, 90, 28, 3, RC.black, 0.15);
      b.rect(6, 63, 164, 1, RC.black, 0.3, { only: true });
      b.blob(88, 74, 4, 3, RC.chrome, { gloss: 1 });
      b.blob(36, 118, 4.5, 3, RC.chrome, { gloss: 1 });
    }
  }
  function van(b, P, front) {
    for (const x of [12, 136]) b.box(x, 136, 28, 30, RC.tire, { r: 6, tex: 0.12 });
    b.box(4, 14, 168, 128, P, { r: 18, gloss: 0.5, shin: 12 });
    b.box(6, 126, 164, 18, RC.black, { r: 7, gloss: 0.4 });
    if (front) {
      b.poly([[16, 70], [160, 70], [150, 26], [26, 26]], RC.glass, { I: glassI(26, 70) });
      b.poly([[50, 70], [64, 70], [80, 26], [66, 26]], RC.glass, { I: 0.92 });
      for (const x of [10, 132]) b.box(x, 92, 34, 14, RC.light, { r: 4, gloss: 1, amb: 0.75 });
      b.box(52, 94, 72, 20, RC.grill, { r: 3 });
      for (let x = 56; x < 122; x += 5) b.rect(x, 96, 2, 16, RC.chrome, 0.8);
    } else {
      for (const x of [16, 92]) b.rect(x, 28, 68, 42, RC.glass, [0.85, 0.3]);
      b.rect(86, 22, 4, 100, RC.black, 0.25, { only: true });
      for (const x of [6, 158]) b.box(x, 82, 12, 36, RC.red, { r: 3, gloss: 1, amb: 0.45 });
      b.rect(70, 108, 36, 12, RC.plate, 0.75); b.rect(74, 112, 28, 3, RC.black, 0.15);
    }
  }
  function truck(b, P, front) {
    for (const x of [14, 168]) b.box(x, 284, 50, 34, RC.tire, { r: 7, tex: 0.12 });
    if (front) {
      b.box(4, 4, 224, 130, RC.box, { r: 10, tex: 0.08 });
      b.box(14, 118, 204, 176, P, { r: 18, gloss: 0.6, shin: 12 });
      b.poly([[26, 210], [206, 210], [196, 132], [36, 132]], RC.glass, { I: glassI(132, 210) });
      b.poly([[70, 210], [88, 210], [108, 132], [90, 132]], RC.glass, { I: 0.92 });
      b.box(62, 226, 108, 44, RC.grill, { r: 4 });
      for (let x = 66; x < 168; x += 6) b.rect(x, 230, 3, 36, RC.chrome, 0.8);
      for (const x of [20, 178]) b.box(x, 232, 34, 20, RC.light, { r: 5, gloss: 1, amb: 0.75 });
      b.box(10, 276, 212, 14, RC.chrome, { r: 5, gloss: 0.8 });
    } else {
      b.box(4, 4, 224, 272, P, { r: 10, tex: 0.06, gloss: 0.15 });
      for (let x = 30; x < 220; x += 28) b.rect(x, 10, 3, 262, P, 0.22, { only: true });
      b.rect(114, 10, 4, 262, RC.black, 0.2, { only: true });
      for (const x of [96, 132]) b.cap(x, 120, x, 200, 2, 2, RC.chrome, { gloss: 0.9 });
      b.text('VẬN TẢI', 116, 50, 26, ramp('#ffffff', { sh: 0.4 }), 0.8, 'center');
      b.text('BẮC - NAM', 116, 84, 18, ramp('#ffffff', { sh: 0.4 }), 0.7, 'center');
      b.box(8, 270, 216, 14, RC.black, { r: 4 });
      for (const x of [12, 190]) b.box(x, 254, 30, 12, RC.red, { r: 3, gloss: 1, amb: 0.45 });
      b.rect(98, 258, 36, 12, RC.plate, 0.75);
    }
  }
  Spr.car = (kind, col, front) => Spr.cached('c|' + kind + '|' + col + '|' + (front ? 1 : 0), () => {
    const P = ramp(kind === 'police' ? '#f0f0f0' : col, { hl: 0.7 });
    let b;
    if (kind === 'truck') { b = new Buf(232, 320); truck(b, P, front); }
    else if (kind === 'van') { b = new Buf(176, 168); van(b, P, front); }
    else { b = new Buf(176, 140); sedan(b, P, front, kind === 'police'); }
    return b.outline(0.3).canvas(CPX);
  });
})();
