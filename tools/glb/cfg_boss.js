// Ford Mustang Boss 302 (1970) ("1970 Ford Mustang Boss 302" by Ddiaz Design on Sketchfab, CC-BY-NC-SA-4.0): Grabber
// Blue with the black Boss stripes. The stripes and the chrome / black trim are painted in the textures: tex.html
// ?dump=10,18,20 writes each triangle's texture colour to boss_tri.json, and the split below sorts them by it.
// Real car: wheelbase 108 in (2.743 m), V8, about 56 % of the weight on the front axle.
const sum = c => c[0] + c[1] + c[2];
module.exports = {
  name: 'boss', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/car/1970_ford_mustang_boss_302.glb', out: 'F:/hb_tmp/cars/boss.js',
  header: '// Ford Mustang Boss 302: "1970 Ford Mustang Boss 302" by Ddiaz Design (https://sketchfab.com/3d-models/1970-ford-mustang-boss-302-eb06dfca70564466b1d98441976de3c6),\n' +
    '// licensed CC-BY-NC-SA-4.0 (http://creativecommons.org/licenses/by-nc-sa/4.0/). Changed: simplified, interior left out, parts recoloured.\n' +
    '// This file is shared under the same licence (non-commercial, share-alike).\n',
  triColors: 'F:/hb_tmp/cars/boss_tri.json',
  wb: 2.743, a: 1.207, err: 0.0015, errLo: 0.006, errW: 0.0025, rimK: 0.7,
  split: p => p.id === 10 ? (c, rgb) => rgb && sum(rgb) > 330 ? 'alu' : 'black'
    : p.id === 20 ? (c, rgb) => rgb && sum(rgb) < 150 ? 'black' : 'paint' : null,
  byName: p => p.id === 21 || p.id === 23 ? 'drop' : null,   // (seat belts share the trim material, the inner window the glass)
  mats: {
    caliper: [0], calDark: [1], wheel: [2], drop: [3, 6, 11, 12, 16], under: [4], grille: [7, 8, 9, 10], lamp: [13, 18],
    white: [14], paint: [15], glass: [17], amber: [19], tail: [20],
  },
  wheel: ['wheel', 'caliper', 'calDark'],
  colors: { rim: '#c4c8ce', caliper: '#3a3d44' },
  // exhaust tips [x, y, radius, z] (probe of the rear)
  head: null, tail: null, exh: [[0.5, 0.29, 0.04, -2.36], [-0.5, 0.29, 0.04, -2.36]],
};
