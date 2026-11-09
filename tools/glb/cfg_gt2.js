// Porsche 911 GT2 (993) ("1995 Porsche 911 GT2 (993)" by Ddiaz Design on Sketchfab, CC-BY-NC-SA-4.0).
// Real car: wheelbase 2.272 m, rear engine - about 38 % of the weight on the front axle.
module.exports = {
  name: 'gt2', glb: 'C:/Users/Administrator/Desktop/New folder/road rash/car/1995_porsche_911_gt2_993.glb', out: 'F:/hb_tmp/cars/gt2.js',
  header: '// Porsche 911 GT2 (993): "1995 Porsche 911 GT2 (993)" by Ddiaz Design (https://sketchfab.com/3d-models/1995-porsche-911-gt2-993-2b3843db0f784ab0a8702f6361d16d2a),\n' +
    '// licensed CC-BY-NC-SA-4.0 (http://creativecommons.org/licenses/by-nc-sa/4.0/). Changed: simplified, interior left out, parts recoloured.\n' +
    '// This file is shared under the same licence (non-commercial, share-alike).\n',
  wb: 2.272, a: 1.409, err: 0.002, errLo: 0.006, errW: 0.002,
  mats: {
    drop: [0, 7, 10, 13, 16, 21, 22, 23],
    glass: [1], amberLamp: [2], tail: [3], grille: [4, 8, 9, 14, 15, 18, 19, 20], lamp: [5], carbon: [6], paint: [11], trim: [12], black: [17],
    wheel: [24], calDark: [25, 26], caliper: [27],
  },
  wheel: ['wheel', 'calDark', 'caliper'],
  colors: { rim: '#b8bcc4', caliper: '#c41616' },
  // exhaust tips [x, y, radius, z] (probe of the rear)
  head: null, tail: null, exh: [[0.1, 0.24, 0.04, -1.81], [-0.1, 0.24, 0.04, -1.81]],
};
