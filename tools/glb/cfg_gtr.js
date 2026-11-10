// Ford Mustang GT-R: a 2018 Mustang GT fastback (S550) with a GT-R style race kit ("Ford Mustang GT-R" by blakebella on
// Sketchfab, CC-BY-SA-4.0). The model faces -z. Real car: wheelbase 2.72 m, about 53 % of the weight on the front axle.
module.exports = {
  name: 'gtr', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/car/ford_mustang_gt-r.glb', out: 'F:/hb_tmp/cars/gtr.js',
  header: '// Ford Mustang GT-R: "Ford Mustang GT-R" by blakebella (https://sketchfab.com/3d-models/ford-mustang-gt-r-09680acc97da4d8eba10a2aa62e08312),\n' +
    '// licensed CC-BY-SA-4.0 (http://creativecommons.org/licenses/by-sa/4.0/). Changed: simplified, interior left out, parts recoloured.\n' +
    '// This file is shared under the same licence (share-alike).\n',
  frame: (x, y, z) => [-x, y, -z],
  wb: 2.72, a: 1.278, err: 0.002, errLo: 0.006, errW: 0.0025,
  // LightA: the headlamp inners at the front, cabin lights further back
  split: p => p.mat === 9 ? c => c[2] > 1.6 ? 'head' : 'drop' : null,
  mats: {
    drop: [0, 3, 4, 7, 8, 11, 12, 13],
    black: [1, 2, 24, 26], grille: [5, 6, 15, 22, 23], paint: [10], glass: [14], trim: [17], lug: [18], carbon: [19],
    exhaust: [20, 21], white: [25], tail: [27], rim: [28], disc: [29], alu: [30, 32], rimAccent: [31], tyre: [33], head: [34],
    caliper: [16],
  },
  wheel: ['tyre', 'rim', 'disc', 'caliper', 'lug'],
  colors: { rim: '#2a2c30', caliper: '#c01818', rimAccent: '#c01818' },
  // exhaust tips [x, y, radius, z] (probe of the rear)
  head: null, tail: null, exh: [[0.055, 0.425, 0.045, -2.52], [-0.055, 0.425, 0.045, -2.52]],
};
